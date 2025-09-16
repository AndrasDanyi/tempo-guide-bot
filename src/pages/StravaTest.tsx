import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import StravaConnectionSimple from "@/components/StravaConnectionSimple";

const StravaTest = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = () => {
    fetchProfile();
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">Please log in to test Strava connection.</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Strava Connection Test</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Simple Strava Integration Test</CardTitle>
        </CardHeader>
        <CardContent>
          <StravaConnectionSimple 
            profile={profile} 
            onUpdate={handleProfileUpdate}
          />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Debug Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div><strong>User ID:</strong> {user?.id}</div>
            <div><strong>Profile ID:</strong> {profile?.id || 'Not found'}</div>
            <div><strong>Strava Connected:</strong> {profile?.strava_connected ? 'Yes' : 'No'}</div>
            <div><strong>Athlete ID:</strong> {profile?.strava_athlete_id || 'Not set'}</div>
            <div><strong>Connected At:</strong> {profile?.strava_connected_at || 'Not set'}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StravaTest;
