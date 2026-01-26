import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/api-client';
import { UserProfileCard } from '@/components/users/user-profile-card';
import { UserRolesGroupsTab } from '@/components/users/user-roles-groups-tab';
import { UserPermissionsTab } from '@/components/users/user-permissions-tab';
import { UserActivityTab } from '@/components/users/user-activity-tab';
import { EditUserDialog } from '@/components/users/edit-user-dialog';

export const Route = createFileRoute('/users/$userId')({
  component: UserDetailsPage,
});

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone?: string | null;
  status: 'active' | 'inactive' | 'suspended' | 'deleted';
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  rootOrganizationId?: string;
  primaryOrganizationId?: string;
}

function UserDetailsPage() {
  const { userId } = Route.useParams();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.get<User>(`/users/${userId}`);
      setUser(response);
      setOrganizationId(response.primaryOrganizationId || response.rootOrganizationId || null);
    } catch (err) {
      console.error('Failed to fetch user:', err);
      setError('Failed to load user details');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const fetchOrganization = useCallback(async () => {
    if (organizationId) return;
    try {
      const response = await apiClient.get<{
        organizations: { id: string }[];
        currentOrganizationId: string | null;
      }>('/auth/organizations');
      setOrganizationId(response.currentOrganizationId || response.organizations[0]?.id || null);
    } catch (err) {
      console.error('Failed to fetch organization:', err);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    fetchOrganization();
  }, [fetchOrganization]);

  const handleStatusChange = async (status: 'active' | 'inactive' | 'suspended') => {
    try {
      await apiClient.patch(`/users/${userId}`, { status });
      fetchUser();
    } catch (err) {
      console.error('Failed to update user status:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-6">
        <Link to="/users">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Users
          </Button>
        </Link>
        <div className="text-center py-16">
          <p className="text-destructive">{error || 'User not found'}</p>
          <Button variant="outline" onClick={fetchUser} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with back navigation */}
      <div className="flex items-center gap-4">
        <Link to="/users">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Users
          </Button>
        </Link>
      </div>

      {/* User Profile Card */}
      <UserProfileCard
        user={user}
        onEdit={() => setIsEditDialogOpen(true)}
        onStatusChange={handleStatusChange}
      />

      {/* Tabs */}
      <Tabs defaultValue="roles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="roles">Roles & Groups</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="roles">
          {organizationId ? (
            <UserRolesGroupsTab userId={userId} organizationId={organizationId} />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Unable to load roles and groups
            </div>
          )}
        </TabsContent>

        <TabsContent value="permissions">
          <UserPermissionsTab userId={userId} />
        </TabsContent>

        <TabsContent value="activity">
          <UserActivityTab userId={userId} />
        </TabsContent>
      </Tabs>

      {/* Edit User Dialog */}
      <EditUserDialog
        user={user}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onUserUpdated={fetchUser}
      />
    </div>
  );
}
