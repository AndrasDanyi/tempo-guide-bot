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

    const prompt = `Generate training details for this workout. Use EXACTLY this format:

HEART_RATE_ZONES: Zone 1 (60-70% max HR) for warm-up, Zone 2 (70-80% max HR) for main session
PURPOSE: Build aerobic base and improve running economy
SESSION_LOAD: Medium - moderate training stress with good recovery
NOTES: Focus on relaxed shoulders, midfoot strike, and breathing rhythm
WHAT_TO_EAT_DRINK: Pre: banana 30min before. During: water every 15min. Post: protein shake within 30min
ADDITIONAL_TRAINING: 15min core work, 10min glute activation
RECOVERY_TRAINING: 10min foam rolling, hip flexor stretches, calf stretches
ESTIMATED_ELEVATION_GAIN_M: 50
ESTIMATED_AVG_POWER_W: 280
ESTIMATED_CADENCE_SPM: 180
ESTIMATED_CALORIES: 350
DAILY_NUTRITION_ADVICE: Target 2200 calories. Breakfast: oatmeal with berries. Dinner: salmon with quinoa

Workout: ${dayData.training_session} on ${dayData.date}
Distance: ${dayData.estimated_distance_km || 'N/A'}km
Duration: ${dayData.estimated_moving_time || 'N/A'}
Structure: ${dayData.mileage_breakdown || 'Standard workout'}
Pace: ${dayData.pace_targets || 'Easy effort'}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-nano-2025-08-07',
        messages: [
          { role: 'system', content: 'You are a running coach. Generate detailed training information in the exact format requested. Be concise and practical.' },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 50000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API Error:', errorData);
      throw new Error(`OpenAI API Error: ${response.status}`);
    }

    const data = await response.json();
    console.log('OpenAI response received:', data);
    
    const generatedContent = data.choices[0]?.message?.content;
    if (!generatedContent || generatedContent.trim().length === 0) {
      console.error('OpenAI returned empty or invalid content:', data);
      
      // Retry with a simpler prompt
      console.log('Retrying with simplified prompt...');
      const simplePrompt = `Generate basic training details for: ${dayData.training_session}. Include heart rate zones, purpose, calories estimate, and basic notes.`;
      
      const retryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-nano-2025-08-07',
          messages: [
            { role: 'system', content: 'You are a running coach. Be brief and practical.' },
            { role: 'user', content: simplePrompt }
          ],
          max_completion_tokens: 1000,
        }),
      });

      if (retryResponse.ok) {
        const retryData = await retryResponse.json();
        const retryContent = retryData.choices[0]?.message?.content;
        if (retryContent && retryContent.trim().length > 0) {
          console.log('Retry successful, using simplified content');
          // Create a basic structured response
          const basicFields = {
            heart_rate_zones: 'Zone 1-2 (Easy-Moderate effort)',
            purpose: 'Training adaptation and fitness building',
            session_load: 'Moderate',
            notes: retryContent.substring(0, 200),
            estimated_calories: 300,
            estimated_cadence_spm: 180,
            estimated_elevation_gain_m: 0,
            estimated_avg_power_w: null,
            what_to_eat_drink: 'Hydrate well before, during, and after',
            additional_training: 'Light stretching',
            recovery_training: 'Rest and hydration',
            daily_nutrition_advice: 'Balanced diet with adequate carbs and protein'
          };
          
          // Update database with basic fields
          const { data: updatedDay, error: updateError } = await supabase
            .from('training_days')
            .update({
              ...basicFields,
              detailed_fields_generated: true
            })
            .eq('id', trainingDayId)
            .eq('user_id', user.id)
            .select()
            .single();

          if (updateError) {
            console.error('Database update error:', updateError);
            throw new Error('Failed to save basic fields to database');
          }

          return new Response(JSON.stringify({ 
            success: true, 
            updatedTrainingDay: updatedDay,
            message: 'Basic details generated successfully'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      
      throw new Error('Failed to generate workout details after retry');
    }
    
    console.log('Generated content:', generatedContent);

    // Parse the generated content
    const lines = generatedContent.split('\n').filter(line => line.trim());
    const detailedFields: any = {};

    // Set default values first
    detailedFields.heart_rate_zones = 'Zone 1-2 (Easy-Moderate effort)';
    detailedFields.purpose = 'Training adaptation and fitness building';
    detailedFields.session_load = 'Moderate';
    detailedFields.notes = 'Focus on form and breathing';
    detailedFields.estimated_calories = 300;
    detailedFields.estimated_cadence_spm = 180;
    detailedFields.estimated_elevation_gain_m = 0;
    detailedFields.what_to_eat_drink = 'Hydrate well before, during, and after';
    detailedFields.additional_training = 'Light stretching';
    detailedFields.recovery_training = 'Rest and hydration';
    detailedFields.daily_nutrition_advice = 'Balanced diet with adequate carbs and protein';

    // Parse the structured response and override defaults
    for (const line of lines) {
      if (line.includes(':')) {
        const [field, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();
        
        if (!value) continue; // Skip empty values
        
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
            const elevation = parseInt(value);
            if (!isNaN(elevation)) detailedFields.estimated_elevation_gain_m = elevation;
            break;
          case 'ESTIMATED_AVG_POWER_W':
            const power = parseInt(value);
            if (!isNaN(power)) detailedFields.estimated_avg_power_w = power;
            break;
          case 'ESTIMATED_CADENCE_SPM':
            const cadence = parseInt(value);
            if (!isNaN(cadence)) detailedFields.estimated_cadence_spm = cadence;
            break;
          case 'ESTIMATED_CALORIES':
            const calories = parseInt(value);
            if (!isNaN(calories)) detailedFields.estimated_calories = calories;
            break;
          case 'DAILY_NUTRITION_ADVICE':
            detailedFields.daily_nutrition_advice = value;
            break;
        }
      }
    }

    console.log('Parsed detailed fields:', detailedFields);

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