/**
 * Recent Activity component
 * Displays recent audit log entries from the backend
 */

import { useState } from 'react';
import { Activity, Loader2, User, Building2, Shield, Database, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ActivityItem {
  id: string;
  category: string;
  action: string;
  userEmail: string | null;
  resourceType: string | null;
  resourceId: string | null;
  outcome: string;
  createdAt: string;
}

interface RecentActivityProps {
  data: ActivityItem[];
  isLoading?: boolean;
  className?: string;
  itemsPerPage?: number;
}

function getCategoryIcon(category: string) {
  switch (category) {
    case 'authentication':
      return <Shield className="h-3 w-3" />;
    case 'user_management':
      return <User className="h-3 w-3" />;
    case 'organization_management':
      return <Building2 className="h-3 w-3" />;
    case 'data_access':
    case 'data_modification':
      return <Database className="h-3 w-3" />;
    default:
      return <Activity className="h-3 w-3" />;
  }
}

function formatAction(action: string): string {
  return action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function RecentActivity({
  data,
  isLoading,
  className,
  itemsPerPage = 5,
}: RecentActivityProps) {
  const [currentPage, setCurrentPage] = useState(0);

  const totalPages = Math.ceil(data.length / itemsPerPage);
  const startIndex = currentPage * itemsPerPage;
  const paginatedData = data.slice(startIndex, startIndex + itemsPerPage);

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1));
  };

  return (
    <Card className={cn('h-full flex flex-col', className)}>
      <CardHeader className="p-3 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-3 w-3 text-muted-foreground" />
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Recent Activity
            </CardTitle>
          </div>
          {!isLoading && data.length > itemsPerPage && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handlePrevPage}
                disabled={currentPage === 0}
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="text-[10px] text-muted-foreground min-w-[40px] text-center">
                {currentPage + 1} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleNextPage}
                disabled={currentPage >= totalPages - 1}
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-2 flex-1 overflow-hidden">
        {isLoading ? (
          <div className="h-full w-full flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="h-full w-full flex flex-col items-center justify-center py-8 text-center">
            <Activity className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-2">
            {paginatedData.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-2 py-1.5 border-b border-border/50 last:border-0"
              >
                <div
                  className={cn(
                    'mt-0.5 rounded-full p-1',
                    item.outcome === 'success'
                      ? 'bg-green-500/10 text-green-600'
                      : item.outcome === 'failure'
                        ? 'bg-red-500/10 text-red-600'
                        : 'bg-muted text-muted-foreground'
                  )}
                >
                  {getCategoryIcon(item.category)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {formatAction(item.action)}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {item.userEmail ?? 'System'}
                    {item.resourceType && ` - ${item.resourceType}`}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {formatRelativeTime(item.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
