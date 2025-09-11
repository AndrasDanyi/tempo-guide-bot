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

    // Save initial training plan entry
    const { data: savedPlan, error: saveError } = await supabase
      .from('training_plans')
      .insert({
        user_id: user.id,
        profile_id: profileData.id,
        plan_content: { text: 'Generating...' },
        start_date: today.toISOString().split('T')[0],
        end_date: profileData.race_date,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Database save error:', saveError);
      throw new Error('Failed to save training plan to database');
    }

    // Generate plan in weekly batches for better performance
    const weekSize = 7;
    const weeks = Math.ceil(daysDifference / weekSize);
    const allTrainingDays = [];

    console.log(`Generating ${weeks} weeks in parallel...`);

    // Process weeks in parallel
    const weekPromises = [];
    for (let week = 0; week < weeks; week++) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + (week * weekSize));
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + weekSize - 1);
      
      if (weekEnd > raceDate) {
        weekEnd.setTime(raceDate.getTime());
      }

      weekPromises.push(generateWeek(weekStart, weekEnd, profileData, openAIApiKey, week + 1, weeks));
    }

    const weekResults = await Promise.all(weekPromises);
    weekResults.forEach(weekDays => allTrainingDays.push(...weekDays));

    console.log(`Generated ${allTrainingDays.length} training days across ${weeks} weeks`);

    // Insert all training days at once
    const { error: insertError } = await supabase
      .from('training_days')
      .insert(allTrainingDays.map(day => ({
        training_plan_id: savedPlan.id,
        user_id: user.id,
        date: day.date,
        training_session: day.workout_type,
        mileage_breakdown: day.description,
        pace_targets: day.pace,
        estimated_distance_km: day.distance_km,
        estimated_moving_time: day.duration,
        detailed_fields_generated: false
      })));

    if (insertError) {
      console.error('Error inserting training days:', insertError);
      throw new Error('Failed to save training days');
    }

    // Update plan with completion status
    const completePlanText = allTrainingDays.map(day => 
      `${day.date}|${day.workout_type}|${day.description}|${day.duration}|${day.distance}|${day.pace}`
    ).join('\n');

    await supabase
      .from('training_plans')
      .update({ 
        plan_content: { text: completePlanText }
      })
      .eq('id', savedPlan.id);

    return new Response(JSON.stringify({ 
      success: true, 
      planId: savedPlan.id,
      message: 'Training plan generated successfully with weekly batches',
      totalDays: allTrainingDays.length
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

// Helper function to generate a single week
async function generateWeek(startDate: Date, endDate: Date, profileData: any, openAIApiKey: string, weekNum: number, totalWeeks: number) {
  const days = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    days.push(currentDate.toISOString().split('T')[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const prompt = `Generate week ${weekNum}/${totalWeeks} of training (${days.length} days) for a ${profileData.race_distance_km || 21}km race:

Profile: ${profileData.experience_years || 'Beginner'} years, ${profileData.current_weekly_mileage || 30}km/week, goal pace ${profileData.goal_pace_per_km || '5:30'}/km, ${profileData.days_per_week || 5} days/week

Return JSON array of training days:
[{
  "date": "YYYY-MM-DD",
  "workout_type": "Easy Run|Tempo Run|Long Run|Intervals|Rest",
  "description": "brief description",
  "duration": "30 min",
  "distance": "5 km",
  "distance_km": 5.0,
  "pace": "Easy (5:30-6:00/km)"
}]

Dates: ${days.join(', ')}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-mini-2025-08-07', // Faster model
      messages: [
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`Week ${weekNum} generation failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  try {
    return JSON.parse(content);
  } catch (e) {
    console.error(`Failed to parse week ${weekNum} JSON:`, content);
    // Fallback to simple format
    return days.map(date => ({
      date,
      workout_type: weekNum % 2 === 1 ? 'Easy Run' : 'Rest',
      description: 'Generated training day',
      duration: '30 min',
      distance: '5 km',
      distance_km: 5.0,
      pace: 'Easy (5:30-6:00/km)'
    }));
  }
}