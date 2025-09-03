import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, Calendar, Clock, MapPin, Target } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, isValid, addMonths, subMonths } from 'date-fns';

interface WorkoutDay {
  date: Date;
  workout: string;
  distance?: string;
  duration?: string;
  description: string;
}

interface TrainingCalendarViewProps {
  trainingPlan: string;
  profile: any;
}

const TrainingCalendarView = ({ trainingPlan, profile }: TrainingCalendarViewProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<WorkoutDay | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Parse training plan to extract daily workouts
  const workoutDays = useMemo(() => {
    const days: WorkoutDay[] = [];
    const lines = trainingPlan.split('\n');
    
    let currentDay: Partial<WorkoutDay> = {};
    let collectingDescription = false;
    let description = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and assumptions section
      if (!line || line.startsWith('assumptions_made:') || line.startsWith('-')) {
        continue;
      }
      
      // Look for date entries (new format)
      if (line.startsWith('date: ')) {
        // Save previous day if it exists
        if (currentDay.date && currentDay.workout) {
          if (collectingDescription) {
            currentDay.description = description.trim();
          }
          days.push(currentDay as WorkoutDay);
        }
        
        // Start new day
        currentDay = {};
        collectingDescription = false;
        description = '';
        
        const dateStr = line.replace('date: ', '').trim();
        const date = parseISO(dateStr);
        if (isValid(date)) {
          currentDay.date = date;
        }
        continue;
      }
      
      // Look for training session (workout type)
      if (line.startsWith('training_session: ')) {
        currentDay.workout = line.replace('training_session: ', '').trim();
        continue;
      }
      
      // Look for estimated distance
      if (line.startsWith('estimated_distance_km: ')) {
        const distance = line.replace('estimated_distance_km: ', '').trim();
        currentDay.distance = distance + ' km';
        continue;
      }
      
      // Look for estimated moving time (duration)
      if (line.startsWith('estimated_moving_time: ')) {
        currentDay.duration = line.replace('estimated_moving_time: ', '').trim();
        continue;
      }
      
      // Collect all other fields for description
      if (currentDay.date && currentDay.workout && 
          !line.startsWith('date: ') && 
          !line.startsWith('training_session: ') &&
          !line.startsWith('estimated_distance_km: ') &&
          !line.startsWith('estimated_moving_time: ')) {
        
        collectingDescription = true;
        
        // Format the field for better readability
        if (line.includes(': ')) {
          const [field, value] = line.split(': ', 2);
          const formattedField = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          description += `\n**${formattedField}:** ${value}`;
        } else {
          description += '\n' + line;
        }
      }
    }
    
    // Don't forget the last day
    if (currentDay.date && currentDay.workout) {
      if (collectingDescription) {
        currentDay.description = description.trim();
      }
      days.push(currentDay as WorkoutDay);
    }
    
    console.log('Parsed workout days:', days.length);
    console.log('Sample parsed day:', days[0]);
    return days;
  }, [trainingPlan]);

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

  const handleDayClick = (workout: WorkoutDay) => {
    setSelectedDay(workout);
    setIsDialogOpen(true);
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
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedDay.description}</p>
                </div>
                
                <div className="text-xs text-muted-foreground text-center">
                  <p>All training fields will be visible and easy to access once the enhanced AI coach provides detailed daily plans.</p>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TrainingCalendarView;