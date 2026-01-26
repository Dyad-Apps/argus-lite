import { createFileRoute } from '@tanstack/react-router';
import { Shield, Key, Users2, Smartphone } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  SecurityGeneralTab,
  SsoConnectionsTab,
  ImpersonationTab,
  TwoFactorTab,
} from '@/components/security';

export const Route = createFileRoute('/security')({
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary">Security</h1>
        <p className="text-muted-foreground">
          Manage security policies, access controls, and authentication methods.
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">
            <Shield className="mr-2 h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="sso">
            <Key className="mr-2 h-4 w-4" />
            SysAdmin SSO
          </TabsTrigger>
          <TabsTrigger value="impersonation">
            <Users2 className="mr-2 h-4 w-4" />
            Impersonation Sessions
          </TabsTrigger>
          <TabsTrigger value="2fa">
            <Smartphone className="mr-2 h-4 w-4" />
            Two-Factor Auth
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <SecurityGeneralTab />
        </TabsContent>

        <TabsContent value="sso">
          <SsoConnectionsTab />
        </TabsContent>

        <TabsContent value="impersonation">
          <ImpersonationTab />
        </TabsContent>

        <TabsContent value="2fa">
          <TwoFactorTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
