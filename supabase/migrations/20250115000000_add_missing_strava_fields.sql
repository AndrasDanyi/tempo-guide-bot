-- Add missing fields to strava_activities table for enhanced data display

-- Add elevation high/low fields
ALTER TABLE public.strava_activities 
ADD COLUMN elev_high numeric,
ADD COLUMN elev_low numeric;

-- Add location fields
ALTER TABLE public.strava_activities 
ADD COLUMN start_latlng numeric[],
ADD COLUMN end_latlng numeric[],
ADD COLUMN map_summary_polyline text;

-- Add max watts field (we have average_watts but not max_watts)
ALTER TABLE public.strava_activities 
ADD COLUMN max_watts numeric;

-- Add comments for clarity
COMMENT ON COLUMN public.strava_activities.elev_high IS 'Maximum elevation reached during activity in meters';
COMMENT ON COLUMN public.strava_activities.elev_low IS 'Minimum elevation reached during activity in meters';
COMMENT ON COLUMN public.strava_activities.start_latlng IS 'Starting coordinates [latitude, longitude]';
COMMENT ON COLUMN public.strava_activities.end_latlng IS 'Ending coordinates [latitude, longitude]';
COMMENT ON COLUMN public.strava_activities.map_summary_polyline IS 'Encoded polyline representing the activity route';
COMMENT ON COLUMN public.strava_activities.max_watts IS 'Maximum power output in watts';
