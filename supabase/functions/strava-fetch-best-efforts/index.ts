import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = 'https://otwcyimspsqxmbwzlmjo.supabase.co';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Missing or invalid authorization header');
    }

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    
    // Get user from JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid or expired token');
    }

    // Get user's Strava tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('encrypted_strava_tokens')
      .select('access_token_encrypted, refresh_token_encrypted, expires_at')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      throw new Error('No Strava connection found. Please connect to Strava first.');
    }

    // Simple base64 decoding
    const decryptToken = (encryptedToken: string) => atob(encryptedToken);
    let accessToken = decryptToken(tokenData.access_token_encrypted);

    // Check if token is expired and refresh if needed
    const now = new Date();
    const expiresAt = new Date(tokenData.expires_at);
    
    if (now >= expiresAt) {
      console.log('Token expired, refreshing...');
      
      const refreshResponse = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: '174698',
          client_secret: Deno.env.get('STRAVA_CLIENT_SECRET'),
          refresh_token: decryptToken(tokenData.refresh_token_encrypted),
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshResponse.ok) {
        throw new Error('Failed to refresh Strava token');
      }

      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;

      // Update tokens in database
      const { error: updateError } = await supabase
        .from('encrypted_strava_tokens')
        .update({
          access_token_encrypted: btoa(refreshData.access_token),
          refresh_token_encrypted: btoa(refreshData.refresh_token),
          expires_at: new Date(refreshData.expires_at * 1000).toISOString()
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error updating refreshed tokens:', updateError);
      }
    }

    // Fetch recent activities and calculate best efforts for common distances
    console.log('Fetching recent activities to calculate best efforts...');
    
    const allBestEfforts = [];
    
    try {
      const activitiesResponse = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=10', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!activitiesResponse.ok) {
        throw new Error(`Strava API error: ${activitiesResponse.status} ${activitiesResponse.statusText}`);
      }

      const activities = await activitiesResponse.json();
      console.log(`Found ${activities.length} recent activities`);

      // Filter for running activities only
      const runningActivities = activities.filter(activity => 
        activity.type === 'Run' && 
        activity.distance && 
        activity.moving_time && 
        activity.distance > 0 && 
        activity.moving_time > 0
      );

      console.log(`Found ${runningActivities.length} running activities with valid data`);

      // Calculate best efforts for common distances
      const targetDistances = [
        { name: '1K', distance: 1000 },
        { name: '5K', distance: 5000 },
        { name: '10K', distance: 10000 },
        { name: 'Half Marathon', distance: 21097.5 },
        { name: 'Marathon', distance: 42195 }
      ];

      // Initialize best times for each distance
      const bestTimes = {};
      const bestActivities = {};
      
      for (const target of targetDistances) {
        bestTimes[target.name] = null;
        bestActivities[target.name] = null;
      }

      console.log(`Analyzing ${runningActivities.length} running activities for best efforts...`);

      // Analyze each activity for best segments
      for (const activity of runningActivities) {
        const activityDistance = activity.distance; // in meters
        const activityTime = activity.moving_time; // in seconds
        const activityPace = activityTime / activityDistance; // seconds per meter

        console.log(`Analyzing activity: ${activity.name} - ${activityDistance}m in ${Math.floor(activityTime / 60)}:${(activityTime % 60).toString().padStart(2, '0')}`);

        // For each target distance, check if this activity can provide a better time
        for (const target of targetDistances) {
          // Only consider activities that are at least as long as the target distance
          if (activityDistance >= target.distance) {
            // Calculate the best possible time for this distance based on the activity's pace
            // We'll use the activity's overall pace as a conservative estimate
            const estimatedTime = Math.round(activityPace * target.distance);
            
            console.log(`  ${target.name}: Estimated ${Math.floor(estimatedTime / 60)}:${(estimatedTime % 60).toString().padStart(2, '0')} (pace: ${(activityPace * 1000).toFixed(2)}s/1000m)`);
            
            // Update best time if this is better
            if (!bestTimes[target.name] || estimatedTime < bestTimes[target.name]) {
              bestTimes[target.name] = estimatedTime;
              bestActivities[target.name] = activity;
              console.log(`  New best ${target.name}: ${Math.floor(estimatedTime / 60)}:${(estimatedTime % 60).toString().padStart(2, '0')} from ${activity.name}`);
            }
          }
        }
      }

      // Add the best efforts to the results
      for (const target of targetDistances) {
        if (bestTimes[target.name] && bestActivities[target.name]) {
          allBestEfforts.push({
            id: `calculated-${target.name.toLowerCase().replace(' ', '-')}-${Date.now()}`,
            strava_effort_id: `calculated-${target.name.toLowerCase().replace(' ', '-')}-${Date.now()}`,
            activity_id: bestActivities[target.name].id,
            name: target.name,
            distance: target.distance,
            elapsed_time: bestTimes[target.name],
            moving_time: bestTimes[target.name],
            start_date: bestActivities[target.name].start_date,
            achievement_rank: null,
            pr_rank: 1
          });
          console.log(`Final best ${target.name}: ${Math.floor(bestTimes[target.name] / 60)}:${(bestTimes[target.name] % 60).toString().padStart(2, '0')} from activity ${bestActivities[target.name].name}`);
        } else {
          console.log(`No ${target.name} effort found in recent activities`);
        }
      }

    } catch (error) {
      console.error('Error fetching activities for best efforts calculation:', error);
    }

    console.log(`Total calculated best efforts: ${allBestEfforts.length}`);

    // Store best efforts in database
    if (allBestEfforts.length > 0) {
      console.log('Storing best efforts in database:', allBestEfforts.length);
      
      const { error: insertError } = await supabase
        .from('strava_best_efforts')
        .upsert(
          allBestEfforts.map(effort => ({
            user_id: user.id,
            strava_effort_id: effort.strava_effort_id,
            name: effort.name,
            distance: effort.distance,
            elapsed_time: effort.elapsed_time,
            moving_time: effort.moving_time,
            start_date: effort.start_date,
            achievement_rank: effort.achievement_rank,
            pr_rank: effort.pr_rank
          })),
          { 
            onConflict: 'strava_effort_id',
            ignoreDuplicates: false
          }
        );

      if (insertError) {
        console.error('Error storing best efforts:', insertError);
      } else {
        console.log('Successfully stored best efforts');
      }
    }

    // Return the best efforts
    return new Response(JSON.stringify({ 
      success: true,
      bestEfforts: allBestEfforts,
      bestEffortsCount: allBestEfforts.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in strava-fetch-best-efforts function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
