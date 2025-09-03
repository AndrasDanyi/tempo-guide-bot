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

// Function to parse text format into JSON structure
function parseTextToJson(textPlan: string) {
  const lines = textPlan.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const days = [];
  let currentDay: any = {};

  for (const line of lines) {
    if (line.startsWith('DATE:')) {
      // If we have a current day, save it
      if (currentDay.date) {
        days.push(currentDay);
      }
      // Start new day
      currentDay = {
        date: line.replace('DATE:', '').trim(),
        training_session: '',
        mileage_breakdown: '',
        pace_targets: '',
        heart_rate_zones: '',
        purpose: '',
        session_load: 'Medium',
        notes: '',
        what_to_eat_drink: '',
        additional_training: '',
        recovery_training: '',
        estimated_distance_km: 0,
        estimated_avg_pace_min_per_km: '0:00',
        estimated_moving_time: '0:00',
        estimated_elevation_gain_m: 0,
        estimated_avg_power_w: 0,
        estimated_cadence_spm: 0,
        estimated_calories: 0,
        daily_nutrition_advice: ''
      };
    } else if (line.startsWith('SESSION:')) {
      currentDay.training_session = line.replace('SESSION:', '').trim();
      if (currentDay.training_session.toLowerCase().includes('rest')) {
        currentDay.session_load = 'Rest';
      }
    } else if (line.startsWith('DISTANCE:')) {
      const distance = line.replace('DISTANCE:', '').trim();
      if (distance.toLowerCase() !== 'rest' && distance !== 'N/A') {
        const distanceNum = parseFloat(distance.replace('km', '').trim());
        if (!isNaN(distanceNum)) {
          currentDay.estimated_distance_km = distanceNum;
          currentDay.estimated_calories = Math.round(distanceNum * 70); // Rough estimate
        }
      }
      currentDay.mileage_breakdown = distance;
    } else if (line.startsWith('PACE:')) {
      currentDay.pace_targets = line.replace('PACE:', '').trim();
      currentDay.estimated_avg_pace_min_per_km = currentDay.pace_targets;
    } else if (line.startsWith('NOTES:')) {
      currentDay.notes = line.replace('NOTES:', '').trim();
      currentDay.purpose = currentDay.notes;
    }
  }

  // Don't forget the last day
  if (currentDay.date) {
    days.push(currentDay);
  }

  return days;
}

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
- Build progressive overload safely, peak 2–3 weeks before race if training for an event, 
  and taper appropriately.
- For beginners, start with run/walk intervals and build gradually.
- Avoid sudden mileage spikes, respect injury history.

### OUTPUT FORMAT
Create a detailed day-by-day training plan in simple text format. For each day, use this structure:

DATE: YYYY-MM-DD
SESSION: [Name of session, e.g. 'Tempo Run', 'Long Run', 'Rest Day']
DISTANCE: [Distance in km or 'Rest' for rest days]
PACE: [Target pace or 'N/A' for rest days]
NOTES: [Brief notes about the session purpose and any tips]

Continue this format for every single day from start date to race date. Include rest days.
Be consistent with the format - use exactly "DATE:", "SESSION:", "DISTANCE:", "PACE:", "NOTES:" labels.`;

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
            content: 'You are an expert running coach. Follow the exact text format requested. Be consistent with the labels and structure.' 
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
    
    // Log token usage
    if (data.usage) {
      console.log('Token usage - Prompt tokens:', data.usage.prompt_tokens);
      console.log('Token usage - Completion tokens:', data.usage.completion_tokens);
      console.log('Token usage - Total tokens:', data.usage.total_tokens);
    }
    
    const trainingPlanText = data.choices[0].message.content;
    console.log('Training plan generated successfully');
    console.log('Plan length:', trainingPlanText?.length || 0);
    
    if (!trainingPlanText || trainingPlanText.trim().length === 0) {
      throw new Error('OpenAI returned empty training plan content');
    }

    // Parse the text format into JSON structure
    const parsedPlan = parseTextToJson(trainingPlanText);
    console.log('Successfully parsed text plan into JSON with', parsedPlan.length, 'days');

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