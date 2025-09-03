import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Look for "Day X" entries
      if (line.match(/^Day \d+$/)) {
        // If we have a complete day, add it
        if (currentDay.date && currentDay.workout) {
          days.push(currentDay as WorkoutDay);
        }
        currentDay = {}; // Reset for new day
        continue;
      }
      
      // Look for date entries
      if (line.startsWith('Date: ')) {
        const dateStr = line.replace('Date: ', '').trim();
        const date = parseISO(dateStr);
        if (isValid(date)) {
          currentDay.date = date;
        }
        continue;
      }
      
      // Look for workout type
      if (line.startsWith('Workout type: ')) {
        currentDay.workout = line.replace('Workout type: ', '').trim();
        continue;
      }
      
      // Look for distance
      if (line.startsWith('Distance: ')) {
        currentDay.distance = line.replace('Distance: ', '').trim();
        continue;
      }
      
      // Look for duration
      if (line.startsWith('Duration: ')) {
        currentDay.duration = line.replace('Duration: ', '').trim();
        continue;
      }
      
      // Look for detailed description
      if (line.startsWith('Detailed description: ') || line.startsWith('Details: ')) {
        let description = line.replace(/^(Detailed description: |Details: )/, '').trim();
        
        // Continue reading following lines that are part of the description
        let nextIndex = i + 1;
        while (nextIndex < lines.length) {
          const nextLine = lines[nextIndex].trim();
          
          // Stop if we hit another field or day
          if (nextLine.match(/^(Day \d+|Date: |Workout type: |Distance: |Duration: |Detailed description: |Details: |ADDITIONAL GUIDANCE|$)/)) {
            break;
          }
          
          description += ' ' + nextLine;
          nextIndex++;
        }
        
        currentDay.description = description;
        i = nextIndex - 1; // Skip the lines we've already processed
        continue;
      }
    }
    
    // Don't forget the last day
    if (currentDay.date && currentDay.workout) {
      days.push(currentDay as WorkoutDay);
    }
    
    console.log('Parsed workout days:', days.length);
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
              
              return (
                <div
                  key={day.toISOString()}
                  className={`
                    relative p-2 h-20 border rounded-lg cursor-pointer transition-colors
                    ${isToday ? 'border-primary bg-primary/5' : 'border-border'}
                    ${workout ? 'hover:bg-accent' : 'hover:bg-muted/50'}
                  `}
                  onClick={() => workout && handleDayClick(workout)}
                >
                  <div className="text-sm font-medium mb-1">
                    {format(day, 'd')}
                  </div>
                  
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {selectedDay && format(selectedDay.date, 'EEEE, MMMM d, yyyy')}
            </DialogTitle>
          </DialogHeader>
          
          {selectedDay && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold">Day {workoutDays.findIndex(w => isSameDay(w.date, selectedDay.date)) + 1}</h3>
                <p className="text-sm text-muted-foreground">{format(selectedDay.date, 'EEEE')}</p>
              </div>
              
              <div className="space-y-3">
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
                <h4 className="font-semibold mb-2">Workout Details:</h4>
                <p className="text-sm leading-relaxed">{selectedDay.description}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TrainingCalendarView;