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
  ExternalLink, // For connect button
  ChevronDown, // For expand/collapse
  ChevronUp    // For expand/collapse
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
  // Basic Metrics
  distance: number;              // Distance in meters
  moving_time: number;           // Moving time in seconds
  elapsed_time: number;          // Total elapsed time in seconds
  average_speed: number;         // Average speed in meters per second
  max_speed: number;             // Maximum speed in meters per second
  // Elevation
  total_elevation_gain?: number; // Total elevation gain in meters
  elev_high?: number;            // Maximum elevation in meters
  elev_low?: number;             // Minimum elevation in meters
  // Heart Rate
  average_heartrate?: number;    // Average heart rate in bpm
  max_heartrate?: number;        // Maximum heart rate in bpm
  // Power (for cycling)
  average_watts?: number;        // Average power in watts
  max_watts?: number;            // Maximum power in watts
  weighted_average_watts?: number; // Weighted average power in watts
  kilojoules?: number;           // Total energy in kilojoules
  // Cadence (for cycling)
  average_cadence?: number;      // Average cadence in rpm
  // Location
  start_latlng?: number[];       // Starting coordinates [lat, lng]
  end_latlng?: number[];         // Ending coordinates [lat, lng]
  map_summary_polyline?: string; // Encoded polyline of route
  // Additional metrics
  suffer_score?: number;         // Strava's difficulty rating
  kudos_count?: number;          // Number of kudos received
  achievement_count?: number;    // Number of achievements
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

// Structure of activity splits (per-kilometer/mile splits)
interface StravaActivitySplit {
  id: string;                    // Unique split ID
  activity_id: string;           // Parent activity ID
  split_number: number;          // Split number (1, 2, 3, etc.)
  distance: number;              // Distance in meters
  elapsed_time: number;          // Time in seconds
  moving_time?: number;          // Moving time in seconds
  elevation_difference?: number; // Elevation change in meters
  average_speed?: number;        // Average speed in m/s
  average_grade?: number;        // Average grade percentage
}

// Structure of activity laps
interface StravaActivityLap {
  id: string;                    // Unique lap ID
  activity_id: string;           // Parent activity ID
  lap_number: number;            // Lap number
  distance: number;              // Distance in meters
  elapsed_time: number;          // Time in seconds
  moving_time?: number;          // Moving time in seconds
  average_speed?: number;        // Average speed in m/s
  max_speed?: number;            // Max speed in m/s
  average_heartrate?: number;    // Average HR in bpm
  max_heartrate?: number;        // Max HR in bpm
  average_cadence?: number;      // Average cadence in rpm
  average_watts?: number;        // Average power in watts
}

// Structure of segment efforts
interface StravaSegmentEffort {
  id: string;                    // Unique effort ID
  activity_id: string;           // Parent activity ID
  strava_segment_id: number;     // Strava segment ID
  segment_name: string;          // Segment name
  distance: number;              // Distance in meters
  elapsed_time: number;          // Time in seconds
  moving_time?: number;          // Moving time in seconds
  start_date: string;            // When this effort was achieved
  pr_rank?: number;              // Personal record ranking (1 = PR)
  achievement_rank?: number;     // Achievement ranking
  kom_rank?: number;             // King of the Mountain ranking
  average_watts?: number;        // Average power in watts
  average_heartrate?: number;    // Average HR in bpm
  max_heartrate?: number;        // Max HR in bpm
}

// Structure of gear information
interface StravaGear {
  id: string;                    // Unique gear ID
  strava_gear_id: string;        // Strava gear ID
  name: string;                  // Gear name
  gear_type: string;             // 'shoes', 'bike', 'other'
  brand_name?: string;           // Brand name
  model_name?: string;           // Model name
  frame_type?: string;           // Frame type (for bikes)
  description?: string;          // Description
  distance: number;              // Total distance in meters
}

