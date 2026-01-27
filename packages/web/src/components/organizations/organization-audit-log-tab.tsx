import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface AuditLog {
    id: string;
    action: string;
    category: string;
    userEmail: string | null;
    outcome: string;
    createdAt: string;
    details?: Record<string, unknown>;
}

interface OrganizationAuditLogTabProps {
    organizationId: string;
}

export function OrganizationAuditLogTab({ organizationId }: OrganizationAuditLogTabProps) {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchLogs() {
            try {
                setIsLoading(true);
                const response = await apiClient.get<{ data: AuditLog[] }>(
                    `/audit-logs?organizationId=${organizationId}&pageSize=20`
                );
                setLogs(response.data);
            } catch (err) {
                console.error('Failed to fetch audit logs:', err);
            } finally {
                setIsLoading(false);
            }
        }

        if (organizationId) {
            fetchLogs();
        }
    }, [organizationId]);

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Audit Log</CardTitle>
            </CardHeader>
            <CardContent>
                {logs.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                        No audit logs found for this organization.
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Time</TableHead>
                                <TableHead>User</TableHead>
                                <TableHead>Action</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Outcome</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell className="whitespace-nowrap text-muted-foreground">
                                        {new Date(log.createdAt).toLocaleString()}
                                    </TableCell>
                                    <TableCell>{log.userEmail || 'System'}</TableCell>
                                    <TableCell className="font-medium">{log.action}</TableCell>
                                    <TableCell>{log.category}</TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={
                                                log.outcome === 'success'
                                                    ? 'default'
                                                    : log.outcome === 'failure'
                                                        ? 'destructive'
                                                        : 'secondary'
                                            }
                                            className={
                                                log.outcome === 'success'
                                                    ? 'bg-green-100 text-green-800 hover:bg-green-200 border-green-200'
                                                    : ''
                                            }
                                        >
                                            {log.outcome}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}
