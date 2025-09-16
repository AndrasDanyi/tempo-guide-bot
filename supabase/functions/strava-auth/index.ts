import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STRAVA_CLIENT_ID = '174698';
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header and validate JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Missing or invalid authorization header');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user from JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid or expired token');
    }

    const { redirectUrl } = await req.json();

    // Generate secure state token instead of exposing user ID
    const stateToken = crypto.randomUUID();
    
    // Store state token in database with expiration
    const { error: stateError } = await supabase
      .from('oauth_state_tokens')
      .insert({
        token: stateToken,
        user_id: user.id,
        redirect_url: redirectUrl || '/'
      });

    if (stateError) {
      console.error('Error storing OAuth state token:', stateError);
      throw new Error('Failed to generate secure state token');
    }

    // Log security event
    await supabase
      .from('security_audit_log')
      .insert({
        user_id: user.id,
        event_type: 'strava_auth_initiated',
        event_details: { redirect_url: redirectUrl },
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown'
      });

    // Build Strava authorization URL with secure state token
    const scope = 'read,activity:read_all';
    
    // Use the Vercel URL for the redirect URI (passed from frontend)
    const redirectUri = `${redirectUrl}/functions/v1/strava-callback`;
    
    const authUrl = new URL('https://www.strava.com/oauth/authorize');
    authUrl.searchParams.set('client_id', STRAVA_CLIENT_ID);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('approval_prompt', 'force');
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('state', stateToken);

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