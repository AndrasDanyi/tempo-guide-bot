-- Create the strava_athlete_stats table if it doesn't exist
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.strava_athlete_stats (
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

-- Enable RLS
ALTER TABLE public.strava_athlete_stats ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY IF NOT EXISTS "Users can view their own athlete stats"
ON public.strava_athlete_stats
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own athlete stats"
ON public.strava_athlete_stats
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own athlete stats"
ON public.strava_athlete_stats
FOR UPDATE
USING (auth.uid() = user_id);

-- Add foreign key constraint
ALTER TABLE public.strava_athlete_stats
ADD CONSTRAINT IF NOT EXISTS fk_strava_athlete_stats_user_id
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_strava_athlete_stats_user_id ON public.strava_athlete_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_strava_athlete_stats_period_type ON public.strava_athlete_stats(period_type);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER IF NOT EXISTS update_strava_athlete_stats_updated_at
BEFORE UPDATE ON public.strava_athlete_stats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
