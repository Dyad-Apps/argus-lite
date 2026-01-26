import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  Search,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
  Loader2,
  RefreshCw,
  Users,
  UserPlus,
  UserMinus,
  Download,
  MoreHorizontal,
  Eye,
  X,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { apiClient } from '@/lib/api-client';
import { EditUserDialog } from './edit-user-dialog';

interface UserCredentials {
  pin: string | null;
  rfid: string | null;
  badge: string | null;
}

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
  credentials?: UserCredentials;
}

interface UserListResponse {
  data: User[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

interface UserStats {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
}

export interface UsersListTabRef {
  refresh: () => void;
}

interface UsersListTabProps {
  onUserSelect?: (user: User) => void;
}

export const UsersListTab = forwardRef<UsersListTabRef, UsersListTabProps>(
  function UsersListTab({ onUserSelect }, ref) {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
    const [stats, setStats] = useState<UserStats>({ total: 0, active: 0, inactive: 0, suspended: 0 });
    const [visiblePins, setVisiblePins] = useState<Record<string, boolean>>({});

    const togglePinVisibility = useCallback((userId: string) => {
      setVisiblePins((prev) => ({ ...prev, [userId]: !prev[userId] }));
    }, []);

    const copyToClipboard = useCallback(async (text: string | null, label: string) => {
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        // Could add toast notification here
      } catch (err) {
        console.error(`Failed to copy ${label}:`, err);
      }
    }, []);

    const fetchUsers = useCallback(async () => {
      try {
        setIsLoading(true);
        setError(null);
        const params = new URLSearchParams({
          page: page.toString(),
          pageSize: '20',
        });
        if (statusFilter !== 'all') {
          params.append('status', statusFilter);
        }
        const response = await apiClient.get<UserListResponse>(`/users?${params}`);
        setUsers(response.data);
        setTotalPages(response.pagination.totalPages);
        setTotalCount(response.pagination.totalCount);

        // Calculate stats from full list
        const allUsers = response.data;
        setStats({
          total: response.pagination.totalCount,
          active: allUsers.filter((u) => u.status === 'active').length,
          inactive: allUsers.filter((u) => u.status === 'inactive').length,
          suspended: allUsers.filter((u) => u.status === 'suspended').length,
        });
      } catch (err) {
        console.error('Failed to fetch users:', err);
        setError('Failed to load users');
      } finally {
        setIsLoading(false);
      }
    }, [page, statusFilter]);

    useEffect(() => {
      fetchUsers();
    }, [fetchUsers]);

    useImperativeHandle(ref, () => ({
      refresh: fetchUsers,
    }));

    const handleStatusChange = async (
      userId: string,
      newStatus: 'active' | 'inactive' | 'suspended'
    ) => {
      try {
        await apiClient.patch(`/users/${userId}`, { status: newStatus });
        fetchUsers();
      } catch (err) {
        console.error('Failed to update user status:', err);
      }
    };

    const handleDeleteUser = async (userId: string) => {
      if (!confirm('Are you sure you want to delete this user?')) return;
      try {
        await apiClient.delete(`/users/${userId}`);
        fetchUsers();
      } catch (err) {
        console.error('Failed to delete user:', err);
      }
    };

    const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete') => {
      if (selectedUserIds.size === 0) return;

      const confirmMessage = {
        activate: `Activate ${selectedUserIds.size} selected user(s)?`,
        deactivate: `Deactivate ${selectedUserIds.size} selected user(s)?`,
        delete: `Delete ${selectedUserIds.size} selected user(s)? This action cannot be undone.`,
      };

      if (!confirm(confirmMessage[action])) return;

      try {
        const userIds = Array.from(selectedUserIds);
        if (action === 'delete') {
          await Promise.all(userIds.map((id) => apiClient.delete(`/users/${id}`)));
        } else {
          const status = action === 'activate' ? 'active' : 'inactive';
          await Promise.all(userIds.map((id) => apiClient.patch(`/users/${id}`, { status })));
        }
        setSelectedUserIds(new Set());
        fetchUsers();
      } catch (err) {
        console.error(`Failed to ${action} users:`, err);
      }
    };

    const handleExport = (format: 'csv' | 'xlsx') => {
      // TODO: Implement export functionality
      console.log('Exporting as:', format);
    };

    const toggleSelectAll = () => {
      if (selectedUserIds.size === filteredUsers.length) {
        setSelectedUserIds(new Set());
      } else {
        setSelectedUserIds(new Set(filteredUsers.map((u) => u.id)));
      }
    };

    const toggleSelectUser = (userId: string) => {
      const newSelection = new Set(selectedUserIds);
      if (newSelection.has(userId)) {
        newSelection.delete(userId);
      } else {
        newSelection.add(userId);
      }
      setSelectedUserIds(newSelection);
    };

    const filteredUsers = users.filter(
      (user) =>
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        (user.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    );

    const getStatusBadge = (status: User['status']) => {
      switch (status) {
        case 'active':
          return <Badge variant="default">Active</Badge>;
        case 'inactive':
          return <Badge variant="secondary">Inactive</Badge>;
        case 'suspended':
          return <Badge variant="destructive">Suspended</Badge>;
        case 'deleted':
          return <Badge variant="outline">Deleted</Badge>;
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

    const formatDate = (dateString: string | null) => {
      if (!dateString) return '-';
      return new Date(dateString).toLocaleDateString();
    };

    const getDisplayName = (user: User) => {
      if (user.firstName || user.lastName) {
        return `${user.firstName || ''} ${user.lastName || ''}`.trim();
      }
      return user.email.split('@')[0];
    };

    if (isLoading && users.length === 0) {
      return (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      );
    }

    if (error) {
      return (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-destructive">{error}</div>
            <div className="text-center mt-4">
              <Button variant="outline" onClick={fetchUsers}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-primary/10 p-3">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-green-500/10 p-3">
                  <UserCheck className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold">{stats.active}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-orange-500/10 p-3">
                  <UserPlus className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Inactive</p>
                  <p className="text-2xl font-bold">{stats.inactive}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-red-500/10 p-3">
                  <UserMinus className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Suspended</p>
                  <p className="text-2xl font-bold">{stats.suspended}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>

              {/* Bulk Actions */}
              {selectedUserIds.size > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <MoreHorizontal className="mr-2 h-4 w-4" />
                      Actions ({selectedUserIds.size})
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleBulkAction('activate')}>
                      <UserCheck className="mr-2 h-4 w-4" />
                      Activate Selected
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkAction('deactivate')}>
                      <UserX className="mr-2 h-4 w-4" />
                      Deactivate Selected
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleBulkAction('delete')}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Selected
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Download className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport('csv')}>
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('xlsx')}>
                    Export as XLSX
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="outline" size="icon" onClick={fetchUsers} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={
                        filteredUsers.length > 0 &&
                        selectedUserIds.size === filteredUsers.length
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Credentials</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow
                      key={user.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onUserSelect?.(user)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedUserIds.has(user.id)}
                          onCheckedChange={() => toggleSelectUser(user.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {getInitials(user.firstName, user.lastName, user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{getDisplayName(user)}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <TooltipProvider delayDuration={0}>
                          <div className="text-[10px] space-y-1 py-1 font-medium whitespace-nowrap">
                            {/* PIN */}
                            <div className="flex items-center gap-1.5">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 shrink-0"
                                    onClick={() => copyToClipboard(user.credentials?.pin ?? null, 'PIN')}
                                  >
                                    <Copy className="h-2.5 w-2.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copy PIN</TooltipContent>
                              </Tooltip>
                            <span className="text-muted-foreground w-8">PIN#</span>
                            <span className="font-mono text-foreground">
                              {visiblePins[user.id]
                                ? (user.credentials?.pin || '-')
                                : (user.credentials?.pin ? '••••' : '-')}
                            </span>
                            {user.credentials?.pin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4"
                                onClick={() => togglePinVisibility(user.id)}
                              >
                                {visiblePins[user.id] ? (
                                  <X className="h-2.5 w-2.5" />
                                ) : (
                                  <Eye className="h-2.5 w-2.5" />
                                )}
                              </Button>
                            )}
                          </div>
                          {/* RFID */}
                          <div className="flex items-center gap-1.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-4 w-4 shrink-0"
                                  onClick={() => copyToClipboard(user.credentials?.rfid ?? null, 'RFID')}
                                >
                                  <Copy className="h-2.5 w-2.5 text-primary" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Copy RFID</TooltipContent>
                            </Tooltip>
                            <span className="text-primary w-8">RFID</span>
                            <span className="font-mono text-foreground truncate max-w-[80px]">
                              {user.credentials?.rfid || '-'}
                            </span>
                          </div>
                          {/* Badge Code */}
                          <div className="flex items-center gap-1.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-4 w-4 shrink-0"
                                  onClick={() => copyToClipboard(user.credentials?.badge ?? null, 'Code')}
                                >
                                  <Copy className="h-2.5 w-2.5 text-orange-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Copy Code</TooltipContent>
                            </Tooltip>
                            <span className="text-orange-600 w-8">CODE</span>
                              <span className="font-mono text-foreground truncate max-w-[80px]">
                                {user.credentials?.badge || '-'}
                              </span>
                            </div>
                          </div>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>{getStatusBadge(user.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(user.lastLoginAt)}
                      </TableCell>
                      <TableCell className="text-center">
                        <TooltipProvider delayDuration={0}>
                          <div className="flex items-center justify-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingUser(user);
                                  }}
                                >
                                  <Pencil className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                            {user.status === 'active' ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStatusChange(user.id, 'inactive');
                                    }}
                                  >
                                    <UserX className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Deactivate</TooltipContent>
                              </Tooltip>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStatusChange(user.id, 'active');
                                    }}
                                  >
                                    <UserCheck className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Activate</TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteUser(user.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {filteredUsers.length} of {totalCount} users
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>

          {/* Edit User Dialog */}
          <EditUserDialog
            user={editingUser}
            open={!!editingUser}
            onOpenChange={(open) => !open && setEditingUser(null)}
            onUserUpdated={fetchUsers}
          />
        </Card>
      </div>
    );
  }
);
