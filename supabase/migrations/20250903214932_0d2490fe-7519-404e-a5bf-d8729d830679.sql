-- Create training_days table for parsed daily training data
CREATE TABLE public.training_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  training_plan_id UUID NOT NULL REFERENCES public.training_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  
  -- Essential fields (Stage 1)
  training_session TEXT NOT NULL, -- Rest, Easy Run, Tempo, Long Run, Intervals
  mileage_breakdown TEXT, -- warm-up/main/cooldown distance or duration
  pace_targets TEXT, -- per segment or range
  estimated_distance_km DECIMAL,
  estimated_avg_pace_min_per_km TEXT, -- stored as text like "5:30"
  estimated_moving_time TEXT, -- stored as text like "1:25"
  
  -- Detailed fields (Stage 2) - generated on demand
  heart_rate_zones TEXT,
  purpose TEXT,
  session_load TEXT, -- Low/Medium/High
  notes TEXT,
  what_to_eat_drink TEXT,
  additional_training TEXT,
  recovery_training TEXT,
  estimated_elevation_gain_m INTEGER,
  estimated_avg_power_w INTEGER,
  estimated_cadence_spm INTEGER,
  estimated_calories INTEGER,
  daily_nutrition_advice TEXT,
  
  -- Metadata
  detailed_fields_generated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure one day per plan
  UNIQUE(training_plan_id, date)
);

-- Enable Row Level Security
ALTER TABLE public.training_days ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own training days" 
ON public.training_days 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own training days" 
ON public.training_days 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own training days" 
ON public.training_days 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own training days" 
ON public.training_days 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_training_days_updated_at
BEFORE UPDATE ON public.training_days
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_training_days_plan_date ON public.training_days(training_plan_id, date);
CREATE INDEX idx_training_days_user_date ON public.training_days(user_id, date);