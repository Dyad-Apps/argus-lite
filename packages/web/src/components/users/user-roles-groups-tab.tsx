import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
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
import { Plus, Trash2, Users, Shield, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Role {
  id: string;
  name: string;
  description?: string;
  source: 'direct' | 'group' | 'sso' | 'inherited';
  groupName?: string;
}

interface Group {
  id: string;
  name: string;
  description?: string;
  memberCount?: number;
}

interface UserRolesGroupsTabProps {
  userId: string;
  organizationId: string;
}

export function UserRolesGroupsTab({ userId, organizationId }: UserRolesGroupsTabProps) {
  const [userRoles, setUserRoles] = useState<Role[]>([]);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [availableGroups, setAvailableGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUserData = useCallback(async () => {
    try {
      setIsLoading(true);
      // Fetch user roles and groups
      const [rolesRes, groupsRes] = await Promise.all([
        apiClient.get<{ data: Role[] }>(`/users/${userId}/roles`).catch(() => ({ data: [] })),
        apiClient.get<{ data: Group[] }>(`/users/${userId}/groups`).catch(() => ({ data: [] })),
      ]);
      setUserRoles(rolesRes.data || []);
      setUserGroups(groupsRes.data || []);
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const fetchAvailableData = useCallback(async () => {
    try {
      const [rolesRes, groupsRes] = await Promise.all([
        apiClient
          .get<{ data: Role[] }>(`/organizations/${organizationId}/roles`)
          .catch(() => ({ data: [] })),
        apiClient
          .get<{ data: Group[] }>(`/organizations/${organizationId}/groups`)
          .catch(() => ({ data: [] })),
      ]);
      setAvailableRoles(rolesRes.data || []);
      setAvailableGroups(groupsRes.data || []);
    } catch (err) {
      console.error('Failed to fetch available roles/groups:', err);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchUserData();
    fetchAvailableData();
  }, [fetchUserData, fetchAvailableData]);

  const handleAddRole = async () => {
    if (!selectedRoleId) return;
    setIsSubmitting(true);
    try {
      await apiClient.post(`/users/${userId}/roles/${selectedRoleId}`);
      await fetchUserData();
      setIsAddRoleOpen(false);
      setSelectedRoleId('');
    } catch (err) {
      console.error('Failed to add role:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveRole = async (roleId: string) => {
    if (!confirm('Remove this role from the user?')) return;
    try {
      await apiClient.delete(`/users/${userId}/roles/${roleId}`);
      await fetchUserData();
    } catch (err) {
      console.error('Failed to remove role:', err);
    }
  };

  const handleAddGroup = async () => {
    if (!selectedGroupId) return;
    setIsSubmitting(true);
    try {
      await apiClient.post(`/users/${userId}/groups/${selectedGroupId}`);
      await fetchUserData();
      setIsAddGroupOpen(false);
      setSelectedGroupId('');
    } catch (err) {
      console.error('Failed to add to group:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveGroup = async (groupId: string) => {
    if (!confirm('Remove user from this group?')) return;
    try {
      await apiClient.delete(`/users/${userId}/groups/${groupId}`);
      await fetchUserData();
    } catch (err) {
      console.error('Failed to remove from group:', err);
    }
  };

  const getSourceBadge = (source: Role['source'], groupName?: string) => {
    switch (source) {
      case 'direct':
        return <Badge variant="default">Direct</Badge>;
      case 'group':
        return (
          <Badge variant="secondary">
            Group: {groupName}
          </Badge>
        );
      case 'sso':
        return <Badge variant="outline">SSO</Badge>;
      case 'inherited':
        return <Badge variant="outline">Inherited</Badge>;
      default:
        return <Badge variant="outline">{source}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Roles Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Roles
            </CardTitle>
            <CardDescription>Manage user role assignments</CardDescription>
          </div>
          <Button size="sm" onClick={() => setIsAddRoleOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Assign Role
          </Button>
        </CardHeader>
        <CardContent>
          {userRoles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No roles assigned to this user
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userRoles.map((role) => (
                  <TableRow key={`${role.id}-${role.source}`}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {role.description || '-'}
                    </TableCell>
                    <TableCell>{getSourceBadge(role.source, role.groupName)}</TableCell>
                    <TableCell>
                      {role.source === 'direct' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveRole(role.id)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Groups Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Groups
            </CardTitle>
            <CardDescription>Manage user group memberships</CardDescription>
          </div>
          <Button size="sm" onClick={() => setIsAddGroupOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add to Group
          </Button>
        </CardHeader>
        <CardContent>
          {userGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              User is not a member of any groups
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userGroups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {group.description || '-'}
                    </TableCell>
                    <TableCell>{group.memberCount ?? '-'}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveGroup(group.id)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Role Dialog */}
      <Dialog open={isAddRoleOpen} onOpenChange={setIsAddRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role</DialogTitle>
            <DialogDescription>
              Select a role to assign directly to this user.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles
                  .filter((r) => !userRoles.some((ur) => ur.id === r.id && ur.source === 'direct'))
                  .map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddRoleOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddRole} disabled={!selectedRoleId || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                'Assign Role'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Group Dialog */}
      <Dialog open={isAddGroupOpen} onOpenChange={setIsAddGroupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Group</DialogTitle>
            <DialogDescription>
              Select a group to add this user to.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent>
                {availableGroups
                  .filter((g) => !userGroups.some((ug) => ug.id === g.id))
                  .map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddGroupOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddGroup} disabled={!selectedGroupId || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add to Group'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
