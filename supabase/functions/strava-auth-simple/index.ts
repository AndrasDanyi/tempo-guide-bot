import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STRAVA_CLIENT_ID = '174698';
const SUPABASE_URL = 'https://otwcyimspsqxmbwzlmjo.supabase.co';
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/strava-callback-simple`;

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

    // Generate state token
    const stateToken = crypto.randomUUID();
    
    // Store state token in database
    const { error: stateError } = await supabase
      .from('oauth_state_tokens')
      .insert({
        token: stateToken,
        user_id: user.id,
        redirect_url: 'https://tempo-guide-bot.vercel.app'
      });

    if (stateError) {
      console.error('Error storing state token:', stateError);
      throw new Error('Failed to generate state token');
    }

    // Build Strava authorization URL
    const authUrl = new URL('https://www.strava.com/oauth/authorize');
    authUrl.searchParams.set('client_id', STRAVA_CLIENT_ID);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('approval_prompt', 'force');
    authUrl.searchParams.set('scope', 'read,activity:read_all');
    authUrl.searchParams.set('state', stateToken);

    console.log('Generated Strava auth URL:', authUrl.toString());

    return new Response(JSON.stringify({ 
      authUrl: authUrl.toString() 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in strava-auth-simple function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
