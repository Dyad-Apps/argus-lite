/**
 * IoT Settings Tab
 *
 * Manages IoT integration configuration including ChirpStack MQTT settings.
 */

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Save, RefreshCw, Radio, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SystemSetting {
  id: string;
  category: string;
  key: string;
  value: Record<string, unknown>;
  description: string | null;
  isPublic: boolean;
  updatedBy: string | null;
  updatedAt: string;
  createdAt: string;
}

interface ChirpStackIntegrationConfig {
  enabled: boolean;
  topicPattern: string;
  description?: string;
}

export function IotSettingsTab() {
  const [config, setConfig] = useState<ChirpStackIntegrationConfig>({
    enabled: true,
    topicPattern: 'application/+/device/+/event/up',
    description: 'ChirpStack MQTT integration for LoRa devices',
  });
  const [originalConfig, setOriginalConfig] = useState<ChirpStackIntegrationConfig>({
    enabled: true,
    topicPattern: 'application/+/device/+/event/up',
    description: 'ChirpStack MQTT integration for LoRa devices',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.get<SystemSetting>(
        '/admin/system-settings/iot/chirpstack_integration'
      );

      const chirpStackConfig = response.value as ChirpStackIntegrationConfig;
      setConfig(chirpStackConfig);
      setOriginalConfig(chirpStackConfig);
      setLastUpdated(response.updatedAt);
    } catch (err: any) {
      if (err?.status === 403) {
        setError('Access denied. System Admin privileges required.');
      } else if (err?.status === 404) {
        // Setting doesn't exist yet, use defaults
        setConfig(originalConfig);
      } else {
        setError('Failed to load IoT settings');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      await apiClient.put(
        '/admin/system-settings/iot/chirpstack_integration',
        {
          value: {
            enabled: config.enabled,
            topicPattern: config.topicPattern,
            description: config.description,
          },
          description: 'ChirpStack MQTT Integration Configuration',
        }
      );

      setOriginalConfig(config);
      await fetchSettings(); // Refresh to get updated timestamp
    } catch (err: any) {
      if (err?.status === 403) {
        setError('Access denied. System Admin privileges required.');
      } else {
        setError('Failed to save IoT settings');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = JSON.stringify(config) !== JSON.stringify(originalConfig);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && error.includes('Access denied')) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md">
          {error}
        </div>
      )}

      {/* ChirpStack Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            ChirpStack LoRa Integration
          </CardTitle>
          <CardDescription>
            Configure MQTT integration for ChirpStack LoRaWAN Network Server.
            {lastUpdated && (
              <span className="block mt-1 text-xs">
                Last updated: {new Date(lastUpdated).toLocaleString()}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Integration */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Enable ChirpStack Integration</Label>
              <p className="text-sm text-muted-foreground">
                Process incoming LoRa device telemetry from ChirpStack MQTT broker
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(checked) =>
                setConfig({ ...config, enabled: checked })
              }
            />
          </div>

          {/* Topic Pattern */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="topicPattern">MQTT Topic Pattern</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <div className="space-y-2">
                      <p className="font-semibold">MQTT Wildcards:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li><code>+</code> - Single level wildcard (e.g., application/+/device)</li>
                        <li><code>#</code> - Multi-level wildcard (e.g., application/#)</li>
                      </ul>
                      <p className="text-sm mt-2">
                        <strong>Examples:</strong>
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li><code>application/+/device/+/event/up</code> (ChirpStack v3)</li>
                        <li><code>chirpstack/+/devices/+/up</code> (Custom)</li>
                        <li><code>v3/+/devices/+/rx</code> (Custom)</li>
                      </ul>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              id="topicPattern"
              placeholder="application/+/device/+/event/up"
              value={config.topicPattern}
              onChange={(e) =>
                setConfig({ ...config, topicPattern: e.target.value })
              }
              disabled={!config.enabled}
            />
            <p className="text-xs text-muted-foreground">
              MQTT topic pattern to subscribe to for ChirpStack uplink messages. Supports wildcards: + (single level), # (multi-level)
            </p>
          </div>

          {/* Description/Notes */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              placeholder="Additional notes about this integration"
              value={config.description || ''}
              onChange={(e) =>
                setConfig({ ...config, description: e.target.value })
              }
              disabled={!config.enabled}
            />
          </div>

          {/* Configuration Status */}
          <div className="rounded-md bg-muted p-4">
            <h4 className="text-sm font-medium mb-2">Current Configuration</h4>
            <div className="space-y-1 text-sm text-muted-foreground font-mono">
              <div className="flex justify-between">
                <span>Status:</span>
                <span className={config.enabled ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
                  {config.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Topic:</span>
                <span className="text-foreground">{config.topicPattern}</span>
              </div>
            </div>
          </div>

          {/* Important Notes */}
          <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-4">
            <h4 className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
              Important Notes
            </h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-amber-900 dark:text-amber-200">
              <li>Changes require restarting the IoT Bridge service to take effect</li>
              <li>Ensure your MQTT broker is configured to accept connections from the IoT Bridge</li>
              <li>LoRa devices must be registered in the ArgusIQ platform with protocol='lorawan'</li>
              <li>The IoT Bridge will automatically decode ChirpStack payloads and store telemetry</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={fetchSettings}
          disabled={isSaving}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Reset
        </Button>
        <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
