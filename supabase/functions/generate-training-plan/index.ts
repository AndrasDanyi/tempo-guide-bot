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

    // Fetch Strava data if available
    let stravaData = null;
    try {
      const { data: stravaStats } = await supabase
        .from('strava_stats')
        .select('*')
        .eq('user_id', user.id)
        .eq('period_type', 'recent')
        .single();

      const { data: recentActivities } = await supabase
        .from('strava_activities')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_date', new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('start_date', { ascending: false })
        .limit(10);

      if (stravaStats || (recentActivities && recentActivities.length > 0)) {
        stravaData = {
          stats: stravaStats,
          recentActivities: recentActivities || []
        };
        console.log('Found Strava data:', {
          hasStats: !!stravaStats,
          activityCount: recentActivities?.length || 0
        });
      }
    } catch (error) {
      console.log('No Strava data found or error fetching:', error);
    }

    // Calculate days between today and race day, with fallback if race_date is in the past
    const today = new Date();
    const originalRaceDate = new Date(profileData.race_date);
    let targetDate = new Date(originalRaceDate);
    let daysDifference = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

    if (!isFinite(daysDifference) || isNaN(daysDifference)) {
      throw new Error('Invalid race_date');
    }

    // If race date is past or today, default to a 12-week plan from today
    if (daysDifference < 1) {
      daysDifference = 7 * 12; // 12 weeks
      targetDate = new Date(today);
      targetDate.setDate(today.getDate() + daysDifference);
      console.log('Race date in the past; defaulting to 12-week plan ending on', targetDate.toISOString().split('T')[0]);
    }

    // Save initial training plan entry
    const { data: savedPlan, error: saveError } = await supabase
      .from('training_plans')
      .insert({
        user_id: user.id,
        profile_id: profileData.id,
        plan_content: { text: 'Generating...' },
        start_date: today.toISOString().split('T')[0],
        end_date: targetDate.toISOString().split('T')[0],
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
      
      if (weekEnd > targetDate) {
        weekEnd.setTime(targetDate.getTime());
      }

      weekPromises.push(generateWeek(weekStart, weekEnd, profileData, openAIApiKey, week + 1, weeks, stravaData));
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
async function generateWeek(startDate: Date, endDate: Date, profileData: any, openAIApiKey: string, weekNum: number, totalWeeks: number, stravaData: any = null) {
  const days = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    days.push(currentDate.toISOString().split('T')[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  let prompt = `Generate week ${weekNum}/${totalWeeks} of training (${days.length} days) for a ${profileData.race_distance_km || 21}km race:

Profile: ${profileData.experience_years || 'Beginner'} years, ${profileData.current_weekly_mileage || 30}km/week, goal pace ${profileData.goal_pace_per_km || '5:30'}/km, ${profileData.days_per_week || 5} days/week`;

  // Add Strava data to prompt if available
  if (stravaData) {
    prompt += `\n\nStrava Training Data (use this to personalize the plan):
Recent Training Stats: ${stravaData.stats ? `${stravaData.stats.count} runs, ${Math.round(stravaData.stats.distance/1000)}km total, ${Math.round(stravaData.stats.moving_time/3600)}h moving time` : 'No stats available'}

Recent Activities (last 6 months):`;
    
    if (stravaData.recentActivities && stravaData.recentActivities.length > 0) {
      stravaData.recentActivities.slice(0, 5).forEach((activity: any, index: number) => {
        const distance = Math.round(activity.distance / 1000 * 10) / 10;
        const duration = Math.round(activity.moving_time / 60);
        const pace = activity.average_speed ? Math.round(1000 / activity.average_speed / 60) + ':' + Math.round((1000 / activity.average_speed) % 60).toString().padStart(2, '0') + '/km' : 'N/A';
        prompt += `\n${index + 1}. ${activity.name} - ${distance}km in ${duration}min (${pace})`;
      });
    } else {
      prompt += '\nNo recent activities found';
    }
    
    prompt += '\n\nUse this Strava data to create a more personalized training plan that builds on their actual training patterns and current fitness level.';
  }

  prompt += `\n\nReturn JSON array of training days:
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
      max_completion_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error(`Week ${weekNum} OpenAI error:`, errorData);
    // Retry with allowed token limit if the error indicates a max token cap
    const match = errorData.match(/max_completion_tokens[^\d]*(\d+)/i);
    if (match) {
      const allowed = parseInt(match[1], 10);
      console.log(`Retrying week ${weekNum} with max_completion_tokens=${allowed}`);
      const retry = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-mini-2025-08-07',
          messages: [ { role: 'user', content: prompt } ],
          max_completion_tokens: allowed,
        }),
      });
      if (!retry.ok) {
        const retryText = await retry.text();
        throw new Error(`Week ${weekNum} generation failed after retry: ${retry.status} - ${retryText}`);
      }
      const retryData = await retry.json();
      const retryContent = retryData.choices[0].message.content;
      try {
        return JSON.parse(retryContent);
      } catch (e) {
        console.error(`Failed to parse retried week ${weekNum} JSON:`, retryContent);
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
    throw new Error(`Week ${weekNum} generation failed: ${response.status} - ${errorData}`);
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