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

    const { profileData } = await req.json();

    if (!profileData) {
      throw new Error('Profile data is required');
    }

    console.log('Generating training plan for user:', user.id);

    // Calculate days between today and race day
    const today = new Date();
    const raceDate = new Date(profileData.race_date);
    const daysDifference = Math.ceil((raceDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

    const prompt = `You are an expert running coach who creates detailed training plans for runners of all levels — 
from beginners doing Couch-to-5K to athletes training for ultramarathons and multi-day events.

Your job is to create a day-by-day plan that prepares the athlete for their specific goal — 
or builds a safe and progressive running base if they do not have a specific race.

### INPUT DATA
- Runner Profile:
  - Name: ${profileData.full_name || 'Runner'}
  - Age: ${profileData.age}
  - Gender: ${profileData.gender || 'Not specified'}
  - Running history: ${profileData.training_history || 'No specific history provided'}
  - Current weekly mileage: ${profileData.current_weekly_mileage || 'Not specified'} km
  - Longest comfortable run: ${profileData.longest_run_km || 'Not specified'} km
  - Target event: ${profileData.race_name || profileData.goal}
  - Target distance: ${profileData.race_distance_km || 'Not specified'} km
  - Target date: ${profileData.race_date} (${daysDifference} days from today)
  - Target pace: ${profileData.goal_pace_per_km || 'Not specified'} per km
  - Past injuries or limitations: ${profileData.injuries || 'None reported'}
  - Strength training habits: ${profileData.strength_notes || 'Not specified'}
  - Typical terrain & elevation gain: ${profileData.elevation_context || 'flat'}

### REQUIREMENTS
- Plan duration: From ${today.toISOString().split('T')[0]} until ${profileData.race_date}.
- Sessions per week: ${profileData.days_per_week || 5}.
- Include:
  - Specific daily run type (easy, tempo, intervals, long run, rest)
  - Distance OR duration target (whichever is most appropriate for user level)
  - Pace or HR zone target
  - Purpose of the session (why we do it)
  - Session load (Rest/Low/Medium/High)
  - Notes for the runner (form cues, breathing, pacing tips)
  - Nutrition & fueling notes for key sessions
  - Recovery suggestions (foam rolling, yoga, mobility)
  - Strength/mobility add-ons (if relevant)
- Build progressive overload safely, peak 2–3 weeks before race if training for an event, 
  and taper appropriately.
- For beginners, start with run/walk intervals and build gradually.
- Avoid sudden mileage spikes, respect injury history.

### OUTPUT FORMAT
Return a **JSON array** with one object per day from start date to race date (or plan end), including rest days.

Use this exact structure, filling in realistic values based on the runner's profile (examples are just for format illustration — do not output them literally):

[
  {
    "date": "YYYY-MM-DD", 
    "training_session": "Name of session, e.g. 'Tempo Run' or 'Long Run'",
    "mileage_breakdown": "Structured breakdown of the session (warm-up, intervals/steady run, cooldown, etc.)",
    "pace_targets": "Pace or HR zone targets for each part of the run",
    "heart_rate_zones": "Which HR zones apply to the session (Z1-Z5)",
    "purpose": "Why this session is included (e.g. aerobic endurance, threshold, recovery)",
    "session_load": "Rest/Low/Medium/High",
    "notes": "Form tips, breathing focus, drills if needed",
    "what_to_eat_drink": "Guidance on pre/during fueling and hydration for this session",
    "additional_training": "Strength/mobility add-ons or leave empty if none",
    "recovery_training": "Post-run recovery suggestions (foam rolling, mobility, etc.)",
    "estimated_distance_km": 0,
    "estimated_avg_pace_min_per_km": "0:00",
    "estimated_moving_time": "0:00",
    "estimated_elevation_gain_m": 0,
    "estimated_avg_power_w": 0,
    "estimated_cadence_spm": 0,
    "estimated_calories": 0,
    "daily_nutrition_advice": "Total calorie target and example meal/snack suggestions"
  }
]

Return **valid JSON only**, with no extra text, markdown, or explanations.`;

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
            content: 'You are an expert running coach who creates detailed, personalized training plans. You must respond with valid JSON only, following the exact format requested in the user prompt. Do not include any explanatory text, markdown, or additional content - only pure JSON.' 
          },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 200000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API Error:', errorData);
      throw new Error(`OpenAI API Error: ${response.status}`);
    }

    const data = await response.json();
    console.log('OpenAI response received');
    console.log('Full OpenAI response:', JSON.stringify(data, null, 2));
    
    // Log token usage
    if (data.usage) {
      console.log('Token usage - Prompt tokens:', data.usage.prompt_tokens);
      console.log('Token usage - Completion tokens:', data.usage.completion_tokens);
      console.log('Token usage - Total tokens:', data.usage.total_tokens);
    }
    
    const trainingPlanText = data.choices[0].message.content;
    console.log('Training plan generated successfully');
    console.log('Plan length:', trainingPlanText?.length || 0);
    console.log('Plan exists:', !!trainingPlanText);
    
    if (trainingPlanText) {
      console.log('Plan preview (first 500 chars):', trainingPlanText.substring(0, 500));
      console.log('Plan preview (last 200 chars):', trainingPlanText.slice(-200));
    } else {
      console.log('ERROR: No training plan text generated!');
      console.log('Response choices:', data.choices);
    }

    // Validate that we have content before saving
    if (!trainingPlanText || trainingPlanText.trim().length === 0) {
      throw new Error('OpenAI returned empty training plan content');
    }

    // Parse JSON and save the training plan to the database
    let parsedPlan;
    try {
      parsedPlan = JSON.parse(trainingPlanText);
      console.log('Successfully parsed JSON plan with', parsedPlan.length, 'days');
    } catch (parseError) {
      console.error('Failed to parse JSON plan:', parseError);
      throw new Error('OpenAI returned invalid JSON format');
    }

    const { data: savedPlan, error: saveError } = await supabase
      .from('training_plans')
      .insert({
        user_id: user.id,
        profile_id: profileData.id,
        plan_content: { json: parsedPlan, text: trainingPlanText }, // Store both JSON and text
        start_date: today.toISOString().split('T')[0],
        end_date: profileData.race_date,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Database save error:', saveError);
      throw new Error('Failed to save training plan to database');
    }

    console.log('Training plan saved successfully');
    console.log('Saved plan ID:', savedPlan.id);
    console.log('Saved plan content length:', savedPlan.plan_content?.text?.length || 0);

    return new Response(JSON.stringify({ 
      success: true, 
      trainingPlanText, 
      planId: savedPlan.id,
      tokenUsage: data.usage || null,
      contentLength: trainingPlanText?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-training-plan function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});