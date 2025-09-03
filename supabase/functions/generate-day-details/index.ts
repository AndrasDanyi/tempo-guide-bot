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

    const { trainingDayId, profileData, dayData } = await req.json();

    if (!trainingDayId || !profileData || !dayData) {
      throw new Error('Training day ID, profile data and day data are required');
    }

    console.log('Generating detailed fields for training day:', trainingDayId);

    const prompt = `You are an expert running coach. Generate detailed training instructions for this specific day.

RUNNER PROFILE:
• Name: ${profileData.full_name || 'Not specified'}
• Age: ${profileData.age || 'Not specified'}
• Gender: ${profileData.gender || 'Not specified'}
• Height: ${profileData.height || 'Not specified'}cm
• Weight: ${profileData.weight_kg || 'Not specified'}kg
• Experience: ${profileData.experience_years || 'Not specified'} years
• Weekly Mileage: ${profileData.current_weekly_mileage || 'Not specified'}km
• Longest Run: ${profileData.longest_run_km || 'Not specified'}km
• Past Injuries: ${profileData.injuries || 'None noted'}
• Strength Training: ${profileData.strength_notes || 'Not specified'}
• Terrain: ${profileData.elevation_context || 'Flat'}
• Goal: ${profileData.goal}
• Race Date: ${profileData.race_date}

TODAY'S WORKOUT:
• Date: ${dayData.specific_date}
• Session: ${dayData.training_session}
• Distance: ${dayData.estimated_distance_km}km
• Structure: ${dayData.mileage_breakdown || 'Not specified'}
• Pace Targets: ${dayData.pace_targets || 'Not specified'}
• Session Load: ${dayData.session_load}
• Purpose: ${dayData.purpose}

Generate ONLY the following fields in this exact format:

HEART_RATE_ZONES: [zones for different segments]
PURPOSE: [detailed purpose and why this workout matters]
SESSION_LOAD: [Low/Medium/High with explanation]
NOTES: [technique focus, form cues, mental tips]
WHAT_TO_EAT_DRINK: [pre/during/post fueling advice]
ADDITIONAL_TRAINING: [strength, mobility, cross-training]
RECOVERY_TRAINING: [foam rolling, stretching, recovery protocols]
ESTIMATED_ELEVATION_GAIN_M: [number only]
ESTIMATED_AVG_POWER_W: [number only]
ESTIMATED_CADENCE_SPM: [number only]
ESTIMATED_CALORIES: [number only]
DAILY_NUTRITION_ADVICE: [calorie target, macros, 2 meal suggestions]`;

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
        max_completion_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API Error:', errorData);
      throw new Error(`OpenAI API Error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Detailed fields generated successfully');
    
    const generatedContent = data.choices[0].message.content;
    if (!generatedContent || generatedContent.trim().length === 0) {
      throw new Error('OpenAI returned empty content');
    }

    // Parse the generated content
    const lines = generatedContent.split('\n').filter(line => line.trim());
    const detailedFields: any = {};

    for (const line of lines) {
      if (line.includes(':')) {
        const [field, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();
        
        switch (field.trim()) {
          case 'HEART_RATE_ZONES':
            detailedFields.heart_rate_zones = value;
            break;
          case 'PURPOSE':
            detailedFields.purpose = value;
            break;
          case 'SESSION_LOAD':
            detailedFields.session_load = value;
            break;
          case 'NOTES':
            detailedFields.notes = value;
            break;
          case 'WHAT_TO_EAT_DRINK':
            detailedFields.what_to_eat_drink = value;
            break;
          case 'ADDITIONAL_TRAINING':
            detailedFields.additional_training = value;
            break;
          case 'RECOVERY_TRAINING':
            detailedFields.recovery_training = value;
            break;
          case 'ESTIMATED_ELEVATION_GAIN_M':
            detailedFields.estimated_elevation_gain_m = parseInt(value) || null;
            break;
          case 'ESTIMATED_AVG_POWER_W':
            detailedFields.estimated_avg_power_w = parseInt(value) || null;
            break;
          case 'ESTIMATED_CADENCE_SPM':
            detailedFields.estimated_cadence_spm = parseInt(value) || null;
            break;
          case 'ESTIMATED_CALORIES':
            detailedFields.estimated_calories = parseInt(value) || null;
            break;
          case 'DAILY_NUTRITION_ADVICE':
            detailedFields.daily_nutrition_advice = value;
            break;
        }
      }
    }

    // Update the training day with detailed fields
    const { data: updatedDay, error: updateError } = await supabase
      .from('training_days')
      .update({
        ...detailedFields,
        detailed_fields_generated: true
      })
      .eq('id', trainingDayId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Database update error:', updateError);
      throw new Error('Failed to save detailed fields to database');
    }

    console.log('Detailed fields saved successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      updatedTrainingDay: updatedDay,
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