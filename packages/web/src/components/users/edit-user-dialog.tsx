import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { apiClient } from '@/lib/api-client';

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: 'active' | 'inactive' | 'suspended' | 'deleted';
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface EditUserDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdated?: () => void;
}

export function EditUserDialog({
  user,
  open,
  onOpenChange,
  onUserUpdated,
}: EditUserDialogProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [status, setStatus] = useState<User['status']>('active');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && open) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setStatus(user.status);
      setError(null);
    }
  }, [user, open]);

  const handleSave = async () => {
    if (!user) return;

    try {
      setIsSaving(true);
      setError(null);
      await apiClient.patch(`/users/${user.id}`, {
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
        status,
      });
      onOpenChange(false);
      onUserUpdated?.();
    } catch (err: any) {
      console.error('Failed to update user:', err);
      setError(err.message || 'Failed to update user');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user details for {user.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              value={user.email}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-firstName">First Name</Label>
              <Input
                id="edit-firstName"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-lastName">Last Name</Label>
              <Input
                id="edit-lastName"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as User['status'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Email Verified</Label>
              <p className="text-sm">
                {user.emailVerifiedAt
                  ? new Date(user.emailVerifiedAt).toLocaleDateString()
                  : 'Not verified'}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Last Login</Label>
              <p className="text-sm">
                {user.lastLoginAt
                  ? new Date(user.lastLoginAt).toLocaleDateString()
                  : 'Never'}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
