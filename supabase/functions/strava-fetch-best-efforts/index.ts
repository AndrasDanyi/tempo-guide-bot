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

    // Fetch all-time personal records from Strava
    console.log('Fetching all-time activities for best efforts...');
    
    const allBestEfforts = [];
    let page = 1;
    const maxPages = 5; // Fetch up to 500 activities (5 pages * 100 per page)
    let totalActivitiesProcessed = 0;
    let activitiesWithBestEfforts = 0;
    
    while (page <= maxPages) {
      console.log(`Fetching activities page ${page}...`);
      
      const activitiesResponse = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=100&page=${page}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!activitiesResponse.ok) {
        console.error(`Error fetching activities page ${page}:`, activitiesResponse.status);
        break;
      }

      const activities = await activitiesResponse.json();
      console.log(`Page ${page}: Found ${activities.length} activities`);

      if (activities.length === 0) {
        // No more activities
        break;
      }

      totalActivitiesProcessed += activities.length;

      // Extract best efforts from this page of activities
      for (const activity of activities) {
        console.log(`Processing activity: ${activity.name} (ID: ${activity.id})`);
        console.log(`Activity has best_efforts: ${!!activity.best_efforts}, count: ${activity.best_efforts?.length || 0}`);
        
        if (activity.best_efforts && activity.best_efforts.length > 0) {
          activitiesWithBestEfforts++;
          console.log(`Activity ${activity.name} has ${activity.best_efforts.length} best efforts`);
          
          for (const effort of activity.best_efforts) {
            console.log(`Best effort: ${effort.name}, pr_rank: ${effort.pr_rank}, achievement_rank: ${effort.achievement_rank}`);
            
            // Include all best efforts, not just PRs - we'll filter later
            allBestEfforts.push({
              strava_effort_id: effort.id,
              activity_id: activity.id,
              name: effort.name,
              distance: effort.distance,
              elapsed_time: effort.elapsed_time,
              moving_time: effort.moving_time,
              start_date: effort.start_date,
              achievement_rank: effort.achievement_rank,
              pr_rank: effort.pr_rank
            });
          }
        }
      }

      page++;
    }

    console.log(`Total activities processed: ${totalActivitiesProcessed}`);
    console.log(`Activities with best efforts: ${activitiesWithBestEfforts}`);
    console.log(`Total best efforts found: ${allBestEfforts.length}`);

    // If we found best efforts, let's also try to get some from the athlete stats
    if (allBestEfforts.length === 0) {
      console.log('No best efforts found in activities, trying athlete stats...');
      
      try {
        const statsResponse = await fetch('https://www.strava.com/api/v3/athletes/me/stats', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (statsResponse.ok) {
          const stats = await statsResponse.json();
          console.log('Athlete stats:', JSON.stringify(stats, null, 2));
          
          // Create some basic best efforts from stats if available
          if (stats.biggest_ride_distance) {
            allBestEfforts.push({
              strava_effort_id: `stats-ride-${Date.now()}`,
              activity_id: null,
              name: 'Longest Ride',
              distance: stats.biggest_ride_distance,
              elapsed_time: null,
              moving_time: null,
              start_date: new Date().toISOString(),
              achievement_rank: null,
              pr_rank: 1
            });
          }
        }
      } catch (error) {
        console.error('Error fetching athlete stats:', error);
      }
    }

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
