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

    const prompt = `You are an expert running coach. Create a detailed personalized training plan for a runner with the following information:

Goal: ${profileData.goal}
Race Date: ${profileData.race_date} (${daysDifference} days from today)
Age: ${profileData.age}
Height: ${profileData.height} cm
Training History: ${profileData.training_history || 'No specific history provided'}
Injuries: ${profileData.injuries || 'None reported'}

Create a structured training plan from today (${today.toISOString().split('T')[0]}) until race day that includes:
1. Weekly training structure with specific workouts
2. Progressive mileage buildup
3. Different types of runs (easy, tempo, intervals, long runs)
4. Rest days and recovery periods
5. Taper period before the race

Return the response as a JSON object with this structure:
{
  "summary": "Brief overview of the training philosophy and approach",
  "weeklyStructure": "General weekly training structure",
  "weeks": [
    {
      "weekNumber": 1,
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "focus": "Week focus/goal",
      "totalMiles": 25,
      "workouts": [
        {
          "day": "Monday",
          "date": "YYYY-MM-DD",
          "workout": "Rest day",
          "distance": 0,
          "duration": "0 min",
          "description": "Complete rest or light stretching"
        },
        {
          "day": "Tuesday", 
          "date": "YYYY-MM-DD",
          "workout": "Easy Run",
          "distance": 3,
          "duration": "25-30 min",
          "description": "Comfortable conversational pace"
        }
      ]
    }
  ]
}

Make sure each week has 7 workouts (Monday through Sunday) and the plan is realistic and progressive.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-nano-2025-08-07',
        messages: [
          { role: 'system', content: 'You are an expert running coach who creates detailed, personalized training plans. Always respond with valid JSON.' },
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
    console.log('OpenAI response received');

    let trainingPlan;
    try {
      trainingPlan = JSON.parse(data.choices[0].message.content);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      throw new Error('Failed to parse training plan from AI response');
    }

    // Save the training plan to the database
    const { data: savedPlan, error: saveError } = await supabase
      .from('training_plans')
      .insert({
        user_id: user.id,
        profile_id: profileData.id,
        plan_content: trainingPlan,
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

    return new Response(JSON.stringify({ 
      success: true, 
      trainingPlan, 
      planId: savedPlan.id 
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