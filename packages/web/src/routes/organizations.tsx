import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/organizations')({
  component: OrganizationsLayout,
});

function OrganizationsLayout() {
  return <Outlet />;
}
