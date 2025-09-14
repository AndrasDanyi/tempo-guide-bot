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

    const { planId, dayIndex, profileData } = await req.json();

    if (!planId || dayIndex === undefined || !profileData) {
      throw new Error('Plan ID, day index, and profile data are required');
    }

    console.log(`Enhancing training plan ${planId}, day ${dayIndex + 1}`);

    // Get current plan from database
    const { data: currentPlan, error: fetchError } = await supabase
      .from('training_plans')
      .select('plan_content')
      .eq('id', planId)
      .single();

    if (fetchError || !currentPlan) {
      throw new Error('Failed to fetch current plan');
    }

    const currentPlanText = currentPlan.plan_content.text;
    
    // Split current plan into day blocks
    const dayBlocks = currentPlanText.split('===DAY_START===').slice(1);
    
    if (dayIndex >= dayBlocks.length) {
      throw new Error(`Day ${dayIndex + 1} not found in plan`);
    }

    // Get the specific day content
    const dayContent = dayBlocks[dayIndex].split('===DAY_END===')[0];
    const lines = dayContent.split('\n').map(line => line.trim()).filter(Boolean);
    
    // Extract existing data
    const existingData: Record<string, string> = {};
    let dateField = '';
    
    lines.forEach(line => {
      if (line.includes(': ')) {
        const [field, value] = line.split(': ', 2);
        existingData[field] = value;
        if (field === 'date') {
          dateField = value;
        }
      }
    });

    // Calculate race date for context
    const today = new Date();
    const raceDate = new Date(profileData.race_date);
    const daysDifference = Math.ceil((raceDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

    // Create enhancement prompt for this specific day
    const prompt = `You are an expert running coach. Enhance this specific training day with detailed additional fields.

### USER PROFILE CONTEXT
- Age: ${profileData.age || 'Not provided'}
- Experience: ${profileData.experience_years || 'Not specified'} years
- Current Weekly Mileage: ${profileData.current_weekly_mileage || 'Not specified'}
- Race Date: ${profileData.race_date} (${daysDifference} days from today)
- Race Distance: ${profileData.race_distance_km || 'Not specified'} km
- Goal Pace: ${profileData.goal_pace_per_km || 'Not specified'}
- Terrain: ${profileData.elevation_context || 'flat'}

### EXISTING DAY DATA TO ENHANCE
Date: ${existingData.date || 'Unknown'}
Training Session: ${existingData.training_session || 'Unknown'}
Purpose: ${existingData.purpose || 'Unknown'}
Session Load: ${existingData.session_load || 'Unknown'}
Distance: ${existingData.estimated_distance_km || '0'} km
Pace: ${existingData.estimated_avg_pace_min_per_km || 'Unknown'}
Duration: ${existingData.estimated_moving_time || 'Unknown'}

### TASK
Add ONLY the missing enhanced fields for this day. Return ONLY the enhanced fields in this exact format:

mileage_breakdown: (warm-up X km / main Y km / cooldown Z km)
pace_targets: (specific paces for each segment)
heart_rate_zones: (Z1-Z5 for different segments)
what_to_eat_drink: (pre/during/post nutrition)
additional_training: (strength/mobility/cross-training for this day)
recovery_training: (foam rolling/stretching/yoga)
estimated_elevation_gain_m: (number only)
estimated_avg_power_w: (number only)
estimated_cadence_spm: (number only)
estimated_calories: (number only)
daily_nutrition_advice: (daily carbs/protein targets + meal suggestions)

Make all recommendations specific to the training session type, user profile, and race goals. Be precise and actionable.`;

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
            content: 'You are an expert running coach who provides detailed, specific training enhancements. Return only the requested fields in the exact format specified.' 
          },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API Error:', errorData);
      throw new Error(`OpenAI API Error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    const enhancedFields = data.choices[0].message.content;

    console.log(`Enhanced fields for day ${dayIndex + 1}:`, enhancedFields);

    // Parse and merge the enhanced fields with existing data
    const enhancedLines = enhancedFields.split('\n').map(line => line.trim()).filter(Boolean);
    
    enhancedLines.forEach(line => {
      if (line.includes(': ')) {
        const [field, value] = line.split(': ', 2);
        existingData[field] = value;
      }
    });

    // Reconstruct the enhanced day block with better formatting
    const enhancedDayBlock = `===DAY_START===
date: ${existingData.date || ''}

🏃‍♂️ WORKOUT OVERVIEW
training_session: ${existingData.training_session || ''}
purpose: ${existingData.purpose || ''}
session_load: ${existingData.session_load || ''}

📊 WORKOUT STRUCTURE
mileage_breakdown: ${existingData.mileage_breakdown || 'Not specified'}
pace_targets: ${existingData.pace_targets || 'Not specified'}
heart_rate_zones: ${existingData.heart_rate_zones || 'Not specified'}

📝 TRAINING NOTES
notes: ${existingData.notes || ''}

🍎 NUTRITION & RECOVERY
what_to_eat_drink: ${existingData.what_to_eat_drink || 'Standard hydration'}
additional_training: ${existingData.additional_training || '0'}
recovery_training: ${existingData.recovery_training || 'Light stretching'}

📈 ESTIMATED METRICS
estimated_distance_km: ${existingData.estimated_distance_km || '0'}
estimated_avg_pace_min_per_km: ${existingData.estimated_avg_pace_min_per_km || '0:00'}
estimated_moving_time: ${existingData.estimated_moving_time || '0:00'}
estimated_elevation_gain_m: ${existingData.estimated_elevation_gain_m || '0'}
estimated_avg_power_w: ${existingData.estimated_avg_power_w || '0'}
estimated_cadence_spm: ${existingData.estimated_cadence_spm || '0'}
estimated_calories: ${existingData.estimated_calories || '0'}

🥗 DAILY NUTRITION
daily_nutrition_advice: ${existingData.daily_nutrition_advice || 'Balanced diet with adequate carbs and protein'}
===DAY_END===`;

    // Reconstruct the full plan with the enhanced day
    const updatedDayBlocks = [...dayBlocks];
    updatedDayBlocks[dayIndex] = enhancedDayBlock + updatedDayBlocks[dayIndex].split('===DAY_END===')[1];

    const updatedPlanText = '===DAY_START===' + updatedDayBlocks.join('===DAY_START===');

    // Update the plan in database
    const { error: updateError } = await supabase
      .from('training_plans')
      .update({
        plan_content: { text: updatedPlanText },
        updated_at: new Date().toISOString()
      })
      .eq('id', planId);

    if (updateError) {
      console.error('Database update error:', updateError);
      throw new Error('Failed to update training plan');
    }

    console.log(`Successfully enhanced day ${dayIndex + 1} of plan ${planId}`);

    return new Response(JSON.stringify({ 
      success: true,
      dayIndex,
      enhancedFields: enhancedFields.length,
      message: `Day ${dayIndex + 1} enhanced successfully`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in enhance-training-plan function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});