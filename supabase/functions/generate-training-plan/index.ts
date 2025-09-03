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

    const prompt = `You are an expert running coach. Create a detailed, personalized training plan.

### USER PROFILE
- Name: ${profileData.full_name || 'Not provided'}
- Age: ${profileData.age || 'Not provided'}
- Gender: ${profileData.gender || 'Not provided'}
- Height: ${profileData.height || 'Not provided'} cm
- Weight: ${profileData.weight_kg || 'Not provided'} kg
- Running Experience: ${profileData.experience_years || 'Not specified'} years
- Current Weekly Mileage: ${profileData.current_weekly_mileage || 'Not specified'} km
- Longest Recent Run: ${profileData.longest_run_km || 'Not specified'} km
- Training History Summary: ${profileData.training_history || 'No specific history provided'}
- Recent Race Performances: ${profileData.race_results || 'None provided'}
- Strength Training Habits: ${profileData.strength_notes || 'Not specified'}
- Injury History: ${profileData.injuries || 'None reported'}

### GOAL / CONTEXT
- Target Event: ${profileData.race_name || 'Not specified'} (${profileData.race_distance_km || 'Not specified'} km, ${profileData.race_surface || 'road'})
- Target Date: ${profileData.race_date} (${daysDifference} days from today)
- Target Pace/Time: ${profileData.goal_pace_per_km || 'Not specified'}
- Days Available to Run: ${profileData.days_per_week || 5} days per week
- Typical Terrain/Elevation: ${profileData.elevation_context || 'flat'}
- Preferred Units: ${profileData.units || 'metric'}
- Time Constraints: ${profileData.time_limits || 'None specified'}

### OUTPUT REQUIREMENTS
Generate a plan from ${today.toISOString().split('T')[0]} until ${profileData.race_date}, covering every day. 

CRITICAL: Format your response with EXACT daily entries as follows:

TRAINING PLAN OVERVIEW
[Brief overview of training philosophy and approach tailored to this specific runner]

DAILY SCHEDULE

Day 1
Date: ${today.toISOString().split('T')[0]}
Day of week: ${today.toLocaleDateString('en-US', { weekday: 'long' })}
Workout type: [Rest/Easy Run/Tempo Run/Long Run/Intervals/etc.]
Distance: [X.X km or 0.0 km for rest days]
Duration: [X min]
Detailed description: [Specific workout details, pacing guidelines, instructions, heart rate zones if applicable]

Day 2
Date: ${new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
Day of week: ${new Date(today.getTime() + 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { weekday: 'long' })}
Workout type: [workout type]
Distance: [X.X km]
Duration: [X min]
Detailed description: [workout details with specific paces, heart rate zones, nutrition guidance]

Continue this exact format for every single day from Day 1 (today) through Day ${daysDifference} (race day).

IMPORTANT REQUIREMENTS: 
- Use EXACTLY this format for every day
- Include ALL ${daysDifference} days
- Start with Day 1 = today (${today.toISOString().split('T')[0]})
- End with Day ${daysDifference} = race day (${profileData.race_date})
- Include specific distances in km (use decimal format like 5.0, 12.5)
- Include specific durations in minutes
- Provide detailed pacing, heart rate zones, and specific workout instructions
- Consider the runner's experience level, current fitness, injury history, and time constraints
- Ensure progression is safe given their background
- Include proper taper if race goal exists
- Make sessions realistic given their availability (${profileData.days_per_week || 5} days per week)
- Account for their typical terrain (${profileData.elevation_context || 'flat'})
- Consider their injury history in workout selection and intensity

ADDITIONAL GUIDANCE
[Include personalized injury prevention tips, nutrition advice, tapering strategy, and race day preparation based on their specific profile and goals]`;

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