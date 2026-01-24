/**
 * Placeholder cards for features that are not yet implemented
 * Used according to ADR-003 data source classification
 */

import { Construction, Settings2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PlaceholderCardProps {
  title: string;
  description: string;
  className?: string;
}

/**
 * Coming Soon Card
 * Used for features that have deferred data (schema exists but no data ingestion)
 */
export function ComingSoonCard({
  title,
  description,
  className,
}: PlaceholderCardProps) {
  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Construction className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="rounded-full bg-amber-500/10 p-3 mb-3">
            <Construction className="h-6 w-6 text-amber-500" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">Coming Soon</p>
          <p className="text-xs text-muted-foreground max-w-[200px]">
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Not Configured Card
 * Used for features that require external service integration
 */
export function NotConfiguredCard({
  title,
  description,
  className,
}: PlaceholderCardProps) {
  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="rounded-full bg-muted p-3 mb-3">
            <Settings2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">
            Not Configured
          </p>
          <p className="text-xs text-muted-foreground max-w-[200px]">
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
