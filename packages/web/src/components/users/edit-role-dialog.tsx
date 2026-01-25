import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

interface Role {
  id: string;
  name: string;
  description: string | null;
  organizationId: string | null;
  isSystem: boolean;
  defaultScope: 'organization' | 'children' | 'tree';
}

interface EditRoleDialogProps {
  role: Role | null;
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRoleUpdated?: () => void;
}

export function EditRoleDialog({
  role,
  organizationId,
  open,
  onOpenChange,
  onRoleUpdated,
}: EditRoleDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultScope, setDefaultScope] = useState<'organization' | 'children' | 'tree'>('organization');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (role && open) {
      setName(role.name);
      setDescription(role.description || '');
      setDefaultScope(role.defaultScope);
      setError(null);
    }
  }, [role, open]);

  const handleSave = async () => {
    if (!role || !name.trim()) return;

    try {
      setIsSaving(true);
      setError(null);
      await apiClient.patch(`/organizations/${organizationId}/roles/${role.id}`, {
        name: name.trim(),
        description: description.trim() || null,
        defaultScope,
      });
      onOpenChange(false);
      onRoleUpdated?.();
    } catch (err: any) {
      console.error('Failed to update role:', err);
      setError(err.message || 'Failed to update role');
    } finally {
      setIsSaving(false);
    }
  };

  if (!role) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Role</DialogTitle>
          <DialogDescription>
            Update the role details. System roles cannot be modified.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-name">Role Name</Label>
            <Input
              id="edit-name"
              placeholder="e.g., Report Viewer"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              placeholder="Optional description for this role"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-scope">Default Scope</Label>
            <Select value={defaultScope} onValueChange={(v) => setDefaultScope(v as typeof defaultScope)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="organization">Organization Only</SelectItem>
                <SelectItem value="children">Organization + Children</SelectItem>
                <SelectItem value="tree">Full Organization Tree</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Determines which organizations this role's permissions apply to by default.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
