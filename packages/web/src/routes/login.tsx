import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
      <div className="w-full max-w-md rounded-lg border p-8">
        <h1 className="text-2xl font-bold">Login</h1>
        <p className="mt-2 text-muted-foreground">
          Login form coming in Sprint 1
        </p>
      </div>
    </div>
  );
}
