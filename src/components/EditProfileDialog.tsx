import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface EditProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  profile: any;
  onProfileUpdated: (updatedProfile: any) => void;
}

const EditProfileDialog = ({ isOpen, onClose, profile, onProfileUpdated }: EditProfileDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    goal: '',
    race_date: '',
    age: '',
    height: '',
    weight_kg: '',
    gender: '',
    experience_years: '',
    current_weekly_mileage: '',
    longest_run_km: '',
    race_distance_km: '',
    race_name: '',
    race_surface: 'road',
    goal_pace_per_km: '',
    days_per_week: '5',
    elevation_context: 'flat',
    units: 'metric',
    time_limits: '',
    training_history: '',
    race_results: '',
    strength_notes: '',
    injuries: '',
    further_notes: ''
  });

  // Pre-populate form with existing profile data
  useEffect(() => {
    if (profile && isOpen) {
      setFormData({
        full_name: profile.full_name || '',
        goal: profile.goal || '',
        race_date: profile.race_date || '',
        age: profile.age?.toString() || '',
        height: profile.height?.toString() || '',
        weight_kg: profile.weight_kg?.toString() || '',
        gender: profile.gender || '',
        experience_years: profile.experience_years?.toString() || '',
        current_weekly_mileage: profile.current_weekly_mileage?.toString() || '',
        longest_run_km: profile.longest_run_km?.toString() || '',
        race_distance_km: profile.race_distance_km?.toString() || '',
        race_name: profile.race_name || '',
        race_surface: profile.race_surface || 'road',
        goal_pace_per_km: profile.goal_pace_per_km || '',
        days_per_week: profile.days_per_week?.toString() || '5',
        elevation_context: profile.elevation_context || 'flat',
        units: profile.units || 'metric',
        time_limits: profile.time_limits || '',
        training_history: profile.training_history || '',
        race_results: profile.race_results || '',
        strength_notes: profile.strength_notes || '',
        injuries: profile.injuries || '',
        further_notes: profile.further_notes || ''
      });
    }
  }, [profile, isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    setIsSubmitting(true);

    try {
      // Validate race date is in the future
      const raceDate = new Date(formData.race_date);
      const today = new Date();
      if (raceDate <= today) {
        toast({
          title: "Invalid race date",
          description: "Race date must be in the future",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const { data: updatedProfile, error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          goal: formData.goal,
          race_date: formData.race_date,
          age: parseInt(formData.age),
          height: parseInt(formData.height),
          weight_kg: parseInt(formData.weight_kg) || null,
          gender: formData.gender || null,
          experience_years: parseInt(formData.experience_years) || null,
          current_weekly_mileage: parseInt(formData.current_weekly_mileage) || null,
          longest_run_km: parseInt(formData.longest_run_km) || null,
          race_distance_km: parseInt(formData.race_distance_km) || null,
          race_name: formData.race_name || null,
          race_surface: formData.race_surface,
          goal_pace_per_km: formData.goal_pace_per_km || null,
          days_per_week: parseInt(formData.days_per_week),
          elevation_context: formData.elevation_context,
          units: formData.units,
          time_limits: formData.time_limits || null,
          training_history: formData.training_history,
          race_results: formData.race_results || null,
          strength_notes: formData.strength_notes || null,
          injuries: formData.injuries || null,
          further_notes: formData.further_notes || null,
        })
        .eq('id', profile.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      toast({
        title: "Profile updated!",
        description: "Your profile has been updated. Regenerating your training plan...",
      });

      onProfileUpdated(updatedProfile);
      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error updating profile",
        description: "Please try again. If the problem persists, contact support.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Edit Your Running Profile</DialogTitle>
          <DialogDescription>
            Update your information and we'll regenerate your training plan with the latest details.
          </DialogDescription>
        </DialogHeader>
        
        <div className="overflow-y-auto pr-6 -mr-6" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_full_name">Full Name</Label>
                <Input
                  id="edit_full_name"
                  name="full_name"
                  placeholder="Your full name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_age">Age</Label>
                <Input
                  id="edit_age"
                  name="age"
                  type="number"
                  min="13"
                  max="100"
                  placeholder="25"
                  value={formData.age}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_gender">Gender</Label>
                <Select onValueChange={(value) => handleSelectChange('gender', value)} value={formData.gender}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_height">Height (cm)</Label>
                <Input
                  id="edit_height"
                  name="height"
                  type="number"
                  min="100"
                  max="250"
                  placeholder="170"
                  value={formData.height}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_weight_kg">Weight (kg)</Label>
                <Input
                  id="edit_weight_kg"
                  name="weight_kg"
                  type="number"
                  min="30"
                  max="200"
                  placeholder="70"
                  value={formData.weight_kg}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_race_name">Race/Event Name (Optional)</Label>
                <Input
                  id="edit_race_name"
                  name="race_name"
                  placeholder="e.g., Boston Marathon, Local 10K, etc."
                  value={formData.race_name}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_race_distance_km">Race Distance (km)</Label>
                <Input
                  id="edit_race_distance_km"
                  name="race_distance_km"
                  type="number"
                  min="1"
                  max="999"
                  placeholder="42.2 for marathon"
                  value={formData.race_distance_km}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_goal">Running Goal</Label>
              <Input
                id="edit_goal"
                name="goal"
                placeholder="e.g., Run a sub-3 hour marathon, Complete a 10K, etc."
                value={formData.goal}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_race_date">Goal/Race Date</Label>
                <Input
                  id="edit_race_date"
                  name="race_date"
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={formData.race_date}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_goal_pace_per_km">Target Pace (per km)</Label>
                <Input
                  id="edit_goal_pace_per_km"
                  name="goal_pace_per_km"
                  placeholder="e.g., 4:30, 5:00"
                  value={formData.goal_pace_per_km}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_race_surface">Race Surface</Label>
                <Select onValueChange={(value) => handleSelectChange('race_surface', value)} value={formData.race_surface}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select surface" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="road">Road</SelectItem>
                    <SelectItem value="trail">Trail</SelectItem>
                    <SelectItem value="track">Track</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_experience_years">Running Experience (years)</Label>
                <Input
                  id="edit_experience_years"
                  name="experience_years"
                  type="number"
                  min="0"
                  max="50"
                  placeholder="2"
                  value={formData.experience_years}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_current_weekly_mileage">Current Weekly Mileage (km)</Label>
                <Input
                  id="edit_current_weekly_mileage"
                  name="current_weekly_mileage"
                  type="number"
                  min="0"
                  max="200"
                  placeholder="30"
                  value={formData.current_weekly_mileage}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_longest_run_km">Longest Recent Run (km)</Label>
                <Input
                  id="edit_longest_run_km"
                  name="longest_run_km"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="20"
                  value={formData.longest_run_km}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_days_per_week">Training Days Per Week</Label>
                <Select onValueChange={(value) => handleSelectChange('days_per_week', value)} value={formData.days_per_week}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select days" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 days</SelectItem>
                    <SelectItem value="4">4 days</SelectItem>
                    <SelectItem value="5">5 days</SelectItem>
                    <SelectItem value="6">6 days</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_elevation_context">Typical Terrain</Label>
                <Select onValueChange={(value) => handleSelectChange('elevation_context', value)} value={formData.elevation_context}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select terrain" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Flat</SelectItem>
                    <SelectItem value="hilly">Hilly</SelectItem>
                    <SelectItem value="mountainous">Mountainous</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_training_history">Training History & Experience</Label>
              <Textarea
                id="edit_training_history"
                name="training_history"
                placeholder="Describe your running background, previous training programs, coaching experience, etc."
                value={formData.training_history}
                onChange={handleInputChange}
                rows={3}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_race_results">Recent Race Performances (Optional)</Label>
              <Textarea
                id="edit_race_results"
                name="race_results"
                placeholder="List recent race times and distances (e.g., 10K - 45:00, Half Marathon - 1:35:00)"
                value={formData.race_results}
                onChange={handleInputChange}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_strength_notes">Strength Training & Cross-Training (Optional)</Label>
              <Textarea
                id="edit_strength_notes"
                name="strength_notes"
                placeholder="Describe your current strength training routine, gym access, preferred cross-training activities"
                value={formData.strength_notes}
                onChange={handleInputChange}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_time_limits">Time Constraints & Schedule (Optional)</Label>
              <Textarea
                id="edit_time_limits"
                name="time_limits"
                placeholder="Any time limitations, preferred training times, work schedule considerations, etc."
                value={formData.time_limits}
                onChange={handleInputChange}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_injuries">Current or Recent Injuries (Optional)</Label>
              <Textarea
                id="edit_injuries"
                name="injuries"
                placeholder="Any injuries or physical limitations we should consider in your training plan"
                value={formData.injuries}
                onChange={handleInputChange}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_further_notes">Any Further Notes/Info (Optional)</Label>
              <Textarea
                id="edit_further_notes"
                name="further_notes"
                placeholder="Any additional information, preferences, schedule constraints, or special considerations for your training plan"
                value={formData.further_notes}
                onChange={handleInputChange}
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1" size="lg" disabled={isSubmitting}>
                {isSubmitting ? 'Updating Profile...' : 'Update Profile & Regenerate Plan'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditProfileDialog;