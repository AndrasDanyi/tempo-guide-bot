import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useTrainingPlanUpdates } from '@/hooks/useTrainingPlanUpdates';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ProfileForm from '@/components/ProfileForm';
import TrainingPlanDisplay from '@/components/TrainingPlanDisplay';
import TrainingCalendarView from '@/components/TrainingCalendarView';
import OnboardingChatbot from '@/components/OnboardingChatbot';
import EditProfileDialog from '@/components/EditProfileDialog';
import { User, LogOut, Target, Calendar, FileText, MessageCircle, ClipboardList, Edit3, Clock, Loader2 } from 'lucide-react';

const Index = () => {
  const { user, signOut, loading } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [trainingPlan, setTrainingPlan] = useState<any>(null);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [onboardingMode, setOnboardingMode] = useState<'chat' | 'form'>('chat');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Use the training plan updates hook
  const { planUpdates, isUpdating, enhancementProgress } = useTrainingPlanUpdates(currentPlanId);

  useEffect(() => {
    if (user) {
      fetchUserData();
    } else {
      setLoadingData(false);
    }
  }, [user]);

  // Update training plan when new updates arrive
  useEffect(() => {
    if (planUpdates?.updatedPlan && currentPlanId) {
      setTrainingPlan({
        ...trainingPlan,
        id: currentPlanId,
        plan_content: { text: planUpdates.updatedPlan }
      });
      console.log('Training plan updated via real-time subscription');
    }
  }, [planUpdates, currentPlanId]);

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
        const { data: planData, error: planError } = await supabase
          .from('training_plans')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (planData && !planError) {
          setTrainingPlan(planData);
          setCurrentPlanId(planData.id);
          console.log('Training plan loaded:', planData.id);
        } else {
          console.log('No training plan found or error:', planError);
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
          plan_content: { text: data.trainingPlanText },
        });
        setCurrentPlanId(data.planId);
        toast({
          title: "Training plan generated!",
          description: "Detailed enhancements are being added in the background.",
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

  const handleProfileUpdated = async (updatedProfile: any) => {
    setProfile(updatedProfile);
    await generateTrainingPlan(updatedProfile);
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Loading...</h2>
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-6"></div>
          <h2 className="text-2xl font-semibold mb-4">Generating Your Training Plan</h2>
          <p className="text-muted-foreground leading-relaxed">
            Our AI coach is analyzing your profile and creating a personalized day-by-day training plan. 
            This may take up to 2 minutes...
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
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
                Let's get started by creating your runner profile. Choose how you'd like to provide your information:
              </p>
              
              {/* Onboarding Mode Selection */}
              <div className="flex justify-center mb-8">
                <Tabs value={onboardingMode} onValueChange={(value) => setOnboardingMode(value as 'chat' | 'form')} className="w-full max-w-md">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="chat" className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      AI Chat
                    </TabsTrigger>
                    <TabsTrigger value="form" className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4" />
                      Form
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
            
            {onboardingMode === 'chat' ? (
              <OnboardingChatbot onProfileComplete={handleProfileCreated} />
            ) : (
              <ProfileForm onProfileCreated={handleProfileCreated} />
            )}
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
              {/* Enhancement Progress Indicator */}
              {isUpdating && enhancementProgress && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">
                      Enhancing your training plan...
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-1000"
                      style={{ width: `${enhancementProgress.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-blue-700">
                    Enhanced {enhancementProgress.enhanced} of {enhancementProgress.total} training days ({enhancementProgress.percentage}%)
                  </p>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <Button 
                  onClick={() => generateTrainingPlan(profile)} 
                  variant="outline"
                  size="sm"
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Regenerate Training Plan'
                  )}
                </Button>
                <Button 
                  onClick={() => setIsEditDialogOpen(true)} 
                  variant="outline"
                  size="sm"
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              </div>
            </div>
            
            {/* Debug info */}
            <div className="mb-4 p-4 bg-muted rounded text-xs">
              <p><strong>Debug Info:</strong></p>
              <p>Training Plan exists: {trainingPlan ? 'Yes' : 'No'}</p>
              {trainingPlan && (
                <>
                  <p>Plan ID: {trainingPlan.id}</p>
                  <p>Plan content type: {typeof trainingPlan.plan_content}</p>
                  <p>Has text property: {trainingPlan.plan_content?.text ? 'Yes' : 'No'}</p>
                  <p>Content length: {trainingPlan.plan_content?.text?.length || 0} chars</p>
                  <p>Content preview: {trainingPlan.plan_content?.text?.substring(0, 200)}...</p>
                </>
              )}
            </div>
            
            {trainingPlan?.plan_content?.text ? (
              <Tabs defaultValue="text" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="text" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Text View
                  </TabsTrigger>
                  <TabsTrigger value="calendar" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Calendar View
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="text">
                  <TrainingPlanDisplay 
                    trainingPlan={trainingPlan.plan_content.text} 
                    profile={profile}
                  />
                </TabsContent>
                
                <TabsContent value="calendar">
                  <TrainingCalendarView 
                    trainingPlan={trainingPlan.plan_content.text} 
                    profile={profile}
                    planStartDate={trainingPlan.created_at}
                  />
                </TabsContent>
              </Tabs>
            ) : (
              <Card className="max-w-md mx-auto">
                <CardHeader>
                  <CardTitle>No Training Plan Found</CardTitle>
                  <CardDescription>
                    It seems your training plan is missing or corrupted.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => generateTrainingPlan(profile)} className="w-full">
                    Generate New Training Plan
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>

      {/* Edit Profile Dialog */}
      <EditProfileDialog 
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        profile={profile}
        onProfileUpdated={handleProfileUpdated}
      />
    </div>
  );
};

export default Index;