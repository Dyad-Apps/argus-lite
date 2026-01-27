import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { useImpersonation } from '@/contexts/impersonation-context';

interface User {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
}

interface StartImpersonationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    organizationId?: string; // Optional: restrict to users of this org
}

export function StartImpersonationDialog({
    open,
    onOpenChange,
    organizationId,
}: StartImpersonationDialogProps) {
    const impersonation = useImpersonation();
    const [isStarting, setIsStarting] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [reason, setReason] = useState('');
    const [duration, setDuration] = useState('60');

    useEffect(() => {
        if (open) {
            fetchUsers();
        } else {
            // Reset state on close
            setSelectedUserId('');
            setReason('');
            setDuration('60');
        }
    }, [open, organizationId]);

    const fetchUsers = async () => {
        try {
            setIsLoadingUsers(true);
            const params = new URLSearchParams();
            params.append('pageSize', '100');
            if (organizationId) {
                params.append('organizationId', organizationId);
            }

            const response = await apiClient.get<{ data: User[] }>(`/users?${params.toString()}`);
            setUsers(response.data);
        } catch (err) {
            console.error('Failed to fetch users:', err);
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const handleStartImpersonation = async () => {
        if (!selectedUserId || !reason.trim()) return;

        try {
            setIsStarting(true);
            const response = await apiClient.post<{
                sessionId: string;
                accessToken: string;
                expiresAt: string;
                targetUser: User;
            }>('/admin/impersonate/start', {
                targetUserId: selectedUserId,
                organizationId: organizationId, // Start session in context of this org if provided
                reason: reason.trim(),
                durationMinutes: parseInt(duration),
            });

            // Use the context to handle token swap and state management
            impersonation.startImpersonation(
                response.sessionId,
                response.accessToken,
                {
                    id: response.targetUser.id,
                    email: response.targetUser.email,
                    name: response.targetUser.firstName
                        ? `${response.targetUser.firstName} ${response.targetUser.lastName || ''}`.trim()
                        : undefined,
                }
            );

            onOpenChange(false);

            // Reload is handled by the context or should be done after state update
            window.location.reload();
        } catch (err: any) {
            console.error('Failed to start impersonation:', err);
            // In a real app, use a proper toast notification here
            alert(err?.data?.error?.message || 'Failed to start impersonation');
        } finally {
            setIsStarting(false);
        }
    };

    const getUserDisplay = (user: User) => {
        if (user.firstName || user.lastName) {
            return `${user.firstName || ''} ${user.lastName || ''}`.trim();
        }
        return user.email.split('@')[0];
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Start Impersonation</DialogTitle>
                    <DialogDescription>
                        Select a user to impersonate and provide a reason for the audit log.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="user">Target User</Label>
                        {isLoadingUsers ? (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                        ) : (
                            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a user to impersonate" />
                                </SelectTrigger>
                                <SelectContent>
                                    {users.length === 0 ? (
                                        <div className="p-2 text-sm text-muted-foreground text-center">No users found</div>
                                    ) : (
                                        users.map((user) => (
                                            <SelectItem key={user.id} value={user.id}>
                                                {getUserDisplay(user)} ({user.email})
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="reason">Reason (Required)</Label>
                        <Textarea
                            id="reason"
                            placeholder="Describe why you need to impersonate this user (min 10 characters)"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                        />
                        <p className="text-xs text-muted-foreground">
                            This will be recorded in the audit log.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="duration">Duration</Label>
                        <Select value={duration} onValueChange={setDuration}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="15">15 minutes</SelectItem>
                                <SelectItem value="30">30 minutes</SelectItem>
                                <SelectItem value="60">1 hour</SelectItem>
                                <SelectItem value="120">2 hours</SelectItem>
                                <SelectItem value="240">4 hours</SelectItem>
                                <SelectItem value="480">8 hours</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleStartImpersonation}
                        disabled={!selectedUserId || reason.trim().length < 10 || isStarting}
                    >
                        {isStarting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Start Impersonation
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
