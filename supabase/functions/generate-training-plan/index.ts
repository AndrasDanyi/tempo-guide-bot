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

    const prompt = `Create a simple training plan overview for a ${profileData.race_distance_km || 21}km race. Generate clean, basic workout summaries that will be displayed in a weekly calendar view.

USER PROFILE:
• Experience: ${profileData.experience_years || 'Beginner'} years
• Current weekly mileage: ${profileData.current_weekly_mileage || 30}km  
• Goal pace: ${profileData.goal_pace_per_km || '5:30'} per km
• Race date: ${profileData.race_date}
• Training days per week: ${profileData.days_per_week || 5}

TRAINING PRINCIPLES:
• Build progressive mileage safely
• Include easy runs, tempo runs, intervals, and long runs
• Taper properly in final 2 weeks
• Include rest days for recovery

OUTPUT FORMAT:
For each day from ${today.toISOString().split('T')[0]} to ${profileData.race_date}, use this exact format:
DATE|WORKOUT_TYPE|SIMPLE_DESCRIPTION|PACE_RANGE|DISTANCE_KM|AVG_PACE|DURATION

WORKOUT TYPES: Rest, Easy Run, Tempo Run, Long Run, Intervals, Track Workout
SIMPLE_DESCRIPTION: Brief, clear description (e.g., "Focus on easy effort, conversational pace")
PACE_RANGE: Simple range (e.g., "Easy (8:30-9:00/mi)" or "Tempo (7:15-7:30/mi)")
DISTANCE_KM: Total distance as number (e.g., 6.0)
AVG_PACE: Average pace (e.g., "5:45")
DURATION: Time in min (e.g., "45 min")

Examples:
2025-09-04|Easy Run|Focus on easy effort, conversational pace|Easy (8:30-9:00/mi)|5.0|8:45|43:45
2025-09-05|Rest|Complete rest day|N/A|0.0|N/A|0:00
2025-09-06|Tempo Run|10 min warm-up, 20 min tempo, 15 min cool-down|Tempo (7:15-7:30/mi)|6.0|7:30|45:00
2025-09-07|Long Run|Relaxed effort, focus on form|Easy (8:15-8:45/mi)|8.0|8:30|68:00

Generate ${daysDifference} days of training:`;

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