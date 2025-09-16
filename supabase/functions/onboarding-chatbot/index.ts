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

// Optimize prompt to reduce token usage while maintaining functionality
const systemPrompt = `You are a friendly AI running coach collecting profile data. Respond ONLY in valid JSON.

REQUIRED: full_name, goal, race_date (YYYY-MM-DD), age, height (cm)
OPTIONAL: gender, weight_kg, experience_years, weekly_mileage, race_distance_km, goal_pace_per_km, days_per_week, training_history, injuries, units (default: metric)

Current data: ${JSON.stringify(profileData)}

Parse naturally: "half marathon" = 21km, "Sept 26" = "2025-09-26", "6 feet" = 183cm
Default to METRIC units (km, kg, cm) unless user explicitly mentions imperial (miles, pounds, feet)

JSON format:
{
  "message": "friendly response",
  "extracted_data": {},
  "missing_required": [],
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
        // temperature not supported in GPT-4.1+ models
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

    let parsedResponse;
    try {
      // Try to parse the JSON response
      if (!assistantMessage || assistantMessage.trim().length === 0) {
        throw new Error('Empty response from AI');
      }
      parsedResponse = JSON.parse(assistantMessage);
    } catch (e) {
      // Enhanced fallback with better error handling
      console.warn('Failed to parse AI response as JSON:', e);
      console.log('Raw AI response was:', assistantMessage);
      
      // Try to extract any useful information from the raw response
      const extractedInfo: any = {};
      const currentMissing = ["full_name", "goal", "race_date", "age", "height"];
      
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
      
      parsedResponse = {
        message: assistantMessage || "I apologize, I'm having trouble processing that. Could you please rephrase your response?",
        extracted_data: extractedInfo,
        missing_required: currentMissing,
        confidence: 0.3,
        ready_for_plan: false
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