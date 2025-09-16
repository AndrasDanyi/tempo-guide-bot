import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = 'https://otwcyimspsqxmbwzlmjo.supabase.co';
const STRAVA_CLIENT_ID = '174698';
const STRAVA_CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET')!;

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
      return Response.redirect('https://tempo-guide-bot.vercel.app?error=access_denied', 302);
    }

    if (!code || !state) {
      throw new Error('Missing code or state parameter');
    }

    const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Verify state token
    const { data: stateData, error: stateError } = await supabase
      .from('oauth_state_tokens')
      .select('user_id, redirect_url, used_at, expires_at')
      .eq('token', state)
      .single();

    if (stateError || !stateData) {
      console.error('Invalid state token:', stateError);
      return Response.redirect('https://tempo-guide-bot.vercel.app?error=invalid_state', 302);
    }

    if (stateData.used_at) {
      console.error('State token already used');
      return Response.redirect('https://tempo-guide-bot.vercel.app?error=state_reused', 302);
    }

    if (new Date() > new Date(stateData.expires_at)) {
      console.error('State token expired');
      return Response.redirect('https://tempo-guide-bot.vercel.app?error=state_expired', 302);
    }

    // Mark state token as used
    await supabase
      .from('oauth_state_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', state);

    const userId = stateData.user_id;
    const frontendRedirectUrl = stateData.redirect_url;
    
    // Exchange code for token
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const tokenData = await tokenResponse.json();
    
    // Simple base64 encoding (not production-grade encryption)
    const encryptToken = (token: string) => btoa(token);
    
    const expiresAt = new Date(tokenData.expires_at * 1000).toISOString();
    
    // Save tokens
    const { error: tokenError } = await supabase
      .from('encrypted_strava_tokens')
      .upsert({
        user_id: userId,
        access_token_encrypted: encryptToken(tokenData.access_token),
        refresh_token_encrypted: encryptToken(tokenData.refresh_token),
        expires_at: expiresAt
      });

    if (tokenError) {
      console.error('Error saving tokens:', tokenError);
      throw new Error('Failed to save Strava tokens');
    }

    // Update profile
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
      throw new Error('Failed to update profile');
    }

    console.log('Strava connection successful for user:', userId);

    // Redirect back to frontend
    return Response.redirect(`${frontendRedirectUrl}?strava=connected`, 302);

  } catch (error) {
    console.error('Error in strava-callback-clean function:', error);
    return Response.redirect('https://tempo-guide-bot.vercel.app?error=strava_connection_failed', 302);
  }
});
