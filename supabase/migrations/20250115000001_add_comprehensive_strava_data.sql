-- Add comprehensive Strava data tables for splits, segments, stats, and gear

-- Create table for activity splits (per-kilometer/mile splits)
CREATE TABLE public.strava_activity_splits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_id UUID NOT NULL,
  strava_activity_id bigint NOT NULL,
  split_number integer NOT NULL,
  distance numeric NOT NULL, -- in meters
  elapsed_time integer NOT NULL, -- in seconds
  moving_time integer, -- in seconds
  elevation_difference numeric, -- in meters
  average_speed numeric, -- in m/s
  average_grade numeric, -- percentage
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(strava_activity_id, split_number)
);

-- Create table for activity laps
CREATE TABLE public.strava_activity_laps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_id UUID NOT NULL,
  strava_activity_id bigint NOT NULL,
  lap_number integer NOT NULL,
  distance numeric NOT NULL, -- in meters
  elapsed_time integer NOT NULL, -- in seconds
  moving_time integer, -- in seconds
  average_speed numeric, -- in m/s
  max_speed numeric, -- in m/s
  average_heartrate numeric, -- in bpm
  max_heartrate numeric, -- in bpm
  average_cadence numeric, -- in rpm
  average_watts numeric, -- in watts
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(strava_activity_id, lap_number)
);

-- Create table for segment efforts
CREATE TABLE public.strava_segment_efforts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_id UUID NOT NULL,
  strava_effort_id bigint NOT NULL UNIQUE,
  strava_segment_id bigint NOT NULL,
  segment_name text NOT NULL,
  distance numeric NOT NULL, -- in meters
  elapsed_time integer NOT NULL, -- in seconds
  moving_time integer, -- in seconds
  start_date timestamp with time zone NOT NULL,
  pr_rank integer, -- 1 = personal record
  achievement_rank integer,
  kom_rank integer, -- King of the Mountain rank
  average_watts numeric, -- in watts
  average_heartrate numeric, -- in bpm
  max_heartrate numeric, -- in bpm
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create table for athlete comprehensive stats
CREATE TABLE public.strava_athlete_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  period_type text NOT NULL, -- 'recent', 'ytd', 'all'
  biggest_ride_distance numeric, -- in meters
  biggest_climb_elevation_gain numeric, -- in meters
  recent_ride_totals jsonb, -- recent ride statistics
  recent_run_totals jsonb, -- recent run statistics
  recent_swim_totals jsonb, -- recent swim statistics
  ytd_ride_totals jsonb, -- year-to-date ride statistics
  ytd_run_totals jsonb, -- year-to-date run statistics
  ytd_swim_totals jsonb, -- year-to-date swim statistics
  all_ride_totals jsonb, -- all-time ride statistics
  all_run_totals jsonb, -- all-time run statistics
  all_swim_totals jsonb, -- all-time swim statistics
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_type)
);

-- Create table for gear information
CREATE TABLE public.strava_gear (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  strava_gear_id text NOT NULL UNIQUE,
  name text NOT NULL,
  gear_type text NOT NULL, -- 'shoes', 'bike', 'other'
  brand_name text,
  model_name text,
  frame_type text, -- for bikes
  description text,
  distance numeric DEFAULT 0, -- total distance in meters
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create table for activity gear usage
CREATE TABLE public.strava_activity_gear (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_id UUID NOT NULL,
  strava_activity_id bigint NOT NULL,
  gear_id UUID NOT NULL,
  strava_gear_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(strava_activity_id, strava_gear_id)
);

-- Create table for heart rate zones
CREATE TABLE public.strava_heart_rate_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_id UUID NOT NULL,
  strava_activity_id bigint NOT NULL,
  zone_1_time integer DEFAULT 0, -- time in zone 1 (seconds)
  zone_2_time integer DEFAULT 0, -- time in zone 2 (seconds)
  zone_3_time integer DEFAULT 0, -- time in zone 3 (seconds)
  zone_4_time integer DEFAULT 0, -- time in zone 4 (seconds)
  zone_5_time integer DEFAULT 0, -- time in zone 5 (seconds)
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(strava_activity_id)
);

-- Enable RLS on all new tables
ALTER TABLE public.strava_activity_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_activity_laps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_segment_efforts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_athlete_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_gear ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_activity_gear ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_heart_rate_zones ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for strava_activity_splits
CREATE POLICY "Users can view their own activity splits"
ON public.strava_activity_splits
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity splits"
ON public.strava_activity_splits
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for strava_activity_laps
CREATE POLICY "Users can view their own activity laps"
ON public.strava_activity_laps
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity laps"
ON public.strava_activity_laps
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for strava_segment_efforts
CREATE POLICY "Users can view their own segment efforts"
ON public.strava_segment_efforts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own segment efforts"
ON public.strava_segment_efforts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for strava_athlete_stats
CREATE POLICY "Users can view their own athlete stats"
ON public.strava_athlete_stats
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own athlete stats"
ON public.strava_athlete_stats
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for strava_gear
CREATE POLICY "Users can view their own gear"
ON public.strava_gear
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own gear"
ON public.strava_gear
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for strava_activity_gear
CREATE POLICY "Users can view their own activity gear"
ON public.strava_activity_gear
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity gear"
ON public.strava_activity_gear
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for strava_heart_rate_zones
CREATE POLICY "Users can view their own heart rate zones"
ON public.strava_heart_rate_zones
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own heart rate zones"
ON public.strava_heart_rate_zones
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create foreign key relationships
ALTER TABLE public.strava_activity_splits
ADD CONSTRAINT fk_strava_activity_splits_user_id
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.strava_activity_splits
ADD CONSTRAINT fk_strava_activity_splits_activity_id
FOREIGN KEY (activity_id) REFERENCES public.strava_activities(id) ON DELETE CASCADE;

