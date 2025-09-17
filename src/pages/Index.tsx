// ============================================================================
// MAIN APPLICATION COMPONENT - AI RUNNING COACH
// ============================================================================
// This is the main page component that handles the entire user experience:
// - User authentication and profile management
// - Training plan generation and display
// - Strava integration for personalized training data
// - Navigation between different views (onboarding, dashboard, training plans)

// React hooks for managing component state and side effects
import { useState, useEffect } from 'react';
// React Router for navigation
import { Navigate } from 'react-router-dom';

// UI Components from our design system (shadcn/ui)
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Custom hooks for authentication and training plan updates
import { useAuth } from '@/hooks/useAuth';
import { useTrainingPlanUpdates } from '@/hooks/useTrainingPlanUpdates';

// Supabase client for database operations
import { supabase } from '@/integrations/supabase/client';

// Toast notifications for user feedback
import { useToast } from '@/hooks/use-toast';

// Custom components for different parts of the application
import ProfileForm from '@/components/ProfileForm';           // Form-based profile creation
import TrainingPlanDisplay from '@/components/TrainingPlanDisplay';  // Text view of training plan
import TrainingCalendarView from '@/components/TrainingCalendarView'; // Calendar view of training plan
import TrainingWeekView from '@/components/TrainingWeekView';  // Weekly view of training plan
import OnboardingChatbot from '@/components/OnboardingChatbot'; // AI chatbot for onboarding
import EditProfileDialog from '@/components/EditProfileDialog'; // Modal for editing profile
import StravaDashboard from '@/components/StravaDashboard';    // Strava data display

// Icons from Lucide React for consistent UI
import { User, LogOut, Target, Calendar, FileText, MessageCircle, ClipboardList, Edit3, Clock, Loader2 } from 'lucide-react';

// Utility functions for consistent date formatting
import { formatDate } from '@/lib/dateUtils';

