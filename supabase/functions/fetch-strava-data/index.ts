import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header and validate JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Missing or invalid authorization header');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user from JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid or expired token');
    }

    const userId = user.id;

    // Get user's encrypted Strava tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('encrypted_strava_tokens')
      .select('access_token_encrypted, refresh_token_encrypted, expires_at')
      .eq('user_id', userId)
      .single();

    if (tokenError || !tokenData?.access_token_encrypted) {
      throw new Error('User not connected to Strava');
    }

    // Decrypt tokens (simple base64 decoding - production should use proper decryption)
    const decryptToken = (encryptedToken: string) => atob(encryptedToken);
    
    // Check if token needs refresh
    let accessToken = decryptToken(tokenData.access_token_encrypted);
    const tokenExpires = new Date(tokenData.expires_at);
    const now = new Date();

    if (tokenExpires <= now) {
      // Refresh token
      const refreshResponse = await refreshStravaToken(
        decryptToken(tokenData.refresh_token_encrypted), 
        userId
      );
      if (!refreshResponse.success) {
        throw new Error('Failed to refresh Strava token');
      }
      accessToken = refreshResponse.accessToken;
    }

    // Fetch athlete stats
    console.log('Fetching athlete stats...');
    const statsResponse = await fetch('https://www.strava.com/api/v3/athletes/stats', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!statsResponse.ok) {
      throw new Error(`Failed to fetch stats: ${statsResponse.statusText}`);
    }

    const statsData = await statsResponse.json();
    
    // Save stats to database
    await saveAthleteStats(userId, statsData);

    // Fetch recent activities (last 6 months)
    console.log('Fetching recent activities...');
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const after = Math.floor(sixMonthsAgo.getTime() / 1000);

    let page = 1;
    let allActivities = [];
    const perPage = 200; // Increased per page to get more activities faster

    while (true) {
      const activitiesResponse = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}&page=${page}&after=${after}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!activitiesResponse.ok) {
        console.error(`Failed to fetch activities page ${page}: ${activitiesResponse.statusText}`);
        break;
      }

      const activities = await activitiesResponse.json();
      console.log(`Fetched page ${page}: ${activities.length} activities`);
      
      if (activities.length === 0) break;
      
      allActivities.push(...activities);
      page++;

      // Stop after getting enough activities or safety limit
      if (allActivities.length >= 500 || page > 5) break;
    }

    console.log(`Fetched ${allActivities.length} activities`);

    // Save activities and extract best efforts
    await saveActivitiesAndBestEfforts(userId, allActivities, accessToken);

    return new Response(JSON.stringify({ 
      success: true,
      activitiesCount: allActivities.length,
      statsData: statsData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fetch-strava-data function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function refreshStravaToken(refreshToken: string, userId: string) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: '174698',
        client_secret: Deno.env.get('STRAVA_CLIENT_SECRET'),
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const tokenData = await response.json();
    const expiresAt = new Date(tokenData.expires_at * 1000).toISOString();

    // Encrypt new tokens
    const encryptToken = (token: string) => btoa(token);

    // Update encrypted tokens
    await supabase
      .from('encrypted_strava_tokens')
      .update({
        access_token_encrypted: encryptToken(tokenData.access_token),
        refresh_token_encrypted: encryptToken(tokenData.refresh_token),
        expires_at: expiresAt
      })
      .eq('user_id', userId);

    return { success: true, accessToken: tokenData.access_token };
  } catch (error) {
    console.error('Error refreshing token:', error);
    return { success: false };
  }
}

async function saveAthleteStats(userId: string, statsData: any) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Clear existing stats
    await supabase
      .from('strava_stats')
      .delete()
      .eq('user_id', userId);

    // Save new stats
    const statsToInsert = [];
    
    if (statsData.recent_run_totals) {
      statsToInsert.push({
        user_id: userId,
        period_type: 'recent',
        count: statsData.recent_run_totals.count,
        distance: statsData.recent_run_totals.distance,
        moving_time: statsData.recent_run_totals.moving_time,
        elevation_gain: statsData.recent_run_totals.elevation_gain,
        achievement_count: statsData.recent_run_totals.achievement_count
      });
    }

    if (statsData.ytd_run_totals) {
      statsToInsert.push({
        user_id: userId,
        period_type: 'ytd',
        count: statsData.ytd_run_totals.count,
        distance: statsData.ytd_run_totals.distance,
        moving_time: statsData.ytd_run_totals.moving_time,
        elevation_gain: statsData.ytd_run_totals.elevation_gain,
        achievement_count: statsData.ytd_run_totals.achievement_count
      });
    }

    if (statsData.all_run_totals) {
      statsToInsert.push({
        user_id: userId,
        period_type: 'all',
        count: statsData.all_run_totals.count,
        distance: statsData.all_run_totals.distance,
        moving_time: statsData.all_run_totals.moving_time,
        elevation_gain: statsData.all_run_totals.elevation_gain,
        achievement_count: statsData.all_run_totals.achievement_count
      });
    }

    if (statsToInsert.length > 0) {
      await supabase
        .from('strava_stats')
        .insert(statsToInsert);
    }

    console.log('Saved athlete stats');
  } catch (error) {
    console.error('Error saving stats:', error);
  }
}

