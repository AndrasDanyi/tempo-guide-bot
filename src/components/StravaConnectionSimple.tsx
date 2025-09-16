import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ExternalLink, Loader2 } from "lucide-react";

interface StravaConnectionSimpleProps {
  profile: any;
  onUpdate: () => void;
}

const StravaConnectionSimple: React.FC<StravaConnectionSimpleProps> = ({ profile, onUpdate }) => {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnectStrava = async () => {
    if (!profile?.user_id) {
      toast.error('User profile not found');
      return;
    }

    setIsConnecting(true);
    
    try {
      console.log('Starting simple Strava connection...');
      
      // Call the simple Strava auth function
      const { data, error } = await supabase.functions.invoke('strava-auth-simple', {
        body: {}
      });

      console.log('Strava auth response:', { data, error });

      if (error) {
        console.error('Error getting Strava auth URL:', error);
        toast.error(`Failed to connect to Strava: ${error.message || 'Unknown error'}`);
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

  if (profile?.strava_connected) {
    return (
      <div className="text-center py-4">
        <div className="text-green-600 font-medium mb-2">✅ Connected to Strava</div>
        <p className="text-sm text-muted-foreground">
          Athlete ID: {profile.strava_athlete_id}
        </p>
      </div>
    );
  }

  return (
    <div className="text-center py-4">
      <h3 className="text-lg font-medium mb-2">Connect to Strava</h3>
      <p className="text-muted-foreground mb-4">
        Connect your Strava account to import your training data.
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
    </div>
  );
};

export default StravaConnectionSimple;
