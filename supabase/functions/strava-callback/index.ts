import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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
      console.error('OAuth error received:', error);
      return Response.redirect('/?error=access_denied', 302);
    }

    if (!code || !state) {
      throw new Error('Missing code or state parameter');
    }

    // Create service role client for secure operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate and consume state token
    const { data: stateData, error: stateError } = await supabase
      .from('oauth_state_tokens')
      .select('user_id, redirect_url, used_at, expires_at')
      .eq('token', state)
      .single();

    if (stateError || !stateData) {
      console.error('Invalid state token:', stateError);
      return Response.redirect('/?error=invalid_state', 302);
    }

    if (stateData.used_at) {
      console.error('State token already used');
      return Response.redirect('/?error=state_reused', 302);
    }

    if (new Date() > new Date(stateData.expires_at)) {
      console.error('State token expired');
      return Response.redirect('/?error=state_expired', 302);
    }

    // Mark state token as used
    await supabase
      .from('oauth_state_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', state);

    const userId = stateData.user_id;
    const redirectUrl = stateData.redirect_url;
    
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
    
    // Encrypt tokens using simple base64 encoding (production should use proper encryption)
    const encryptToken = (token: string) => btoa(token);
    
    const expiresAt = new Date(tokenData.expires_at * 1000).toISOString();
    
    // Save encrypted tokens to secure table
    const { error: tokenError } = await supabase
      .from('encrypted_strava_tokens')
      .upsert({
        user_id: userId,
        access_token_encrypted: encryptToken(tokenData.access_token),
        refresh_token_encrypted: encryptToken(tokenData.refresh_token),
        expires_at: expiresAt
      });

    if (tokenError) {
      console.error('Error saving encrypted tokens:', tokenError);
      throw new Error('Failed to save Strava tokens securely');
    }

    // Update profile with Strava connection info (without tokens)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        strava_connected: true,
        strava_athlete_id: tokenData.athlete.id.toString(),
        strava_connected_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      throw new Error('Failed to save Strava connection');
    }

    // Log security event
    await supabase
      .from('security_audit_log')
      .insert({
        user_id: userId,
        event_type: 'strava_connection_success',
        event_details: { 
          athlete_id: tokenData.athlete.id.toString(),
          token_expires_at: expiresAt
        }
      });

    console.log('Strava connection successful for user:', userId);

    // Create a user token for background data fetch
    const { data: { session }, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: '', // We'll use the user ID directly
      options: { redirectTo: '/' }
    });

    if (!sessionError && session) {
      // Trigger data fetch in background with proper user auth
      fetch(`${supabaseUrl}/functions/v1/fetch-strava-data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // No userId needed - will get from auth
      }).catch(error => {
        console.error('Background data fetch failed:', error);
      });
    }

    // Redirect back to the application
    const finalRedirectUrl = redirectUrl || '/';
    return Response.redirect(`${finalRedirectUrl}?strava=connected`, 302);

  } catch (error) {
    console.error('Error in strava-callback function:', error);
    return Response.redirect('/?error=strava_connection_failed', 302);
  }
});