import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ExternalLink, Zap, ZapOff } from "lucide-react";

interface StravaConnectionProps {
  profile: any;
  onUpdate: () => void;
}

const StravaConnection: React.FC<StravaConnectionProps> = ({ profile, onUpdate }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  // Check for connection success in URL and auto-refresh data
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('strava') === 'connected' && profile?.strava_connected) {
      // Auto-refresh data after successful connection
      handleRefreshData();
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [profile?.strava_connected]);

  const handleConnect = async () => {
    if (!profile?.user_id) {
      toast.error('User profile not found');
      return;
    }

    setIsConnecting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('strava-auth', {
        body: {
          redirectUrl: window.location.origin
        }
      });

      if (error) {
        console.error('Error getting Strava auth URL:', error);
        toast.error('Failed to connect to Strava. Please try again.');
        return;
      }

      if (data?.authUrl) {
        // Open Strava authorization in current window
        window.location.href = data.authUrl;
      } else {
        throw new Error('No authorization URL received');
      }

    } catch (error) {
      console.error('Error connecting to Strava:', error);
      toast.error('Failed to connect to Strava. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    
    try {
      // Clear profile connection status
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          strava_connected: false,
          strava_athlete_id: null,
          strava_connected_at: null
        })
        .eq('user_id', profile.user_id);

      if (profileError) {
        console.error('Error disconnecting Strava:', profileError);
        toast.error('Failed to disconnect Strava. Please try again.');
        return;
      }

      // Clear encrypted tokens
      await supabase.from('encrypted_strava_tokens').delete().eq('user_id', profile.user_id);

      // Clear Strava data
      await supabase.from('strava_activities').delete().eq('user_id', profile.user_id);
      await supabase.from('strava_best_efforts').delete().eq('user_id', profile.user_id);
      await supabase.from('strava_stats').delete().eq('user_id', profile.user_id);

      toast.success('Successfully disconnected from Strava');
      onUpdate();

    } catch (error) {
      console.error('Error disconnecting from Strava:', error);
      toast.error('Failed to disconnect from Strava. Please try again.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleRefreshData = async () => {
    setIsFetching(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-strava-data', {
        body: {} // No userId needed - authenticated via JWT
      });

      if (error) {
        console.error('Error refreshing Strava data:', error);
        toast.error('Failed to refresh Strava data. Please try again.');
        return;
      }

      toast.success(`Successfully refreshed Strava data! Found ${data?.activitiesCount || 0} activities.`);
      onUpdate();

    } catch (error) {
      console.error('Error refreshing Strava data:', error);
      toast.error('Failed to refresh Strava data. Please try again.');
    } finally {
      setIsFetching(false);
    }
  };

  if (profile?.strava_connected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-orange-500" />
            <div>
              <h3 className="font-medium">Strava Connected</h3>
              <p className="text-sm text-muted-foreground">
                Connected on {new Date(profile.strava_connected_at).toLocaleDateString()}
              </p>
            </div>
            <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200">
              Connected
            </Badge>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={handleRefreshData}
            disabled={isFetching}
            size="sm"
            variant="outline"
          >
            {isFetching ? 'Refreshing...' : 'Refresh Data'}
          </Button>
          
          <Button
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            size="sm"
            variant="ghost"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ZapOff className="h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="font-medium">Connect Strava</h3>
            <p className="text-sm text-muted-foreground">
              Sync your running data for personalized training plans
            </p>
          </div>
        </div>
      </div>
      
      <Button
        onClick={handleConnect}
        disabled={isConnecting}
        className="bg-orange-600 hover:bg-orange-700 text-white"
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        {isConnecting ? 'Connecting...' : 'Connect with Strava'}
      </Button>
      
      <p className="text-xs text-muted-foreground">
        We'll import your recent activities, best efforts, and training stats to create more personalized training plans.
      </p>
    </div>
  );
};

export default StravaConnection;