const Index = () => {
  // ============================================================================
  // COMPONENT STATE MANAGEMENT
  // ============================================================================
  // These state variables control what the user sees and the app's behavior
  
  // Authentication state from our custom hook
  const { user, signOut, loading } = useAuth();
  
  // Toast notifications for user feedback (success, error messages)
  const { toast } = useToast();
  
  // User profile data - contains all the runner's information (goals, experience, etc.)
  const [profile, setProfile] = useState<any>(null);
  
  // Current training plan data - the AI-generated training schedule
  const [trainingPlan, setTrainingPlan] = useState<any>(null);
  
  // ID of the current training plan - used for tracking updates
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  
  // Loading state for training plan generation - shows "Generating..." to user
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Loading state for initial data fetch - shows loading screen
  const [loadingData, setLoadingData] = useState(true);
  
  // Onboarding mode selection - user can choose between AI chat or form
  const [onboardingMode, setOnboardingMode] = useState<'chat' | 'form'>('chat');
  
  // Controls whether the edit profile dialog is open
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // Shows prompt to refresh training plan after Strava data sync
  const [showStravaRefreshPrompt, setShowStravaRefreshPrompt] = useState(false);

  // Hook that monitors training plan updates in real-time
  // This allows us to show progress when the AI is enhancing the training plan
  const { planUpdates, isUpdating, enhancementProgress } = useTrainingPlanUpdates(currentPlanId);

  // ============================================================================
  // SIDE EFFECTS (useEffect hooks)
  // ============================================================================
  // These hooks run when certain values change and handle automatic updates
  
  // Handle Strava redirect on initial page load (before user auth is ready)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('strava') === 'connected') {
      // Clean up URL immediately
      window.history.replaceState({}, '', window.location.pathname);
      console.log('Strava connection detected on page load');
    }
  }, []); // Run once on mount

  // Main data loading effect - runs when user authentication changes
  useEffect(() => {
    if (user) {
      // User is logged in, fetch their profile and training plan
      fetchUserData();
    } else {
      // User is not logged in, stop loading
      setLoadingData(false);
    }
  }, [user]);

  // Handle URL parameters after external redirects (e.g., Strava OAuth callback)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('strava') === 'connected') {
      // User just connected to Strava, clean up URL immediately
      window.history.replaceState({}, '', window.location.pathname);
      
      // If user is available, refresh their data
      if (user) {
        fetchUserData();
      } else {
        // If user is not available yet, wait for authentication to complete
        // The main useEffect will handle fetching data once user is available
        console.log('Strava connected, waiting for user authentication...');
      }
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

  // ============================================================================
  // MAIN DATA FETCHING FUNCTION
  // ============================================================================
  // This function loads all the user's data when they log in or when we need to refresh
  
  const fetchUserData = async () => {
    if (!user) return;

    try {
      console.log('Fetching user data for user:', user.id);
      
      // STEP 1: Fetch the user's profile from the database
      // The profile contains all their running information (goals, experience, etc.)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      console.log('Profile data:', profileData);

      if (profileData) {
        // Store the profile data in our component state
        setProfile(profileData);

        // STEP 2: Fetch their latest training plan
        // We get the most recent training plan they've generated
        const { data: planData, error: planError } = await supabase
          .from('training_plans')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })  // Get the newest first
          .limit(1)
          .maybeSingle();

        console.log('Training plan data:', planData, 'Error:', planError);

        if (planData && !planError) {
          // User has a training plan, load it
          setTrainingPlan(planData);
          setCurrentPlanId(planData.id);
          console.log('Training plan loaded:', planData.id);
        } else {
          console.log('No training plan found or error:', planError);
          // STEP 3: Auto-generate training plan if user has complete profile
          // This ensures new users get a training plan immediately after onboarding
          if (hasCompleteMandatoryProfile(profileData)) {
            console.log('Complete profile found, generating training plan automatically');
            await generateTrainingPlan(profileData);
          }
        }
      } else {
        console.log('No profile found for user');
      }
    } catch (error) {
      // This is normal for new users who haven't created a profile yet
      console.log('Error fetching user data:', error);
    } finally {
      // Always stop loading, even if there was an error
      setLoadingData(false);
    }
  };

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================
  
  // Check if the user's profile has all the required information to generate a training plan
  // This prevents the AI from trying to create a plan with incomplete data
  const hasCompleteMandatoryProfile = (profileData: any) => {
    return profileData && 
           profileData.goal &&                    // What they want to achieve (marathon, 5k, etc.)
           profileData.race_date &&              // When their race is
           profileData.race_distance_km &&       // How far they need to run
           profileData.current_weekly_mileage && // How much they currently run
           profileData.days_per_week;            // How often they train
  };

  // ============================================================================
  // TRAINING PLAN GENERATION FUNCTION
  // ============================================================================
  // This function calls our AI to generate a personalized training plan
  // It always uses the most up-to-date profile data, regardless of Strava connection status
  
  const generateTrainingPlan = async (profileData: any) => {
    setIsGenerating(true);
    
    try {
      // IMPORTANT: Always use the most current profile data
      // This ensures that if Strava is disconnected, we still use the latest profile info
      const currentProfileData = profile || profileData;
      
      console.log('Generating training plan with profile data:', currentProfileData);
      
      // Call our Supabase Edge Function that uses AI to generate the training plan
      const { data, error } = await supabase.functions.invoke('generate-training-plan', {
        body: { profileData: currentProfileData },
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        // The AI has generated the plan, now fetch the complete data from the database
        const { data: planData, error: fetchError } = await supabase
          .from('training_plans')
          .select('*')
          .eq('id', data.planId)
          .single();

        if (fetchError) {
          throw new Error('Failed to fetch generated training plan');
        }

        // Update our component state with the new training plan
        setTrainingPlan(planData);
        setCurrentPlanId(data.planId);
        
        // Show success message to the user
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
      // Always stop the loading state, even if there was an error
      setIsGenerating(false);
    }
  };

  // ============================================================================
  // EVENT HANDLER FUNCTIONS
  // ============================================================================
  // These functions handle user interactions and data updates
  
  // Called when a new user completes onboarding and creates their profile
  const handleProfileCreated = async (newProfile: any) => {
    // Update our component state with the new profile
    setProfile(newProfile);
    // Automatically generate their first training plan
    await generateTrainingPlan(newProfile);
  };

  // Called when user updates their profile (e.g., changes goals, race date, etc.)
  const handleProfileUpdated = async (updatedProfile: any) => {
    // Update our component state with the new profile data
    setProfile(updatedProfile);
    
    // Only regenerate training plan if training-relevant data has changed
    // Don't regenerate for Strava connection changes or other non-training data
    const trainingRelevantFields = [
      'goal', 'race_date', 'race_distance_km', 'current_weekly_mileage', 
      'days_per_week', 'age', 'height', 'training_history', 'injuries', 
      'further_notes', 'current_5k_time', 'current_10k_time', 'current_half_marathon_time', 
      'current_marathon_time', 'current_weekly_mileage', 'days_per_week'
    ];
    
    const hasTrainingRelevantChanges = trainingRelevantFields.some(field => {
      const oldValue = profile?.[field];
      const newValue = updatedProfile?.[field];
      return oldValue !== newValue;
    });
    
    if (hasTrainingRelevantChanges) {
      console.log('Training-relevant profile data changed, regenerating training plan');
      await generateTrainingPlan(updatedProfile);
    } else {
      console.log('Profile updated but no training-relevant changes detected, skipping plan regeneration');
    }
  };

  // Called when user clicks the sign out button
  const handleSignOut = async () => {
    // Sign out from Supabase authentication
    await signOut();
    // Clear all user data from our component state
    setProfile(null);
    setTrainingPlan(null);
  };

  // Called when Strava data has been successfully synced
  const handleStravaDataSynced = () => {
    // Show the prompt to refresh the training plan
    setShowStravaRefreshPrompt(true);
    // Notify the user that their Strava data is ready
    toast({
      title: "Strava Data Synced!",
      description: "Your training data has been imported. Consider refreshing your training plan to incorporate this new data.",
    });
  };

  // Called when user clicks "Refresh Plan" after Strava data sync
  const handleRefreshTrainingPlanWithStrava = async () => {
    if (!profile) return;
    
    setIsGenerating(true);
    setShowStravaRefreshPrompt(false);
    
    try {
      // Generate a new training plan that incorporates the Strava data
      // The generateTrainingPlan function will automatically use the most current profile data
      await generateTrainingPlan(profile);
      toast({
        title: "Training Plan Refreshed!",
        description: "Your training plan has been updated with your Strava data for better personalization.",
      });
    } catch (error) {
      console.error('Error refreshing training plan:', error);
      toast({
        title: "Error",
        description: "Failed to refresh training plan. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // ============================================================================
  // LOADING AND AUTHENTICATION CHECKS
  // ============================================================================
  // These checks determine what the user sees based on their authentication status
  
  // Show loading screen while we're checking authentication or fetching data
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

  // If user is not authenticated, redirect them to the login page
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
                {trainingPlan && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      // Scroll to dashboard section
                      const dashboardElement = document.querySelector('[data-dashboard]');
                      if (dashboardElement) {
                        dashboardElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      } else {
                        // Fallback: scroll to top of main content
                        const mainElement = document.querySelector('main');
                        if (mainElement) {
                          mainElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }
                    }}
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Dashboard
                  </Button>
                )}
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
        {/* ============================================================================
            MAIN CONDITIONAL RENDERING LOGIC
            ============================================================================
            This determines what the user sees based on their profile and training plan status:
            1. If no profile OR incomplete profile + no training plan → Show onboarding
            2. If complete profile + training plan OR complete profile → Show dashboard
            3. If complete profile but no training plan → Show "Generate Plan" card
        */}
        {!profile || (!trainingPlan && !hasCompleteMandatoryProfile(profile)) ? (
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
        ) : profile && (trainingPlan || hasCompleteMandatoryProfile(profile)) ? (
          <div data-dashboard>
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-bold">Welcome back, {profile.full_name}!</h2>
              </div>
              <p className="text-muted-foreground">
                Goal: {profile.goal} • Race Date: {formatDate(profile.race_date)}
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

              {/* Strava Refresh Prompt */}
              {showStravaRefreshPrompt && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-blue-900">New Strava Data Available!</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Your Strava training data has been synced. Refresh your training plan to incorporate this data for better personalization.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={handleRefreshTrainingPlanWithStrava}
                        size="sm"
                        disabled={isGenerating}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Refreshing...
                          </>
                        ) : (
                          'Refresh Plan'
                        )}
                      </Button>
                      <Button 
                        onClick={() => setShowStravaRefreshPrompt(false)}
                        variant="ghost"
                        size="sm"
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            
            {trainingPlan?.plan_content?.text ? (
              <>
                <Tabs defaultValue="week" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="week" className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Week View
                    </TabsTrigger>
                    <TabsTrigger value="text" className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Text View
                    </TabsTrigger>
                    <TabsTrigger value="calendar" className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Calendar View
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="week">
                    {trainingPlan ? (
                      <TrainingWeekView 
                        trainingPlan={trainingPlan} 
                        profile={profile}
                      />
                    ) : (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Loading training plan...</p>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="text">
                    {trainingPlan?.plan_content?.text ? (
                      <TrainingPlanDisplay 
                        trainingPlan={trainingPlan.plan_content.text} 
                        profile={profile}
                      />
                    ) : (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Loading training plan...</p>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="calendar">
                    {trainingPlan?.plan_content?.text ? (
                      <TrainingCalendarView 
                        trainingPlan={trainingPlan.plan_content.text} 
                        profile={profile}
                        planStartDate={trainingPlan.created_at}
                      />
                    ) : (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Loading training plan...</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

                {/* Strava Dashboard */}
                <StravaDashboard profile={profile} onStravaDataSynced={handleStravaDataSynced} />
              </>
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
        ) : (
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