import React from 'react';
import StravaClean from "@/components/StravaClean";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

const StravaCleanTest = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading user...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Clean Strava Integration Test</CardTitle>
          <CardDescription className="text-center mt-2">
            This is a clean, simple Strava integration that connects to Strava and fetches your 10 most recent workouts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!user ? (
            <div className="text-center text-red-500 mb-4">
              Please log in to test the Strava connection.
            </div>
          ) : (
            <StravaClean />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StravaCleanTest;
