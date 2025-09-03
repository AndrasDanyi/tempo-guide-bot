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

const systemPrompt = `You are a friendly AI running coach assistant helping runners create their personalized training plan. Your job is to collect their profile information through a natural conversation.

CRITICAL: You MUST ALWAYS respond with VALID JSON. Never respond with plain text or incomplete JSON.

REQUIRED FIELDS TO COLLECT:
1. full_name (string) - Their full name
2. goal (string) - Their running goal (e.g., "Run a sub-3 hour marathon")
3. race_date (date) - When is their goal race/event (YYYY-MM-DD format)
4. age (number) - How old are they
5. height (number) - Height in centimeters

OPTIONAL FIELDS TO COLLECT:
- gender (string) - male, female, other, or prefer-not-to-say
- weight_kg (number) - Weight in kilograms
- experience_years (number) - Years of running experience
- current_weekly_mileage (number) - Current weekly kilometers
- longest_run_km (number) - Longest recent run in km
- race_distance_km (number) - Target race distance in km
- race_name (string) - Name of the race/event
- race_surface (string) - road, trail, track, or mixed
- goal_pace_per_km (string) - Target pace like "4:30" or "5:00"
- days_per_week (number) - Training days per week (3-7)
- elevation_context (string) - flat, hilly, mountainous, or mixed
- units (string) - metric or imperial
- time_limits (string) - Any time constraints or schedule notes
- training_history (string) - Description of their running background
- race_results (string) - Recent race times and performances
- strength_notes (string) - Strength training habits
- injuries (string) - Current or recent injuries
- further_notes (string) - Any additional information

CURRENT PROFILE DATA: ${JSON.stringify(profileData)}

NATURAL LANGUAGE PARSING RULES:
- Convert relative dates to YYYY-MM-DD format (e.g., "Sept 26th" = "2025-09-26", "March 15" = "2025-03-15")
- Extract distances from natural text (e.g., "200+ km" = 200, "half marathon" = 21, "marathon" = 42)
- Parse heights with units (e.g., "182 cm" = 182, "6 feet" = 183)
- Extract paces from text (e.g., "under 4 minutes per km" = "4:00")
- Convert race types to distances (e.g., "5K" = 5, "10K" = 10, "half marathon" = 21, "marathon" = 42, "ultra" = 50+)
- Make intelligent assumptions about missing context (current year, metric units, etc.)

CONVERSATION RULES:
1. Be conversational, friendly, and encouraging
2. Ask questions naturally, don't make it feel like a form
3. Ask follow-up questions based on their answers
4. If they mention something relevant to multiple fields, extract all the information
5. Prioritize required fields but gather optional ones naturally
6. If they seem unsure about optional fields, reassure them it's okay to skip
7. When you have enough information for a basic plan (required fields + some optional), mention they can generate their plan

RESPONSE FORMAT - YOU MUST ALWAYS RESPOND WITH THIS EXACT JSON STRUCTURE:
{
  "message": "Your conversational response to the user",
  "extracted_data": {
    // Only include fields you've confidently extracted from the conversation
    // Use the exact field names listed above
    // Convert natural language to proper formats
  },
  "missing_required": ["field1", "field2"], // List any required fields still missing
  "confidence": 0.8, // Your confidence in the extracted data (0-1)
  "ready_for_plan": false // Set to true when you have required fields + reasonable optional data
}

CRITICAL: Never respond with anything other than valid JSON. If you're uncertain about parsing something, make your best educated guess and note lower confidence.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
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
        model: 'gpt-5-2025-08-07',
        messages: messages,
        max_completion_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API Error:', errorData);
      throw new Error(`OpenAI API Error: ${response.status}`);
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