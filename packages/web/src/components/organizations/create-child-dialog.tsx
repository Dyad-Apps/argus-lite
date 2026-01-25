import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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

interface Organization {
  id: string;
  name: string;
  orgCode: string;
}

interface TenantProfile {
  id: string;
  name: string;
  type: string;
}

interface CreateChildDialogProps {
  parentOrganization: Organization;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface CreateChildFormData {
  name: string;
  orgCode: string;
  description: string;
  canHaveChildren: boolean;
  profileId: string;
}

const initialFormData: CreateChildFormData = {
  name: '',
  orgCode: '',
  description: '',
  canHaveChildren: false,
  profileId: '',
};

export function CreateChildDialog({
  parentOrganization,
  open,
  onOpenChange,
  onCreated,
}: CreateChildDialogProps) {
  const [formData, setFormData] = useState<CreateChildFormData>(initialFormData);
  const [profiles, setProfiles] = useState<TenantProfile[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch tenant profiles when dialog opens
  useEffect(() => {
    if (open) {
      fetchProfiles();
    }
  }, [open]);

  const fetchProfiles = async () => {
    try {
      const response = await apiClient.get<{ data: TenantProfile[] }>('/organization-profiles');
      setProfiles(response.data || []);
    } catch (err) {
      console.error('Failed to fetch organization profiles:', err);
      // Continue without profiles - they're optional
    }
  };

  const handleCreate = async () => {
    try {
      setIsCreating(true);
      setError(null);

      await apiClient.post(`/organizations/${parentOrganization.id}/children`, {
        name: formData.name,
        orgCode: formData.orgCode.toUpperCase(),
        description: formData.description || undefined,
        canHaveChildren: formData.canHaveChildren,
        profileId: formData.profileId || undefined,
      });

      setFormData(initialFormData);
      onCreated();
    } catch (err: any) {
      console.error('Failed to create child organization:', err);
      const message = err?.data?.error?.message || 'Failed to create child organization';
      setError(message);
    } finally {
      setIsCreating(false);
    }
  };

  const updateFormData = (field: keyof CreateChildFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleClose = () => {
    setFormData(initialFormData);
    setError(null);
    onOpenChange(false);
  };

  const isFormValid = formData.name && formData.orgCode;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Child Organization</DialogTitle>
          <DialogDescription>
            Create a new child organization under {parentOrganization.name} ({parentOrganization.orgCode})
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4 py-4">
          {/* Organization Name and Code */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="childName">Organization Name</Label>
              <Input
                id="childName"
                placeholder="e.g., Northeast Region"
                value={formData.name}
                onChange={(e) => updateFormData('name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="childOrgCode">Organization Code</Label>
              <Input
                id="childOrgCode"
                placeholder="e.g., REGION_NE"
                value={formData.orgCode}
                onChange={(e) => updateFormData('orgCode', e.target.value.toUpperCase())}
              />
              <p className="text-xs text-muted-foreground">
                Uppercase letters, numbers, and underscores only
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="childDescription">Description</Label>
            <Textarea
              id="childDescription"
              placeholder="Optional description for the organization"
              value={formData.description}
              onChange={(e) => updateFormData('description', e.target.value)}
              rows={2}
            />
          </div>

          {/* Tenant Profile */}
          {profiles.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="childProfile">Tenant Profile</Label>
              <Select
                value={formData.profileId}
                onValueChange={(value) => updateFormData('profileId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a profile (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name} ({profile.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Can Have Children */}
          <div className="flex items-start space-x-3 pt-2">
            <Checkbox
              id="childCanHaveChildren"
              checked={formData.canHaveChildren}
              onCheckedChange={(checked) =>
                updateFormData('canHaveChildren', checked === true)
              }
            />
            <div className="grid gap-1.5 leading-none">
              <Label htmlFor="childCanHaveChildren" className="font-medium cursor-pointer">
                Allow Child Organizations
              </Label>
              <p className="text-sm text-muted-foreground">
                This organization can create its own child organizations
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!isFormValid || isCreating}>
            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Child Organization
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
