import { Badge } from '@/components/ui/badge';

interface VersionDisplayProps {
  version: string;
}

const VersionDisplay = ({ version }: VersionDisplayProps) => {
  return (
    <Badge 
      variant="outline" 
      className="fixed top-4 right-4 z-50 bg-background/80 backdrop-blur-sm border-border/50"
    >
      v{version}
    </Badge>
  );
};

export default VersionDisplay;
