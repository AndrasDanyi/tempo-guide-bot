// ============================================================================
// STRAVA DASHBOARD COMPONENT
// ============================================================================
// This component displays the user's Strava training data in a beautiful dashboard
// It shows:
// - Training statistics overview (runs, distance, time, elevation)
// - Recent running activities with detailed metrics
// - Personal records and best efforts
// - Manual sync functionality to fetch latest data from Strava

// React hooks for managing component state and side effects
import React, { useState, useEffect } from 'react';

// UI Components from our design system (shadcn/ui)
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Supabase client for database operations
import { supabase } from "@/integrations/supabase/client";

// Toast notifications for user feedback
import { toast } from "sonner";

// Icons from Lucide React for consistent UI
import { 
  Activity,    // For activity-related icons
  Calendar,    // For date/time displays
  TrendingUp,  // For pace/speed metrics
  Clock,       // For duration/time displays
  MapPin,      // For distance/location
  Heart,       // For heart rate data
  Trophy,      // For achievements/PRs
  Target,      // For goals/targets
  Zap,         // For Strava branding and sync actions
  Loader2,     // For loading states
  ExternalLink // For connect button
} from "lucide-react";

// ============================================================================
// TYPE DEFINITIONS (TypeScript Interfaces)
// ============================================================================
// These define the structure of our data to ensure type safety

// Props that this component receives from its parent
interface StravaDashboardProps {
  profile: any;                    // User's profile data (contains Strava connection status)
  onStravaDataSynced?: () => void; // Optional callback when Strava data is successfully synced
}

// Structure of Strava training statistics (recent, year-to-date, all-time)
interface StravaStats {
  period_type: string;    // "recent", "ytd", or "all"
  count: number;          // Number of runs
  distance: number;       // Total distance in meters
  moving_time: number;    // Total moving time in seconds
  elevation_gain: number; // Total elevation gain in meters
  achievement_count: number; // Number of achievements/PRs
}

// Structure of individual Strava activities (runs, rides, etc.)
interface StravaActivity {
  id: string;                    // Unique activity ID
  name: string;                  // Activity name (e.g., "Morning Run")
  activity_type: string;         // Type of activity (Run, Ride, etc.)
  start_date: string;            // When the activity started
  distance: number;              // Distance in meters
  moving_time: number;           // Moving time in seconds
  average_speed: number;         // Average speed in meters per second
  average_heartrate?: number;    // Average heart rate (optional)
  total_elevation_gain?: number; // Total elevation gain (optional)
  suffer_score?: number;         // Strava's difficulty rating (optional)
}

// Structure of Strava best efforts (personal records, segment times)
interface StravaBestEffort {
  id: string;              // Unique effort ID
  name: string;            // Effort name (e.g., "1 mile", "5K")
  distance: number;        // Distance in meters
  elapsed_time: number;    // Time in seconds
  start_date: string;      // When this effort was achieved
  pr_rank?: number;        // Personal record ranking (1 = PR)
  achievement_rank?: number; // Achievement ranking
}

// ============================================================================
// MAIN COMPONENT FUNCTION
// ============================================================================

const StravaDashboard: React.FC<StravaDashboardProps> = ({ profile, onStravaDataSynced }) => {
  // ============================================================================
  // COMPONENT STATE MANAGEMENT
  // ============================================================================
  // These state variables store the Strava data we fetch from the database
  
  const [stats, setStats] = useState<StravaStats[]>([]);           // Training statistics (recent, YTD, all-time)
  const [activities, setActivities] = useState<StravaActivity[]>([]); // Recent running activities
  const [bestEfforts, setBestEfforts] = useState<StravaBestEffort[]>([]); // Personal records and achievements
  const [loading, setLoading] = useState(true);                   // Loading state for initial data fetch
  const [refreshing, setRefreshing] = useState(false);            // Loading state for manual sync
  const [isConnecting, setIsConnecting] = useState(false);        // Loading state for Strava connection

  // ============================================================================
  // SIDE EFFECTS (useEffect hooks)
  // ============================================================================
  
  // Automatically fetch Strava data when the user connects to Strava
  useEffect(() => {
    if (profile?.strava_connected) {
      fetchStravaData();
    }
  }, [profile?.strava_connected]);

  // ============================================================================
  // DATA FETCHING FUNCTION
  // ============================================================================
  // This function fetches all Strava data from our database and displays it
  
  const fetchStravaData = async () => {
    setLoading(true);
    
    try {
      // Fetch all Strava data in parallel for better performance
      // We use Promise.all to fetch all three types of data simultaneously
      const [statsResponse, activitiesResponse, bestEffortsResponse] = await Promise.all([
        // Fetch training statistics (recent, year-to-date, all-time totals)
        supabase
          .from('strava_stats')
          .select('*')
          .eq('user_id', profile.user_id),
        
        // Fetch recent running activities (last 6 months, most recent first, limit 10)
        supabase
          .from('strava_activities')
          .select('*')
          .eq('user_id', profile.user_id)
          .gte('start_date', new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString()) // 6 months filter
          .order('start_date', { ascending: false })
          .limit(10),
        
        // Fetch personal records and best efforts (ranked by PR status)
        supabase
          .from('strava_best_efforts')
          .select('*')
          .eq('user_id', profile.user_id)
          .order('pr_rank', { ascending: true, nullsFirst: false })
          .limit(10)
      ]);

      // Process the statistics data
      if (statsResponse.error) {
        console.error('Error fetching stats:', statsResponse.error);
      } else {
        setStats(statsResponse.data || []);
      }

      // Process the activities data
      if (activitiesResponse.error) {
        console.error('Error fetching activities:', activitiesResponse.error);
      } else {
        const activitiesData = activitiesResponse.data || [];
        console.log('Activities fetched from database:', activitiesData.length, activitiesData);
        setActivities(activitiesData);
        
        // Smart auto-sync: If no activities found in database, try to fetch from Strava API
        // This handles cases where the user connected to Strava but data wasn't synced yet
        if (activitiesData.length === 0) {
          console.log('No activities in database, attempting to fetch from Strava API...');
          await handleManualRefresh();
        } else {
          // Notify parent component that we have Strava data available
          if (activitiesData.length > 0 && onStravaDataSynced) {
            onStravaDataSynced();
          }
        }
      }

      // Process the best efforts data
      if (bestEffortsResponse.error) {
        console.error('Error fetching best efforts:', bestEffortsResponse.error);
      } else {
        setBestEfforts(bestEffortsResponse.data || []);
      }

    } catch (error) {
      console.error('Error fetching Strava data:', error);
      toast.error('Failed to load Strava data');
    } finally {
      // Always stop loading, even if there was an error
      setLoading(false);
    }
  };

  // ============================================================================
  // STRAVA CONNECTION FUNCTION
  // ============================================================================
  // This function initiates the Strava OAuth connection process
  
  const handleConnectStrava = async () => {
    if (!profile?.user_id) {
      toast.error('User profile not found');
      return;
    }

    setIsConnecting(true);
    
    try {
      console.log('Starting Strava connection process...');
      console.log('Profile user_id:', profile.user_id);
      console.log('Redirect URL:', window.location.origin);
      
      // Use the current origin as redirect URL
      const redirectUrl = window.location.origin;
      
      console.log('Using redirect URL:', redirectUrl);
      
      const { data, error } = await supabase.functions.invoke('strava-auth-clean', {
        body: {}
      });

      console.log('Strava auth response:', { data, error });

      if (error) {
        console.error('Error getting Strava auth URL:', error);
        console.error('Full error object:', JSON.stringify(error, null, 2));
        let errorMessage = 'Failed to connect to Strava';
        if (error.message?.includes('redirect_uri_mismatch')) {
          errorMessage = 'Strava app configuration issue. Please check redirect URL settings.';
        } else if (error.message?.includes('invalid_client')) {
          errorMessage = 'Strava app credentials issue. Please check client ID and secret.';
        } else if (error.message) {
          errorMessage = `Strava connection error: ${error.message}`;
        }
        toast.error(errorMessage);
        return;
      }

      if (data?.authUrl) {
        console.log('Redirecting to Strava auth URL:', data.authUrl);
        // Open Strava authorization in current window
        window.location.href = data.authUrl;
      } else {
        throw new Error('No authorization URL received');
      }

    } catch (error) {
      console.error('Error connecting to Strava:', error);
      toast.error(`Failed to connect to Strava: ${error.message || 'Unknown error'}`);
    } finally {
      setIsConnecting(false);
    }
  };

  // ============================================================================
  // MANUAL SYNC FUNCTION
  // ============================================================================
  // This function manually triggers a sync with Strava to fetch the latest data
  
  const handleManualRefresh = async () => {
    setRefreshing(true);
    
    try {
      console.log('Calling Strava fetch function...');
      console.log('Profile strava_connected:', profile?.strava_connected);
      console.log('Profile strava_athlete_id:', profile?.strava_athlete_id);
      
      // Call Strava fetch function for activities
      const activitiesResponse = await supabase.functions.invoke('strava-fetch-clean', {
        body: {}
      });

      // Try to fetch best efforts (optional - don't fail if function doesn't exist)
      let bestEffortsResponse = { data: null, error: null };
      try {
        bestEffortsResponse = await supabase.functions.invoke('strava-fetch-best-efforts', {
          body: {}
        });
      } catch (error) {
        console.log('Best efforts function not available yet:', error);
        // Continue without best efforts - don't break the main functionality
      }

      // Handle activities response
      if (activitiesResponse.error) {
        console.error('Error refreshing Strava activities:', activitiesResponse.error);
        console.error('Full error object:', JSON.stringify(activitiesResponse.error, null, 2));
        
        // Provide user-friendly error messages based on the specific error
        let errorMessage = 'Failed to refresh Strava activities';
        if (activitiesResponse.error.message?.includes('not connected to Strava')) {
          errorMessage = 'Please connect to Strava first in your profile settings';
        } else if (activitiesResponse.error.message?.includes('non-2xx status code')) {
          errorMessage = `Strava connection issue. Please try reconnecting to Strava. (Error: ${activitiesResponse.error.message})`;
        } else if (activitiesResponse.error.message?.includes('Failed to fetch stats')) {
          errorMessage = 'Strava API error. Your token may have expired. Please reconnect to Strava.';
        } else if (activitiesResponse.error.message?.includes('Failed to refresh Strava token')) {
          errorMessage = 'Strava token expired. Please reconnect to Strava.';
        } else if (activitiesResponse.error.message) {
          errorMessage = `Error: ${activitiesResponse.error.message}`;
        }
        
        toast.error(errorMessage);
      } else {
        console.log('Strava activities fetch response:', activitiesResponse.data);
        const activityCount = activitiesResponse.data?.activitiesCount || 0;
        
        if (activityCount > 0) {
          // Update the activities state with the fetched data
          if (activitiesResponse.data?.activities) {
            console.log('Setting activities state with:', activitiesResponse.data.activities);
            console.log('Activities count:', activitiesResponse.data.activities.length);
            setActivities(activitiesResponse.data.activities);
            console.log('Activities state should now be updated');
          }
          toast.success(`Successfully synced ${activityCount} activities from Strava!`);
        } else {
          console.log('No activities returned from Strava API');
          toast.warning('No activities found on Strava. Make sure you have running activities.');
        }
      }

      // Handle best efforts response
      if (bestEffortsResponse.error) {
        console.error('Error refreshing Strava best efforts:', bestEffortsResponse.error);
        toast.error(`Failed to refresh best efforts: ${bestEffortsResponse.error.message || 'Unknown error'}`);
      } else {
        console.log('Strava best efforts fetch response:', bestEffortsResponse.data);
        const bestEffortsCount = bestEffortsResponse.data?.bestEffortsCount || 0;
        
        if (bestEffortsCount > 0) {
          // Update the best efforts state with the fetched data
          if (bestEffortsResponse.data?.bestEfforts) {
            console.log('Setting best efforts state with:', bestEffortsResponse.data.bestEfforts);
            console.log('Best efforts count:', bestEffortsResponse.data.bestEfforts.length);
            setBestEfforts(bestEffortsResponse.data.bestEfforts);
          }
          toast.success(`Successfully synced ${bestEffortsCount} best efforts from Strava!`);
        }
      }

      // Notify parent component that new Strava data is available
      if (onStravaDataSynced) {
        onStravaDataSynced();
      }
    } catch (error) {
      console.error('Error calling Strava refresh function:', error);
      toast.error('Failed to refresh Strava data. Please try again.');
    } finally {
      // Always stop the refreshing state
      setRefreshing(false);
    }
  };

  // ============================================================================
  // FORMATTING UTILITY FUNCTIONS
  // ============================================================================
  // These functions convert raw data into user-friendly display formats
  
  // Convert distance from meters to readable format (km or m)
  const formatDistance = (distance: number) => {
    if (!distance || distance === 0) return 'N/A';
    const km = distance / 1000;
    return km >= 1 ? `${km.toFixed(1)} km` : `${Math.round(distance)} m`;
  };

  // Convert speed (m/s) to pace (min:sec/km) - the standard running pace format
  const formatPace = (speed: number) => {
    if (!speed || speed === 0) return 'N/A';
    const paceSeconds = 1000 / speed; // seconds per km
    const minutes = Math.floor(paceSeconds / 60);
    const seconds = Math.floor(paceSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  };

  // Convert time from seconds to readable format (hours, minutes, seconds)
  const formatTime = (seconds: number) => {
    if (!seconds || seconds === 0) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Convert time to MM:SS format for best efforts and segments
  const formatEffortTime = (seconds: number) => {
    if (!seconds || seconds === 0) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Convert date string to readable format (e.g., "Dec 20, 2025")
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  // ============================================================================
  // CONDITIONAL RENDERING LOGIC
  // ============================================================================
  // Show different content based on Strava connection status and loading states
  
  // If user is not connected to Strava, show connection prompt with Connect button
  if (!profile?.strava_connected) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-500" />
            Strava Training Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Zap className="h-12 w-12 text-orange-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Connect to Strava</h3>
            <p className="text-muted-foreground mb-6">
              Connect your Strava account to import your training data and get personalized training plans.
            </p>
            <Button
              onClick={handleConnectStrava}
              disabled={isConnecting}
              size="lg"
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Connect to Strava
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              You can also connect to Strava in your profile settings.
            </p>
          </div>
        </CardContent>
      </Card>
    );
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
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-500" />
            Strava Training Data
          </CardTitle>
          <Button
            onClick={handleManualRefresh}
            disabled={refreshing}
            size="sm"
            variant="outline"
            className="text-orange-600 border-orange-200 hover:bg-orange-50"
          >
            {refreshing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Sync Data
              </>
            )}
          </Button>
        </div>
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
                      {recentStats.elevation_gain ? `${Math.round(recentStats.elevation_gain)}m` : 'N/A'}
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
            {console.log('Current activities state:', activities, 'Length:', activities.length)}
            {activities.length === 0 ? (
              <div className="text-center py-8">
                <div className="mb-4">
                  <Zap className="h-12 w-12 text-orange-500 mx-auto mb-2" />
                  <p className="text-muted-foreground mb-2">
                    No recent running activities found in the last 6 months
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Click "Sync Data" above to fetch your latest activities from Strava
                  </p>
                </div>
                <Button
                  onClick={handleManualRefresh}
                  disabled={refreshing}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {refreshing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Sync Strava Data
                    </>
                  )}
                </Button>
              </div>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <h3 className="font-medium">{activity.name}</h3>
                    <Badge variant="secondary">
                      {formatDate(activity.start_date)}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-blue-500" />
                      <span className="font-medium">Distance:</span>
                      <span>{formatDistance(activity.distance)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-green-500" />
                      <span className="font-medium">Duration:</span>
                      <span>{formatTime(activity.moving_time)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-orange-500" />
                      <span className="font-medium">Pace:</span>
                      <span>{formatPace(activity.average_speed)}</span>
                    </div>
                  </div>
                  
                  {activity.average_heartrate && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Heart className="h-3 w-3 text-red-500" />
                      <span>Avg HR: {Math.round(activity.average_heartrate)} bpm</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </TabsContent>
          
          <TabsContent value="efforts" className="space-y-3">
            {bestEfforts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-2">
                  No personal records found
                </p>
                <p className="text-sm text-muted-foreground">
                  Best efforts will appear here after you complete runs with achievements on Strava
                </p>
              </div>
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