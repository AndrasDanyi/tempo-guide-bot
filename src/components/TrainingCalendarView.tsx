import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, Calendar, Clock, MapPin, Target, Loader2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { formatDate } from '@/lib/dateUtils';

interface TrainingDay {
  id: string;
  date: string;
  training_session: string;
  mileage_breakdown?: string;
  pace_targets?: string;
  estimated_distance_km?: number;
  estimated_avg_pace_min_per_km?: string;
  estimated_moving_time?: string;
  
  // Detailed fields
  heart_rate_zones?: string;
  purpose?: string;
  session_load?: string;
  notes?: string;
  what_to_eat_drink?: string;
  additional_training?: string;
  recovery_training?: string;
  estimated_elevation_gain_m?: number;
  estimated_avg_power_w?: number;
  estimated_cadence_spm?: number;
  estimated_calories?: number;
  daily_nutrition_advice?: string;
  detailed_fields_generated: boolean;
}

interface TrainingCalendarViewProps {
  trainingPlan: string;
  profile: any;
  planStartDate: string;
}

const TrainingCalendarView = ({ trainingPlan, profile, planStartDate }: TrainingCalendarViewProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<TrainingDay | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [trainingDays, setTrainingDays] = useState<TrainingDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Load training days from database
  useEffect(() => {
    const loadTrainingDays = async () => {
      try {
        // Get the current training plan ID
        const { data: plans, error: planError } = await supabase
          .from('training_plans')
          .select('id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (planError) {
          console.error('Error fetching training plan:', planError);
          return;
        }

        if (!plans || plans.length === 0) {
          console.log('No training plans found');
          return;
        }

        const planId = plans[0].id;

        // Load training days for this plan
        const { data: days, error: daysError } = await supabase
          .from('training_days')
          .select('*')
          .eq('training_plan_id', planId)
          .order('date', { ascending: true });

        if (daysError) {
          console.error('Error fetching training days:', daysError);
          toast({
            title: "Error",
            description: "Failed to load training calendar. Please try again.",
            variant: "destructive"
          });
          return;
        }

        setTrainingDays(days || []);
        console.log('Loaded training days:', days?.length || 0);
      } catch (error) {
        console.error('Error loading training days:', error);
        toast({
          title: "Error",
          description: "Failed to load training calendar. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadTrainingDays();
  }, [toast]);

  // Get days for current month view
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get workout for specific day
  const getWorkoutForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return trainingDays.find(day => day.date === dateStr);
  };

  const getWorkoutTypeColor = (workoutType: string) => {
    const type = workoutType.toLowerCase();
    if (type.includes('rest')) return 'bg-gray-100 text-gray-800 border-gray-200';
    if (type.includes('easy') || type.includes('recovery')) return 'bg-green-100 text-green-800 border-green-200';
    if (type.includes('tempo') || type.includes('threshold')) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (type.includes('interval') || type.includes('speed')) return 'bg-red-100 text-red-800 border-red-200';
    if (type.includes('long')) return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-purple-100 text-purple-800 border-purple-200';
  };

  const handleDayClick = async (trainingDay: TrainingDay) => {
    setSelectedDay(trainingDay);
    setIsDialogOpen(true);
    
    // If detailed fields are already generated, don't reload
    if (trainingDay.detailed_fields_generated) {
      return;
    }

    setIsLoadingDetails(true);

    try {
      // Call the enhanced generate-day-details function
      const { data, error } = await supabase.functions.invoke('generate-day-details', {
        body: {
          trainingDayId: trainingDay.id,
          profileData: profile,
          dayData: {
            specific_date: trainingDay.date,
            training_session: trainingDay.training_session,
            estimated_distance_km: trainingDay.estimated_distance_km || 0,
            estimated_duration_min: trainingDay.estimated_moving_time ? 
              (trainingDay.estimated_moving_time.includes(':') ? 
                parseInt(trainingDay.estimated_moving_time.split(':')[0]) * 60 + parseInt(trainingDay.estimated_moving_time.split(':')[1]) 
                : 0) : 0,
            session_load: trainingDay.session_load || 'Medium',
            purpose: trainingDay.purpose || 'Training session',
            mileage_breakdown: trainingDay.mileage_breakdown,
            pace_targets: trainingDay.pace_targets
          }
        }
      });

      if (error) {
        console.error('Error generating day details:', error);
        toast({
          title: "Error",
          description: "Failed to load detailed training information. Please try again.",
          variant: "destructive"
        });
      } else if (data?.success) {
        // Update the local state with the enhanced data
        setTrainingDays(prev => 
          prev.map(day => 
            day.id === trainingDay.id 
              ? { ...day, ...data.updatedTrainingDay, detailed_fields_generated: true }
              : day
          )
        );
        
        // Update selected day as well
        setSelectedDay(prev => prev ? { ...prev, ...data.updatedTrainingDay, detailed_fields_generated: true } : null);
        
        toast({
          title: "Success",
          description: "Detailed training information loaded successfully!",
        });
      }
    } catch (error) {
      console.error('Error calling day details function:', error);
      toast({
        title: "Error",
        description: "Failed to load detailed training information. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <span>Loading training calendar...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Training Calendar
          </CardTitle>
          <div className="flex items-center justify-between">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <strong>Goal:</strong> {profile.goal}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <strong>Race Date:</strong> {formatDate(profile.race_date)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <strong>Total Workouts:</strong> {trainingDays.length}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Calendar Navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Day headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}
            
            {/* Calendar days */}
            {calendarDays.map(day => {
              const workout = getWorkoutForDay(day);
              const isToday = isSameDay(day, new Date());
              const isRaceDay = profile?.race_date && isSameDay(day, new Date(profile.race_date));
              
              return (
                <div
                  key={day.toISOString()}
                  className={`
                    relative p-2 h-20 border rounded-lg cursor-pointer transition-colors
                    ${isToday ? 'border-primary bg-primary/5' : 'border-border'}
                    ${isRaceDay ? 'border-red-500 bg-red-50 border-2' : ''}
                    ${workout ? 'hover:bg-accent' : 'hover:bg-muted/50'}
                  `}
                  onClick={() => workout && handleDayClick(workout)}
                >
                  <div className="text-sm font-medium mb-1">
                    {format(day, 'd')}
                    {isRaceDay && <span className="text-red-600 ml-1">🏁</span>}
                  </div>
                  
                  {isRaceDay && !workout && (
                    <div className="space-y-1">
                      <Badge 
                        variant="secondary" 
                        className="text-xs p-1 h-auto leading-tight bg-red-100 text-red-800 border-red-200"
                      >
                        Race Day!
                      </Badge>
                    </div>
                  )}
                  
                  {workout && (
                    <div className="space-y-1">
                      <Badge 
                        variant="secondary" 
                        className={`text-xs p-1 h-auto leading-tight ${getWorkoutTypeColor(workout.training_session)}`}
                      >
                        {workout.training_session}
                      </Badge>
                      
                      {workout.estimated_distance_km && workout.estimated_distance_km > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {workout.estimated_distance_km} km
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Workout Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {selectedDay && format(new Date(selectedDay.date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
            </DialogTitle>
          </DialogHeader>
          
          {selectedDay && (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-lg font-semibold">
                    Day {trainingDays.findIndex(d => d.id === selectedDay.id) + 1}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedDay.date + 'T00:00:00'), 'EEEE')}
                  </p>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-center">
                    <Badge 
                      variant="secondary" 
                      className={`text-sm px-3 py-1 ${getWorkoutTypeColor(selectedDay.training_session)}`}
                    >
                      {selectedDay.training_session}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="p-3 bg-secondary rounded-lg">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium">Distance</span>
                      </div>
                      <span className="text-sm font-semibold">
                        {selectedDay.estimated_distance_km ? `${selectedDay.estimated_distance_km} km` : '0 km'}
                      </span>
                    </div>
                    
                    <div className="p-3 bg-secondary rounded-lg">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium">Duration</span>
                      </div>
                      <span className="text-sm font-semibold">
                        {selectedDay.estimated_moving_time || '0:00'}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Basic workout information */}
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Workout Overview
                  </h4>
                  
                  <div className="space-y-2 text-sm">
                    {selectedDay.mileage_breakdown && (
                      <div><strong>Structure:</strong> {selectedDay.mileage_breakdown}</div>
                    )}
                    {selectedDay.pace_targets && (
                      <div><strong>Pace Targets:</strong> {selectedDay.pace_targets}</div>
                    )}
                    {selectedDay.session_load && (
                      <div><strong>Session Load:</strong> {selectedDay.session_load}</div>
                    )}
                    {selectedDay.purpose && (
                      <div><strong>Purpose:</strong> {selectedDay.purpose}</div>
                    )}
                  </div>
                </div>
                
                {/* Detailed information */}
                {isLoadingDetails ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span className="text-sm">Generating detailed training plan...</span>
                  </div>
                ) : selectedDay.detailed_fields_generated ? (
                  <div className="space-y-4">
                    {selectedDay.heart_rate_zones && (
                      <div className="p-4 bg-muted rounded-lg">
                        <h4 className="font-semibold mb-2">Heart Rate Zones</h4>
                        <p className="text-sm">{selectedDay.heart_rate_zones}</p>
                      </div>
                    )}
                    
                    {selectedDay.notes && (
                      <div className="p-4 bg-muted rounded-lg">
                        <h4 className="font-semibold mb-2">Training Notes</h4>
                        <p className="text-sm whitespace-pre-wrap">{selectedDay.notes}</p>
                      </div>
                    )}
                    
                    {selectedDay.what_to_eat_drink && (
                      <div className="p-4 bg-muted rounded-lg">
                        <h4 className="font-semibold mb-2">Nutrition & Hydration</h4>
                        <p className="text-sm whitespace-pre-wrap">{selectedDay.what_to_eat_drink}</p>
                      </div>
                    )}
                    
                    {selectedDay.additional_training && (
                      <div className="p-4 bg-muted rounded-lg">
                        <h4 className="font-semibold mb-2">Additional Training</h4>
                        <p className="text-sm whitespace-pre-wrap">{selectedDay.additional_training}</p>
                      </div>
                    )}
                    
                    {selectedDay.recovery_training && (
                      <div className="p-4 bg-muted rounded-lg">
                        <h4 className="font-semibold mb-2">Recovery & Mobility</h4>
                        <p className="text-sm whitespace-pre-wrap">{selectedDay.recovery_training}</p>
                      </div>
                    )}
                    
                    {selectedDay.daily_nutrition_advice && (
                      <div className="p-4 bg-muted rounded-lg">
                        <h4 className="font-semibold mb-2">Daily Nutrition</h4>
                        <p className="text-sm whitespace-pre-wrap">{selectedDay.daily_nutrition_advice}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <p className="text-sm text-muted-foreground mb-3">
                      Click to load detailed training instructions including heart rate zones, nutrition advice, and recovery recommendations.
                    </p>
                    <Button 
                      onClick={() => handleDayClick(selectedDay)}
                      size="sm"
                      disabled={isLoadingDetails}
                    >
                      Load Detailed Plan
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TrainingCalendarView;