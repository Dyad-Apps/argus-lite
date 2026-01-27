import { useState, useEffect, useCallback } from 'react';
import {
  Users2,
  Play,
  Square,
  Loader2,
  RefreshCw,
  Clock,
  AlertTriangle,
  Ban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { apiClient } from '@/lib/api-client';
import { useImpersonation } from '@/contexts/impersonation-context';
import { StartImpersonationDialog } from '@/components/impersonation/start-impersonation-dialog';

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface ImpersonationSession {
  id: string;
  impersonator: User;
  target: User;
  organizationId: string | null;
  reason: string;
  status: 'active' | 'ended' | 'expired' | 'revoked';
  startedAt: string;
  endedAt: string | null;
  expiresAt: string;
}

interface ImpersonationStatus {
  isImpersonating: boolean;
  sessionId?: string;
  impersonator?: User;
  target?: User;
  startedAt?: string;
  expiresAt?: string;
  reason?: string;
}

interface ImpersonationListResponse {
  data: ImpersonationSession[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

interface UserListResponse {
  data: User[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export function ImpersonationTab() {
  const impersonation = useImpersonation();
  const [canImpersonate, setCanImpersonate] = useState(false);
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);
  const [status, setStatus] = useState<ImpersonationStatus | null>(null);
  const [activeSessions, setActiveSessions] = useState<ImpersonationSession[]>([]);
  const [history, setHistory] = useState<ImpersonationSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start impersonation dialog state
  const [isStartDialogOpen, setIsStartDialogOpen] = useState(false);

  // Check if current user can impersonate
  useEffect(() => {
    async function checkPermission() {
      try {
        setIsCheckingPermission(true);
        const response = await apiClient.get<{ canImpersonate: boolean }>(
          '/admin/impersonate/can-impersonate'
        );
        setCanImpersonate(response.canImpersonate);
      } catch (err) {
        console.error('Failed to check impersonation permission:', err);
        setCanImpersonate(false);
      } finally {
        setIsCheckingPermission(false);
      }
    }
    checkPermission();
  }, []);

  // Fetch impersonation status and data
  const fetchData = useCallback(async () => {
    if (!canImpersonate) return;

    try {
      setIsLoading(true);
      setError(null);

      const [statusRes, sessionsRes, historyRes] = await Promise.all([
        apiClient.get<ImpersonationStatus>('/admin/impersonate/status'),
        apiClient.get<ImpersonationListResponse>('/admin/impersonate/sessions?pageSize=50'),
        apiClient.get<ImpersonationListResponse>('/admin/impersonate/history?pageSize=50'),
      ]);

      setStatus(statusRes);
      setActiveSessions(sessionsRes.data);
      setHistory(historyRes.data);
    } catch (err) {
      console.error('Failed to fetch impersonation data:', err);
      setError('Failed to load impersonation data');
    } finally {
      setIsLoading(false);
    }
  }, [canImpersonate]);

  useEffect(() => {
    if (canImpersonate) {
      fetchData();
    }
  }, [canImpersonate, fetchData]);



  const handleOpenStartDialog = () => {
    setIsStartDialogOpen(true);
  };

  const handleEndImpersonation = async () => {
    try {
      // Pass the session ID from the API status if available, to recover if local context reads null
      await impersonation.endImpersonation(status?.sessionId);
    } catch (err) {
      console.error('Failed to end impersonation:', err);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to revoke this impersonation session?')) return;

    try {
      await impersonation.revokeSession(sessionId);
      fetchData();
    } catch (err) {
      console.error('Failed to revoke session:', err);
      // alert('Failed to revoke session'); // Optional user feedback
    }
  };

  const getStatusBadge = (sessionStatus: string) => {
    switch (sessionStatus) {
      case 'active':
        return <Badge variant="default" className="bg-green-500">Active</Badge>;
      case 'ended':
        return <Badge variant="secondary">Ended</Badge>;
      case 'expired':
        return <Badge variant="outline">Expired</Badge>;
      case 'revoked':
        return <Badge variant="destructive">Revoked</Badge>;
      default:
        return <Badge variant="outline">{sessionStatus}</Badge>;
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (startedAt: string, endedAt: string | null) => {
    const start = new Date(startedAt);
    const end = endedAt ? new Date(endedAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  };

  const getUserDisplay = (user: User) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email.split('@')[0];
  };

  if (isCheckingPermission) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!canImpersonate) {
    return (
      <Card>
        <CardContent className="py-8">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Access Restricted</AlertTitle>
            <AlertDescription>
              You do not have permission to impersonate users. Only Super Admins can use this feature.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current Status */}
      {(impersonation.isActive || status?.isImpersonating) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Active Impersonation Session</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              Currently impersonating{' '}
              <strong>
                {impersonation.impersonatedUser?.email || status?.target?.email}
              </strong>
              {status?.expiresAt && (
                <> (expires {formatDateTime(status.expiresAt)})</>
              )}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEndImpersonation}
            >
              <Square className="mr-2 h-4 w-4" />
              End Session
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Start Impersonation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users2 className="h-5 w-5" />
                User Impersonation
              </CardTitle>
              <CardDescription>
                Temporarily access the platform as another user for support and debugging purposes.
              </CardDescription>
            </div>
            <Button
              onClick={handleOpenStartDialog}
              disabled={impersonation.isActive || status?.isImpersonating}
            >
              <Play className="mr-2 h-4 w-4" />
              Start Impersonation
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Active Sessions</CardTitle>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchData}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activeSessions.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              No active impersonation sessions
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Impersonator</TableHead>
                  <TableHead>Target User</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeSessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{getUserDisplay(session.impersonator)}</div>
                        <div className="text-sm text-muted-foreground">
                          {session.impersonator.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{getUserDisplay(session.target)}</div>
                        <div className="text-sm text-muted-foreground">
                          {session.target.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(session.startedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {formatDateTime(session.expiresAt)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {session.reason}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeSession(session.id)}
                      >
                        <Ban className="mr-2 h-4 w-4" />
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Session History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Session History</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              No impersonation history
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{getUserDisplay(session.target)}</div>
                        <div className="text-sm text-muted-foreground">
                          {session.target.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(session.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDuration(session.startedAt, session.endedAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(session.startedAt)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {session.reason}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Start Impersonation Dialog */}
      <StartImpersonationDialog
        open={isStartDialogOpen}
        onOpenChange={setIsStartDialogOpen}
      />
    </div>
  );
}
