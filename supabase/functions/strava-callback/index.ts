import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const stravaClientId = '174698';
const stravaClientSecret = Deno.env.get('STRAVA_CLIENT_SECRET')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      const redirectUrl = state?.split(':')[1] || '/';
      return Response.redirect(`${redirectUrl}?error=access_denied`, 302);
    }

    if (!code || !state) {
      throw new Error('Missing code or state parameter');
    }

    const [userId, redirectUrl] = state.split(':');
    
    // Exchange code for access token
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: stravaClientId,
        client_secret: stravaClientSecret,
        code: code,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const tokenData = await tokenResponse.json();
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: `Bearer ${supabaseAnonKey}` }
      }
    });

    // Update profile with Strava connection info
    const expiresAt = new Date(tokenData.expires_at * 1000).toISOString();
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        strava_connected: true,
        strava_athlete_id: tokenData.athlete.id.toString(),
        strava_access_token: tokenData.access_token,
        strava_refresh_token: tokenData.refresh_token,
        strava_token_expires_at: expiresAt,
        strava_connected_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      throw new Error('Failed to save Strava connection');
    }

    console.log('Strava connection successful for user:', userId);

    // Trigger data fetch in background
    fetch(`${supabaseUrl}/functions/v1/fetch-strava-data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    }).catch(error => {
      console.error('Background data fetch failed:', error);
    });

    // Redirect back to the application
    const finalRedirectUrl = redirectUrl || '/';
    return Response.redirect(`${finalRedirectUrl}?strava=connected`, 302);

  } catch (error) {
    console.error('Error in strava-callback function:', error);
    return Response.redirect('/?error=strava_connection_failed', 302);
  }
});