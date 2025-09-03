import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, Clock, MapPin } from 'lucide-react';

interface Workout {
  day: string;
  date: string;
  workout: string;
  distance: number;
  duration: string;
  description: string;
}

interface Week {
  weekNumber: number;
  startDate: string;
  endDate: string;
  focus: string;
  totalMiles: number;
  workouts: Workout[];
}

interface TrainingPlan {
  summary: string;
  weeklyStructure: string;
  weeks: Week[];
}

interface TrainingCalendarProps {
  trainingPlan: TrainingPlan;
}

const TrainingCalendar = ({ trainingPlan }: TrainingCalendarProps) => {
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);

  const currentWeek = trainingPlan.weeks[currentWeekIndex];

  const goToPreviousWeek = () => {
    setCurrentWeekIndex(prev => Math.max(0, prev - 1));
  };

  const goToNextWeek = () => {
    setCurrentWeekIndex(prev => Math.min(trainingPlan.weeks.length - 1, prev + 1));
  };

  const getWorkoutTypeColor = (workoutType: string) => {
    const type = workoutType.toLowerCase();
    if (type.includes('rest')) return 'bg-gray-100 text-gray-800';
    if (type.includes('easy') || type.includes('recovery')) return 'bg-green-100 text-green-800';
    if (type.includes('tempo') || type.includes('threshold')) return 'bg-orange-100 text-orange-800';
    if (type.includes('interval') || type.includes('speed')) return 'bg-red-100 text-red-800';
    if (type.includes('long')) return 'bg-blue-100 text-blue-800';
    return 'bg-purple-100 text-purple-800';
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Plan Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Your Personalized Training Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">{trainingPlan.summary}</p>
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2">Weekly Structure:</h4>
            <p className="text-sm">{trainingPlan.weeklyStructure}</p>
          </div>
        </CardContent>
      </Card>

      {/* Week Navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Week {currentWeek.weekNumber}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {new Date(currentWeek.startDate).toLocaleDateString()} - {new Date(currentWeek.endDate).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPreviousWeek}
                disabled={currentWeekIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">
                {currentWeekIndex + 1} / {trainingPlan.weeks.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextWeek}
                disabled={currentWeekIndex === trainingPlan.weeks.length - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Badge variant="secondary" className="mr-2">
              Focus: {currentWeek.focus}
            </Badge>
            <Badge variant="outline">
              Total: {currentWeek.totalMiles} miles
            </Badge>
          </div>

          {/* Weekly Calendar Grid */}
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {currentWeek.workouts.map((workout, index) => (
              <Card
                key={index}
                className={`cursor-pointer transition-colors hover:bg-accent ${
                  selectedWorkout === workout ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedWorkout(workout)}
              >
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">{workout.day}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(workout.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </div>
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${getWorkoutTypeColor(workout.workout)}`}
                    >
                      {workout.workout}
                    </Badge>
                    {workout.distance > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {workout.distance} miles
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Workout Details */}
      {selectedWorkout && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {selectedWorkout.day} - {selectedWorkout.workout}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {selectedWorkout.distance} miles
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{selectedWorkout.duration}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {new Date(selectedWorkout.date).toLocaleDateString()}
                </span>
              </div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Workout Description:</h4>
              <p className="text-sm">{selectedWorkout.description}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TrainingCalendar;