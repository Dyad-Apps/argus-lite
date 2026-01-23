import { createRootRoute, Link, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <nav className="container mx-auto flex gap-4 p-4">
          <Link to="/" className="[&.active]:font-bold">
            Home
          </Link>
          <Link to="/login" className="[&.active]:font-bold">
            Login
          </Link>
        </nav>
      </header>

      <main className="container mx-auto p-4">
        <Outlet />
      </main>

      {/* Only in development */}
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </div>
  );
}
