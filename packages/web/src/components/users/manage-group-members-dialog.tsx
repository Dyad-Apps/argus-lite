import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  UserPlus,
  UserMinus,
  Loader2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/api-client';

interface Group {
  id: string;
  name: string;
  organizationId: string;
}

interface GroupMember {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  addedAt: string;
  addedBy: string | null;
}

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
}

interface ManageGroupMembersDialogProps {
  group: Group | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMembersChanged?: () => void;
}

export function ManageGroupMembersDialog({
  group,
  open,
  onOpenChange,
  onMembersChanged,
}: ManageGroupMembersDialogProps) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!group) return;
    try {
      setIsLoadingMembers(true);
      const response = await apiClient.get<{ data: GroupMember[] }>(
        `/organizations/${group.organizationId}/groups/${group.id}/members?pageSize=100`
      );
      setMembers(response.data);
    } catch (err) {
      console.error('Failed to fetch group members:', err);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [group]);

  const fetchAvailableUsers = useCallback(async () => {
    if (!group) return;
    try {
      setIsLoadingUsers(true);
      // Get all users in the organization
      const response = await apiClient.get<{ data: User[] }>(
        `/organizations/${group.organizationId}/members?pageSize=100`
      );
      setAvailableUsers(response.data);
    } catch (err) {
      console.error('Failed to fetch available users:', err);
      // Fallback to all users if org members endpoint doesn't exist
      try {
        const fallbackResponse = await apiClient.get<{ data: User[] }>(
          '/users?pageSize=100'
        );
        setAvailableUsers(fallbackResponse.data);
      } catch {
        console.error('Failed to fetch users fallback');
      }
    } finally {
      setIsLoadingUsers(false);
    }
  }, [group]);

  useEffect(() => {
    if (open && group) {
      fetchMembers();
      fetchAvailableUsers();
    }
  }, [open, group, fetchMembers, fetchAvailableUsers]);

  const handleAddMember = async (userId: string) => {
    if (!group) return;
    try {
      setAddingUserId(userId);
      await apiClient.post(
        `/organizations/${group.organizationId}/groups/${group.id}/members`,
        { userId }
      );
      await fetchMembers();
      onMembersChanged?.();
    } catch (err) {
      console.error('Failed to add member:', err);
    } finally {
      setAddingUserId(null);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!group) return;
    try {
      setRemovingUserId(userId);
      await apiClient.delete(
        `/organizations/${group.organizationId}/groups/${group.id}/members/${userId}`
      );
      await fetchMembers();
      onMembersChanged?.();
    } catch (err) {
      console.error('Failed to remove member:', err);
    } finally {
      setRemovingUserId(null);
    }
  };

  const getInitials = (firstName: string | null, lastName: string | null, email: string) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) {
      return firstName.slice(0, 2).toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
  };

  const getDisplayName = (firstName: string | null, lastName: string | null, email: string) => {
    if (firstName || lastName) {
      return `${firstName || ''} ${lastName || ''}`.trim();
    }
    return email.split('@')[0];
  };

  const memberIds = new Set(members.map((m) => m.userId));

  const filteredMembers = members.filter(
    (member) =>
      member.email.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      (member.firstName?.toLowerCase().includes(memberSearchQuery.toLowerCase()) ?? false) ||
      (member.lastName?.toLowerCase().includes(memberSearchQuery.toLowerCase()) ?? false)
  );

  const filteredAvailableUsers = availableUsers.filter(
    (user) =>
      !memberIds.has(user.id) &&
      (user.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        (user.firstName?.toLowerCase().includes(userSearchQuery.toLowerCase()) ?? false) ||
        (user.lastName?.toLowerCase().includes(userSearchQuery.toLowerCase()) ?? false))
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Manage Members - {group?.name}
          </DialogTitle>
          <DialogDescription>
            Add or remove members from this group.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="members" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="members">
              Current Members ({members.length})
            </TabsTrigger>
            <TabsTrigger value="add">Add Members</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="flex-1 overflow-hidden flex flex-col mt-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex-1 overflow-auto border rounded-md">
              {isLoadingMembers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {members.length === 0
                    ? 'No members in this group yet.'
                    : 'No members match your search.'}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.map((member) => (
                      <TableRow key={member.userId}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {getInitials(member.firstName, member.lastName, member.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-sm">
                                {getDisplayName(member.firstName, member.lastName, member.email)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {member.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(member.addedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(member.userId)}
                            disabled={removingUserId === member.userId}
                          >
                            {removingUserId === member.userId ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <UserMinus className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          <TabsContent value="add" className="flex-1 overflow-hidden flex flex-col mt-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search users to add..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex-1 overflow-auto border rounded-md">
              {isLoadingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredAvailableUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {availableUsers.length === memberIds.size
                    ? 'All users are already members of this group.'
                    : 'No users match your search.'}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAvailableUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {getInitials(user.firstName, user.lastName, user.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-sm">
                                {getDisplayName(user.firstName, user.lastName, user.email)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={user.status === 'active' ? 'default' : 'secondary'}
                          >
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddMember(user.id)}
                            disabled={addingUserId === user.id}
                          >
                            {addingUserId === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <UserPlus className="h-4 w-4 text-muted-foreground hover:text-primary" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
