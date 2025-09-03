import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface ProfileFormProps {
  onProfileCreated: (profile: any) => void;
}

const ProfileForm = ({ onProfileCreated }: ProfileFormProps) => {
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

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

      const { data: profile, error } = await supabase
        .from('profiles')
        .insert({
          user_id: user.id,
          email: user.email,
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
        .select()
        .single();

      if (error) {
        throw error;
      }

      toast({
        title: "Profile created!",
        description: "Now let's generate your personalized training plan.",
      });

      onProfileCreated(profile);
    } catch (error) {
      console.error('Error creating profile:', error);
      toast({
        title: "Error creating profile",
        description: "Please try again. If the problem persists, contact support.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Your Running Profile</CardTitle>
          <CardDescription>
            Tell us about your running goals so we can create a personalized training plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  placeholder="Your full name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
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
                <Label htmlFor="gender">Gender</Label>
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
                <Label htmlFor="height">Height (cm)</Label>
                <Input
                  id="height"
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
                <Label htmlFor="weight_kg">Weight (kg)</Label>
                <Input
                  id="weight_kg"
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
                <Label htmlFor="race_name">Race/Event Name (Optional)</Label>
                <Input
                  id="race_name"
                  name="race_name"
                  placeholder="e.g., Boston Marathon, Local 10K, etc."
                  value={formData.race_name}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="race_distance_km">Race Distance (km)</Label>
                <Input
                  id="race_distance_km"
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
              <Label htmlFor="goal">Running Goal</Label>
              <Input
                id="goal"
                name="goal"
                placeholder="e.g., Run a sub-3 hour marathon, Complete a 10K, etc."
                value={formData.goal}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="race_date">Goal/Race Date</Label>
                <Input
                  id="race_date"
                  name="race_date"
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={formData.race_date}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="goal_pace_per_km">Target Pace (per km)</Label>
                <Input
                  id="goal_pace_per_km"
                  name="goal_pace_per_km"
                  placeholder="e.g., 4:30, 5:00"
                  value={formData.goal_pace_per_km}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="race_surface">Race Surface</Label>
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
                <Label htmlFor="experience_years">Running Experience (years)</Label>
                <Input
                  id="experience_years"
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
                <Label htmlFor="current_weekly_mileage">Current Weekly Mileage (km)</Label>
                <Input
                  id="current_weekly_mileage"
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
                <Label htmlFor="longest_run_km">Longest Recent Run (km)</Label>
                <Input
                  id="longest_run_km"
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
                <Label htmlFor="days_per_week">Training Days Per Week</Label>
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
                <Label htmlFor="elevation_context">Typical Terrain</Label>
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
              <Label htmlFor="training_history">Training History & Experience</Label>
              <Textarea
                id="training_history"
                name="training_history"
                placeholder="Describe your running background, previous training programs, coaching experience, etc."
                value={formData.training_history}
                onChange={handleInputChange}
                rows={3}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="race_results">Recent Race Performances (Optional)</Label>
              <Textarea
                id="race_results"
                name="race_results"
                placeholder="List recent race times and distances (e.g., 10K - 45:00, Half Marathon - 1:35:00)"
                value={formData.race_results}
                onChange={handleInputChange}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="strength_notes">Strength Training & Cross-Training (Optional)</Label>
              <Textarea
                id="strength_notes"
                name="strength_notes"
                placeholder="Describe your current strength training routine, gym access, preferred cross-training activities"
                value={formData.strength_notes}
                onChange={handleInputChange}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="time_limits">Time Constraints & Schedule (Optional)</Label>
              <Textarea
                id="time_limits"
                name="time_limits"
                placeholder="Any time limitations, preferred training times, work schedule considerations, etc."
                value={formData.time_limits}
                onChange={handleInputChange}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="injuries">Current or Recent Injuries (Optional)</Label>
              <Textarea
                id="injuries"
                name="injuries"
                placeholder="Any injuries or physical limitations we should consider in your training plan"
                value={formData.injuries}
                onChange={handleInputChange}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="further_notes">Any Further Notes/Info (Optional)</Label>
              <Textarea
                id="further_notes"
                name="further_notes"
                placeholder="Any additional information, preferences, schedule constraints, or special considerations for your training plan"
                value={formData.further_notes}
                onChange={handleInputChange}
                rows={3}
              />
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? 'Creating Profile...' : 'Create Profile & Generate Training Plan'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileForm;