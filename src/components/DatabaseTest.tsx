import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const DatabaseTest: React.FC = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const testDatabaseQuery = async () => {
    if (!user) {
      toast.error('You must be logged in to test database queries.');
      return;
    }

    setLoading(true);
    try {
      console.log('Testing database query for user:', user.id);
      
      // Test 1: Query all activities for this user
      const { data, error } = await supabase
        .from('strava_activities')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Database query error:', error);
        toast.error('Database query failed: ' + error.message);
        return;
      }

      console.log('Database query result:', data);
      setActivities(data || []);
      
      if (data && data.length > 0) {
        toast.success(`Found ${data.length} activities in database!`);
      } else {
        toast.warning('No activities found in database');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to query database');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatDistance = (meters: number) => {
    return (meters / 1000).toFixed(2) + ' km';
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Database Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center">
          <Button
            onClick={testDatabaseQuery}
            disabled={loading || !user}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? 'Querying Database...' : 'Test Database Query'}
          </Button>
          {!user && (
            <p className="mt-4 text-sm text-yellow-600">Please log in to test database queries.</p>
          )}
        </div>

        {activities.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Activities in Database ({activities.length})</h3>
            <div className="grid gap-4">
              {activities.map((activity, index) => (
                <div key={activity.id || index} className="border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <h4 className="font-medium">{activity.name}</h4>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(activity.start_date)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="font-medium">Distance</div>
                      <div>{formatDistance(activity.distance)}</div>
                    </div>
                    <div>
                      <div className="font-medium">Type</div>
                      <div>{activity.activity_type}</div>
                    </div>
                    <div>
                      <div className="font-medium">Moving Time</div>
                      <div>{Math.floor(activity.moving_time / 60)}m</div>
                    </div>
                    <div>
                      <div className="font-medium">Strava ID</div>
                      <div>{activity.strava_activity_id}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activities.length === 0 && !loading && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Click "Test Database Query" to see what's stored in the database
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DatabaseTest;
