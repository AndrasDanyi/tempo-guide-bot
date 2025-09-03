import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { profileData, dayData } = await req.json();

    if (!profileData || !dayData) {
      throw new Error('Profile data and day data are required');
    }

    console.log('Generating day details for:', dayData.specific_date);

    const prompt = `You are an expert running coach.
Based on the following context, generate detailed instructions for the training day below.

RUNNER PROFILE
• Goal: ${profileData.goal || 'Not specified'}
• Race date: ${profileData.race_date}
• Age: ${profileData.age || 'Not provided'}
• Gender: ${profileData.gender || 'Not specified'}
• Height: ${profileData.height || 'Not specified'}
• Training history: ${profileData.experience_years || 'Not specified'} years
• Current weekly mileage: ${profileData.current_weekly_mileage || 'Not specified'}
• Longest comfortable run: ${profileData.longest_run_km || 'Not specified'} km
• Past injuries: ${profileData.injury_notes || 'None specified'}
• Strength training habits: ${profileData.strength_notes || 'Not specified'}
• Elevation preference/terrain: ${profileData.elevation_context || 'Not specified'}
• Days available per week: ${profileData.days_per_week || 5}
• Further notes: ${profileData.further_notes || 'None'}

DAY CONTEXT
• Date: ${dayData.specific_date}
• Training Session: ${dayData.training_session}
• Estimated Distance: ${dayData.estimated_distance_km} km
• Estimated Duration: ${dayData.estimated_duration_min} minutes
• Session Load: ${dayData.session_load}
• Purpose: ${dayData.purpose}

OUTPUT FIELDS
• Mileage breakdown (warm-up, main set, cooldown)
• Pace targets
• Heart rate zones
• Notes / technique focus
• What to eat/drink before & during
• Additional training (strength/mobility)
• Recovery training (foam rolling, mobility)
• Estimated metrics:
  • Distance (km)
  • Avg pace (min/km)
  • Moving time
  • Elevation gain (m)
  • Avg power (W)
  • Cadence (spm)
  • Calories
• Daily nutrition advice (meals + macros)

Keep this concise but actionable — no unnecessary explanations.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-nano-2025-08-07',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert running coach who provides detailed, actionable training instructions. Be specific and practical.' 
          },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API Error:', errorData);
      throw new Error(`OpenAI API Error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Day details generated successfully');
    
    // Log token usage
    if (data.usage) {
      console.log('Token usage - Prompt tokens:', data.usage.prompt_tokens);
      console.log('Token usage - Completion tokens:', data.usage.completion_tokens);
      console.log('Token usage - Total tokens:', data.usage.total_tokens);
    }
    
    const dayDetails = data.choices[0].message.content;

    // Validate that we have content
    if (!dayDetails || dayDetails.trim().length === 0) {
      throw new Error('OpenAI returned empty day details content');
    }

    return new Response(JSON.stringify({ 
      success: true, 
      dayDetails,
      tokenUsage: data.usage || null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-day-details function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});