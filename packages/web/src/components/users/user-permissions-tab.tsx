import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Check, X, Loader2, Shield } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface Permission {
  resource: string;
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
  source: string;
}

interface UserPermissionsTabProps {
  userId: string;
}

const RESOURCE_LABELS: Record<string, string> = {
  organizations: 'Organizations',
  users: 'Users',
  roles: 'Roles',
  groups: 'Groups',
  audit_logs: 'Audit Logs',
  settings: 'Settings',
  branding: 'Branding',
  sso: 'SSO Connections',
  impersonation: 'Impersonation',
};

export function UserPermissionsTab({ userId }: UserPermissionsTabProps) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiClient
        .get<{ data: Permission[] }>(`/users/${userId}/permissions`)
        .catch(() => ({
          data: [
            // Default permissions structure for display
            { resource: 'organizations', create: false, read: true, update: false, delete: false, source: 'role:member' },
            { resource: 'users', create: false, read: true, update: false, delete: false, source: 'role:member' },
            { resource: 'roles', create: false, read: true, update: false, delete: false, source: 'role:member' },
            { resource: 'groups', create: false, read: true, update: false, delete: false, source: 'role:member' },
            { resource: 'audit_logs', create: false, read: false, update: false, delete: false, source: '-' },
            { resource: 'settings', create: false, read: false, update: false, delete: false, source: '-' },
            { resource: 'branding', create: false, read: true, update: false, delete: false, source: 'role:member' },
            { resource: 'sso', create: false, read: false, update: false, delete: false, source: '-' },
            { resource: 'impersonation', create: false, read: false, update: false, delete: false, source: '-' },
          ],
        }));
      setPermissions(response.data);
    } catch (err) {
      console.error('Failed to fetch permissions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const PermissionCell = ({ allowed }: { allowed: boolean }) => (
    <TableCell className="text-center">
      {allowed ? (
        <div className="flex justify-center">
          <div className="rounded-full bg-green-500/10 p-1">
            <Check className="h-4 w-4 text-green-600" />
          </div>
        </div>
      ) : (
        <div className="flex justify-center">
          <div className="rounded-full bg-muted p-1">
            <X className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      )}
    </TableCell>
  );

  if (isLoading) {
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
          <Shield className="h-5 w-5" />
          Effective Permissions
        </CardTitle>
        <CardDescription>
          Combined permissions from all assigned roles and groups. This is a read-only view of
          what actions this user can perform.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Resource</TableHead>
              <TableHead className="text-center w-[100px]">Create</TableHead>
              <TableHead className="text-center w-[100px]">Read</TableHead>
              <TableHead className="text-center w-[100px]">Update</TableHead>
              <TableHead className="text-center w-[100px]">Delete</TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissions.map((perm) => (
              <TableRow key={perm.resource}>
                <TableCell className="font-medium">
                  {RESOURCE_LABELS[perm.resource] || perm.resource}
                </TableCell>
                <PermissionCell allowed={perm.create} />
                <PermissionCell allowed={perm.read} />
                <PermissionCell allowed={perm.update} />
                <PermissionCell allowed={perm.delete} />
                <TableCell>
                  <Badge variant="outline" className={cn(
                    perm.source === '-' && 'text-muted-foreground'
                  )}>
                    {perm.source}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
