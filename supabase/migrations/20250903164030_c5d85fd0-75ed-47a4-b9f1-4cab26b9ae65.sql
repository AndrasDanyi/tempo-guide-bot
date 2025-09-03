-- Add new fields to profiles table for enhanced personalization
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weight_kg integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS experience_years integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS race_results text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS race_surface text DEFAULT 'road';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS units text DEFAULT 'metric';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS time_limits text;