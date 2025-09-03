-- Add further_notes field to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS further_notes text;