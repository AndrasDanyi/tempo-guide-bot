import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ProfileForm from '@/components/ProfileForm';
import TrainingCalendar from '@/components/TrainingCalendar';
import { User, LogOut, Target, Calendar } from 'lucide-react';

const Index = () => {
  const { user, signOut, loading } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [trainingPlan, setTrainingPlan] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserData();
    } else {
      setLoadingData(false);
    }
  }, [user]);

  const fetchUserData = async () => {
    if (!user) return;

    try {
      // Fetch user profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileData) {
        setProfile(profileData);

        // Fetch latest training plan
        const { data: planData } = await supabase
          .from('training_plans')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (planData) {
          setTrainingPlan(planData);
        }
      }
    } catch (error) {
      // Profile or plan doesn't exist yet - this is fine for new users
      console.log('No profile or training plan found yet');
    } finally {
      setLoadingData(false);
    }
  };

  const generateTrainingPlan = async (profileData: any) => {
    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-training-plan', {
        body: { profileData },
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        setTrainingPlan({
          id: data.planId,
          plan_content: data.trainingPlan,
        });
        toast({
          title: "Training plan generated!",
          description: "Your personalized training plan is ready.",
        });
      } else {
        throw new Error(data.error || 'Failed to generate training plan');
      }
    } catch (error) {
      console.error('Error generating training plan:', error);
      toast({
        title: "Error generating training plan",
        description: "Please try again. If the problem persists, contact support.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleProfileCreated = async (newProfile: any) => {
    setProfile(newProfile);
    await generateTrainingPlan(newProfile);
  };

  const handleSignOut = async () => {
    await signOut();
    setProfile(null);
    setTrainingPlan(null);
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Loading...</h2>
          <p className="text-muted-foreground">Getting your data ready</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (isGenerating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-2xl font-semibold mb-2">Generating Your Training Plan</h2>
          <p className="text-muted-foreground">
            Our AI coach is analyzing your profile and creating a personalized training plan. 
            This may take a minute...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Target className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">AI Running Coach</h1>
              <p className="text-sm text-muted-foreground">Your personal training companion</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  {user.email}
                </div>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {!profile ? (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-4">Welcome to Your AI Running Coach!</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Let's get started by creating your runner profile. We'll use this information 
                to generate a personalized training plan just for you.
              </p>
            </div>
            <ProfileForm onProfileCreated={handleProfileCreated} />
          </div>
        ) : !trainingPlan ? (
          <div className="text-center">
            <Card className="max-w-md mx-auto">
              <CardHeader>
                <CardTitle>Profile Created!</CardTitle>
                <CardDescription>
                  Your profile has been saved. Now let's generate your training plan.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => generateTrainingPlan(profile)} className="w-full">
                  Generate Training Plan
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div>
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-bold">Welcome back, {profile.full_name}!</h2>
              </div>
              <p className="text-muted-foreground">
                Goal: {profile.goal} • Race Date: {new Date(profile.race_date).toLocaleDateString()}
              </p>
            </div>
            <TrainingCalendar trainingPlan={trainingPlan.plan_content} />
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;