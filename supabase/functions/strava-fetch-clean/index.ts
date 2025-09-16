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

    // Store activities in database (commented out until schema is fixed)
    // if (activities && activities.length > 0) {
    //   const activitiesToInsert = activities.map((activity: any) => ({
    //     user_id: user.id,
    //     activity_id: activity.id,
    //     name: activity.name,
    //     distance: activity.distance,
    //     moving_time: activity.moving_time,
    //     elapsed_time: activity.elapsed_time,
    //     total_elevation_gain: activity.total_elevation_gain,
    //     type: activity.type,
    //     start_date: activity.start_date,
    //     average_speed: activity.average_speed,
    //     max_speed: activity.max_speed,
    //     average_heartrate: activity.average_heartrate,
    //     max_heartrate: activity.max_heartrate,
    //     average_cadence: activity.average_cadence,
    //     calories: activity.calories,
    //     description: activity.description
    //   }));

    //   // Upsert activities (insert or update if exists)
    //   const { error: insertError } = await supabase
    //     .from('strava_activities')
    //     .upsert(activitiesToInsert, { 
    //       onConflict: 'user_id,activity_id',
    //       ignoreDuplicates: false 
    //     });

    //   if (insertError) {
    //     console.error('Error storing activities:', insertError);
    //   }
    // }

    return new Response(JSON.stringify({ 
      success: true,
      activities: activities,
      count: activities ? activities.length : 0
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