ALTER TABLE public.strava_activity_laps
ADD CONSTRAINT fk_strava_activity_laps_user_id
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.strava_activity_laps
ADD CONSTRAINT fk_strava_activity_laps_activity_id
FOREIGN KEY (activity_id) REFERENCES public.strava_activities(id) ON DELETE CASCADE;

ALTER TABLE public.strava_segment_efforts
ADD CONSTRAINT fk_strava_segment_efforts_user_id
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.strava_segment_efforts
ADD CONSTRAINT fk_strava_segment_efforts_activity_id
FOREIGN KEY (activity_id) REFERENCES public.strava_activities(id) ON DELETE CASCADE;

ALTER TABLE public.strava_athlete_stats
ADD CONSTRAINT fk_strava_athlete_stats_user_id
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.strava_gear
ADD CONSTRAINT fk_strava_gear_user_id
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.strava_activity_gear
ADD CONSTRAINT fk_strava_activity_gear_user_id
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.strava_activity_gear
ADD CONSTRAINT fk_strava_activity_gear_activity_id
FOREIGN KEY (activity_id) REFERENCES public.strava_activities(id) ON DELETE CASCADE;

ALTER TABLE public.strava_activity_gear
ADD CONSTRAINT fk_strava_activity_gear_gear_id
FOREIGN KEY (gear_id) REFERENCES public.strava_gear(id) ON DELETE CASCADE;

ALTER TABLE public.strava_heart_rate_zones
ADD CONSTRAINT fk_strava_heart_rate_zones_user_id
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.strava_heart_rate_zones
ADD CONSTRAINT fk_strava_heart_rate_zones_activity_id
FOREIGN KEY (activity_id) REFERENCES public.strava_activities(id) ON DELETE CASCADE;

-- Add triggers for updated_at timestamps
CREATE TRIGGER update_strava_activity_splits_updated_at
BEFORE UPDATE ON public.strava_activity_splits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_strava_activity_laps_updated_at
BEFORE UPDATE ON public.strava_activity_laps
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_strava_segment_efforts_updated_at
BEFORE UPDATE ON public.strava_segment_efforts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_strava_athlete_stats_updated_at
BEFORE UPDATE ON public.strava_athlete_stats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_strava_gear_updated_at
BEFORE UPDATE ON public.strava_gear
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_strava_heart_rate_zones_updated_at
BEFORE UPDATE ON public.strava_heart_rate_zones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_strava_activity_splits_user_id ON public.strava_activity_splits(user_id);
CREATE INDEX idx_strava_activity_splits_activity_id ON public.strava_activity_splits(activity_id);
CREATE INDEX idx_strava_activity_splits_strava_activity_id ON public.strava_activity_splits(strava_activity_id);

CREATE INDEX idx_strava_activity_laps_user_id ON public.strava_activity_laps(user_id);
CREATE INDEX idx_strava_activity_laps_activity_id ON public.strava_activity_laps(activity_id);
CREATE INDEX idx_strava_activity_laps_strava_activity_id ON public.strava_activity_laps(strava_activity_id);

CREATE INDEX idx_strava_segment_efforts_user_id ON public.strava_segment_efforts(user_id);
CREATE INDEX idx_strava_segment_efforts_activity_id ON public.strava_segment_efforts(activity_id);
CREATE INDEX idx_strava_segment_efforts_segment_id ON public.strava_segment_efforts(strava_segment_id);
CREATE INDEX idx_strava_segment_efforts_pr_rank ON public.strava_segment_efforts(pr_rank);

CREATE INDEX idx_strava_athlete_stats_user_id ON public.strava_athlete_stats(user_id);
CREATE INDEX idx_strava_athlete_stats_period_type ON public.strava_athlete_stats(period_type);

CREATE INDEX idx_strava_gear_user_id ON public.strava_gear(user_id);
CREATE INDEX idx_strava_gear_type ON public.strava_gear(gear_type);

CREATE INDEX idx_strava_activity_gear_user_id ON public.strava_activity_gear(user_id);
CREATE INDEX idx_strava_activity_gear_activity_id ON public.strava_activity_gear(activity_id);

CREATE INDEX idx_strava_heart_rate_zones_user_id ON public.strava_heart_rate_zones(user_id);
CREATE INDEX idx_strava_heart_rate_zones_activity_id ON public.strava_heart_rate_zones(activity_id);
