import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Calendar, Clock, MapPin, Target } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, isValid, addMonths, subMonths } from 'date-fns';

interface WorkoutDay {
  date: string;
  training_session: string;
  mileage_breakdown: string;
  pace_targets: string;
  heart_rate_zones: string;
  purpose: string;
  session_load: string;
  notes: string;
  what_to_eat_drink: string;
  additional_training: string;
  recovery_training: string;
  estimated_distance_km: number;
  estimated_avg_pace_min_per_km: string;
  estimated_moving_time: string;
  estimated_elevation_gain_m: number;
  estimated_avg_power_w: number;
  estimated_cadence_spm: number;
  estimated_calories: number;
  daily_nutrition_advice: string;
}

interface TrainingCalendarViewProps {
  planContent: any;
  profile: any;
}

const TrainingCalendarView = ({ planContent, profile }: TrainingCalendarViewProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutDay | null>(null);

  const parseTrainingPlan = (planContent: any): WorkoutDay[] => {
    if (!planContent) return [];
    
    // Try JSON format first
    if (planContent.json && Array.isArray(planContent.json)) {
      console.log('Using JSON format training plan with', planContent.json.length, 'days');
      return planContent.json;
    }
    
    // Fallback to text parsing for legacy plans
    if (planContent.text) {
      console.log('Falling back to text format parsing');
      const text = planContent.text;
      const workoutDays: WorkoutDay[] = [];
      
      // Split by "Day " and filter out empty parts
      const dayBlocks = text.split(/Day \d+/).filter((block: string) => block.trim());
      
      dayBlocks.forEach((block: string, index: number) => {
        const lines = block.trim().split('\n').filter((line: string) => line.trim());
        
        const workout: Partial<WorkoutDay> = {
          estimated_distance_km: 0,
          estimated_avg_pace_min_per_km: "0:00",
          estimated_moving_time: "0:00",
          estimated_elevation_gain_m: 0,
          estimated_avg_power_w: 0,
          estimated_cadence_spm: 0,
          estimated_calories: 0,
        };
        
        lines.forEach((line: string) => {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('Date:')) {
            workout.date = trimmedLine.replace('Date:', '').trim();
          } else if (trimmedLine.startsWith('Workout type:')) {
            workout.training_session = trimmedLine.replace('Workout type:', '').trim();
          } else if (trimmedLine.startsWith('Distance:')) {
            const distanceText = trimmedLine.replace('Distance:', '').trim();
            const distanceMatch = distanceText.match(/(\d+(?:\.\d+)?)/);
            workout.estimated_distance_km = distanceMatch ? parseFloat(distanceMatch[1]) : 0;
          } else if (trimmedLine.startsWith('Duration:')) {
            workout.estimated_moving_time = trimmedLine.replace('Duration:', '').trim();
          } else if (trimmedLine.startsWith('Detailed description:')) {
            workout.notes = trimmedLine.replace('Detailed description:', '').trim();
          }
        });
        
        if (workout.date && workout.training_session) {
          workoutDays.push(workout as WorkoutDay);
        }
      });
      
      return workoutDays;
    }
    
    return [];
  };

  // Parse training plan to extract daily workouts
  const workoutDays = useMemo(() => {
    return parseTrainingPlan(planContent);
  }, [planContent]);

  // Get days for current month view
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get workout for specific day
  const getWorkoutForDay = (date: Date) => {
    return workoutDays.find(workout => {
      const workoutDate = parseISO(workout.date);
      return isValid(workoutDate) && isSameDay(workoutDate, date);
    });
  };

  const getWorkoutTypeColor = (sessionType: string): string => {
    const type = sessionType.toLowerCase();
    if (type.includes('rest') || type.includes('recovery')) return 'bg-gray-200 text-gray-800';
    if (type.includes('easy') || type.includes('base')) return 'bg-green-200 text-green-800';
    if (type.includes('tempo') || type.includes('threshold')) return 'bg-yellow-200 text-yellow-800';
    if (type.includes('interval') || type.includes('speed') || type.includes('track')) return 'bg-red-200 text-red-800';
    if (type.includes('long') || type.includes('endurance')) return 'bg-blue-200 text-blue-800';
    return 'bg-purple-200 text-purple-800';
  };

  const handleDayClick = (workout: WorkoutDay) => {
    setSelectedWorkout(workout);
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

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
                  <strong>Race Date:</strong> {new Date(profile.race_date).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <strong>Total Workouts:</strong> {workoutDays.length}
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
              const workoutForDay = getWorkoutForDay(day);
              const isToday = isSameDay(day, new Date());
              
              return (
                <div
                  key={day.toISOString()}
                  className={`
                    relative p-2 h-20 border rounded-lg cursor-pointer transition-colors
                    ${isToday ? 'border-primary bg-primary/5' : 'border-border'}
                    ${workoutForDay ? 'hover:bg-accent' : 'hover:bg-muted/50'}
                  `}
                  onClick={() => workoutForDay && handleDayClick(workoutForDay)}
                >
                  <div className="text-sm font-medium mb-1">
                    {format(day, 'd')}
                  </div>
                  
                  {workoutForDay && (
                    <div className="space-y-1">
                      <div 
                        className={`text-xs p-1 rounded cursor-pointer transition-colors ${getWorkoutTypeColor(workoutForDay.training_session)}`}
                      >
                        <div className="font-medium truncate">{workoutForDay.training_session}</div>
                        <div className="text-xs opacity-75">{workoutForDay.estimated_distance_km}km</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Workout Detail Dialog */}
      {selectedWorkout && (
        <Dialog open={!!selectedWorkout} onOpenChange={() => setSelectedWorkout(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {format(parseISO(selectedWorkout.date), 'EEEE, MMMM d, yyyy')}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Session Type</h4>
                  <p className="font-medium">{selectedWorkout.training_session}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Distance</h4>
                  <p>{selectedWorkout.estimated_distance_km} km</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Duration</h4>
                  <p>{selectedWorkout.estimated_moving_time}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Load</h4>
                  <p>{selectedWorkout.session_load}</p>
                </div>
              </div>

              {selectedWorkout.mileage_breakdown && (
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Workout Structure</h4>
                  <p className="text-sm leading-relaxed bg-muted p-3 rounded-md">{selectedWorkout.mileage_breakdown}</p>
                </div>
              )}

              {selectedWorkout.pace_targets && (
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Pace Targets</h4>
                  <p className="text-sm">{selectedWorkout.pace_targets}</p>
                </div>
              )}

              {selectedWorkout.purpose && (
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Purpose</h4>
                  <p className="text-sm">{selectedWorkout.purpose}</p>
                </div>
              )}

              {selectedWorkout.notes && (
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Notes & Form Tips</h4>
                  <p className="text-sm leading-relaxed">{selectedWorkout.notes}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedWorkout.what_to_eat_drink && (
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">Nutrition & Hydration</h4>
                    <p className="text-sm leading-relaxed">{selectedWorkout.what_to_eat_drink}</p>
                  </div>
                )}

                {selectedWorkout.recovery_training && (
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">Recovery</h4>
                    <p className="text-sm leading-relaxed">{selectedWorkout.recovery_training}</p>
                  </div>
                )}
              </div>

              {selectedWorkout.additional_training && (
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Additional Training</h4>
                  <p className="text-sm leading-relaxed">{selectedWorkout.additional_training}</p>
                </div>
              )}

              {selectedWorkout.daily_nutrition_advice && (
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Daily Nutrition</h4>
                  <p className="text-sm leading-relaxed">{selectedWorkout.daily_nutrition_advice}</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default TrainingCalendarView;