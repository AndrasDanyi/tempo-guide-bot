import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TrainingPlanUpdate {
  planId: string;
  updatedPlan: string;
  lastUpdateTime: string;
}

export const useTrainingPlanUpdates = (planId: string | null) => {
  const [planUpdates, setPlanUpdates] = useState<TrainingPlanUpdate | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!planId) return;

    // Set up real-time subscription for plan updates
    const subscription = supabase
      .channel(`training_plan_${planId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'training_plans',
          filter: `id=eq.${planId}`,
        },
        (payload) => {
          console.log('Training plan updated:', payload);
          if (payload.new?.plan_content?.text) {
            setPlanUpdates({
              planId: planId,
              updatedPlan: payload.new.plan_content.text,
              lastUpdateTime: new Date().toISOString()
            });
            setIsUpdating(false); // Update received
          }
        }
      )
      .subscribe();

    // Start with updating status
    setIsUpdating(true);

    // Clean up subscription
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [planId]);

  // Check if plan is still being enhanced by looking at content structure
  useEffect(() => {
    if (planUpdates?.updatedPlan) {
      const dayBlocks = planUpdates.updatedPlan.split('===DAY_START===').slice(1);
      const totalDays = dayBlocks.length;
      
      // Count enhanced days (those with emoji sections and detailed fields)
      const enhancedDays = dayBlocks.filter(block => 
        block.includes('🏃‍♂️ WORKOUT OVERVIEW') && 
        block.includes('📊 WORKOUT STRUCTURE') &&
        block.includes('🍎 NUTRITION & RECOVERY')
      ).length;

      const isStillUpdating = enhancedDays < totalDays;
      setIsUpdating(isStillUpdating);

      console.log(`Plan enhancement progress: ${enhancedDays}/${totalDays} days enhanced`);
    }
  }, [planUpdates]);

  return {
    planUpdates,
    isUpdating,
    enhancementProgress: planUpdates ? calculateEnhancementProgress(planUpdates.updatedPlan) : null
  };
};

function calculateEnhancementProgress(planText: string) {
  const dayBlocks = planText.split('===DAY_START===').slice(1);
  const totalDays = dayBlocks.length;
  
  const enhancedDays = dayBlocks.filter(block => 
    block.includes('🏃‍♂️ WORKOUT OVERVIEW') && 
    block.includes('📊 WORKOUT STRUCTURE') &&
    block.includes('🍎 NUTRITION & RECOVERY')
  ).length;

  return {
    enhanced: enhancedDays,
    total: totalDays,
    percentage: totalDays > 0 ? Math.round((enhancedDays / totalDays) * 100) : 0
  };
}