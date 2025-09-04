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

    const prompt = `You are an expert running coach. Generate a personalized, day-by-day training plan for the runner, following standard coaching principles: progressive overload, periodization, tapering, recovery, and injury prevention.

⸻

USER PROFILE
	•	Name: ${profileData.full_name || 'Not specified'}
	•	Age: ${profileData.age || 'Not specified'}
	•	Gender: ${profileData.gender || 'Not specified'}
	•	Height: ${profileData.height || 'Not specified'}cm
	•	Weight: ${profileData.weight_kg || 'Not specified'}kg
	•	Running Experience: ${profileData.experience_years || 'Not specified'} years
	•	Current Weekly Mileage: ${profileData.current_weekly_mileage || 30}km
	•	Longest Comfortable Run: ${profileData.longest_run_km || 'Not specified'}km
	•	Training History Summary: ${profileData.training_history || 'Not specified'}
	•	Recent Race Performances: ${profileData.race_results || 'Not specified'}
	•	Past Injuries / Limitations: ${profileData.injuries || 'None noted'}
	•	Strength Training Habits: ${profileData.strength_notes || 'Not specified'}
	•	Typical Terrain / Elevation: ${profileData.elevation_context || 'Flat'}
	•	Goal Pace / Time: ${profileData.goal_pace_per_km || 'Not specified'}
	•	Race Name / Distance / Date: ${profileData.race_name || 'Running Event'}, ${profileData.race_distance_km || 21}km, ${profileData.race_date}
	•	Training Days per Week: ${profileData.days_per_week || 5}
	•	Further Notes (free-form): ${profileData.further_notes || 'None'}

⸻

TRAINING PRINCIPLES
	1.	Progressive Overload & Recovery
	•	Increase weekly mileage by max 5–10% per week.
	•	Include a recovery/deload week every 4th week (-20% mileage).
	•	Long runs build progressively — typically +2–3 km/week,
but may increase faster (up to +20–30%) if:
	•	Runner is experienced & injury-free
	•	Training window is short (≤8 weeks)
	•	Total weekly mileage increase still stays within safe range
	•	Peak long run = 30–40% of weekly mileage, ideally 2–3 weeks before race.
	2.	Periodization
	•	Base Phase: Build aerobic foundation (if plan ≥10 weeks)
	•	Build Phase: Add tempos/intervals 1–2x per week
	•	Peak Phase: Highest mileage 3 weeks before race
	•	Taper Phase:
	•	Week -2: reduce mileage 20–30%
	•	Week -1: reduce mileage 40–60%
	•	Keep intensity, reduce volume
	•	Final long run 14 days before race
	3.	Short Plan Handling (≤8 weeks)
	•	Skip full base phase
	•	Minimal mileage growth (≤5% per week except for long run where safe)
	•	Prioritize race-specific workouts
	•	Short taper (5–7 days)
	4.	Beginner / Advanced Adjustments
	•	Beginners (<20 km/week): focus on base mileage before intervals
	•	Advanced (>40 km/week): include weekly intervals + tempo runs
	5.	Further Notes Integration
	•	Adjust plan for preferred training times, schedule limits, terrain, cross-training, or personal goals
	•	Always prioritize safety and recovery
	6.	Missing Inputs Handling
	•	If inputs are missing, assume safe defaults (e.g., 25 km/week, 10 km long run, flat terrain)
	•	Document assumptions in an "assumptions_made" section

⸻

OUTPUT REQUIREMENTS

Generate the plan in Stage 1 format - ESSENTIAL FIELDS only (this will be parsed and displayed immediately in the calendar).

For each day from ${today.toISOString().split('T')[0]} to ${profileData.race_date}, output exactly in this format:
DATE|TRAINING_SESSION|MILEAGE_BREAKDOWN|PACE_TARGETS|ESTIMATED_DISTANCE_KM|ESTIMATED_AVG_PACE_MIN_PER_KM|ESTIMATED_MOVING_TIME

Where:
	•	DATE: YYYY-MM-DD format
	•	TRAINING_SESSION: Rest, Easy Run, Tempo, Long Run, Intervals
	•	MILEAGE_BREAKDOWN: warm-up/main/cooldown (e.g., "2km wu + 8km main + 1km cd" or "Rest day")
	•	PACE_TARGETS: pace per segment (e.g., "Easy 5:30-6:00" or "2km@5:00, 6x1km@4:30, 2km easy")
	•	ESTIMATED_DISTANCE_KM: total distance as decimal (e.g., 10.5)
	•	ESTIMATED_AVG_PACE_MIN_PER_KM: average pace (e.g., "5:45")
	•	ESTIMATED_MOVING_TIME: total time (e.g., "1:25")

Example lines:
2025-09-03|Easy Run|2km wu + 6km easy + 1km cd|Easy 5:30-6:00|9.0|5:45|51:45
2025-09-04|Rest|Complete rest day|N/A|0.0|N/A|0:00
2025-09-05|Intervals|3km wu + 6x1km@4:30 + 2km cd|Wu@6:00, Reps@4:30, Rec@6:30, Cd@6:00|8.0|5:15|42:00

⸻

RULES
	•	Cover every single day from start date to race day (including rest days).
	•	Respect fatigue, injuries, recovery weeks, and proper tapering.
	•	Use safe but efficient mileage progression based on experience level.
	•	Output ONLY the daily plan lines in the specified format - no commentary.
	•	Generate all ${daysDifference} days now:`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-nano-2025-08-07',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 120000, // Safe limit for gpt-5-nano (max 128k)
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API Error:', errorData);
      
      let parsedError;
      try {
        parsedError = JSON.parse(errorData);
      } catch {
        parsedError = { error: { message: errorData } };
      }
      
      const errorMessage = parsedError?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      console.error('Parsed OpenAI error:', parsedError);
      throw new Error(`OpenAI API Error: ${errorMessage}`);
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

    console.log('Training plan overview saved successfully');
    console.log('Saved plan ID:', savedPlan.id);
    console.log('Saved plan content length:', savedPlan.plan_content?.text?.length || 0);

    // Parse and save the training plan to training_days table
    console.log('Parsing training plan...');
    try {
      const parseResponse = await supabase.functions.invoke('parse-training-plan', {
        body: {
          planId: savedPlan.id,
          planText: trainingPlanText
        }
      });

      if (parseResponse.error) {
        console.error('Parse function error:', parseResponse.error);
        // Don't fail the whole request if parsing fails
      } else {
        console.log('Training plan parsed successfully:', parseResponse.data);
      }
    } catch (parseError) {
      console.error('Error calling parse function:', parseError);
      // Don't fail the whole request if parsing fails
    }

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