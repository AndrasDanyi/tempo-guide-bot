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

    // Store activities in database
    if (activities && activities.length > 0) {
      console.log('Storing activities in database:', activities.length);
      
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

      // Upsert activities (insert or update if exists)
      const { error: insertError } = await supabase
        .from('strava_activities')
        .upsert(activitiesToInsert, { 
          onConflict: 'strava_activity_id',
          ignoreDuplicates: true 
        });

      if (insertError) {
        console.error('Error storing activities:', insertError);
      } else {
        console.log('Successfully stored activities in database');
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      activities: activities,
      activitiesCount: activities ? activities.length : 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in strava-fetch-clean function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
