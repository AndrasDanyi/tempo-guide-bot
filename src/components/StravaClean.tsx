import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Zap, Activity, Clock, MapPin } from "lucide-react";

interface StravaActivity {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  type: string;
  start_date: string;
  average_speed: number;
  average_heartrate?: number;
  calories?: number;
}

const StravaClean: React.FC = () => {
  const { user } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Check if user is connected to Strava
  useEffect(() => {
    const checkConnection = async () => {
      if (!user) return;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('strava_connected')
          .eq('user_id', user.id)
          .single();

        if (profile?.strava_connected) {
          setIsConnected(true);
        }
      } catch (error) {
        console.error('Error checking Strava connection:', error);
      }
    };

    checkConnection();
  }, [user]);

  // Check for Strava connection success after redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('strava') === 'connected') {
      setIsConnected(true);
      toast.success('Strava connected successfully!');
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('error')) {
      const errorMessage = urlParams.get('error');
      setError(`Strava connection failed: ${errorMessage}`);
      toast.error(`Strava connection failed: ${errorMessage}`);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleConnectStrava = async () => {
    if (!user) {
      toast.error('You must be logged in to connect to Strava.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      console.log('Calling strava-auth-clean Edge Function...');
      const { data, error: authError } = await supabase.functions.invoke('strava-auth-clean', {
        body: {}
      });

      if (authError) {
        console.error('Error from strava-auth-clean:', authError);
        throw new Error(authError.message || 'Failed to get Strava authorization URL.');
      }

      if (data?.authUrl) {
        console.log('Redirecting to Strava...');
        window.location.href = data.authUrl;
      } else {
        throw new Error('No authorization URL received from Supabase function.');
      }

    } catch (err: any) {
      console.error('Strava connection failed:', err);
      setError(err.message || 'An unknown error occurred during Strava connection.');
      toast.error(err.message || 'Failed to connect to Strava.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleFetchActivities = async () => {
    if (!user) {
      toast.error('You must be logged in to fetch Strava data.');
      return;
    }

    setIsFetching(true);
    setError(null);

    try {
      console.log('Fetching Strava activities...');
      const { data, error: fetchError } = await supabase.functions.invoke('strava-fetch-clean', {
        body: {}
      });

      if (fetchError) {
        console.error('Error from strava-fetch-clean:', fetchError);
        throw new Error(fetchError.message || 'Failed to fetch Strava activities.');
      }

      if (data?.activities) {
        setActivities(data.activities);
        toast.success(`Successfully fetched ${data.count} activities from Strava!`);
      } else {
        throw new Error('No activities received from Strava API.');
      }

    } catch (err: any) {
      console.error('Failed to fetch Strava activities:', err);
      setError(err.message || 'An unknown error occurred while fetching activities.');
      toast.error(err.message || 'Failed to fetch Strava activities.');
    } finally {
      setIsFetching(false);
    }
  };

  const formatDistance = (meters: number) => {
    return (meters / 1000).toFixed(2) + ' km';
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatPace = (speed: number) => {
    const paceSeconds = 1000 / speed; // seconds per km
    const minutes = Math.floor(paceSeconds / 60);
    const seconds = Math.floor(paceSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold flex items-center">
          <Zap className="mr-2 text-orange-500" />
          Strava Integration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isConnected ? (
          <div className="text-center">
            <p className="mb-4 text-muted-foreground">
              Connect to Strava to sync your recent workouts and get personalized training insights.
            </p>
            <Button
              onClick={handleConnectStrava}
              disabled={isConnecting || !user}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Connect to Strava
                </>
              )}
            </Button>
            {!user && (
              <p className="mt-4 text-sm text-yellow-600">Please log in to connect to Strava.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-green-600">
                <Zap className="mr-2 h-4 w-4" />
                <span className="font-medium">Connected to Strava</span>
              </div>
              <Button
                onClick={handleFetchActivities}
                disabled={isFetching}
                variant="outline"
              >
                {isFetching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  <>
                    <Activity className="mr-2 h-4 w-4" />
                    Fetch Recent Activities
                  </>
                )}
              </Button>
            </div>

            {activities.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Recent Activities ({activities.length})</h3>
                <div className="grid gap-3">
                  {activities.map((activity) => (
                    <div key={activity.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <h4 className="font-medium">{activity.name}</h4>
                        <span className="text-sm text-muted-foreground">
                          {new Date(activity.start_date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center">
                          <MapPin className="mr-1 h-3 w-3 text-muted-foreground" />
                          {formatDistance(activity.distance)}
                        </div>
                        <div className="flex items-center">
                          <Clock className="mr-1 h-3 w-3 text-muted-foreground" />
                          {formatTime(activity.moving_time)}
                        </div>
                        <div className="flex items-center">
                          <Activity className="mr-1 h-3 w-3 text-muted-foreground" />
                          {formatPace(activity.average_speed)}
                        </div>
                        <div className="text-muted-foreground">
                          {activity.type}
                        </div>
                      </div>
                      {activity.average_heartrate && (
                        <div className="text-sm text-muted-foreground">
                          Avg HR: {Math.round(activity.average_heartrate)} bpm
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="p-4 border border-red-200 rounded-lg bg-red-50">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StravaClean;
