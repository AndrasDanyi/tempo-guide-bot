import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, Calendar } from 'lucide-react';

interface TrainingPlanDisplayProps {
  trainingPlan: string;
  profile: any;
}

const TrainingPlanDisplay = ({ trainingPlan, profile }: TrainingPlanDisplayProps) => {
  // Split the training plan into sections for better formatting
  const formatTrainingPlan = (text: string) => {
    const lines = text.split('\n');
    const formattedLines: JSX.Element[] = [];
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      if (trimmedLine === '') {
        formattedLines.push(<br key={index} />);
      } else if (trimmedLine.match(/^\d+\./)) {
        // Numbered sections
        formattedLines.push(
          <h3 key={index} className="text-lg font-semibold mt-6 mb-3 text-primary">
            {trimmedLine}
          </h3>
        );
      } else if (trimmedLine.match(/^Week \d+/i)) {
        // Week headers
        formattedLines.push(
          <h4 key={index} className="text-base font-medium mt-4 mb-2 text-secondary-foreground bg-secondary p-2 rounded">
            {trimmedLine}
          </h4>
        );
      } else if (trimmedLine.match(/^[A-Z][^:]*:$/)) {
        // Section headers ending with colon
        formattedLines.push(
          <h4 key={index} className="text-base font-medium mt-4 mb-2 text-primary">
            {trimmedLine}
          </h4>
        );
      } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ')) {
        // Bullet points
        formattedLines.push(
          <li key={index} className="ml-4 mb-1">
            {trimmedLine.substring(2)}
          </li>
        );
      } else {
        // Regular paragraphs
        formattedLines.push(
          <p key={index} className="mb-2 leading-relaxed">
            {trimmedLine}
          </p>
        );
      }
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