// Structure of athlete comprehensive stats
interface StravaAthleteStats {
  id: string;                    // Unique stats ID
  period_type: string;           // 'recent', 'ytd', 'all'
  biggest_ride_distance?: number; // Biggest ride distance in meters
  biggest_climb_elevation_gain?: number; // Biggest climb in meters
  recent_ride_totals?: any;      // Recent ride statistics
  recent_run_totals?: any;       // Recent run statistics
  recent_swim_totals?: any;      // Recent swim statistics
  ytd_ride_totals?: any;         // Year-to-date ride statistics
  ytd_run_totals?: any;          // Year-to-date run statistics
  ytd_swim_totals?: any;         // Year-to-date swim statistics
  all_ride_totals?: any;         // All-time ride statistics
  all_run_totals?: any;          // All-time run statistics
  all_swim_totals?: any;         // All-time swim statistics
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
  const [activitySplits, setActivitySplits] = useState<StravaActivitySplit[]>([]); // Activity splits data
  const [activityLaps, setActivityLaps] = useState<StravaActivityLap[]>([]); // Activity laps data
  const [segmentEfforts, setSegmentEfforts] = useState<StravaSegmentEffort[]>([]); // Segment efforts data
  const [gear, setGear] = useState<StravaGear[]>([]); // Gear information
  const [athleteStats, setAthleteStats] = useState<StravaAthleteStats[]>([]); // Comprehensive athlete stats
  const [loading, setLoading] = useState(true);                   // Loading state for initial data fetch
  const [refreshing, setRefreshing] = useState(false);            // Loading state for manual sync
  const [isConnecting, setIsConnecting] = useState(false);        // Loading state for Strava connection
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set()); // Track which activities are expanded

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
      // We use Promise.all to fetch all types of data simultaneously
      const [
        statsResponse, 
        activitiesResponse, 
        bestEffortsResponse,
        splitsResponse,
        lapsResponse,
        segmentEffortsResponse,
        gearResponse,
        athleteStatsResponse
      ] = await Promise.all([
        // Fetch training statistics (recent, year-to-date, all-time totals)
        supabase
          .from('strava_stats')
          .select('*')
          .eq('user_id', profile.user_id),
        
        // Fetch recent running activities (all activities, most recent first, limit 10)
        supabase
          .from('strava_activities')
          .select('*')
          .eq('user_id', profile.user_id)
          .order('start_date', { ascending: false })
          .limit(10),
        
        // Fetch personal records and best efforts (all time, ranked by PR status)
        supabase
          .from('strava_best_efforts')
          .select('*')
          .eq('user_id', profile.user_id)
          .order('pr_rank', { ascending: true, nullsFirst: false })
          .order('start_date', { ascending: false })
          .limit(20),

        // Fetch activity splits
        supabase
          .from('strava_activity_splits')
          .select('*')
          .eq('user_id', profile.user_id)
          .order('strava_activity_id', { ascending: false })
          .order('split_number', { ascending: true }),

        // Fetch activity laps
        supabase
          .from('strava_activity_laps')
          .select('*')
          .eq('user_id', profile.user_id)
          .order('strava_activity_id', { ascending: false })
          .order('lap_number', { ascending: true }),

        // Fetch segment efforts
        supabase
          .from('strava_segment_efforts')
          .select('*')
          .eq('user_id', profile.user_id)
          .order('start_date', { ascending: false })
          .limit(50),

        // Fetch gear information
        supabase
          .from('strava_gear')
          .select('*')
          .eq('user_id', profile.user_id)
          .order('distance', { ascending: false }),

        // Fetch comprehensive athlete stats
        supabase
          .from('strava_athlete_stats')
          .select('*')
          .eq('user_id', profile.user_id)
      ]);

      // Process the statistics data
      if (statsResponse.error) {
        console.error('Error fetching stats:', statsResponse.error);
      } else {
        setStats(statsResponse.data || []);
      }

      // Process the activities data
      if (activitiesResponse.error) {
        console.error('Error fetching activities from database:', activitiesResponse.error);
        console.error('Full error details:', JSON.stringify(activitiesResponse.error, null, 2));
      } else {
        const activitiesData = activitiesResponse.data || [];
        console.log('Activities fetched from database:', activitiesData.length, activitiesData);
        console.log('User ID used in query:', profile.user_id);
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

      // Process the activity splits data
      if (splitsResponse.error) {
        console.error('Error fetching activity splits:', splitsResponse.error);
      } else {
        setActivitySplits(splitsResponse.data || []);
      }

      // Process the activity laps data
      if (lapsResponse.error) {
        console.error('Error fetching activity laps:', lapsResponse.error);
      } else {
        setActivityLaps(lapsResponse.data || []);
      }

      // Process the segment efforts data
      if (segmentEffortsResponse.error) {
        console.error('Error fetching segment efforts:', segmentEffortsResponse.error);
      } else {
        setSegmentEfforts(segmentEffortsResponse.data || []);
      }

      // Process the gear data
      if (gearResponse.error) {
        console.error('Error fetching gear:', gearResponse.error);
      } else {
        setGear(gearResponse.data || []);
      }

      // Process the athlete stats data
      if (athleteStatsResponse.error) {
        console.error('Error fetching athlete stats:', athleteStatsResponse.error);
      } else {
        setAthleteStats(athleteStatsResponse.data || []);
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
      
      // Call comprehensive Strava fetch function for activities and detailed data
      const activitiesResponse = await supabase.functions.invoke('strava-fetch-comprehensive', {
        body: {}
      });

      // Try to fetch best efforts (optional - don't fail if function doesn't exist)
      let bestEffortsResponse = { data: null, error: null };
      try {
        bestEffortsResponse = await supabase.functions.invoke('strava-fetch-best-efforts', {
          body: {}
        });
        console.log('Best efforts fetch response:', bestEffortsResponse.data);
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
        
        // Always update the best efforts state with whatever we got
        if (bestEffortsResponse.data?.bestEfforts) {
          console.log('Setting best efforts state with:', bestEffortsResponse.data.bestEfforts);
          console.log('Best efforts count:', bestEffortsResponse.data.bestEfforts.length);
          setBestEfforts(bestEffortsResponse.data.bestEfforts);
          
          if (bestEffortsCount > 0) {
            toast.success(`Successfully synced ${bestEffortsCount} best efforts from Strava!`);
          } else {
            console.log('No best efforts returned from Strava API');
          }
        } else {
          console.log('No best efforts data in response, checking database...');
          // Still refresh from database in case there are stored best efforts
          const { data: dbBestEfforts, error: dbError } = await supabase
            .from('strava_best_efforts')
            .select('*')
            .eq('user_id', profile.user_id)
            .order('pr_rank', { ascending: true, nullsFirst: false })
            .order('start_date', { ascending: false })
            .limit(20);
          
          if (!dbError && dbBestEfforts) {
            setBestEfforts(dbBestEfforts);
            console.log('Loaded best efforts from database:', dbBestEfforts.length);
          }
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

  // Convert time to h:mm:ss format for best efforts and segments
  const formatEffortTime = (seconds: number) => {
    if (!seconds || seconds === 0) return 'N/A';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
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

  // Convert elevation from meters to readable format
  const formatElevation = (elevation: number) => {
    if (!elevation || elevation === 0) return 'N/A';
    return `${Math.round(elevation)}m`;
  };

  // Convert speed to max speed display (km/h)
  const formatMaxSpeed = (speed: number) => {
    if (!speed || speed === 0) return 'N/A';
    const kmh = (speed * 3.6).toFixed(1);
    return `${kmh} km/h`;
  };

  // Convert power to readable format
  const formatPower = (watts: number) => {
    if (!watts || watts === 0) return 'N/A';
    return `${Math.round(watts)}W`;
  };

  // Convert cadence to readable format
  const formatCadence = (cadence: number) => {
    if (!cadence || cadence === 0) return 'N/A';
    return `${Math.round(cadence)} rpm`;
  };

  // Convert coordinates to readable format
  const formatCoordinates = (coords: number[]) => {
    if (!coords || coords.length !== 2) return 'N/A';
    return `${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`;
  };

  // Toggle expanded state for activity cards
  const toggleActivityExpanded = (activityId: string) => {
    setExpandedActivities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(activityId)) {
        newSet.delete(activityId);
      } else {
        newSet.add(activityId);
      }
      return newSet;
    });
  };

  // Helper functions to get related data for activities
  const getActivitySplits = (activityId: string) => {
    return activitySplits.filter(split => split.activity_id === activityId);
  };

  const getActivityLaps = (activityId: string) => {
    return activityLaps.filter(lap => lap.activity_id === activityId);
  };

  const getActivitySegmentEfforts = (activityId: string) => {
    return segmentEfforts.filter(effort => effort.activity_id === activityId);
  };

  const getActivityGear = (stravaActivityId: number) => {
    // This would need to be implemented with a join query in a real scenario
    // For now, we'll return empty array
    return [];
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
        <Tabs defaultValue="activities" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="activities">Recent Runs</TabsTrigger>
            <TabsTrigger value="efforts">Estimated Best Efforts</TabsTrigger>
          </TabsList>
          
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
              activities.map((activity) => {
                const isExpanded = expandedActivities.has(activity.id);
                const hasDetailedData = activity.total_elevation_gain || activity.elev_high || activity.elev_low || 
                                       activity.average_heartrate || activity.max_heartrate || 
                                       activity.average_watts || activity.max_watts || activity.kilojoules ||
                                       activity.average_cadence || activity.start_latlng || activity.end_latlng ||
                                       activity.kudos_count || activity.achievement_count || activity.suffer_score;

                return (
                  <div key={activity.id} className="border rounded-lg p-4 space-y-3">
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium">{activity.name}</h3>
                      <Badge variant="secondary">
                        {formatDate(activity.start_date)}
                      </Badge>
                    </div>
                    
                    {/* Basic Metrics - Always Visible */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
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
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-purple-500" />
                        <span className="font-medium">Max Speed:</span>
                        <span>{formatMaxSpeed(activity.max_speed)}</span>
                      </div>
                    </div>

                    {/* More Info Button */}
                    {hasDetailedData && (
                      <div className="flex justify-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleActivityExpanded(activity.id)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-4 w-4 mr-1" />
                              Less Info
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4 mr-1" />
                              More Info
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Detailed Metrics - Expandable */}
                    {isExpanded && hasDetailedData && (
                      <div className="space-y-4 pt-2 border-t">
                        {/* Basic Metrics Details */}
                        <div>
                          <h4 className="text-sm font-semibold mb-2 text-foreground">Basic Metrics</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                            <div className="flex justify-between">
                              <span>Moving Time:</span>
                              <span>{formatTime(activity.moving_time)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Elapsed Time:</span>
                              <span>{formatTime(activity.elapsed_time)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Average Speed:</span>
                              <span>{formatMaxSpeed(activity.average_speed)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Max Speed:</span>
                              <span>{formatMaxSpeed(activity.max_speed)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Elevation Data */}
                        {(activity.total_elevation_gain || activity.elev_high || activity.elev_low) && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2 text-foreground">Elevation</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                              {activity.total_elevation_gain && (
                                <div className="flex justify-between">
                                  <span>Total Gain:</span>
                                  <span>{formatElevation(activity.total_elevation_gain)}</span>
                                </div>
                              )}
                              {activity.elev_high && (
                                <div className="flex justify-between">
                                  <span>Max Elevation:</span>
                                  <span>{formatElevation(activity.elev_high)}</span>
                                </div>
                              )}
                              {activity.elev_low && (
                                <div className="flex justify-between">
                                  <span>Min Elevation:</span>
                                  <span>{formatElevation(activity.elev_low)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Heart Rate Data */}
                        {(activity.average_heartrate || activity.max_heartrate) && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2 text-foreground flex items-center gap-1">
                              <Heart className="h-3 w-3 text-red-500" />
                              Heart Rate
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                              {activity.average_heartrate && (
                                <div className="flex justify-between">
                                  <span>Average HR:</span>
                                  <span>{Math.round(activity.average_heartrate)} bpm</span>
                                </div>
                              )}
                              {activity.max_heartrate && (
                                <div className="flex justify-between">
                                  <span>Max HR:</span>
                                  <span>{Math.round(activity.max_heartrate)} bpm</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Power Data (for cycling) */}
                        {(activity.average_watts || activity.max_watts || activity.kilojoules) && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2 text-foreground">Power (Cycling)</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                              {activity.average_watts && (
                                <div className="flex justify-between">
                                  <span>Avg Power:</span>
                                  <span>{formatPower(activity.average_watts)}</span>
                                </div>
                              )}
                              {activity.max_watts && (
                                <div className="flex justify-between">
                                  <span>Max Power:</span>
                                  <span>{formatPower(activity.max_watts)}</span>
                                </div>
                              )}
                              {activity.kilojoules && (
                                <div className="flex justify-between">
                                  <span>Energy:</span>
                                  <span>{Math.round(activity.kilojoules)} kJ</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Cadence Data (for cycling) */}
                        {activity.average_cadence && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2 text-foreground">Cadence (Cycling)</h4>
                            <div className="text-sm text-muted-foreground">
                              <div className="flex justify-between">
                                <span>Average Cadence:</span>
                                <span>{formatCadence(activity.average_cadence)}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Location Data */}
                        {(activity.start_latlng || activity.end_latlng) && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2 text-foreground">Location</h4>
                            <div className="space-y-2 text-sm text-muted-foreground">
                              {activity.start_latlng && (
                                <div>
                                  <span className="font-medium">Start:</span>
                                  <span className="font-mono text-xs ml-2">{formatCoordinates(activity.start_latlng)}</span>
                                </div>
                              )}
                              {activity.end_latlng && (
                                <div>
                                  <span className="font-medium">End:</span>
                                  <span className="font-mono text-xs ml-2">{formatCoordinates(activity.end_latlng)}</span>
                                </div>
                              )}
                              {activity.map_summary_polyline && (
                                <div>
                                  <span className="font-medium">Route:</span>
                                  <span className="text-xs ml-2">Polyline available ({activity.map_summary_polyline.length} chars)</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Activity Splits */}
                        {getActivitySplits(activity.id).length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2 text-foreground">Per-Kilometer Splits</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm text-muted-foreground">
                              {getActivitySplits(activity.id).slice(0, 6).map((split) => (
                                <div key={split.id} className="border rounded p-2">
                                  <div className="font-medium text-foreground">Split {split.split_number}</div>
                                  <div className="flex justify-between">
                                    <span>Distance:</span>
                                    <span>{formatDistance(split.distance)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Time:</span>
                                    <span>{formatEffortTime(split.elapsed_time)}</span>
                                  </div>
                                  {split.average_speed && (
                                    <div className="flex justify-between">
                                      <span>Pace:</span>
                                      <span>{formatPace(split.average_speed)}</span>
                                    </div>
                                  )}
                                  {split.elevation_difference && (
                                    <div className="flex justify-between">
                                      <span>Elevation:</span>
                                      <span>{split.elevation_difference > 0 ? '+' : ''}{Math.round(split.elevation_difference)}m</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Activity Laps */}
                        {getActivityLaps(activity.id).length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2 text-foreground">Laps</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                              {getActivityLaps(activity.id).slice(0, 4).map((lap) => (
                                <div key={lap.id} className="border rounded p-2">
                                  <div className="font-medium text-foreground">Lap {lap.lap_number}</div>
                                  <div className="flex justify-between">
                                    <span>Distance:</span>
                                    <span>{formatDistance(lap.distance)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Time:</span>
                                    <span>{formatEffortTime(lap.elapsed_time)}</span>
                                  </div>
                                  {lap.average_speed && (
                                    <div className="flex justify-between">
                                      <span>Pace:</span>
                                      <span>{formatPace(lap.average_speed)}</span>
                                    </div>
                                  )}
                                  {lap.average_heartrate && (
                                    <div className="flex justify-between">
                                      <span>Avg HR:</span>
                                      <span>{Math.round(lap.average_heartrate)} bpm</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Segment Efforts */}
                        {getActivitySegmentEfforts(activity.id).length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2 text-foreground flex items-center gap-1">
                              <Trophy className="h-3 w-3 text-yellow-500" />
                              Segment Efforts
                            </h4>
                            <div className="space-y-2 text-sm text-muted-foreground">
                              {getActivitySegmentEfforts(activity.id).slice(0, 5).map((effort) => (
                                <div key={effort.id} className="border rounded p-2">
                                  <div className="flex justify-between items-start">
                                    <div className="font-medium text-foreground">{effort.segment_name}</div>
                                    <div className="flex gap-1">
                                      {effort.pr_rank === 1 && (
                                        <Badge className="bg-yellow-100 text-yellow-800 text-xs">PR</Badge>
                                      )}
                                      {effort.kom_rank && effort.kom_rank <= 10 && (
                                        <Badge className="bg-orange-100 text-orange-800 text-xs">KOM #{effort.kom_rank}</Badge>
                                      )}
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 mt-1">
                                    <div className="flex justify-between">
                                      <span>Distance:</span>
                                      <span>{formatDistance(effort.distance)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Time:</span>
                                      <span>{formatEffortTime(effort.elapsed_time)}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Additional Metrics */}
                        <div>
                          <h4 className="text-sm font-semibold mb-2 text-foreground">Additional</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                            {activity.kudos_count && activity.kudos_count > 0 && (
                              <div className="flex justify-between">
                                <span>Kudos:</span>
                                <span>{activity.kudos_count}</span>
                              </div>
                            )}
                            {activity.achievement_count && activity.achievement_count > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="flex items-center gap-1">
                                  <Trophy className="h-3 w-3 text-yellow-500" />
                                  Achievements:
                                </span>
                                <span>{activity.achievement_count}</span>
                              </div>
                            )}
                            {activity.suffer_score && (
                              <div className="flex justify-between">
                                <span>Suffer Score:</span>
                                <span>{activity.suffer_score}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </TabsContent>
          
          <TabsContent value="efforts" className="space-y-3">
            {bestEfforts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-2">
                  No estimated best efforts found
                </p>
                <p className="text-sm text-muted-foreground">
                  Estimated best efforts will appear here after analyzing your recent activities
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