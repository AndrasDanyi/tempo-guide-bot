-- Add database indexes for better performance on Strava data queries
CREATE INDEX IF NOT EXISTS idx_strava_activities_user_date ON strava_activities(user_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_strava_activities_user_type ON strava_activities(user_id, activity_type);
CREATE INDEX IF NOT EXISTS idx_strava_best_efforts_user_distance ON strava_best_efforts(user_id, distance);
CREATE INDEX IF NOT EXISTS idx_strava_stats_user_period ON strava_stats(user_id, period_type);