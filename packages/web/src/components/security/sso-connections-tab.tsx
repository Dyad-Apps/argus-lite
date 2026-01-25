import { useState, useEffect, useCallback } from 'react';
import {
  Key,
  Search,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  Building2,
  TestTube,
  Check,
  X,
  ExternalLink,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { apiClient } from '@/lib/api-client';

interface Organization {
  id: string;
  name: string;
  slug: string;
  orgCode: string;
}

interface SsoConnection {
  id: string;
  organizationId: string | null;
  type: 'oidc' | 'saml' | 'google' | 'microsoft' | 'github' | 'okta';
  name: string;
  displayName: string | null;
  allowedDomains: string[] | null;
  enabled: boolean;
  autoCreateUsers: boolean;
  autoLinkUsers: boolean;
  linkedUsersCount: number;
  createdAt: string;
  updatedAt: string;
}

interface SsoConnectionListResponse {
  data: SsoConnection[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

interface OrganizationListResponse {
  data: Organization[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

interface TestResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

const PROVIDER_TYPES = [
  { value: 'google', label: 'Google', icon: '🔵' },
  { value: 'github', label: 'GitHub', icon: '⚫' },
  { value: 'microsoft', label: 'Microsoft / Azure AD', icon: '🟦' },
  { value: 'okta', label: 'Okta', icon: '🟠' },
  { value: 'oidc', label: 'Generic OIDC', icon: '🔐' },
  { value: 'saml', label: 'SAML 2.0', icon: '🔒' },
];

export function SsoConnectionsTab() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [connections, setConnections] = useState<SsoConnection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Create dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newConnectionType, setNewConnectionType] = useState<string>('');
  const [newConnectionName, setNewConnectionName] = useState('');
  const [newConnectionClientId, setNewConnectionClientId] = useState('');
  const [newConnectionClientSecret, setNewConnectionClientSecret] = useState('');
  const [newConnectionIssuer, setNewConnectionIssuer] = useState('');
  const [newConnectionEnabled, setNewConnectionEnabled] = useState(true);
  const [newConnectionAutoCreate, setNewConnectionAutoCreate] = useState(false);
  const [newConnectionAutoLink, setNewConnectionAutoLink] = useState(true);

  // Test dialog state
  const [testingConnectionId, setTestingConnectionId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // Fetch organizations
  useEffect(() => {
    async function fetchOrganizations() {
      try {
        setIsLoadingOrgs(true);
        const response = await apiClient.get<OrganizationListResponse>(
          '/organizations?pageSize=100'
        );
        setOrganizations(response.data);
        if (response.data.length > 0 && !selectedOrgId) {
          setSelectedOrgId(response.data[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch organizations:', err);
      } finally {
        setIsLoadingOrgs(false);
      }
    }
    fetchOrganizations();
  }, []);

  const fetchConnections = useCallback(async () => {
    if (!selectedOrgId) return;

    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.get<SsoConnectionListResponse>(
        `/organizations/${selectedOrgId}/sso-connections?pageSize=100`
      );
      setConnections(response.data);
    } catch (err) {
      console.error('Failed to fetch SSO connections:', err);
      setError('Failed to load SSO connections');
    } finally {
      setIsLoading(false);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    if (selectedOrgId) {
      fetchConnections();
    }
  }, [selectedOrgId, fetchConnections]);

  const handleCreateConnection = async () => {
    if (!selectedOrgId || !newConnectionType || !newConnectionName.trim()) return;

    try {
      setIsCreating(true);

      // Build config based on provider type
      let config: Record<string, unknown> = {};
      if (['google', 'github', 'microsoft'].includes(newConnectionType)) {
        config = {
          clientId: newConnectionClientId,
          clientSecret: newConnectionClientSecret,
        };
      } else if (['oidc', 'okta'].includes(newConnectionType)) {
        config = {
          issuer: newConnectionIssuer,
          clientId: newConnectionClientId,
          clientSecret: newConnectionClientSecret,
        };
      }

      await apiClient.post(`/organizations/${selectedOrgId}/sso-connections`, {
        type: newConnectionType,
        name: newConnectionName.trim(),
        config,
        enabled: newConnectionEnabled,
        autoCreateUsers: newConnectionAutoCreate,
        autoLinkUsers: newConnectionAutoLink,
      });

      setIsCreateDialogOpen(false);
      resetCreateForm();
      fetchConnections();
    } catch (err) {
      console.error('Failed to create SSO connection:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const resetCreateForm = () => {
    setNewConnectionType('');
    setNewConnectionName('');
    setNewConnectionClientId('');
    setNewConnectionClientSecret('');
    setNewConnectionIssuer('');
    setNewConnectionEnabled(true);
    setNewConnectionAutoCreate(false);
    setNewConnectionAutoLink(true);
  };

  const handleDeleteConnection = async (connectionId: string) => {
    if (!selectedOrgId) return;
    if (!confirm('Are you sure you want to delete this SSO connection?')) return;

    try {
      await apiClient.delete(
        `/organizations/${selectedOrgId}/sso-connections/${connectionId}`
      );
      fetchConnections();
    } catch (err: any) {
      if (err?.data?.error?.message?.includes('linked users')) {
        if (confirm('This connection has linked users. Force delete will unlink all users. Continue?')) {
          await apiClient.delete(
            `/organizations/${selectedOrgId}/sso-connections/${connectionId}?force=true`
          );
          fetchConnections();
        }
      } else {
        console.error('Failed to delete SSO connection:', err);
      }
    }
  };

  const handleTestConnection = async (connectionId: string) => {
    if (!selectedOrgId) return;

    setTestingConnectionId(connectionId);
    setTestResult(null);

    try {
      const result = await apiClient.post<TestResult>(
        `/organizations/${selectedOrgId}/sso-connections/${connectionId}/test`
      );
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Test failed',
      });
    }
  };

  const handleToggleEnabled = async (connection: SsoConnection) => {
    if (!selectedOrgId) return;

    try {
      await apiClient.patch(
        `/organizations/${selectedOrgId}/sso-connections/${connection.id}`,
        { enabled: !connection.enabled }
      );
      fetchConnections();
    } catch (err) {
      console.error('Failed to toggle SSO connection:', err);
    }
  };

  const filteredConnections = connections.filter(
    (conn) =>
      conn.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conn.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getProviderIcon = (type: string) => {
    return PROVIDER_TYPES.find((p) => p.value === type)?.icon || '🔐';
  };

  const getProviderLabel = (type: string) => {
    return PROVIDER_TYPES.find((p) => p.value === type)?.label || type.toUpperCase();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoadingOrgs) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (organizations.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            No organizations found. Create an organization first to manage SSO connections.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Organization Selector */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <Label>Organization</Label>
              </div>
              <Select value={selectedOrgId || ''} onValueChange={setSelectedOrgId}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name} ({org.orgCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={!selectedOrgId}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add SSO Connection
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add SSO Connection</DialogTitle>
                  <DialogDescription>
                    Configure a new Single Sign-On provider for this organization.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                  <div className="space-y-2">
                    <Label htmlFor="type">Provider Type</Label>
                    <Select value={newConnectionType} onValueChange={setNewConnectionType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider type" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVIDER_TYPES.map((provider) => (
                          <SelectItem key={provider.value} value={provider.value}>
                            {provider.icon} {provider.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Connection Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Corporate SSO"
                      value={newConnectionName}
                      onChange={(e) => setNewConnectionName(e.target.value)}
                    />
                  </div>

                  {newConnectionType && (
                    <>
                      {['oidc', 'okta'].includes(newConnectionType) && (
                        <div className="space-y-2">
                          <Label htmlFor="issuer">Issuer URL</Label>
                          <Input
                            id="issuer"
                            placeholder="https://your-domain.okta.com"
                            value={newConnectionIssuer}
                            onChange={(e) => setNewConnectionIssuer(e.target.value)}
                          />
                        </div>
                      )}

                      {['google', 'github', 'microsoft', 'oidc', 'okta'].includes(newConnectionType) && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="clientId">Client ID</Label>
                            <Input
                              id="clientId"
                              placeholder="Enter client ID"
                              value={newConnectionClientId}
                              onChange={(e) => setNewConnectionClientId(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="clientSecret">Client Secret</Label>
                            <Input
                              id="clientSecret"
                              type="password"
                              placeholder="Enter client secret"
                              value={newConnectionClientSecret}
                              onChange={(e) => setNewConnectionClientSecret(e.target.value)}
                            />
                          </div>
                        </>
                      )}

                      <div className="space-y-4 pt-4 border-t">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Enabled</Label>
                            <p className="text-xs text-muted-foreground">
                              Allow users to sign in with this provider
                            </p>
                          </div>
                          <Switch
                            checked={newConnectionEnabled}
                            onCheckedChange={setNewConnectionEnabled}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Auto-create Users</Label>
                            <p className="text-xs text-muted-foreground">
                              Automatically create new users on first login
                            </p>
                          </div>
                          <Switch
                            checked={newConnectionAutoCreate}
                            onCheckedChange={setNewConnectionAutoCreate}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Auto-link Users</Label>
                            <p className="text-xs text-muted-foreground">
                              Link to existing users by email match
                            </p>
                          </div>
                          <Switch
                            checked={newConnectionAutoLink}
                            onCheckedChange={setNewConnectionAutoLink}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreateDialogOpen(false);
                      resetCreateForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateConnection}
                    disabled={!newConnectionType || !newConnectionName.trim() || isCreating}
                  >
                    {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Connection
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* SSO Connections List */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search SSO connections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchConnections}
              disabled={isLoading || !selectedOrgId}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && connections.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center text-destructive py-8">{error}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Linked Users</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConnections.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      {connections.length === 0
                        ? 'No SSO connections configured. Add your first connection to enable single sign-on.'
                        : 'No connections match your search.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredConnections.map((connection) => (
                    <TableRow key={connection.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-lg">
                            {getProviderIcon(connection.type)}
                          </div>
                          <span className="font-medium">
                            {getProviderLabel(connection.type)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{connection.name}</div>
                          {connection.displayName && (
                            <div className="text-sm text-muted-foreground">
                              {connection.displayName}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={connection.enabled}
                            onCheckedChange={() => handleToggleEnabled(connection)}
                          />
                          <Badge variant={connection.enabled ? 'default' : 'secondary'}>
                            {connection.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{connection.linkedUsersCount}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(connection.createdAt)}
                      </TableCell>
                      <TableCell className="text-center">
                        <TooltipProvider delayDuration={0}>
                          <div className="flex items-center justify-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleTestConnection(connection.id)}
                                >
                                  {testingConnectionId === connection.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : testResult && testingConnectionId === connection.id ? (
                                    testResult.success ? (
                                      <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <X className="h-4 w-4 text-destructive" />
                                    )
                                  ) : (
                                    <TestTube className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {testResult && testingConnectionId === connection.id
                                  ? testResult.message
                                  : 'Test Connection'}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Pencil className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteConnection(connection.id)}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
