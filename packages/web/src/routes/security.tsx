import { createFileRoute } from '@tanstack/react-router';
import { Shield, Key, Users2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SsoConnectionsTab, ImpersonationTab } from '@/components/security';

export const Route = createFileRoute('/security')({
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary">Security</h1>
        <p className="text-muted-foreground">
          Manage SSO connections, impersonation, and security settings
        </p>
      </div>

      <Tabs defaultValue="sso" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sso">
            <Key className="mr-2 h-4 w-4" />
            SSO Connections
          </TabsTrigger>
          <TabsTrigger value="impersonation">
            <Users2 className="mr-2 h-4 w-4" />
            Impersonation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sso">
          <SsoConnectionsTab />
        </TabsContent>

        <TabsContent value="impersonation">
          <ImpersonationTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
