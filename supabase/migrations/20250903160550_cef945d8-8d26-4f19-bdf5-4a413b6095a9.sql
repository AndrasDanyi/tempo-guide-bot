-- Add new columns to profiles table for enhanced training plan generation
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS gender text,
ADD COLUMN IF NOT EXISTS current_weekly_mileage integer,
ADD COLUMN IF NOT EXISTS longest_run_km integer,
ADD COLUMN IF NOT EXISTS race_name text,
ADD COLUMN IF NOT EXISTS race_distance_km integer,
ADD COLUMN IF NOT EXISTS goal_pace_per_km text,
ADD COLUMN IF NOT EXISTS strength_notes text,
ADD COLUMN IF NOT EXISTS elevation_context text DEFAULT 'flat',
ADD COLUMN IF NOT EXISTS days_per_week integer DEFAULT 5;