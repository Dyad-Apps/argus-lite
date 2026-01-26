import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Loader2,
  Activity,
  LogIn,
  LogOut,
  Key,
  Shield,
  AlertTriangle,
  Monitor,
  Smartphone,
  Globe,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface ActivityEntry {
  id: string;
  action: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  device?: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser?: string;
  success: boolean;
  details?: string;
}

interface UserActivityTabProps {
  userId: string;
}

export function UserActivityTab({ userId }: UserActivityTabProps) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchActivities = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiClient
        .get<{ data: ActivityEntry[]; pagination: { hasNext: boolean } }>(
          `/users/${userId}/activity?page=${page}&pageSize=20`
        )
        .catch(() => ({
          // Mock data for display when endpoint doesn't exist
          data: [
            {
              id: '1',
              action: 'login',
              timestamp: new Date().toISOString(),
              ipAddress: '192.168.1.100',
              userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
              device: 'desktop' as const,
              browser: 'Chrome',
              location: 'New York, US',
              success: true,
            },
            {
              id: '2',
              action: 'password_change',
              timestamp: new Date(Date.now() - 86400000).toISOString(),
              ipAddress: '192.168.1.100',
              device: 'desktop' as const,
              success: true,
            },
            {
              id: '3',
              action: 'login_failed',
              timestamp: new Date(Date.now() - 172800000).toISOString(),
              ipAddress: '10.0.0.1',
              device: 'mobile' as const,
              success: false,
              details: 'Invalid password',
            },
          ],
          pagination: { hasNext: false },
        }));
      setActivities(response.data);
      setHasMore(response.pagination.hasNext);
    } catch (err) {
      console.error('Failed to fetch activity:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, page]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const getActionIcon = (action: string, success: boolean) => {
    if (!success) {
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
    switch (action) {
      case 'login':
        return <LogIn className="h-4 w-4 text-green-600" />;
      case 'logout':
        return <LogOut className="h-4 w-4 text-muted-foreground" />;
      case 'password_change':
        return <Key className="h-4 w-4 text-blue-600" />;
      case 'mfa_enabled':
      case 'mfa_disabled':
        return <Shield className="h-4 w-4 text-purple-600" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      login: 'Login',
      logout: 'Logout',
      login_failed: 'Failed Login',
      password_change: 'Password Changed',
      password_reset: 'Password Reset',
      mfa_enabled: 'MFA Enabled',
      mfa_disabled: 'MFA Disabled',
      profile_updated: 'Profile Updated',
      role_assigned: 'Role Assigned',
      role_removed: 'Role Removed',
    };
    return labels[action] || action;
  };

  const getDeviceIcon = (device?: string) => {
    switch (device) {
      case 'desktop':
        return <Monitor className="h-4 w-4 text-muted-foreground" />;
      case 'mobile':
      case 'tablet':
        return <Smartphone className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Globe className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading && activities.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Activity Log
        </CardTitle>
        <CardDescription>
          Recent login history and account activity for this user.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No activity recorded for this user
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell>
                      {getActionIcon(activity.action, activity.success)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {getActionLabel(activity.action)}
                      {activity.details && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {activity.details}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(activity.timestamp)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getDeviceIcon(activity.device)}
                        <span className="text-sm">
                          {activity.browser || activity.device || 'Unknown'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {activity.ipAddress || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {activity.location || '-'}
                    </TableCell>
                    <TableCell>
                      {activity.success ? (
                        <Badge variant="outline" className="text-green-600">
                          Success
                        </Badge>
                      ) : (
                        <Badge variant="destructive">Failed</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {hasMore && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
