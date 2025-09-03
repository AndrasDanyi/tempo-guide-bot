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

    const prompt = `You are an expert running coach. Generate a **personalized, day-by-day training plan** for the runner, following all standard coaching principles (progressive overload, periodization, tapering, recovery, and injury prevention).

### USER PROFILE
- Name: ${profileData.full_name || 'Not provided'}
- Age: ${profileData.age || 'Not provided'}
- Gender: ${profileData.gender || 'Not provided'}
- Height: ${profileData.height || 'Not provided'}
- Weight: ${profileData.weight_kg || 'Not provided'}
- Running Experience: ${profileData.experience_years || 'Not specified'}
- Current Weekly Mileage: ${profileData.current_weekly_mileage || 'Not specified'}
- Longest Comfortable Run: ${profileData.longest_run_km || 'Not specified'}
- Training History Summary: ${profileData.training_history || 'No specific history provided'}
- Recent Race Performances: ${profileData.race_results || 'None provided'}
- Past Injuries / Limitations: ${profileData.injuries || 'None reported'}
- Strength Training Habits: ${profileData.strength_notes || 'Not specified'}
- Typical Terrain / Elevation: ${profileData.elevation_context || 'flat'}
- Goal Pace / Time: ${profileData.goal_pace_per_km || 'Not specified'}
- Race Name / Distance / Date: ${profileData.race_name || 'Not specified'}, ${profileData.race_distance_km || 'Not specified'}, ${profileData.race_date}
- Training Days per Week: ${profileData.days_per_week || 5}
- Further Notes (free-form): ${profileData.further_notes || 'None provided'}

### TRAINING PRINCIPLES
1. **Progressive Overload & Recovery**
   - Increase weekly mileage by max 5–10% per week.  
   - Include a recovery week every 4th week (-20% mileage).  
   - Long runs build gradually (+2–3 km/week) and peak at 30–40% of weekly mileage.  
2. **Periodization**
   - Base Phase: Build aerobic foundation (if plan ≥10 weeks).  
   - Build Phase: Add tempos/intervals 1–2x per week.  
   - Peak Phase: Highest mileage 3 weeks before race.  
   - Taper Phase: 
     - Week -2: reduce mileage 20–30%  
     - Week -1: reduce mileage 40–60%  
     - Keep intensity but reduce volume.  
     - Final long run 14 days before race.  
3. **Short Plan Handling (≤8 weeks)**
   - Skip base phase. Maintain current mileage and gradually sharpen key workouts.  
   - Minimal mileage growth (≤5% per week).  
   - Short taper (last 5–7 days).  
4. **Beginner / Advanced Adjustments**
   - Beginners (<20 km/week): build base before intervals.  
   - Advanced (>40 km/week): include weekly intervals & tempo runs.  
5. **Further Notes Integration**
   - Review "Further Notes" for preferred training times, schedule/terrain constraints, cross-training, personal goals, or extra health considerations.  
   - Adjust daily schedule or mileage accordingly, but prioritize safety.  
6. **Missing Inputs Handling**
   - If any required input is missing, assume safe, conservative defaults and document them in an "assumptions_made" summary.  
   - Example: mileage not provided → assume 25 km/week; long run unknown → 10 km; flat terrain if unspecified.  

### OUTPUT FORMAT
For each day, include:
- \`date\` (YYYY-MM-DD)
- \`training_session\` (e.g., Rest, Easy Run, Tempo, Long Run, Intervals)
- \`mileage_breakdown\` (warm-up / main / cooldown in km or minutes)
- \`pace_targets\` (per segment or range)
- \`heart_rate_zones\` (Z1–Z5)
- \`purpose\` (why the session exists)
- \`session_load\` (Low/Medium/High)
- \`notes\` (technical focus, drills, warnings, adjustments per Further Notes)
- \`what_to_eat_drink\` (pre/during/post fueling)
- \`additional_training\` (strength, mobility, cross-training)
- \`recovery_training\` (foam rolling, yoga, mobility flow)
- \`estimated_distance_km\`
- \`estimated_avg_pace_min_per_km\`
- \`estimated_moving_time\` (h:mm)
- \`estimated_elevation_gain_m\`
- \`estimated_avg_power_w\`
- \`estimated_cadence_spm\`
- \`estimated_calories\`
- \`daily_nutrition_advice\` (carbs/protein target + 2 meal/snack suggestions)

### RULES
- Cover every single day from start date to race day, including rest days.  
- Make progression realistic, respect fatigue & injuries, include recovery weeks and proper tapering.  
- If any assumptions were made due to missing inputs, include a short \`"assumptions_made"\` summary at the top.  
- Short plans (<8 weeks) must prioritize safe progression and sharpening rather than a full base/build phase.  
- Keep all sessions actionable and specific to the runner's profile, terrain, and goals.  
- Only output the structured day-by-day plan; no extra explanations or text outside the plan.

Generate a plan from ${today.toISOString().split('T')[0]} until ${profileData.race_date}, covering every day (${daysDifference} days total).`;

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
            content: 'You are an expert running coach who creates detailed, personalized training plans. Provide comprehensive text-based training plans that runners can easily follow.' 
          },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 100000,
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

    // Save the training plan to the database as text
    const { data: savedPlan, error: saveError } = await supabase
      .from('training_plans')
      .insert({
        user_id: user.id,
        profile_id: profileData.id,
        plan_content: { text: trainingPlanText }, // Store as simple object with text property
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