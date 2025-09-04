import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clock, MapPin, Heart } from "lucide-react";

interface TrainingDay {
  id: string;
  date: string;
  training_session: string;
  mileage_breakdown: string;
  pace_targets: string;
  estimated_distance_km: number;
  estimated_moving_time: string;
  estimated_calories?: number;
  estimated_cadence_spm?: number;
  heart_rate_zones?: string;
  detailed_fields_generated: boolean;
}

interface TrainingWeekViewProps {
  trainingPlan: any;
  profile: any;
}

const TrainingWeekView: React.FC<TrainingWeekViewProps> = ({ trainingPlan, profile }) => {
  const [currentWeek, setCurrentWeek] = useState(0);
  const [trainingDays, setTrainingDays] = useState<TrainingDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<TrainingDay | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const raceDate = new Date(profile?.race_date);
  const planStartDate = new Date(trainingPlan?.start_date);
  
  // Calculate total weeks
  const totalWeeks = Math.ceil((raceDate.getTime() - planStartDate.getTime()) / (1000 * 3600 * 24 * 7));
  
  // Get current week's dates
  const getWeekDates = (weekIndex: number) => {
    const weekStart = new Date(planStartDate);
    weekStart.setDate(weekStart.getDate() + (weekIndex * 7));
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const currentWeekDates = getWeekDates(currentWeek);

  useEffect(() => {
    fetchTrainingDays();
  }, [trainingPlan?.id, currentWeek]);

  const fetchTrainingDays = async () => {
    if (!trainingPlan?.id) return;

    const weekDates = getWeekDates(currentWeek);
    const startDate = weekDates[0].toISOString().split('T')[0];
    const endDate = weekDates[6].toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('training_days')
      .select('*')
      .eq('training_plan_id', trainingPlan.id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date');

    if (error) {
      console.error('Error fetching training days:', error);
      toast.error('Failed to load training days');
      return;
    }

    setTrainingDays(data || []);
  };

  const getWorkoutForDay = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return trainingDays.find(day => day.date === dateStr);
  };

  const getWorkoutTypeColor = (workoutType: string) => {
    const type = workoutType?.toLowerCase() || '';
    
    if (type.includes('easy') || type.includes('recovery')) {
      return 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200';
    }
    if (type.includes('tempo') || type.includes('track') || type.includes('intervals')) {
      return 'bg-red-100 text-red-800 hover:bg-red-200';  
    }
    if (type.includes('long')) {
      return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
    }
    if (type.includes('rest')) {
      return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
    return 'bg-primary/10 text-primary hover:bg-primary/20';
  };

  const getWorkoutTypeLabel = (workoutType: string) => {
    const type = workoutType?.toLowerCase() || '';
    
    if (type.includes('easy') || type.includes('recovery')) return 'Easy';
    if (type.includes('tempo') || type.includes('track') || type.includes('intervals')) return 'Hard';
    return 'Moderate';
  };

  const handleDayClick = async (day: TrainingDay) => {
    setSelectedDay(day);
    setIsDialogOpen(true);

    // Generate details if not already generated
    if (!day.detailed_fields_generated && !isLoadingDetails) {
      setIsLoadingDetails(true);
      try {
        const { error } = await supabase.functions.invoke('generate-day-details', {
          body: {
            trainingDayId: day.id,
            profileData: profile,
            dayData: day
          }
        });

        if (!error) {
          // Refetch the updated day data
          const { data: updatedDay } = await supabase
            .from('training_days')
            .select('*')
            .eq('id', day.id)
            .single();
          
          if (updatedDay) {
            setSelectedDay(updatedDay);
            fetchTrainingDays(); // Refresh the list
          }
        }
      } catch (error) {
        console.error('Error generating day details:', error);
      } finally {
        setIsLoadingDetails(false);
      }
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">This Week</h1>
        <p className="text-muted-foreground">
          {profile?.race_name || 'Marathon'} Training - Week {currentWeek + 1} of {totalWeeks}
        </p>
      </div>

      {/* Week Navigation */}
      <div className="flex justify-center gap-2">
        <Button
          variant="outline"
          onClick={() => setCurrentWeek(Math.max(0, currentWeek - 1))}
          disabled={currentWeek === 0}
        >
          Previous Week
        </Button>
        <Button
          variant="default"
          className="bg-primary text-primary-foreground"
        >
          This Week
        </Button>
        <Button
          variant="outline"
          onClick={() => setCurrentWeek(Math.min(totalWeeks - 1, currentWeek + 1))}
          disabled={currentWeek >= totalWeeks - 1}
        >
          Next Week
        </Button>
      </div>

      {/* Weekly Training Schedule */}
      <div className="space-y-4">
        {currentWeekDates.map((date, index) => {
          const workout = getWorkoutForDay(date);
          const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
          const dayDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          return (
            <div key={index} className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="text-left">
                      <h3 className="font-semibold text-foreground">{workout?.training_session || 'Rest'}</h3>
                      <div className="text-sm text-muted-foreground">
                        {dayName}<br />{dayDate}
                      </div>
                    </div>
                    
                    {workout?.training_session && (
                      <Badge className={getWorkoutTypeColor(workout.training_session)}>
                        {getWorkoutTypeLabel(workout.training_session)}
                      </Badge>
                    )}
                  </div>
                  
                  {workout && (
                    <>
                      <p className="text-muted-foreground mb-3">
                        {workout.mileage_breakdown || 'Complete rest day'}
                      </p>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock size={16} />
                          {workout.estimated_moving_time || '0 min'}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin size={16} />
                          {workout.estimated_distance_km 
                            ? `${Math.round(workout.estimated_distance_km / 1.60934)} miles`
                            : '0 miles'
                          }
                        </div>
                        <div className="flex items-center gap-1">
                          <Heart size={16} />
                          {workout.pace_targets || 'N/A'}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                
                <div className="flex flex-col gap-2">
                  {workout && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDayClick(workout)}
                      className="text-primary hover:text-primary-foreground hover:bg-primary"
                    >
                      View Details
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" disabled>
                    Log Workout
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Workout Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Workout Details</DialogTitle>
          </DialogHeader>
          
          {selectedDay && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">{selectedDay.training_session}</h3>
                <p className="text-muted-foreground">{selectedDay.mileage_breakdown}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Duration:</span>
                  <p>{selectedDay.estimated_moving_time}</p>
                </div>
                <div>
                  <span className="font-medium">Distance:</span>
                  <p>{selectedDay.estimated_distance_km 
                    ? `${Math.round(selectedDay.estimated_distance_km / 1.60934)} miles`
                    : 'N/A'
                  }</p>
                </div>
                <div>
                  <span className="font-medium">Pace:</span>
                  <p>{selectedDay.pace_targets}</p>
                </div>
              </div>

              {selectedDay.detailed_fields_generated && (
                <div className="border-t pt-4 space-y-3">
                  <h4 className="font-semibold">Enhanced Details</h4>
                  {selectedDay.estimated_calories && (
                    <div>
                      <span className="font-medium">Estimated Calories:</span>
                      <p>{selectedDay.estimated_calories}</p>
                    </div>
                  )}
                  {selectedDay.estimated_cadence_spm && (
                    <div>
                      <span className="font-medium">Target Cadence:</span>
                      <p>{selectedDay.estimated_cadence_spm} SPM</p>
                    </div>
                  )}
                  {selectedDay.heart_rate_zones && (
                    <div>
                      <span className="font-medium">Heart Rate Zones:</span>
                      <p>{selectedDay.heart_rate_zones}</p>
                    </div>
                  )}
                </div>
              )}

              {!selectedDay.detailed_fields_generated && (
                <Button
                  onClick={() => handleDayClick(selectedDay)}
                  disabled={isLoadingDetails}
                  className="w-full"
                >
                  {isLoadingDetails ? 'Loading Details...' : 'Load Enhanced Details'}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TrainingWeekView;