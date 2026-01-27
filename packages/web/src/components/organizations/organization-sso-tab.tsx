import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield } from 'lucide-react';

export function OrganizationSSOTab() {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5" />
                                Single Sign-On (SSO)
                            </CardTitle>
                            <CardDescription>
                                Configure SAML or OIDC authentication for this organization.
                            </CardDescription>
                        </div>
                        <Badge variant="outline">Enterprise Feature</Badge>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="rounded-full bg-muted p-4 mb-4">
                        <Shield className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">SSO Configuration</h3>
                    <p className="text-muted-foreground max-w-md mb-6">
                        Connect your identity provider (azure AD, Okta, Google Workspace) to enable Single Sign-On for your users.
                    </p>
                    <Button disabled>Configure Provider (Coming Soon)</Button>
                </CardContent>
            </Card>
        </div>
    );
}
