import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Search,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  Building2,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { apiClient } from '@/lib/api-client';

interface Organization {
  id: string;
  name: string;
  slug: string;
  orgCode: string;
}

interface RolePermissions {
  resources: Array<{
    resource: string;
    actions: string[];
  }>;
  menuAccess?: string[];
  custom?: Record<string, boolean>;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  organizationId: string | null;
  isSystem: boolean;
  defaultScope: 'organization' | 'children' | 'tree';
  permissions: RolePermissions;
  createdAt: string;
  updatedAt: string;
}

interface RoleListResponse {
  data: Role[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

interface OrganizationListResponse {
  data: Organization[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export function RolesTab() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [newRoleScope, setNewRoleScope] = useState<'organization' | 'children' | 'tree'>('organization');

  // Fetch organizations
  useEffect(() => {
    async function fetchOrganizations() {
      try {
        setIsLoadingOrgs(true);
        const response = await apiClient.get<OrganizationListResponse>(
          '/organizations?pageSize=100'
        );
        setOrganizations(response.data);
        if (response.data.length > 0 && !selectedOrgId) {
          setSelectedOrgId(response.data[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch organizations:', err);
      } finally {
        setIsLoadingOrgs(false);
      }
    }
    fetchOrganizations();
  }, []);

  const fetchRoles = useCallback(async () => {
    if (!selectedOrgId) return;

    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.get<RoleListResponse>(
        `/organizations/${selectedOrgId}/roles?pageSize=100&includeSystem=true`
      );
      setRoles(response.data);
    } catch (err) {
      console.error('Failed to fetch roles:', err);
      setError('Failed to load roles');
    } finally {
      setIsLoading(false);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    if (selectedOrgId) {
      fetchRoles();
    }
  }, [selectedOrgId, fetchRoles]);

  const handleCreateRole = async () => {
    if (!selectedOrgId || !newRoleName.trim()) return;

    try {
      setIsCreating(true);
      await apiClient.post(`/organizations/${selectedOrgId}/roles`, {
        name: newRoleName.trim(),
        description: newRoleDescription.trim() || undefined,
        defaultScope: newRoleScope,
        permissions: { resources: [], menuAccess: [] },
      });
      setIsCreateDialogOpen(false);
      setNewRoleName('');
      setNewRoleDescription('');
      setNewRoleScope('organization');
      fetchRoles();
    } catch (err) {
      console.error('Failed to create role:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!selectedOrgId) return;
    if (!confirm('Are you sure you want to delete this role?')) return;

    try {
      await apiClient.delete(`/organizations/${selectedOrgId}/roles/${roleId}`);
      fetchRoles();
    } catch (err) {
      console.error('Failed to delete role:', err);
    }
  };

  const filteredRoles = roles.filter(
    (role) =>
      role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (role.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  // Sort: system roles first, then by name
  const sortedRoles = [...filteredRoles].sort((a, b) => {
    if (a.isSystem && !b.isSystem) return -1;
    if (!a.isSystem && b.isSystem) return 1;
    return a.name.localeCompare(b.name);
  });

  const getScopeBadge = (scope: string) => {
    switch (scope) {
      case 'organization':
        return <Badge variant="outline">Organization</Badge>;
      case 'children':
        return <Badge variant="outline">Children</Badge>;
      case 'tree':
        return <Badge variant="outline">Full Tree</Badge>;
      default:
        return <Badge variant="outline">{scope}</Badge>;
    }
  };

  const getPermissionCount = (permissions: RolePermissions) => {
    const resourceCount = permissions.resources?.length ?? 0;
    const menuCount = permissions.menuAccess?.length ?? 0;
    return resourceCount + menuCount;
  };

  if (isLoadingOrgs) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (organizations.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            No organizations found. Create an organization first to manage roles.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Organization Selector */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <Label>Organization</Label>
              </div>
              <Select value={selectedOrgId || ''} onValueChange={setSelectedOrgId}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name} ({org.orgCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={!selectedOrgId}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Role
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Custom Role</DialogTitle>
                  <DialogDescription>
                    Create a new role with specific permissions for this organization.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Role Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Report Viewer"
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Optional description for this role"
                      value={newRoleDescription}
                      onChange={(e) => setNewRoleDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scope">Default Scope</Label>
                    <Select value={newRoleScope} onValueChange={(v) => setNewRoleScope(v as typeof newRoleScope)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="organization">Organization Only</SelectItem>
                        <SelectItem value="children">Organization + Children</SelectItem>
                        <SelectItem value="tree">Full Organization Tree</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateRole}
                    disabled={!newRoleName.trim() || isCreating}
                  >
                    {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Role
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* Roles List */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search roles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchRoles}
              disabled={isLoading || !selectedOrgId}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && roles.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center text-destructive py-8">{error}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRoles.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground py-8"
                    >
                      {roles.length === 0
                        ? 'No roles found. Create your first custom role.'
                        : 'No roles match your search.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedRoles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                            <Shield className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{role.name}</span>
                            {role.isSystem && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Lock className="h-3 w-3 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    System role (read-only)
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">
                        {role.description || '-'}
                      </TableCell>
                      <TableCell>{getScopeBadge(role.defaultScope)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {getPermissionCount(role.permissions)} permissions
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {!role.isSystem && (
                          <TooltipProvider delayDuration={0}>
                            <div className="flex items-center justify-center gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <Pencil className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteRole(role.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete</TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
