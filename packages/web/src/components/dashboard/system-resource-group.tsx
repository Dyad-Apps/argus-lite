import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { SystemMetrics } from "@/lib/dashboard-api";

interface ResourceCardProps {
    title: string;
    usagePercent: number | null;
    details: string;
    status?: 'healthy' | 'warning' | 'critical';
    className?: string;
}

const SingleResourceCard: React.FC<ResourceCardProps> = ({
    title,
    usagePercent,
    details,
    status = 'healthy',
    className
}) => {
    const percent = usagePercent || 0;

    return (
        <Card className={cn("flex-1", className)}>
            <CardContent className="p-4 relative overflow-hidden flex flex-col justify-center h-full">
                <div className="absolute right-3 top-3">
                    {status === 'healthy' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : status === 'warning' ? (
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                    ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                    )}
                </div>
                <div className="space-y-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</span>
                    <div>
                        <div className="flex items-baseline gap-2 mb-1.5">
                            <span className="text-xl font-bold">{percent === null ? '-' : `${percent.toFixed(1)}%`}</span>
                            <span className="text-[10px] text-muted-foreground border-l pl-2 border-border/50">
                                {details}
                            </span>
                        </div>
                        <Progress value={percent} className={cn("h-1", status === 'critical' ? "bg-red-100 [&>div]:bg-red-500" : "")} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

interface SystemResourceGroupProps {
    data: SystemMetrics | null;
}

export const SystemResourceGroup = ({ data }: SystemResourceGroupProps) => {
    if (!data?.metrics) {
        return (
            <div className="flex flex-col gap-3 h-full">
                <div className="flex-1 flex gap-3">
                    <SingleResourceCard title="CPU" usagePercent={0} details="Loading..." status="healthy" />
                    <SingleResourceCard title="RAM" usagePercent={0} details="Loading..." status="healthy" />
                </div>
                <div className="flex-1">
                    <SingleResourceCard title="Disk Storage" usagePercent={0} details="Loading..." status="healthy" />
                </div>
            </div>
        );
    }

    const { cpu, memory, disk } = data.metrics;

    const determineStatus = (usage: number | null): 'healthy' | 'warning' | 'critical' => {
        if (!usage) return 'healthy';
        if (usage > 90) return 'critical';
        if (usage > 75) return 'warning';
        return 'healthy';
    };

    const formatBytes = (bytes: number | null) => {
        if (!bytes) return '-';
        const gb = bytes / (1024 * 1024 * 1024);
        return `${gb.toFixed(1)} GB`;
    };

    return (
        <div className="flex flex-col gap-3 h-full">
            <div className="flex-1 flex gap-3">
                <SingleResourceCard
                    title="CPU"
                    usagePercent={cpu.usage}
                    details={`${cpu.cores || '-'} cores`}
                    status={determineStatus(cpu.usage)}
                />
                <SingleResourceCard
                    title="RAM"
                    usagePercent={memory.usage}
                    details={formatBytes(memory.totalBytes)}
                    status={determineStatus(memory.usage)}
                />
            </div>
            <div className="flex-1">
                <SingleResourceCard
                    title="Disk Storage"
                    usagePercent={disk.usage}
                    details={`${formatBytes(disk.usedBytes)} / ${formatBytes(disk.totalBytes)}`}
                    status={determineStatus(disk.usage)}
                />
            </div>
        </div>
    );
};
