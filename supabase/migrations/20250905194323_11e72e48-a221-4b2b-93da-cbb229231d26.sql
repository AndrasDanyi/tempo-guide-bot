-- Add Strava connection fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN strava_connected boolean DEFAULT false,
ADD COLUMN strava_athlete_id text,
ADD COLUMN strava_access_token text,
ADD COLUMN strava_refresh_token text,
ADD COLUMN strava_token_expires_at timestamp with time zone,
ADD COLUMN strava_connected_at timestamp with time zone;

-- Create table for Strava activities
CREATE TABLE public.strava_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  strava_activity_id bigint NOT NULL UNIQUE,
  name text NOT NULL,
  activity_type text NOT NULL,
  start_date timestamp with time zone NOT NULL,
  distance numeric,
  moving_time integer,
  elapsed_time integer,
  total_elevation_gain numeric,
  average_speed numeric,
  max_speed numeric,
  average_heartrate numeric,
  max_heartrate numeric,
  average_cadence numeric,
  average_watts numeric,
  weighted_average_watts numeric,
  kilojoules numeric,
  suffer_score integer,
  kudos_count integer,
  achievement_count integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create table for Strava best efforts
CREATE TABLE public.strava_best_efforts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  strava_effort_id bigint NOT NULL UNIQUE,
  activity_id UUID,
  name text NOT NULL,
  distance numeric NOT NULL,
  elapsed_time integer NOT NULL,
  moving_time integer,
  start_date timestamp with time zone NOT NULL,
  achievement_rank integer,
  pr_rank integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create table for Strava stats summary
CREATE TABLE public.strava_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  period_type text NOT NULL, -- 'recent', 'ytd', 'all'
  count integer,
  distance numeric,
  moving_time integer,
  elevation_gain numeric,
  achievement_count integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.strava_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_best_efforts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_stats ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for strava_activities
CREATE POLICY "Users can view their own Strava activities"
ON public.strava_activities
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Strava activities"
ON public.strava_activities
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Strava activities"
ON public.strava_activities
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Strava activities"
ON public.strava_activities
FOR DELETE
USING (auth.uid() = user_id);

-- Create RLS policies for strava_best_efforts
CREATE POLICY "Users can view their own Strava best efforts"
ON public.strava_best_efforts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Strava best efforts"
ON public.strava_best_efforts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Strava best efforts"
ON public.strava_best_efforts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Strava best efforts"
ON public.strava_best_efforts
FOR DELETE
USING (auth.uid() = user_id);

-- Create RLS policies for strava_stats
CREATE POLICY "Users can view their own Strava stats"
ON public.strava_stats
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Strava stats"
ON public.strava_stats
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Strava stats"
ON public.strava_stats
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Strava stats"
ON public.strava_stats
FOR DELETE
USING (auth.uid() = user_id);

-- Create foreign key relationships
ALTER TABLE public.strava_activities
ADD CONSTRAINT fk_strava_activities_user_id
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.strava_best_efforts
ADD CONSTRAINT fk_strava_best_efforts_user_id
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.strava_best_efforts
ADD CONSTRAINT fk_strava_best_efforts_activity_id
FOREIGN KEY (activity_id) REFERENCES public.strava_activities(id) ON DELETE CASCADE;

ALTER TABLE public.strava_stats
ADD CONSTRAINT fk_strava_stats_user_id
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add triggers for updated_at timestamps
CREATE TRIGGER update_strava_activities_updated_at
BEFORE UPDATE ON public.strava_activities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_strava_best_efforts_updated_at
BEFORE UPDATE ON public.strava_best_efforts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_strava_stats_updated_at
BEFORE UPDATE ON public.strava_stats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_strava_activities_user_id ON public.strava_activities(user_id);
CREATE INDEX idx_strava_activities_start_date ON public.strava_activities(start_date DESC);
CREATE INDEX idx_strava_activities_activity_type ON public.strava_activities(activity_type);

CREATE INDEX idx_strava_best_efforts_user_id ON public.strava_best_efforts(user_id);
CREATE INDEX idx_strava_best_efforts_name ON public.strava_best_efforts(name);
CREATE INDEX idx_strava_best_efforts_distance ON public.strava_best_efforts(distance);

CREATE INDEX idx_strava_stats_user_id ON public.strava_stats(user_id);
CREATE INDEX idx_strava_stats_period_type ON public.strava_stats(period_type);