/**
 * System Load Chart
 * Displays historical CPU, Memory, and Request Rate data from Prometheus
 */

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Activity, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SystemLoadResponse } from '@/lib/dashboard-api';

interface SystemLoadChartProps {
  data: SystemLoadResponse | null;
  isLoading?: boolean;
  onRangeChange?: (range: number) => void;
  className?: string;
}

const RANGE_OPTIONS = [
  { label: '15m', value: 15 },
  { label: '1h', value: 60 },
  { label: '6h', value: 360 },
  { label: '24h', value: 1440 },
];

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: number;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !label) return null;

  return (
    <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
      <p className="text-muted-foreground mb-2">
        {new Date(label * 1000).toLocaleString()}
      </p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">
            {entry.dataKey === 'requestRate'
              ? `${entry.value?.toFixed(2)}/s`
              : `${entry.value?.toFixed(1)}%`}
          </span>
        </div>
      ))}
    </div>
  );
}

export function SystemLoadChart({
  data,
  isLoading,
  onRangeChange,
  className,
}: SystemLoadChartProps) {
  const [selectedRange, setSelectedRange] = useState(60);

  const handleRangeChange = (range: number) => {
    setSelectedRange(range);
    onRangeChange?.(range);
  };

  // Show not configured state
  if (!data?.configured) {
    return (
      <Card className={cn('h-full', className)}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium text-muted-foreground">
              System Load
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[180px] text-center">
            <div className="rounded-full bg-muted p-3 mb-3">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              Not Configured
            </p>
            <p className="text-xs text-muted-foreground max-w-[200px]">
              Prometheus monitoring not configured
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show empty state if no data
  if (!data.data || data.data.length === 0) {
    return (
      <Card className={cn('h-full', className)}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-sm font-medium text-muted-foreground">
                System Load
              </CardTitle>
            </div>
            <div className="flex gap-1">
              {RANGE_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={selectedRange === option.value ? 'default' : 'ghost'}
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => handleRangeChange(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[180px] text-center">
            <p className="text-sm text-muted-foreground">
              No data available yet. Metrics will appear after the system has been running.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-green-500" />
            <CardTitle className="text-sm font-medium text-muted-foreground">
              System Load
            </CardTitle>
            <span className="text-[10px] text-green-500 font-medium">LIVE</span>
          </div>
          <div className="flex gap-1">
            {RANGE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={selectedRange === option.value ? 'default' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => handleRangeChange(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data.data}
              margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatTimestamp}
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '10px' }}
                iconType="circle"
                iconSize={8}
              />
              <Line
                type="monotone"
                dataKey="cpu"
                name="CPU"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="memory"
                name="Memory"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
