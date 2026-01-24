import { createRootRoute, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { useEffect } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { DashboardHeader } from '@/components/dashboard-header';
import { Footer } from '@/components/footer';
import { ThemeProvider } from '@/components/theme-provider';

export const Route = createRootRoute({
  component: RootLayout,
});

// Public routes that don't require authentication
const publicRoutes = ['/login', '/auth/callback'];

function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isPublicRoute = publicRoutes.some((route) =>
    location.pathname.startsWith(route)
  );

  // Check authentication for protected routes
  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken');
    if (!isPublicRoute && !accessToken) {
      navigate({ to: '/login' });
    }
  }, [isPublicRoute, navigate, location.pathname]);

  // For public routes, render without the dashboard layout
  if (isPublicRoute) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-background">
          <Outlet />
          {import.meta.env.DEV && <TanStackRouterDevtools />}
        </div>
      </ThemeProvider>
    );
  }

  // For authenticated routes, render with the dashboard layout
  // SidebarProvider creates the flex container, AppSidebar and SidebarInset are direct children
  return (
    <ThemeProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <DashboardHeader />
          <div className="flex-1 p-4 lg:p-6 bg-background">
            <Outlet />
          </div>
          <Footer />
        </SidebarInset>
        {import.meta.env.DEV && <TanStackRouterDevtools />}
      </SidebarProvider>
    </ThemeProvider>
  );
}