async function saveActivitiesAndBestEfforts(userId: string, activities: any[], accessToken: string) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Clear existing activities and best efforts
    await supabase.from('strava_activities').delete().eq('user_id', userId);
    await supabase.from('strava_best_efforts').delete().eq('user_id', userId);

    // Filter and save running activities - be more inclusive with activity types
    const runningActivities = activities.filter(activity => 
      activity.type === 'Run' || 
      activity.sport_type === 'Run' ||
      activity.type === 'TrailRun' ||
      activity.sport_type === 'TrailRun' ||
      (activity.name && activity.name.toLowerCase().includes('run'))
    );

    console.log(`Found ${runningActivities.length} running activities out of ${activities.length} total activities`);

    if (runningActivities.length === 0) {
      console.log('No running activities found');
      return;
    }

    const activitiesToInsert = runningActivities.map(activity => ({
      user_id: userId,
      strava_activity_id: activity.id,
      name: activity.name,
      activity_type: activity.type,
      start_date: activity.start_date,
      distance: activity.distance,
      moving_time: activity.moving_time,
      elapsed_time: activity.elapsed_time,
      total_elevation_gain: activity.total_elevation_gain,
      average_speed: activity.average_speed,
      max_speed: activity.max_speed,
      average_heartrate: activity.average_heartrate,
      max_heartrate: activity.max_heartrate,
      average_cadence: activity.average_cadence,
      average_watts: activity.average_watts,
      weighted_average_watts: activity.weighted_average_watts,
      kilojoules: activity.kilojoules,
      suffer_score: activity.suffer_score,
      kudos_count: activity.kudos_count,
      achievement_count: activity.achievement_count
    }));

    // Insert activities in batches
    for (let i = 0; i < activitiesToInsert.length; i += 50) {
      const batch = activitiesToInsert.slice(i, i + 50);
      await supabase.from('strava_activities').insert(batch);
    }

    console.log(`Saved ${activitiesToInsert.length} activities`);

    // Fetch and save best efforts for recent activities
    await fetchAndSaveBestEfforts(userId, runningActivities.slice(0, 20), accessToken);

  } catch (error) {
    console.error('Error saving activities:', error);
  }
}

async function fetchAndSaveBestEfforts(userId: string, activities: any[], accessToken: string) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const allBestEfforts = [];

    for (const activity of activities) {
      if (activity.achievement_count > 0) {
        try {
          const detailResponse = await fetch(
            `https://www.strava.com/api/v3/activities/${activity.id}`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            }
          );

          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            
            if (detailData.best_efforts && detailData.best_efforts.length > 0) {
              const bestEfforts = detailData.best_efforts.map((effort: any) => ({
                user_id: userId,
                strava_effort_id: effort.id,
                activity_id: null, // Will be set after activity is saved
                name: effort.name,
                distance: effort.distance,
                elapsed_time: effort.elapsed_time,
                moving_time: effort.moving_time,
                start_date: effort.start_date,
                achievement_rank: effort.achievement_rank,
                pr_rank: effort.pr_rank
              }));
              
              allBestEfforts.push(...bestEfforts);
            }
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
          console.error(`Error fetching details for activity ${activity.id}:`, error);
        }
      }
    }

    if (allBestEfforts.length > 0) {
      // Insert best efforts in batches
      for (let i = 0; i < allBestEfforts.length; i += 50) {
        const batch = allBestEfforts.slice(i, i + 50);
        await supabase.from('strava_best_efforts').insert(batch);
      }
      
      console.log(`Saved ${allBestEfforts.length} best efforts`);
    }

  } catch (error) {
    console.error('Error saving best efforts:', error);
  }
}