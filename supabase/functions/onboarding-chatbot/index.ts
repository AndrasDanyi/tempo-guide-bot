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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { message, conversationHistory, profileData } = await req.json();

// Natural conversation approach that was working before
const currentDate = new Date();
const currentDateString = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD format
const currentYear = currentDate.getFullYear();
const currentMonth = currentDate.getMonth() + 1; // getMonth() is 0-based
const currentDay = currentDate.getDate();

const systemPrompt = `You are a friendly AI running coach collecting profile data. Have a natural conversation and extract information as you go.

IMPORTANT: Today's date is ${currentDateString} (${currentYear}-${currentMonth.toString().padStart(2, '0')}-${currentDay.toString().padStart(2, '0')}). Use this for date calculations and conversations.

REQUIRED FIELDS: full_name, goal, race_date (YYYY-MM-DD), age, height (cm)
OPTIONAL: gender, weight_kg, experience_years, weekly_mileage, race_distance_km, goal_pace_per_km, days_per_week, training_history, injuries, units (default: metric)

Current data: ${JSON.stringify(profileData)}

Parse naturally: "half marathon" = 21km, "Sept 26" = "2025-09-26", "6 feet" = 183cm
Default to METRIC units (km, kg, cm) unless user explicitly mentions imperial (miles, pounds, feet)

CRITICAL EXTRACTION RULES - YOU MUST EXTRACT DATA:
- If user gives their name (like "andy", "peter", "john") → extracted_data: {"full_name": "Andy"}
- If user gives ANY running goal → extracted_data: {"goal": "exact user goal text", "race_distance_km": extracted_distance}
- If user gives a date → extracted_data: {"race_date": "YYYY-MM-DD"} (use smart year logic: if date is after today, assume this year; if before today, assume next year)
- If user gives age → extracted_data: {"age": number}
- If user gives height → extracted_data: {"height": number}

OPTIONAL DATA EXTRACTION - ALSO EXTRACT THESE:
- If user mentions pace/time goals → extracted_data: {"goal_pace_per_km": "pace", "goal_time": "time goal"}
- If user mentions training frequency → extracted_data: {"days_per_week": number}
- If user mentions current mileage → extracted_data: {"current_weekly_mileage": number}
- If user mentions experience → extracted_data: {"experience_years": number}
- If user mentions weight → extracted_data: {"weight_kg": number}
- If user mentions gender → extracted_data: {"gender": "gender"}
- If user mentions injuries → extracted_data: {"injuries": "injury description"}
- If user mentions training history → extracted_data: {"training_history": "history description"}

GOAL EXTRACTION RULES - BE FLEXIBLE:
- Extract the EXACT goal text as the user said it
- Try to extract distance from the goal if mentioned
- Examples:
  * "run 12 km" → {"goal": "run 12 km", "race_distance_km": 12}
  * "run 120km with 3000m elevation" → {"goal": "run 120km with 3000m elevation", "race_distance_km": 120}
  * "run a 10k under 40 mins" → {"goal": "run a 10k under 40 mins", "race_distance_km": 10}
  * "marathon" → {"goal": "marathon", "race_distance_km": 42.2}
  * "half marathon" → {"goal": "half marathon", "race_distance_km": 21.1}
  * "5k" → {"goal": "5k", "race_distance_km": 5}
  * "10k" → {"goal": "10k", "race_distance_km": 10}

EXAMPLES (Today is ${currentDateString}):
- If user says "andy" when asked for name → extracted_data: {"full_name": "Andy"}
- If user says "jan 3rd" → extracted_data: {"race_date": "${currentYear + 1}-01-03"} (since Jan 3rd has passed this year)
- If user says "march 15" → extracted_data: {"race_date": "${currentYear + 1}-03-15"} (since March 15 has passed this year)
- If user says "run 12 km" → extracted_data: {"goal": "run 12 km", "race_distance_km": 12}
- If user says "run 120km with 3000m elevation" → extracted_data: {"goal": "run 120km with 3000m elevation", "race_distance_km": 120}
- If user says "run a 10k under 40 mins" → extracted_data: {"goal": "run a 10k under 40 mins", "race_distance_km": 10}
- If user says "marathon" → extracted_data: {"goal": "marathon", "race_distance_km": 42.2}
- If user says "32" when asked for age → extracted_data: {"age": 32}
- If user says "182" when asked for height → extracted_data: {"height": 182}
- If user says "6 feet" when asked for height → extracted_data: {"height": 183}
- If user says "I want to finish under 16 hours" → extracted_data: {"goal_time": "under 16 hours", "goal_pace_per_km": "8:00/km"}
- If user says "5:30 per km" → extracted_data: {"goal_pace_per_km": "5:30/km"}
- If user says "4 times a week" → extracted_data: {"days_per_week": 4}
- If user says "I run 30km per week" → extracted_data: {"current_weekly_mileage": 30}
- If user says "I've been running for 3 years" → extracted_data: {"experience_years": 3}

Set "ready_for_plan": true ONLY when ALL required fields are collected:
- full_name: user's name
- goal: their running goal  
- race_date: target race date (YYYY-MM-DD format)
- age: their age (number)
- height: their height in cm (number)

Respond with this EXACT JSON structure:
{
  "message": "your natural conversational response",
  "extracted_data": {"field": "value"},
  "missing_required": ["list", "of", "missing", "fields"],
  "confidence": 0.8,
  "ready_for_plan": false
}`;

    // Limit conversation history to last 6 messages for performance
    const recentHistory = conversationHistory.slice(-6);
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentHistory,
      { role: 'user', content: message }
    ];

    console.log('Sending request to OpenAI with messages:', messages.length);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        max_completion_tokens: 4096, // Aim high; retry logic handles caps
        temperature: 0.7, // Higher temperature for more natural conversation
      }),
    });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('OpenAI API Error Status:', response.status);
        console.error('OpenAI API Error Response:', errorData);
        // If the error complains about max token cap, retry with the allowed value
        const match = errorData.match(/max_completion_tokens[^\d]*(\d+)/i);
        if (match) {
          const allowed = parseInt(match[1], 10);
          console.log(`Retrying with max_completion_tokens=${allowed}`);
          const retry = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: messages,
              max_completion_tokens: allowed,
              temperature: 0.7,
            }),
          });
          if (!retry.ok) {
            const retryText = await retry.text();
            throw new Error(`OpenAI API Error: ${retry.status} - ${retryText}`);
          }
          const retryData = await retry.json();
          data = retryData; // use retried response
        } else {
          throw new Error(`OpenAI API Error: ${response.status} - ${errorData}`);
        }
      }

      const data = await response.json();
      const assistantMessage = data.choices[0].message.content;

    console.log('AI Response:', assistantMessage);
    console.log('Current profile data:', profileData);
    console.log('User message:', message);

    let parsedResponse;
    try {
      // Try to parse the JSON response
      if (!assistantMessage || assistantMessage.trim().length === 0) {
        throw new Error('Empty response from AI');
      }
      
      // Clean the response - remove code blocks if present
      let cleanResponse = assistantMessage.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      parsedResponse = JSON.parse(cleanResponse);
      console.log('Parsed response:', parsedResponse);
      console.log('Extracted data:', parsedResponse.extracted_data);
      console.log('Missing required:', parsedResponse.missing_required);
      console.log('Ready for plan:', parsedResponse.ready_for_plan);
    } catch (e) {
      // Enhanced fallback with better error handling
      console.warn('Failed to parse AI response as JSON:', e);
      console.log('Raw AI response was:', assistantMessage);
      
      // Try to extract any useful information from the raw response
      const extractedInfo: any = {};
      const requiredFields = ["full_name", "goal", "race_date", "age", "height"];
      const currentMissing = [...requiredFields];
      
      // Check current profile data to see what we already have
      if (profileData) {
        Object.keys(profileData).forEach(key => {
          if (profileData[key] !== null && profileData[key] !== undefined && profileData[key] !== '') {
            if (currentMissing.includes(key)) {
              currentMissing.splice(currentMissing.indexOf(key), 1);
            }
          }
        });
      }
      
      // Try to extract data from the user's message if JSON parsing failed
      const userMessage = message.toLowerCase().trim();
      
      // Extract name if it's a simple name response
      if (userMessage.length < 20 && /^[a-zA-Z]+$/.test(userMessage)) {
        extractedInfo.full_name = userMessage.charAt(0).toUpperCase() + userMessage.slice(1);
      }
      
      // Extract age if it's a number between 10 and 100
      const ageMatch = userMessage.match(/^(\d{1,2})$/);
      if (ageMatch) {
        const age = parseInt(ageMatch[1]);
        if (age >= 10 && age <= 100) {
          extractedInfo.age = age;
        }
      }
      
      // Extract height if it's a number (cm) or feet/inches
      const heightMatch = userMessage.match(/^(\d{2,3})$/);
      if (heightMatch) {
        const height = parseInt(heightMatch[1]);
        if (height >= 100 && height <= 250) { // reasonable height range in cm
          extractedInfo.height = height;
        }
      }
      
      // Extract height in feet and inches
      const feetInchesMatch = userMessage.match(/(\d+)\s*feet?\s*(\d+)\s*inches?/i);
      if (feetInchesMatch) {
        const feet = parseInt(feetInchesMatch[1]);
        const inches = parseInt(feetInchesMatch[2]);
        const totalInches = feet * 12 + inches;
        const heightCm = Math.round(totalInches * 2.54);
        extractedInfo.height = heightCm;
      }
      
      // Extract height in feet only
      const feetOnlyMatch = userMessage.match(/(\d+)\s*feet?/i);
      if (feetOnlyMatch && !userMessage.includes('inch')) {
        const feet = parseInt(feetOnlyMatch[1]);
        const heightCm = Math.round(feet * 30.48);
        extractedInfo.height = heightCm;
      }
      
      // Extract optional data points
      
      // Extract time goals and pace
      if (userMessage.includes('under') && (userMessage.includes('hour') || userMessage.includes('min'))) {
        const timeMatch = userMessage.match(/under\s+(\d+(?:\.\d+)?)\s*(hour|min)/i);
        if (timeMatch) {
          const time = parseFloat(timeMatch[1]);
          const unit = timeMatch[2].toLowerCase();
          if (unit === 'hour') {
            extractedInfo.goal_time = `under ${time} hours`;
            // Calculate pace if we have distance (assuming from previous context)
            if (extractedInfo.race_distance_km) {
              const pacePerKm = (time * 60) / extractedInfo.race_distance_km;
              const minutes = Math.floor(pacePerKm);
              const seconds = Math.round((pacePerKm - minutes) * 60);
              extractedInfo.goal_pace_per_km = `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
            }
          } else {
            extractedInfo.goal_time = `under ${time} minutes`;
          }
        }
      }
      
      // Extract pace per km
      const paceMatch = userMessage.match(/(\d+):(\d+)\s*per\s*km/i);
      if (paceMatch) {
        const minutes = parseInt(paceMatch[1]);
        const seconds = parseInt(paceMatch[2]);
        extractedInfo.goal_pace_per_km = `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
      }
      
      // Extract training frequency
      const frequencyMatch = userMessage.match(/(\d+)\s*times?\s*a?\s*week/i);
      if (frequencyMatch) {
        extractedInfo.days_per_week = parseInt(frequencyMatch[1]);
      }
      
      // Extract weekly mileage
      const mileageMatch = userMessage.match(/(\d+(?:\.\d+)?)\s*km\s*per\s*week/i);
      if (mileageMatch) {
        extractedInfo.current_weekly_mileage = parseFloat(mileageMatch[1]);
      }
      
      // Extract experience years
      const experienceMatch = userMessage.match(/running\s*for\s*(\d+)\s*years?/i);
      if (experienceMatch) {
        extractedInfo.experience_years = parseInt(experienceMatch[1]);
      }
      
      // Extract weight
      const weightMatch = userMessage.match(/(\d+(?:\.\d+)?)\s*kg/i);
      if (weightMatch) {
        extractedInfo.weight_kg = parseFloat(weightMatch[1]);
      }
      
      // Extract running goals - be flexible and extract any goal
      if (userMessage.includes('run') || userMessage.includes('marathon') || userMessage.includes('k') || userMessage.includes('km') || userMessage.includes('mile')) {
        // Extract the exact goal text
        extractedInfo.goal = message.trim();
        
        // Try to extract distance from the goal
        let distance = null;
        
        // Look for distance patterns
        const kmMatch = userMessage.match(/(\d+(?:\.\d+)?)\s*km/i);
        if (kmMatch) {
          distance = parseFloat(kmMatch[1]);
        } else {
          const kMatch = userMessage.match(/(\d+(?:\.\d+)?)\s*k\b/i);
          if (kMatch) {
            distance = parseFloat(kMatch[1]);
          } else {
            const mileMatch = userMessage.match(/(\d+(?:\.\d+)?)\s*mile/i);
            if (mileMatch) {
              distance = parseFloat(mileMatch[1]) * 1.60934; // convert miles to km
            }
          }
        }
        
        // If no distance found, try common race distances
        if (!distance) {
          if (userMessage.includes('marathon') && !userMessage.includes('half')) {
            distance = 42.2;
          } else if (userMessage.includes('half marathon')) {
            distance = 21.1;
          } else if (userMessage.includes('5k') || userMessage.includes('5 k')) {
            distance = 5;
          } else if (userMessage.includes('10k') || userMessage.includes('10 k')) {
            distance = 10;
          }
        }
        
        if (distance) {
          extractedInfo.race_distance_km = distance;
        }
      }
      
      // Extract dates with smart year logic
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1; // getMonth() is 0-based
      const currentDay = today.getDate();
      
      // Simple date patterns (month day or day month)
      const datePatterns = [
        /(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|september|oct|october|nov|november|dec|december)\s+(\d{1,2})/i,
        /(\d{1,2})\s+(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|september|oct|october|nov|november|dec|december)/i
      ];
      
      for (const pattern of datePatterns) {
        const match = userMessage.match(pattern);
        if (match) {
          let month, day;
          if (pattern.source.includes('\\d{1,2}\\s+')) {
            // day month format
            day = parseInt(match[1]);
            month = match[2];
          } else {
            // month day format
            month = match[1];
            day = parseInt(match[2]);
          }
          
          // Convert month name to number
          const monthNames = {
            'jan': 1, 'january': 1, 'feb': 2, 'february': 2, 'mar': 3, 'march': 3,
            'apr': 4, 'april': 4, 'may': 5, 'jun': 6, 'june': 6, 'jul': 7, 'july': 7,
            'aug': 8, 'august': 8, 'sep': 9, 'september': 9, 'oct': 10, 'october': 10,
            'nov': 11, 'november': 11, 'dec': 12, 'december': 12
          };
          
          const monthNum = monthNames[month.toLowerCase()];
          if (monthNum && day >= 1 && day <= 31) {
            // Smart year logic: if date is after today, assume this year; if before today, assume next year
            let year = currentYear;
            if (monthNum < currentMonth || (monthNum === currentMonth && day < currentDay)) {
              year = currentYear + 1;
            }
            
            const raceDate = `${year}-${monthNum.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            extractedInfo.race_date = raceDate;
            break;
          }
        }
      }
      
      // Update missing fields based on extracted info
      Object.keys(extractedInfo).forEach(key => {
        if (currentMissing.includes(key)) {
          currentMissing.splice(currentMissing.indexOf(key), 1);
        }
      });
      
      // Determine if ready for plan based on missing fields
      const isReadyForPlan = currentMissing.length === 0;
      
      parsedResponse = {
        message: assistantMessage || "I apologize, I'm having trouble processing that. Could you please rephrase your response?",
        extracted_data: extractedInfo,
        missing_required: currentMissing,
        confidence: 0.3,
        ready_for_plan: isReadyForPlan
      };
    }

    return new Response(JSON.stringify(parsedResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in onboarding-chatbot function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});