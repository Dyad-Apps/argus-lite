/**
 * System Metrics Card
 * Displays CPU, Memory, Disk, and API metrics from Prometheus
 */

import { Cpu, HardDrive, MemoryStick, Activity, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { SystemMetrics } from '@/lib/dashboard-api';

interface SystemMetricsCardProps {
  data: SystemMetrics | null;
  isLoading?: boolean;
  className?: string;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '-';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

function getUsageColor(usage: number | null): string {
  if (usage === null) return 'text-muted-foreground';
  if (usage >= 90) return 'text-red-500';
  if (usage >= 75) return 'text-amber-500';
  return 'text-green-500';
}

function getProgressColor(usage: number | null): string {
  if (usage === null) return 'bg-muted';
  if (usage >= 90) return 'bg-red-500';
  if (usage >= 75) return 'bg-amber-500';
  return 'bg-green-500';
}

interface MetricGaugeProps {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  suffix?: string;
  tooltip?: string;
}

function MetricGauge({ icon, label, value, suffix = '%', tooltip }: MetricGaugeProps) {
  const displayValue = value !== null ? value.toFixed(1) : '-';
  const colorClass = getUsageColor(value);

  const content = (
    <div className="flex items-center gap-3">
      <div className={cn('p-2 rounded-lg bg-muted/50', colorClass)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className={cn('text-sm font-semibold', colorClass)}>
            {displayValue}{value !== null ? suffix : ''}
          </span>
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full transition-all duration-500', getProgressColor(value))}
            style={{ width: `${value ?? 0}%` }}
          />
        </div>
      </div>
    </div>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-help">{content}</div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

export function SystemMetricsCard({ data, isLoading, className }: SystemMetricsCardProps) {
  // Show not configured state
  if (!data?.configured) {
    return (
      <Card className={cn('h-full', className)}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium text-muted-foreground">
              System Metrics
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <div className="rounded-full bg-muted p-3 mb-3">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              Not Configured
            </p>
            <p className="text-xs text-muted-foreground max-w-[200px]">
              Prometheus monitoring not configured. Start the monitoring stack with docker compose.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show unhealthy state
  if (!data?.healthy) {
    return (
      <Card className={cn('h-full', className)}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-sm font-medium text-muted-foreground">
              System Metrics
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <div className="rounded-full bg-amber-500/10 p-3 mb-3">
              <AlertCircle className="h-5 w-5 text-amber-500" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              Prometheus Unavailable
            </p>
            <p className="text-xs text-muted-foreground max-w-[200px]">
              Unable to connect to Prometheus. Check that the monitoring stack is running.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const metrics = data.metrics;

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-green-500" />
          <CardTitle className="text-sm font-medium text-muted-foreground">
            System Metrics
          </CardTitle>
          <span className="ml-auto text-[10px] text-green-500 font-medium">LIVE</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <MetricGauge
          icon={<Cpu className="h-4 w-4" />}
          label="CPU"
          value={metrics?.cpu.usage ?? null}
          tooltip={metrics?.cpu.cores ? `${metrics.cpu.cores} cores` : undefined}
        />
        <MetricGauge
          icon={<MemoryStick className="h-4 w-4" />}
          label="Memory"
          value={metrics?.memory.usage ?? null}
          tooltip={
            metrics?.memory.totalBytes
              ? `${formatBytes(metrics.memory.usedBytes)} / ${formatBytes(metrics.memory.totalBytes)}`
              : undefined
          }
        />
        <MetricGauge
          icon={<HardDrive className="h-4 w-4" />}
          label="Disk"
          value={metrics?.disk.usage ?? null}
          tooltip={
            metrics?.disk.totalBytes
              ? `${formatBytes(metrics.disk.usedBytes)} / ${formatBytes(metrics.disk.totalBytes)}`
              : undefined
          }
        />

        {/* API Metrics */}
        <div className="pt-2 border-t">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">Req/s</p>
              <p className="text-sm font-semibold">
                {metrics?.api.requestRate?.toFixed(1) ?? '-'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">Errors</p>
              <p className={cn(
                'text-sm font-semibold',
                (metrics?.api.errorRate ?? 0) > 5 ? 'text-red-500' : 'text-green-500'
              )}>
                {metrics?.api.errorRate?.toFixed(1) ?? '-'}%
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">Latency</p>
              <p className={cn(
                'text-sm font-semibold',
                (metrics?.api.avgLatencyMs ?? 0) > 500 ? 'text-amber-500' : 'text-foreground'
              )}>
                {metrics?.api.avgLatencyMs?.toFixed(0) ?? '-'}ms
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
