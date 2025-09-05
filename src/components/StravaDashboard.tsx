import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Activity, 
  Calendar, 
  TrendingUp, 
  Clock, 
  MapPin, 
  Heart,
  Trophy,
  Target,
  Zap
} from "lucide-react";

interface StravaDashboardProps {
  profile: any;
}

interface StravaStats {
  period_type: string;
  count: number;
  distance: number;
  moving_time: number;
  elevation_gain: number;
  achievement_count: number;
}

interface StravaActivity {
  id: string;
  name: string;
  activity_type: string;
  start_date: string;
  distance: number;
  moving_time: number;
  average_speed: number;
  average_heartrate?: number;
  total_elevation_gain?: number;
  suffer_score?: number;
}

interface StravaBestEffort {
  id: string;
  name: string;
  distance: number;
  elapsed_time: number;
  start_date: string;
  pr_rank?: number;
  achievement_rank?: number;
}

const StravaDashboard: React.FC<StravaDashboardProps> = ({ profile }) => {
  const [stats, setStats] = useState<StravaStats[]>([]);
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [bestEfforts, setBestEfforts] = useState<StravaBestEffort[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.strava_connected) {
      fetchStravaData();
    }
  }, [profile?.strava_connected]);

  const fetchStravaData = async () => {
    setLoading(true);
    
    try {
      const [statsResponse, activitiesResponse, bestEffortsResponse] = await Promise.all([
        supabase
          .from('strava_stats')
          .select('*')
          .eq('user_id', profile.user_id),
        
        supabase
          .from('strava_activities')
          .select('*')
          .eq('user_id', profile.user_id)
          .order('start_date', { ascending: false })
          .limit(10),
        
        supabase
          .from('strava_best_efforts')
          .select('*')
          .eq('user_id', profile.user_id)
          .order('pr_rank', { ascending: true, nullsFirst: false })
          .limit(10)
      ]);

      if (statsResponse.error) {
        console.error('Error fetching stats:', statsResponse.error);
        toast.error('Failed to load Strava stats');
      } else {
        setStats(statsResponse.data || []);
      }

      if (activitiesResponse.error) {
        console.error('Error fetching activities:', activitiesResponse.error);
        toast.error('Failed to load Strava activities');
      } else {
        setActivities(activitiesResponse.data || []);
      }

      if (bestEffortsResponse.error) {
        console.error('Error fetching best efforts:', bestEffortsResponse.error);
        toast.error('Failed to load best efforts');
      } else {
        setBestEfforts(bestEffortsResponse.data || []);
      }

    } catch (error) {
      console.error('Error fetching Strava data:', error);
      toast.error('Failed to load Strava data');
    } finally {
      setLoading(false);
    }
  };

  const formatDistance = (distance: number) => {
    const km = distance / 1000;
    return km > 10 ? `${km.toFixed(0)} km` : `${km.toFixed(1)} km`;
  };

  const formatPace = (speed: number) => {
    if (!speed) return 'N/A';
    const paceSeconds = 1000 / speed; // seconds per km
    const minutes = Math.floor(paceSeconds / 60);
    const seconds = Math.floor(paceSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatEffortTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (!profile?.strava_connected) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-500" />
            Strava Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const recentStats = stats.find(s => s.period_type === 'recent');
  const ytdStats = stats.find(s => s.period_type === 'ytd');

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-orange-500" />
          Strava Training Data
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activities">Recent Runs</TabsTrigger>
            <TabsTrigger value="efforts">Best Efforts</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {recentStats && (
                <>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {recentStats.count}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Recent Runs
                    </div>
                  </div>
                  
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {formatDistance(recentStats.distance)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Total Distance
                    </div>
                  </div>
                  
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {formatTime(recentStats.moving_time)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Moving Time
                    </div>
                  </div>
                  
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {Math.round(recentStats.elevation_gain)}m
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Elevation
                    </div>
                  </div>
                </>
              )}
            </div>

            {ytdStats && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Year to Date
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-xl font-bold">{ytdStats.count}</div>
                    <div className="text-sm text-muted-foreground">Runs</div>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-xl font-bold">{formatDistance(ytdStats.distance)}</div>
                    <div className="text-sm text-muted-foreground">Distance</div>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-xl font-bold">{formatTime(ytdStats.moving_time)}</div>
                    <div className="text-sm text-muted-foreground">Time</div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="activities" className="space-y-3">
            {activities.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No recent activities found
              </p>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <h3 className="font-medium">{activity.name}</h3>
                    <Badge variant="secondary">
                      {new Date(activity.start_date).toLocaleDateString()}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {formatDistance(activity.distance)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(activity.moving_time)}
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {formatPace(activity.average_speed)}
                    </div>
                    {activity.average_heartrate && (
                      <div className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {Math.round(activity.average_heartrate)} bpm
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </TabsContent>
          
          <TabsContent value="efforts" className="space-y-3">
            {bestEfforts.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No best efforts found
              </p>
            ) : (
              bestEfforts.map((effort) => (
                <div key={effort.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-yellow-500" />
                      <h3 className="font-medium">{effort.name}</h3>
                      {effort.pr_rank === 1 && (
                        <Badge className="bg-yellow-100 text-yellow-800">PR</Badge>
                      )}
                    </div>
                    <Badge variant="outline">
                      {formatEffortTime(effort.elapsed_time)}
                    </Badge>
                  </div>
                  
                  <div className="mt-2 text-sm text-muted-foreground">
                    {formatDistance(effort.distance)} • {new Date(effort.start_date).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default StravaDashboard;