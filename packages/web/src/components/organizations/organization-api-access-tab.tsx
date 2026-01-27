import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Key } from 'lucide-react';

export function OrganizationAPIAccessTab() {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        API Access
                    </CardTitle>
                    <CardDescription>
                        Manage API keys and access tokens for this organization.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="rounded-full bg-muted p-4 mb-4">
                        <Key className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">API Keys</h3>
                    <p className="text-muted-foreground max-w-md mb-6">
                        Generate and manage API keys for programmatic access to the Argus IQ platform.
                    </p>
                    <Button disabled>Generate Key (Coming Soon)</Button>
                </CardContent>
            </Card>
        </div>
    );
}
