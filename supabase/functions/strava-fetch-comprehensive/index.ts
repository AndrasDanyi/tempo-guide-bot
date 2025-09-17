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

    console.log('Starting comprehensive Strava data fetch...');

    // Fetch 10 most recent activities
    const activitiesResponse = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=10', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!activitiesResponse.ok) {
      throw new Error(`Strava API error: ${activitiesResponse.status} ${activitiesResponse.statusText}`);
    }

    const activities = await activitiesResponse.json();
    console.log(`Found ${activities.length} activities`);

    // Store activities in database
    if (activities && activities.length > 0) {
      console.log('Storing activities in database...');
      
      const activitiesToInsert = activities.map((activity: any) => ({
        user_id: user.id,
        strava_activity_id: activity.id,
        name: activity.name,
        activity_type: activity.type,
        start_date: activity.start_date,
        // Basic Metrics
        distance: activity.distance,
        moving_time: activity.moving_time,
        elapsed_time: activity.elapsed_time,
        average_speed: activity.average_speed,
        max_speed: activity.max_speed,
        // Elevation
        total_elevation_gain: activity.total_elevation_gain,
        elev_high: activity.elev_high,
        elev_low: activity.elev_low,
        // Heart Rate
        average_heartrate: activity.average_heartrate,
        max_heartrate: activity.max_heartrate,
        // Power (for cycling)
        average_watts: activity.average_watts,
        max_watts: activity.max_watts,
        weighted_average_watts: activity.weighted_average_watts,
        kilojoules: activity.kilojoules,
        // Cadence (for cycling)
        average_cadence: activity.average_cadence,
        // Location
        start_latlng: activity.start_latlng,
        end_latlng: activity.end_latlng,
        map_summary_polyline: activity.map?.summary_polyline,
        // Additional metrics
        suffer_score: activity.suffer_score,
        kudos_count: activity.kudos_count,
        achievement_count: activity.achievement_count
      }));

      // Upsert activities
      const { error: insertError } = await supabase
        .from('strava_activities')
        .upsert(activitiesToInsert, { 
          onConflict: 'strava_activity_id',
          ignoreDuplicates: true 
        });

      if (insertError) {
        console.error('Error storing activities:', insertError);
      } else {
        console.log('Successfully stored activities');
      }

      // Get the stored activity IDs for foreign key relationships
      const { data: storedActivities } = await supabase
        .from('strava_activities')
        .select('id, strava_activity_id')
        .eq('user_id', user.id)
        .in('strava_activity_id', activities.map((a: any) => a.id));

      const activityIdMap = new Map();
      storedActivities?.forEach(activity => {
        activityIdMap.set(activity.strava_activity_id, activity.id);
      });

      // Fetch detailed data for each activity
      for (const activity of activities) {
        const activityId = activityIdMap.get(activity.id);
        if (!activityId) continue;

        console.log(`Fetching detailed data for activity: ${activity.name}`);

        try {
          // 1. Fetch Activity Splits
          const splitsResponse = await fetch(`https://www.strava.com/api/v3/activities/${activity.id}/splits`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });

          if (splitsResponse.ok) {
            const splits = await splitsResponse.json();
            console.log(`Found ${splits.length} splits for activity ${activity.id}`);

            if (splits.length > 0) {
              const splitsToInsert = splits.map((split: any, index: number) => ({
                user_id: user.id,
                activity_id: activityId,
                strava_activity_id: activity.id,
                split_number: index + 1,
                distance: split.distance,
                elapsed_time: split.elapsed_time,
                moving_time: split.moving_time,
                elevation_difference: split.elevation_difference,
                average_speed: split.average_speed,
                average_grade: split.average_grade
              }));

              const { error: splitsError } = await supabase
                .from('strava_activity_splits')
                .upsert(splitsToInsert, { 
                  onConflict: 'strava_activity_id,split_number',
                  ignoreDuplicates: true 
                });

              if (splitsError) {
                console.error('Error storing splits:', splitsError);
              } else {
                console.log(`Stored ${splits.length} splits`);
              }
            }
          }

          // 2. Fetch Activity Laps
          const lapsResponse = await fetch(`https://www.strava.com/api/v3/activities/${activity.id}/laps`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });

          if (lapsResponse.ok) {
            const laps = await lapsResponse.json();
            console.log(`Found ${laps.length} laps for activity ${activity.id}`);

            if (laps.length > 0) {
              const lapsToInsert = laps.map((lap: any, index: number) => ({
                user_id: user.id,
                activity_id: activityId,
                strava_activity_id: activity.id,
                lap_number: index + 1,
                distance: lap.distance,
                elapsed_time: lap.elapsed_time,
                moving_time: lap.moving_time,
                average_speed: lap.average_speed,
                max_speed: lap.max_speed,
                average_heartrate: lap.average_heartrate,
                max_heartrate: lap.max_heartrate,
                average_cadence: lap.average_cadence,
                average_watts: lap.average_watts
              }));

              const { error: lapsError } = await supabase
                .from('strava_activity_laps')
                .upsert(lapsToInsert, { 
                  onConflict: 'strava_activity_id,lap_number',
                  ignoreDuplicates: true 
                });

              if (lapsError) {
                console.error('Error storing laps:', lapsError);
              } else {
                console.log(`Stored ${laps.length} laps`);
              }
            }
          }

          // 3. Fetch Segment Efforts
          const segmentEffortsResponse = await fetch(`https://www.strava.com/api/v3/activities/${activity.id}/segment_efforts`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });

          if (segmentEffortsResponse.ok) {
            const segmentEfforts = await segmentEffortsResponse.json();
            console.log(`Found ${segmentEfforts.length} segment efforts for activity ${activity.id}`);

            if (segmentEfforts.length > 0) {
              const segmentEffortsToInsert = segmentEfforts.map((effort: any) => ({
                user_id: user.id,
                activity_id: activityId,
                strava_effort_id: effort.id,
                strava_segment_id: effort.segment.id,
                segment_name: effort.segment.name,
                distance: effort.distance,
                elapsed_time: effort.elapsed_time,
                moving_time: effort.moving_time,
                start_date: effort.start_date,
                pr_rank: effort.pr_rank,
                achievement_rank: effort.achievement_rank,
                kom_rank: effort.kom_rank,
                average_watts: effort.average_watts,
                average_heartrate: effort.average_heartrate,
                max_heartrate: effort.max_heartrate
              }));

              const { error: segmentEffortsError } = await supabase
                .from('strava_segment_efforts')
                .upsert(segmentEffortsToInsert, { 
                  onConflict: 'strava_effort_id',
                  ignoreDuplicates: true 
                });

              if (segmentEffortsError) {
                console.error('Error storing segment efforts:', segmentEffortsError);
              } else {
                console.log(`Stored ${segmentEfforts.length} segment efforts`);
              }
            }
          }

          // 4. Store gear information if available
          if (activity.gear_id) {
            // First, get or create gear record
            const { data: existingGear } = await supabase
              .from('strava_gear')
              .select('id')
              .eq('strava_gear_id', activity.gear_id)
              .eq('user_id', user.id)
              .single();

            let gearId = existingGear?.id;

            if (!gearId) {
              // Fetch gear details from Strava
              const gearResponse = await fetch(`https://www.strava.com/api/v3/gear/${activity.gear_id}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
              });

              if (gearResponse.ok) {
                const gear = await gearResponse.json();
                
                const { data: newGear, error: gearError } = await supabase
                  .from('strava_gear')
                  .insert({
                    user_id: user.id,
                    strava_gear_id: gear.id,
                    name: gear.name,
                    gear_type: gear.resource_state === 3 ? 'bike' : 'shoes', // bikes have more detailed info
                    brand_name: gear.brand_name,
                    model_name: gear.model_name,
                    frame_type: gear.frame_type,
                    description: gear.description,
                    distance: gear.distance
                  })
                  .select('id')
                  .single();

                if (gearError) {
                  console.error('Error storing gear:', gearError);
                } else {
                  gearId = newGear.id;
                  console.log(`Stored gear: ${gear.name}`);
                }
              }
            }

            // Link gear to activity
            if (gearId) {
              const { error: activityGearError } = await supabase
                .from('strava_activity_gear')
                .upsert({
                  user_id: user.id,
                  activity_id: activityId,
                  strava_activity_id: activity.id,
                  gear_id: gearId,
                  strava_gear_id: activity.gear_id
                }, { 
                  onConflict: 'strava_activity_id,strava_gear_id',
                  ignoreDuplicates: true 
                });

              if (activityGearError) {
                console.error('Error linking gear to activity:', activityGearError);
              }
            }
          }

        } catch (error) {
          console.error(`Error fetching detailed data for activity ${activity.id}:`, error);
          // Continue with other activities even if one fails
        }
      }
    }

    // 5. Fetch Athlete Stats
    console.log('Fetching athlete stats...');
    const athleteStatsResponse = await fetch('https://www.strava.com/api/v3/athletes/me/stats', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (athleteStatsResponse.ok) {
      const athleteStats = await athleteStatsResponse.json();
      console.log('Found athlete stats');

      // Store comprehensive athlete stats
      const statsToInsert = [
        {
          user_id: user.id,
          period_type: 'recent',
          biggest_ride_distance: athleteStats.biggest_ride_distance,
          biggest_climb_elevation_gain: athleteStats.biggest_climb_elevation_gain,
          recent_ride_totals: athleteStats.recent_ride_totals,
          recent_run_totals: athleteStats.recent_run_totals,
          recent_swim_totals: athleteStats.recent_swim_totals,
          ytd_ride_totals: athleteStats.ytd_ride_totals,
          ytd_run_totals: athleteStats.ytd_run_totals,
          ytd_swim_totals: athleteStats.ytd_swim_totals,
          all_ride_totals: athleteStats.all_ride_totals,
          all_run_totals: athleteStats.all_run_totals,
          all_swim_totals: athleteStats.all_swim_totals
        }
      ];

      const { error: statsError } = await supabase
        .from('strava_athlete_stats')
        .upsert(statsToInsert, { 
          onConflict: 'user_id,period_type',
          ignoreDuplicates: true 
        });

      if (statsError) {
        console.error('Error storing athlete stats:', statsError);
      } else {
        console.log('Stored athlete stats');
      }
    }

    console.log('Comprehensive Strava data fetch completed');

    return new Response(JSON.stringify({ 
      success: true,
      activities: activities,
      activitiesCount: activities ? activities.length : 0,
      message: 'Comprehensive Strava data fetched and stored successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in strava-fetch-comprehensive function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
