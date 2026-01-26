import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Mail,
  Phone,
  Calendar,
  Clock,
  Shield,
  Pencil,
  UserX,
  UserCheck,
} from 'lucide-react';

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
}

interface UserProfileCardProps {
  user: User;
  onEdit?: () => void;
  onStatusChange?: (status: 'active' | 'inactive' | 'suspended') => void;
}

export function UserProfileCard({ user, onEdit, onStatusChange }: UserProfileCardProps) {
  const getInitials = () => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user.firstName) {
      return user.firstName.slice(0, 2).toUpperCase();
    }
    return user.email.slice(0, 2).toUpperCase();
  };

  const getDisplayName = () => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email.split('@')[0];
  };

  const getStatusBadge = () => {
    switch (user.status) {
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Profile</CardTitle>
        <div className="flex gap-2">
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          {onStatusChange && (
            <>
              {user.status === 'active' ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onStatusChange('inactive')}
                >
                  <UserX className="mr-2 h-4 w-4" />
                  Deactivate
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onStatusChange('active')}
                >
                  <UserCheck className="mr-2 h-4 w-4" />
                  Activate
                </Button>
              )}
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-6">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="bg-primary/10 text-primary text-2xl">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">{getDisplayName()}</h2>
                {getStatusBadge()}
              </div>
              <p className="text-muted-foreground">{user.email}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Email:</span>
                <span>
                  {user.emailVerifiedAt ? (
                    <Badge variant="outline" className="text-green-600">
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-orange-500">
                      Not Verified
                    </Badge>
                  )}
                </span>
              </div>

              {user.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Phone:</span>
                  <span>{user.phone}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Created:</span>
                <span>{formatDate(user.createdAt)}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Last Login:</span>
                <span>{formatDate(user.lastLoginAt)}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Email Verified:</span>
                <span>{user.emailVerifiedAt ? formatDate(user.emailVerifiedAt) : 'Not yet'}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
