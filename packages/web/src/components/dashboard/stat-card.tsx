import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type StatCardVariant = 'default' | 'green' | 'blue' | 'purple' | 'orange' | 'info';

interface StatCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  link?: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: StatCardVariant;
  className?: string;
  tooltip?: string;
}

const variantStyles: Record<StatCardVariant, string> = {
  default: '',
  green: 'border-l-4 border-l-green-500',
  blue: 'border-l-4 border-l-blue-500',
  purple: 'border-l-4 border-l-purple-500',
  orange: 'border-l-4 border-l-orange-500',
  info: 'bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800',
};

export function StatCard({
  title,
  value,
  subValue,
  link,
  actionLabel,
  onAction,
  variant = 'default',
  className,
  tooltip,
}: StatCardProps) {
  return (
    <Card className={cn('flex flex-col justify-center', variantStyles[variant], className)}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {title}
            </span>
            {link && (
              <Link to={link}>
                <ArrowUpRight className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-primary" />
              </Link>
            )}
            {tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {actionLabel && (
            <Button
              size="sm"
              className="h-6 text-[10px] px-2 bg-blue-600 hover:bg-blue-700"
              onClick={onAction}
            >
              {actionLabel}
            </Button>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-foreground">{value}</span>
          {subValue && <span className="text-xs text-muted-foreground">{subValue}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
