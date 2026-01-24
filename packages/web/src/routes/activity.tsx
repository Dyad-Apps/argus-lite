import { createFileRoute } from '@tanstack/react-router';
import { Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const Route = createFileRoute('/activity')({
  component: ActivityPage,
});

function ActivityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity Log</h1>
        <p className="text-muted-foreground">
          View system activity and audit logs
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-muted-foreground">System initialized</span>
              <span className="ml-auto text-xs text-muted-foreground">
                Just now
              </span>
            </div>
            <div className="text-center py-8 text-sm text-muted-foreground">
              Activity log will appear here as actions are performed.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
