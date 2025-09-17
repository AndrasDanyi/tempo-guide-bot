import React from 'react';
import DatabaseTest from "@/components/DatabaseTest";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

const DatabaseTestPage = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading user...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Database Test</CardTitle>
          <CardDescription className="text-center mt-2">
            This page directly queries the database to see what Strava activities are stored.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!user ? (
            <div className="text-center text-red-500 mb-4">
              Please log in to test the database queries.
            </div>
          ) : (
            <DatabaseTest />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DatabaseTestPage;
