import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, Calendar } from 'lucide-react';

interface TrainingPlanDisplayProps {
  trainingPlan: string;
  profile: any;
}

const TrainingPlanDisplay = ({ trainingPlan, profile }: TrainingPlanDisplayProps) => {
  const formatTrainingPlan = (text: string) => {
    const lines = text.split('\n');
    const formattedLines: JSX.Element[] = [];
    let currentSection = '';
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      if (trimmedLine === '') {
        formattedLines.push(<div key={index} className="h-2" />);
        return;
      }

      // Check for major section headers
      if (trimmedLine.match(/^(TRAINING PLAN OVERVIEW|WEEKLY STRUCTURE|DAY-BY-DAY SCHEDULE|ADDITIONAL GUIDANCE)$/i)) {
        currentSection = trimmedLine.toUpperCase();
        formattedLines.push(
          <h2 key={index} className="text-xl font-bold mt-8 mb-4 text-primary border-b border-border pb-2">
            {trimmedLine}
          </h2>
        );
        return;
      }

      // Day entries (look for date patterns)
      if (trimmedLine.match(/^\d{4}-\d{2}-\d{2}/)) {
        const [datePart, ...restParts] = trimmedLine.split(' - ');
        const date = new Date(datePart);
        const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
        const formattedDate = date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        });
        
        formattedLines.push(
          <div key={index} className="bg-secondary/50 rounded-lg p-4 mb-3 border border-border">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-primary">
                {dayOfWeek}, {formattedDate}
              </h4>
              <span className="text-xs text-muted-foreground">{datePart}</span>
            </div>
            <p className="text-sm">{restParts.join(' - ')}</p>
          </div>
        );
        return;
      }

      // Week headers
      if (trimmedLine.match(/^Week \d+/i)) {
        formattedLines.push(
          <h3 key={index} className="text-lg font-semibold mt-6 mb-3 text-secondary-foreground bg-secondary p-3 rounded">
            {trimmedLine}
          </h3>
        );
        return;
      }

      // Subsection headers (ending with colon)
      if (trimmedLine.match(/^[A-Z][^:]*:$/)) {
        formattedLines.push(
          <h4 key={index} className="text-base font-medium mt-4 mb-2 text-primary">
            {trimmedLine}
          </h4>
        );
        return;
      }

      // Bullet points
      if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ')) {
        formattedLines.push(
          <li key={index} className="ml-6 mb-1 list-disc">
            {trimmedLine.substring(2)}
          </li>
        );
        return;
      }

      // Regular paragraphs
      formattedLines.push(
        <p key={index} className="mb-2 leading-relaxed text-sm">
          {trimmedLine}
        </p>
      );
    });
    
    return formattedLines;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Profile Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Your Training Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
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
                <strong>Age:</strong> {profile.age}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Training Plan Content */}
      <Card>
        <CardContent className="p-6">
          <div className="prose prose-sm max-w-none">
            {formatTrainingPlan(trainingPlan)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrainingPlanDisplay;