import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface OnboardingChatbotProps {
  onProfileComplete: (profileData: any) => void;
  initialMessage?: string;
}

const OnboardingChatbot = ({ onProfileComplete, initialMessage = "Hi! I'm your AI running coach assistant. I'd love to help you create a personalized training plan. Let's start with your name - what should I call you?" }: OnboardingChatbotProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: initialMessage,
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<any>({});
  const [missingRequired, setMissingRequired] = useState<string[]>(['full_name', 'goal', 'race_date', 'age', 'height']);
  const [isReadyForPlan, setIsReadyForPlan] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Required fields for progress calculation
  const requiredFields = ['full_name', 'goal', 'race_date', 'age', 'height'];
  const progressPercentage = ((requiredFields.length - missingRequired.length) / requiredFields.length) * 100;

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollAreaRef.current) {
        const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollElement) {
          scrollElement.scrollTop = scrollElement.scrollHeight;
        }
      }
    };
    
    // Use setTimeout to ensure DOM is updated before scrolling
    const timeoutId = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeoutId);
  }, [messages]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || !user) return;

    const userMessage: Message = {
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const conversationHistory = [...messages, userMessage].map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const { data, error } = await supabase.functions.invoke('onboarding-chatbot', {
        body: {
          message: userMessage.content,
          conversationHistory: conversationHistory,
          profileData: extractedData
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Update extracted data
      if (data.extracted_data && Object.keys(data.extracted_data).length > 0) {
        setExtractedData(prev => ({ ...prev, ...data.extracted_data }));
      }
      
      setMissingRequired(data.missing_required || []);
      setIsReadyForPlan(data.ready_for_plan || false);

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const generatePlan = async () => {
    if (!isReadyForPlan) return;

    try {
      // Prepare profile payload with correct column mapping
      const toSave: any = {
        user_id: user!.id,
        email: user!.email,
        units: extractedData.units || 'metric',
        full_name: extractedData.full_name,
        goal: extractedData.goal,
        race_date: extractedData.race_date ? new Date(extractedData.race_date).toISOString().split('T')[0] : null,
        race_distance_km: extractedData.race_distance_km,
        age: extractedData.age,
        height: extractedData.height,
        weight_kg: extractedData.weight_kg,
        gender: extractedData.gender,
        experience_years: extractedData.experience_years,
        days_per_week: extractedData.days_per_week,
        goal_pace_per_km: extractedData.goal_pace_per_km,
        // Map weekly_mileage -> current_weekly_mileage (DB column)
        current_weekly_mileage: extractedData.current_weekly_mileage ?? extractedData.weekly_mileage ?? null,
      };

      // Remove undefined to avoid overwriting with nulls unnecessarily
      Object.keys(toSave).forEach((k) => (toSave[k] === undefined ? delete toSave[k] : null));

      // Upsert profile (insert or update by user_id)
      const { data: profile, error: upsertError } = await supabase
        .from('profiles')
        .upsert(toSave, { onConflict: 'user_id' })
        .select()
        .single();

      if (upsertError) {
        throw upsertError;
      }

      toast({
        title: 'Profile saved!',
        description: 'Generating your personalized training plan...',
      });

      onProfileComplete(profile);
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: 'Error saving profile',
        description: 'Please try again. If the problem persists, contact support.',
        variant: 'destructive',
      });
    }
  };

  const getFieldLabel = (field: string) => {
    const labels: Record<string, string> = {
      full_name: 'Name',
      goal: 'Running Goal',
      race_date: 'Race Date',
      age: 'Age',
      height: 'Height',
      weight_kg: 'Weight',
      gender: 'Gender',
      experience_years: 'Experience',
      current_weekly_mileage: 'Weekly Mileage',
      longest_run_km: 'Longest Run',
      race_distance_km: 'Race Distance',
      race_name: 'Race Name',
      days_per_week: 'Training Days'
    };
    return labels[field] || field;
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            <CardTitle>AI Running Coach Chat</CardTitle>
          </div>
          
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Profile Progress</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <div className="flex gap-1 flex-wrap">
              {requiredFields.map(field => (
                <Badge
                  key={field}
                  variant={missingRequired.includes(field) ? "outline" : "default"}
                  className="text-xs"
                >
                  {getFieldLabel(field)}
                </Badge>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Chat Messages */}
          <ScrollArea className="h-96 w-full border rounded-lg p-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                  )}
                  
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground ml-auto'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <span className="text-xs opacity-70 mt-1 block">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {message.role === 'user' && (
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-secondary-foreground" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary animate-pulse" />
                    </div>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type your response..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              size="sm"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Generate Plan Button */}
          {isReadyForPlan && (
            <Button
              onClick={generatePlan}
              className="w-full"
              size="lg"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate My Training Plan
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Data Preview */}
      {Object.keys(extractedData).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Extracted Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              {Object.entries(extractedData).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="font-medium">{getFieldLabel(key)}:</span>
                  <span className="text-muted-foreground">{String(value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OnboardingChatbot;