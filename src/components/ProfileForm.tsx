import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
    training_history: '',
    injuries: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
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
          training_history: formData.training_history,
          injuries: formData.injuries || null,
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="training_history">Training History</Label>
              <Textarea
                id="training_history"
                name="training_history"
                placeholder="Describe your running experience, current weekly mileage, recent races, etc."
                value={formData.training_history}
                onChange={handleInputChange}
                rows={4}
                required
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