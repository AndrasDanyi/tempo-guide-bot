import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, Calendar, Clock, MapPin, Target, Loader2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface WorkoutDay {
  date: Date;
  workout: string;
  distance?: string;
  duration?: string;
  description: string;
  sessionLoad?: string;
  purpose?: string;
}

interface TrainingCalendarViewProps {
  trainingPlan: string;
  profile: any;
  planStartDate: string;
}

const TrainingCalendarView = ({ trainingPlan, profile, planStartDate }: TrainingCalendarViewProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<WorkoutDay | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dayDetails, setDayDetails] = useState<string | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Parse training plan using the new pipe-delimited format
  const workoutDays = useMemo(() => {
    if (!trainingPlan || typeof trainingPlan !== 'string' || !profile?.race_date) {
      console.log('Missing training plan or race date');
      return [];
    }
    
    const days: WorkoutDay[] = [];
    
    // Split by lines and parse pipe-delimited format: DATE|DAY|TYPE|KM|MIN|LOAD|PURPOSE
    const lines = trainingPlan.split('\n').filter(line => line.trim() && line.includes('|'));
    
    console.log('Found plan lines:', lines.length);
    
    lines.forEach((line) => {
      const parts = line.split('|').map(part => part.trim());
      if (parts.length >= 7) {
        const [dateStr, dayOfWeek, type, km, minutes, load, purpose] = parts;
        
        const sessionDate = new Date(dateStr);
        if (isNaN(sessionDate.getTime())) return; // Skip invalid dates
        
        const session: WorkoutDay = {
          date: sessionDate,
          workout: type,
          distance: km && km !== '0' ? `${km} km` : undefined,
          duration: minutes && minutes !== '0' ? `${minutes} min` : undefined,
          sessionLoad: load,
          purpose: purpose,
          description: `**Session Load:** ${load}\n**Purpose:** ${purpose}\n**Day:** ${dayOfWeek}`
        };
        
        days.push(session);
      }
    });
    
    console.log('Parsed workout sessions with pipe format:', days.length);
    console.log('Sample sessions:', days.slice(0, 3));
    
    return days;
  }, [trainingPlan, profile?.race_date, planStartDate]);

  // Get days for current month view
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get workout for specific day
  const getWorkoutForDay = (date: Date) => {
    return workoutDays.find(workout => isSameDay(workout.date, date));
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

  const handleDayClick = async (workout: WorkoutDay) => {
    setSelectedDay(workout);
    setIsDialogOpen(true);
    setDayDetails(null);
    setIsLoadingDetails(true);

    try {
      // Prepare day data for the AI prompt
      const dayData = {
        specific_date: format(workout.date, 'yyyy-MM-dd'),
        training_session: workout.workout,
        estimated_distance_km: parseFloat(workout.distance?.replace(' km', '') || '0'),
        estimated_duration_min: workout.duration ? 
          (workout.duration.includes(':') ? 
            parseInt(workout.duration.split(':')[0]) * 60 + parseInt(workout.duration.split(':')[1]) 
            : parseInt(workout.duration.replace(' min', ''))) 
          : 0,
        session_load: (workout as any).sessionLoad || 'Medium',
        purpose: (workout as any).purpose || 'Training session'
      };

      const { data, error } = await supabase.functions.invoke('generate-day-details', {
        body: {
          profileData: profile,
          dayData: dayData
        }
      });

      if (error) {
        console.error('Error generating day details:', error);
        setDayDetails('Error loading detailed information. Please try again.');
      } else if (data?.dayDetails) {
        setDayDetails(data.dayDetails);
      } else {
        setDayDetails('No detailed information available for this day.');
      }
    } catch (error) {
      console.error('Error calling day details function:', error);
      setDayDetails('Error loading detailed information. Please try again.');
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
                        className={`text-xs p-1 h-auto leading-tight ${getWorkoutTypeColor(workout.workout)}`}
                      >
                        {workout.workout}
                      </Badge>
                      
                      {workout.distance && workout.distance !== '0 km' && (
                        <div className="text-xs text-muted-foreground">
                          {workout.distance}
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
              {selectedDay && format(selectedDay.date, 'EEEE, MMMM d, yyyy')}
            </DialogTitle>
          </DialogHeader>
          
          {selectedDay && (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-lg font-semibold">Day {workoutDays.findIndex(w => isSameDay(w.date, selectedDay.date)) + 1}</h3>
                  <p className="text-sm text-muted-foreground">{format(selectedDay.date, 'EEEE')}</p>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-center">
                    <Badge 
                      variant="secondary" 
                      className={`text-sm px-3 py-1 ${getWorkoutTypeColor(selectedDay.workout)}`}
                    >
                      {selectedDay.workout}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="p-3 bg-secondary rounded-lg">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium">Distance</span>
                      </div>
                      <span className="text-sm font-semibold">{selectedDay.distance || '0 km'}</span>
                    </div>
                    
                    <div className="p-3 bg-secondary rounded-lg">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium">Duration</span>
                      </div>
                      <span className="text-sm font-semibold">{selectedDay.duration || '0 min'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Workout Details
                  </h4>
                  
                  {isLoadingDetails ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span className="text-sm">Generating detailed training plan...</span>
                    </div>
                  ) : dayDetails ? (
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">{dayDetails}</div>
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedDay.description}</p>
                  )}
                </div>
                
                {!isLoadingDetails && !dayDetails && (
                  <div className="text-xs text-muted-foreground text-center">
                    <p>Click to load detailed training instructions for this day.</p>
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