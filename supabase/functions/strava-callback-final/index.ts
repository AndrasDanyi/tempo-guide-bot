import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = 'https://otwcyimspsqxmbwzlmjo.supabase.co';
const STRAVA_CLIENT_ID = '174698';
const STRAVA_CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    // Use direct fetch to Supabase instead of the client to bypass JWT issues
    const verifyStateResponse = await fetch(`${SUPABASE_URL}/rest/v1/oauth_state_tokens?token=eq.${state}&select=user_id,redirect_url,used_at,expires_at`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!verifyStateResponse.ok) {
      throw new Error('Failed to verify state token');
    }

    const stateData = await verifyStateResponse.json();
    
    if (!stateData || stateData.length === 0) {
      console.error('Invalid state token');
      return Response.redirect('https://tempo-guide-bot.vercel.app?error=invalid_state', 302);
    }

    const stateRecord = stateData[0];

    if (stateRecord.used_at) {
      console.error('State token already used');
      return Response.redirect('https://tempo-guide-bot.vercel.app?error=state_reused', 302);
    }

    if (new Date() > new Date(stateRecord.expires_at)) {
      console.error('State token expired');
      return Response.redirect('https://tempo-guide-bot.vercel.app?error=state_expired', 302);
    }

    // Mark state token as used
    await fetch(`${SUPABASE_URL}/rest/v1/oauth_state_tokens?token=eq.${state}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ used_at: new Date().toISOString() })
    });

    const userId = stateRecord.user_id;
    const frontendRedirectUrl = stateRecord.redirect_url;
    
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
    
    // Simple base64 encoding
    const encryptToken = (token: string) => btoa(token);
    const expiresAt = new Date(tokenData.expires_at * 1000).toISOString();
    
    // Save tokens using direct fetch
    const saveTokensResponse = await fetch(`${SUPABASE_URL}/rest/v1/encrypted_strava_tokens`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        user_id: userId,
        access_token_encrypted: encryptToken(tokenData.access_token),
        refresh_token_encrypted: encryptToken(tokenData.refresh_token),
        expires_at: expiresAt
      })
    });

    if (!saveTokensResponse.ok) {
      console.error('Error saving tokens:', await saveTokensResponse.text());
      throw new Error('Failed to save Strava tokens');
    }

    // Update profile using direct fetch
    const updateProfileResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        strava_connected: true,
        strava_athlete_id: tokenData.athlete.id.toString(),
        strava_connected_at: new Date().toISOString()
      })
    });

    if (!updateProfileResponse.ok) {
      console.error('Error updating profile:', await updateProfileResponse.text());
      throw new Error('Failed to update profile');
    }

    console.log('Strava connection successful for user:', userId);

    // Redirect back to frontend
    return Response.redirect(`${frontendRedirectUrl}?strava=connected`, 302);

  } catch (error) {
    console.error('Error in strava-callback-final function:', error);
    return Response.redirect('https://tempo-guide-bot.vercel.app?error=strava_connection_failed', 302);
  }
});
