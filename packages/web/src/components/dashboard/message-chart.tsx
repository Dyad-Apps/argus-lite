import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";

const ClockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
);

export const MessageChart = () => {
    return (
        <Card className="col-span-full lg:col-span-2 h-full">
            <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        Transport messages <Info className="h-3 w-3" />
                    </CardTitle>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ClockIcon /> History - last 30 days
                </div>
            </CardHeader>
            <CardContent className="flex items-center justify-center h-[160px]">
                <div className="text-center text-muted-foreground">
                    <p className="text-sm">Message metrics coming soon</p>
                    <p className="text-xs opacity-70">Requires updated API endpoint</p>
                </div>
            </CardContent>
        </Card>
    );
};
