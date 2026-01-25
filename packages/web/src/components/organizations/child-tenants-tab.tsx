import { useState, useEffect, useCallback } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Building2,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  RefreshCw,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CreateChildDialog } from './create-child-dialog';
import { DeleteTenantDialog } from './delete-tenant-dialog';

interface Organization {
  id: string;
  name: string;
  orgCode: string;
  slug: string;
  description?: string;
  isActive: boolean;
  isRoot: boolean;
  canHaveChildren: boolean;
  depth: number;
  createdAt: string;
}

interface ChildTenantsTabProps {
  organization: Organization;
  onChildCreated: () => void;
}

export function ChildTenantsTab({ organization, onChildCreated }: ChildTenantsTabProps) {
  const [children, setChildren] = useState<Organization[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Organization | null>(null);

  const fetchChildren = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.get<{ data: Organization[] }>(
        `/organizations/${organization.id}/children`
      );
      setChildren(response.data || []);
    } catch (err) {
      console.error('Failed to fetch child organizations:', err);
      setError('Failed to load child organizations');
    } finally {
      setIsLoading(false);
    }
  }, [organization.id]);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  const filteredChildren = children.filter(
    (child) =>
      child.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      child.orgCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleChildCreated = () => {
    setIsCreateDialogOpen(false);
    fetchChildren();
    onChildCreated();
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;

    try {
      await apiClient.delete(`/organizations/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchChildren();
      onChildCreated();
    } catch (err) {
      console.error('Failed to delete organization:', err);
      setError('Failed to delete organization');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search child organizations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={fetchChildren}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Child
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive text-sm mb-4">
              {error}
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Depth</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Can Have Children</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading child organizations...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredChildren.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {searchQuery
                      ? 'No child organizations match your search'
                      : 'No child organizations yet'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredChildren.map((child) => (
                  <TableRow key={child.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{child.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {child.slug}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm">{child.orgCode}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">Level {child.depth}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={child.isActive ? 'default' : 'secondary'}>
                        {child.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={child.canHaveChildren ? 'default' : 'outline'}>
                        {child.canHaveChildren ? 'Yes' : 'No'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to="/organizations/$orgId" params={{ orgId: child.id }}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/organizations/$orgId" params={{ orgId: child.id }}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteTarget(child)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Child Dialog */}
      <CreateChildDialog
        parentOrganization={organization}
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreated={handleChildCreated}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteTenantDialog
        organization={deleteTarget}
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}
