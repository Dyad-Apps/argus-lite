import { createFileRoute, useSearch, useNavigate } from '@tanstack/react-router';
import { Shield, Mail, Bell, Radio } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GeneralSettingsTab, MailServerTab, NotificationSettingsTab, IotSettingsTab } from '@/components/settings';

type SettingsTab = 'general' | 'mail' | 'notifications' | 'iot';

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
  validateSearch: (search: Record<string, unknown>): { tab?: SettingsTab } => ({
    tab: (search.tab as SettingsTab) || 'general',
  }),
});

function SettingsPage() {
  const { tab = 'general' } = useSearch({ from: '/settings' });
  const navigate = useNavigate();

  const handleTabChange = (value: string) => {
    navigate({
      to: '/settings',
      search: { tab: value as SettingsTab },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary">
          Platform Settings
        </h1>
        <p className="text-muted-foreground">
          Configure platform-wide settings and preferences
        </p>
      </div>

      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-4 lg:w-[500px]">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="mail" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Mail Server
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="iot" className="flex items-center gap-2">
            <Radio className="h-4 w-4" />
            IoT
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <GeneralSettingsTab />
        </TabsContent>

        <TabsContent value="mail" className="mt-6">
          <MailServerTab />
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <NotificationSettingsTab />
        </TabsContent>

        <TabsContent value="iot" className="mt-6">
          <IotSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
