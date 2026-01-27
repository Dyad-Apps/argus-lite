import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Clock } from "lucide-react";
import { SystemLoadResponse } from "@/lib/dashboard-api";

interface RealtimeChartProps {
    data: SystemLoadResponse | null;
}

export const RealtimeChart = ({ data }: RealtimeChartProps) => {
    const chartData = data?.data.map(point => ({
        time: new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        cpu: point.cpu || 0,
        ram: point.memory || 0,
        disk: 0, // Disk metric not available in historical load data yet
    })) || [];

    return (
        <Card className="h-full">
            <CardHeader className="p-3 pb-0">
                <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">System Load (1h)</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-2">
                <div className="w-full h-[200px] min-w-0" style={{ minHeight: '200px' }}>
                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis
                                    dataKey="time"
                                    tick={{ fontSize: 9, fill: '#9CA3AF' }}
                                    axisLine={false}
                                    tickLine={false}
                                    interval="preserveStartEnd"
                                    minTickGap={30}
                                    height={20}
                                />
                                <YAxis
                                    tick={{ fontSize: 9, fill: '#9CA3AF' }}
                                    axisLine={false}
                                    tickLine={false}
                                    domain={[0, 100]}
                                    width={30}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '4px', border: '1px solid #e5e7eb', fontSize: '10px', padding: '4px' }}
                                    itemStyle={{ padding: 0 }}
                                    labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                                />
                                <Line type="monotone" dataKey="cpu" name="CPU %" stroke="#3B82F6" strokeWidth={1.5} dot={false} />
                                <Line type="monotone" dataKey="ram" name="Memory %" stroke="#8B5CF6" strokeWidth={1.5} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                            Loading chart data...
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
