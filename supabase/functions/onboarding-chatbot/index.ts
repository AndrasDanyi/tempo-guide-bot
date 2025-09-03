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

CONVERSATION RULES:
1. Be conversational, friendly, and encouraging
2. Ask questions naturally, don't make it feel like a form
3. Ask follow-up questions based on their answers
4. If they mention something relevant to multiple fields, extract all the information
5. Prioritize required fields but gather optional ones naturally
6. If they seem unsure about optional fields, reassure them it's okay to skip
7. When you have enough information for a basic plan (required fields + some optional), mention they can generate their plan

RESPONSE FORMAT:
Always respond with a JSON object containing:
{
  "message": "Your conversational response to the user",
  "extracted_data": {
    // Only include fields you've confidently extracted from the conversation
    // Use the exact field names listed above
  },
  "missing_required": ["field1", "field2"], // List any required fields still missing
  "confidence": 0.8, // Your confidence in the extracted data (0-1)
  "ready_for_plan": false // Set to true when you have required fields + reasonable optional data
}

Be natural and don't overwhelm them with too many questions at once. Extract information as the conversation flows.`;

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
        model: 'gpt-5-nano-2025-08-07',
        messages: messages,
        max_completion_tokens: 1000,
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
      parsedResponse = JSON.parse(assistantMessage);
    } catch (e) {
      // Fallback if response isn't valid JSON
      console.warn('Failed to parse AI response as JSON:', e);
      parsedResponse = {
        message: assistantMessage,
        extracted_data: {},
        missing_required: ["full_name", "goal", "race_date", "age", "height"],
        confidence: 0.5,
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