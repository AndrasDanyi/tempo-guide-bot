import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Activity, MapPin, Clock, TrendingUp, Heart } from "lucide-react";

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

const SimpleActivitiesDisplay: React.FC = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchActivities = async () => {
    if (!user) {
      toast.error('You must be logged in to fetch Strava data.');
      return;
    }

    setLoading(true);
    try {
      console.log('Fetching activities...');
      const { data, error } = await supabase.functions.invoke('strava-fetch-clean', {
        body: {}
      });

      if (error) {
        console.error('Error fetching activities:', error);
        toast.error('Failed to fetch activities: ' + error.message);
        return;
      }

      console.log('Activities response:', data);
      
      if (data?.activities && data.activities.length > 0) {
        setActivities(data.activities);
        toast.success(`Found ${data.activities.length} activities!`);
      } else {
        toast.warning('No activities found');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to fetch activities');
    } finally {
      setLoading(false);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold flex items-center">
          <Activity className="mr-2 text-orange-500" />
          Simple Strava Activities Display
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center">
          <Button
            onClick={fetchActivities}
            disabled={loading || !user}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Fetching Activities...
              </>
            ) : (
              <>
                <Activity className="mr-2 h-4 w-4" />
                Fetch My Strava Activities
              </>
            )}
          </Button>
          {!user && (
            <p className="mt-4 text-sm text-yellow-600">Please log in to fetch activities.</p>
          )}
        </div>

        {activities.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Your Activities ({activities.length})</h3>
            <div className="grid gap-4">
              {activities.map((activity) => (
                <div key={activity.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <h4 className="font-medium text-lg">{activity.name}</h4>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(activity.start_date)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-blue-500" />
                      <div>
                        <div className="font-medium">Distance</div>
                        <div>{formatDistance(activity.distance)}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-green-500" />
                      <div>
                        <div className="font-medium">Duration</div>
                        <div>{formatTime(activity.moving_time)}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-orange-500" />
                      <div>
                        <div className="font-medium">Pace</div>
                        <div>{formatPace(activity.average_speed)}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-purple-500" />
                      <div>
                        <div className="font-medium">Type</div>
                        <div>{activity.type}</div>
                      </div>
                    </div>
                  </div>
                  
                  {activity.average_heartrate && (
                    <div className="flex items-center gap-2 text-sm">
                      <Heart className="h-4 w-4 text-red-500" />
                      <span className="font-medium">Avg HR:</span>
                      <span>{Math.round(activity.average_heartrate)} bpm</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activities.length === 0 && !loading && (
          <div className="text-center py-8">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Click "Fetch My Strava Activities" to see your recent workouts
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SimpleActivitiesDisplay;
