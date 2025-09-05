import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STRAVA_CLIENT_ID = '174698';
const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/strava-callback`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, redirectUrl } = await req.json();

    if (!userId) {
      throw new Error('User ID is required');
    }

    // Build Strava authorization URL
    const scope = 'read,activity:read_all';
    const state = `${userId}:${redirectUrl || ''}`;
    
    const authUrl = new URL('https://www.strava.com/oauth/authorize');
    authUrl.searchParams.set('client_id', STRAVA_CLIENT_ID);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('approval_prompt', 'force');
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('state', state);

    return new Response(JSON.stringify({ 
      authUrl: authUrl.toString() 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in strava-auth function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});