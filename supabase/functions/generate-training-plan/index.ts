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

    const prompt = `You are an expert running coach who creates realistic, progressive training plans for runners of all levels, from couch-to-5K beginners to ultramarathon athletes.
Your job is to generate a high-level day-by-day overview plan based on the runner's profile.

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

OUTPUT REQUIREMENTS
• Cover every single day from today until race day.
• Include rest days.
• Build mileage progressively, peak 2–3 weeks before race day, then taper.
• If there is short preparation time (<6 weeks), prioritize key workouts and minimize risk.
• Avoid sudden mileage spikes if user has history of injuries.

OUTPUT FORMAT
For each day, output exactly this format:

Date (YYYY-MM-DD)
Day of Week
Training Session (Rest, Easy Run, Long Run, Tempo, Intervals)
Estimated Distance (km)
Estimated Duration (minutes)
Session Load (Low / Medium / High)
Purpose (short, 1 sentence)

Return only the overview fields — no detailed pacing, nutrition, or recovery instructions yet.`;

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
            content: 'You are an expert running coach. Generate concise, structured training plan overviews. Be precise with the output format.' 
          },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 15000,
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

    console.log('Training plan overview saved successfully');
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