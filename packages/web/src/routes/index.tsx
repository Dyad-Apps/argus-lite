import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Welcome to Argus IQ</h1>
      <p className="mt-2 text-muted-foreground">
        IoT Device Management Platform
      </p>
    </div>
  );
}
