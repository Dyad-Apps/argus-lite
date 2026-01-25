import { createFileRoute } from '@tanstack/react-router';
import { Paintbrush } from 'lucide-react';
import { BrandingEditor } from '@/components/branding';

export const Route = createFileRoute('/branding')({
  component: BrandingPage,
});

function BrandingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
          <Paintbrush className="h-6 w-6" />
          White Labeling
        </h1>
        <p className="text-muted-foreground">
          Customize the platform's appearance with your organization's branding
        </p>
      </div>

      <BrandingEditor />
    </div>
  );
}
