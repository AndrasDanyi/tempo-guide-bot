import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

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

    const { planId, planText } = await req.json();

    if (!planId || !planText) {
      throw new Error('Plan ID and text are required');
    }

    console.log('Parsing training plan:', planId);
    console.log('Plan text length:', planText.length);

    // Parse the training plan text
    const lines = planText.trim().split('\n').filter(line => line.trim());
    const trainingDays = [];

    for (const line of lines) {
      // Skip empty lines or lines that don't match the format
      if (!line.includes('|')) continue;

      const parts = line.split('|').map(part => part.trim());
      if (parts.length !== 6) {
        console.warn('Skipping malformed line:', line);
        continue;
      }

      const [
        dateStr,
        workoutType,
        description,
        duration,
        distance,
        pace
      ] = parts;

      // Parse distance (handle N/A or invalid values)
      let estimatedDistanceKm = null;
      if (distance && distance !== 'N/A' && distance !== '0 miles' && distance !== '0') {
        // Extract numeric value from distance string like "3-4 miles"
        const distanceMatch = distance.match(/(\d+(?:\.\d+)?)/);
        if (distanceMatch) {
          estimatedDistanceKm = parseFloat(distanceMatch[1]) * 1.60934; // Convert miles to km
        }
      }

      const trainingDay = {
        user_id: user.id,
        training_plan_id: planId,
        date: dateStr,
        training_session: workoutType,
        mileage_breakdown: description === 'N/A' ? null : description,
        pace_targets: pace === 'N/A' ? null : pace,
        estimated_distance_km: estimatedDistanceKm,
        estimated_moving_time: duration === 'N/A' || duration === '0 min' ? null : duration,
        detailed_fields_generated: false
      };

      trainingDays.push(trainingDay);
    }

    console.log('Parsed training days:', trainingDays.length);

    if (trainingDays.length === 0) {
      throw new Error('No valid training days found in the plan text');
    }

    // Delete existing training days for this plan (in case of regeneration)
    const { error: deleteError } = await supabase
      .from('training_days')
      .delete()
      .eq('training_plan_id', planId);

    if (deleteError) {
      console.error('Error deleting existing training days:', deleteError);
      // Don't throw here, just log - we can still insert new ones
    }

    // Insert the parsed training days
    const { data: insertedDays, error: insertError } = await supabase
      .from('training_days')
      .insert(trainingDays)
      .select();

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw new Error('Failed to save parsed training days to database');
    }

    console.log('Successfully saved', insertedDays?.length || 0, 'training days');

    return new Response(JSON.stringify({ 
      success: true, 
      parsedDays: insertedDays?.length || 0,
      message: 'Training plan parsed and saved successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in parse-training-plan function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});