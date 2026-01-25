import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Loader2,
  RefreshCw,
  User,
  Building2,
  Shield,
  Database,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { dashboardApi, type RecentActivityItem } from '@/lib/dashboard-api';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/activity')({
  component: ActivityPage,
});

function getCategoryIcon(category: string) {
  switch (category) {
    case 'authentication':
      return <Shield className="h-4 w-4" />;
    case 'user_management':
      return <User className="h-4 w-4" />;
    case 'organization_management':
      return <Building2 className="h-4 w-4" />;
    case 'data_access':
    case 'data_modification':
      return <Database className="h-4 w-4" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
}

function formatAction(action: string): string {
  return action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatCategory(category: string): string {
  return category
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString();
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

function ActivityPage() {
  const [activities, setActivities] = useState<RecentActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await dashboardApi.getRecentActivity(50);
      setActivities(data);
    } catch (err) {
      console.error('Failed to fetch activities:', err);
      setError('Failed to load activity log');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary">Activity Log</h1>
        <p className="text-muted-foreground">
          View system activity and audit logs
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchActivities}
              disabled={isLoading}
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && activities.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" onClick={fetchActivities} className="mt-4">
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No activity recorded yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Activity will appear here as actions are performed.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'rounded-full p-1.5',
                            activity.outcome === 'success'
                              ? 'bg-green-500/10 text-green-600'
                              : activity.outcome === 'failure'
                                ? 'bg-red-500/10 text-red-600'
                                : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {getCategoryIcon(activity.category)}
                        </div>
                        <span className="font-medium">{formatAction(activity.action)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatCategory(activity.category)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {activity.userEmail || 'System'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {activity.resourceType ? (
                        <span className="capitalize">{activity.resourceType}</span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {activity.outcome === 'success' ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Success
                        </Badge>
                      ) : activity.outcome === 'failure' ? (
                        <Badge variant="destructive">
                          <XCircle className="mr-1 h-3 w-3" />
                          Failed
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{activity.outcome}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground" title={formatDateTime(activity.createdAt)}>
                      {formatRelativeTime(activity.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
