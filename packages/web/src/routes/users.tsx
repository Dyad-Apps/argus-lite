import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users as UsersIcon,
  Plus,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UsersListTab, GroupsTab, RolesTab, CreateUserWizard, UsersListTabRef } from '@/components/users';
import { apiClient } from '@/lib/api-client';

export const Route = createFileRoute('/users')({
  component: UsersPage,
});

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
  isPrimary: boolean;
}

interface Group {
  id: string;
  name: string;
}

function UsersPage() {
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [currentOrganizationId, setCurrentOrganizationId] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const usersListRef = useRef<UsersListTabRef | null>(null);

  const handleUserSelect = (user: { id: string }) => {
    navigate({ to: '/users/$userId', params: { userId: user.id } });
  };

  const fetchOrganization = useCallback(async () => {
    try {
      const response = await apiClient.get<{
        organizations: Organization[];
        currentOrganizationId: string | null;
      }>('/auth/organizations');
      setCurrentOrganizationId(response.currentOrganizationId);
    } catch (err) {
      console.error('Failed to fetch organization:', err);
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    if (!currentOrganizationId) return;
    try {
      const response = await apiClient.get<{ data: Group[] }>(
        `/organizations/${currentOrganizationId}/groups`
      );
      setGroups(response.data || []);
    } catch (err) {
      console.error('Failed to fetch groups:', err);
      setGroups([]);
    }
  }, [currentOrganizationId]);

  useEffect(() => {
    fetchOrganization();
  }, [fetchOrganization]);

  useEffect(() => {
    if (currentOrganizationId) {
      fetchGroups();
    }
  }, [currentOrganizationId, fetchGroups]);

  const handleUserCreated = () => {
    usersListRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Users</h1>
          <p className="text-muted-foreground">
            Manage users, groups, and roles
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create User
        </Button>
      </div>

      {/* Create User Wizard */}
      {currentOrganizationId && (
        <CreateUserWizard
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onUserCreated={handleUserCreated}
          organizationId={currentOrganizationId}
          groups={groups}
        />
      )}

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">
            <UsersIcon className="mr-2 h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="groups">
            <UsersIcon className="mr-2 h-4 w-4" />
            Groups
          </TabsTrigger>
          <TabsTrigger value="roles">
            <Shield className="mr-2 h-4 w-4" />
            Roles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UsersListTab ref={usersListRef} onUserSelect={handleUserSelect} />
        </TabsContent>

        <TabsContent value="groups">
          <GroupsTab />
        </TabsContent>

        <TabsContent value="roles">
          <RolesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
