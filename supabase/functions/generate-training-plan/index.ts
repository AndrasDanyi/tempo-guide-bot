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
        // Note: Additional comprehensive training data fields (additional_training, recovery_instructions, 
        // nutrition_guidance, evaluation_questions) are generated by AI but not stored in database yet
        // These can be added to the database schema in the future for enhanced functionality
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

  // Create comprehensive user profile summary for AI
  const userProfile = {
    name: profileData.full_name || 'User',
    goal: profileData.goal || 'Complete the race',
    raceDistance: profileData.race_distance_km || 21,
    raceDate: profileData.race_date,
    goalTime: profileData.goal_time || 'Not specified',
    goalPace: profileData.goal_pace_per_km || 'Not specified',
    age: profileData.age || 'Not specified',
    height: profileData.height || 'Not specified',
    weight: profileData.weight_kg || 'Not specified',
    gender: profileData.gender || 'Not specified',
    experience: profileData.experience_years || 'Not specified',
    currentWeeklyMileage: profileData.current_weekly_mileage || 'Not specified',
    daysPerWeek: profileData.days_per_week || 'Not specified',
    injuries: profileData.injuries || 'None reported',
    trainingHistory: profileData.training_history || 'Not specified',
    furtherNotes: profileData.further_notes || 'None'
  };

  let prompt = `You are a world-class running coach with expertise in all levels of runners—from beginners to elite athletes—and across all race distances and goals. Your task is to create a fully personalized running training plan that is safe, effective, and optimized for performance, recovery, and injury prevention.

Athlete Information:
• Goal: ${userProfile.goal}
• Target finish time or distance: ${userProfile.goalTime} for ${userProfile.raceDistance}km
• Race/event date: ${userProfile.raceDate}
• Start date of training: ${days[0]}
• Current weekly mileage: ${userProfile.currentWeeklyMileage}km
• Typical pace or recent race results: ${userProfile.goalPace}
• Running experience: ${userProfile.experience} years
• Available training days per week: ${userProfile.daysPerWeek}
• Time-of-day preference: Not specified
• Injuries, limitations, or medical conditions: ${userProfile.injuries}
• Equipment or environment constraints: Not specified

Optional Information:
• Cross-training experience: Not specified
• Strength training experience: Not specified
• Nutrition preferences: Not specified
• Heart rate zones: Not specified
• Sleep and recovery habits: Not specified
• Lifestyle constraints: Not specified

Plan Requirements for Week ${weekNum}/${totalWeeks}:
1. Running Sessions:
   • Include warm-up, main set, and cooldown
   • Specify distance, pace, heart rate zone, effort, and purpose
   • Include interval, tempo, long, and easy runs as appropriate
   • Weekly mileage progression based on experience
2. Strength & Mobility:
   • Include 1–3 weekly sessions with exercises, sets, and reps
   • Focus on injury prevention and running efficiency
3. Recovery & Rest:
   • Rest day guidance, active recovery, stretching, foam rolling, mobility
   • Include sleep and fatigue management advice
4. Nutrition & Hydration:
   • Pre-, during, and post-run fueling
   • General daily calorie and macronutrient guidance

Additional Instructions:
• Use the latest science-based training methods
• Tailor the plan to the runner's ability, experience, and goals
• Ensure progressive overload while preventing injury
• Include variety to avoid monotony and optimize performance
• Explain reasoning for key sessions or changes to the plan`;

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

  prompt += `\n\nOutput Format:
Provide a day-by-day plan for the following dates: ${days.join(', ')}

Return JSON array with this structure:
[{
  "date": "YYYY-MM-DD",
  "workout_type": "Long Run|Interval|Tempo Run|Easy Run|Recovery Run|Strength Training|Mobility|Rest Day",
  "description": "COMPREHENSIVE SESSION BREAKDOWN: Warm-up: [details], Main set: [details with purpose and effort level], Cooldown: [details]. Additional Training: [strength/mobility exercises]. Recovery: [stretching, foam rolling, sleep guidance]. Nutrition: [pre/during/post-run fueling]. Evaluation: [questions for tracking progress]",
  "duration": "XX min",
  "distance": "X.X km",
  "distance_km": X.X,
  "pace": "Specific pace range with heart rate zones and effort description"
}]

IMPORTANT: 
• Create VARIED and PROGRESSIVE workouts specific to this runner's ${userProfile.raceDistance}km goal
• Each day should be unique with different focus areas
• Include proper warm-up and cooldown for each session
• Consider their experience level (${userProfile.experience} years) and current fitness
• Build appropriately for week ${weekNum} of ${totalWeeks}
• Use science-based training principles for optimal performance and injury prevention`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o', // Better quality for training plans
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
          model: 'gpt-4o',
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
        // Create varied fallback workouts based on user profile
        const workoutTypes = ['Easy Run', 'Tempo Run', 'Long Run', 'Intervals', 'Recovery Run', 'Rest'];
        const distances = [3, 5, 8, 10, 12, 15];
        const durations = ['25 min', '35 min', '45 min', '60 min', '75 min', '90 min'];
        
        return days.map((date, index) => {
          const workoutType = workoutTypes[index % workoutTypes.length];
          const distance = distances[index % distances.length];
          const duration = durations[index % durations.length];
          
          return {
            date,
            workout_type: workoutType,
            description: `Personalized ${workoutType} for ${userProfile.raceDistance}km goal - Warm-up: 10min easy, Main set: ${workoutType === 'Rest' ? 'Complete rest' : 'As prescribed'}, Cooldown: 10min easy. Additional: ${workoutType === 'Rest' ? 'Light stretching and mobility' : 'Post-run strength exercises'}. Recovery: Focus on sleep, hydration, and proper nutrition. Nutrition: Pre-run: light snack, During: water/electrolytes, Post-run: protein + carbs.`,
            duration,
            distance: `${distance} km`,
            distance_km: distance,
            pace: workoutType === 'Rest' ? 'Rest Day' : `Based on ${userProfile.goalPace} target pace`
          };
        });
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
    // Create varied fallback workouts based on user profile
    const workoutTypes = ['Easy Run', 'Tempo Run', 'Long Run', 'Intervals', 'Recovery Run', 'Rest'];
    const distances = [3, 5, 8, 10, 12, 15];
    const durations = ['25 min', '35 min', '45 min', '60 min', '75 min', '90 min'];
    
    return days.map((date, index) => {
      const workoutType = workoutTypes[index % workoutTypes.length];
      const distance = distances[index % distances.length];
      const duration = durations[index % durations.length];
      
      return {
        date,
        workout_type: workoutType,
        description: `Personalized ${workoutType} for ${userProfile.raceDistance}km goal - Warm-up: 10min easy, Main set: ${workoutType === 'Rest' ? 'Complete rest' : 'As prescribed'}, Cooldown: 10min easy. Additional: ${workoutType === 'Rest' ? 'Light stretching and mobility' : 'Post-run strength exercises'}. Recovery: Focus on sleep, hydration, and proper nutrition. Nutrition: Pre-run: light snack, During: water/electrolytes, Post-run: protein + carbs.`,
        duration,
        distance: `${distance} km`,
        distance_km: distance,
        pace: workoutType === 'Rest' ? 'Rest Day' : `Based on ${userProfile.goalPace} target pace`
      };
    });
  }
}