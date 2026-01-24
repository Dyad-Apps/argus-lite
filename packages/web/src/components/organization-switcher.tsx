import { useState, useEffect } from 'react';
import { ChevronDown, Building2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  isPrimary: boolean;
}

interface OrganizationSwitcherProps {
  className?: string;
}

/**
 * Organization Switcher Component
 *
 * Displays the current organization and allows users with multi-org access
 * to switch between organizations without re-authenticating.
 */
export function OrganizationSwitcher({ className }: OrganizationSwitcherProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);

  // Fetch user's accessible organizations
  useEffect(() => {
    async function fetchOrganizations() {
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          setIsLoading(false);
          return;
        }

        const response = await fetch('/api/v1/auth/organizations', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setOrganizations(data.organizations || []);

          // Set current org from the list (the one marked as current in JWT)
          const current = data.organizations?.find((org: Organization) => org.id === data.currentOrganizationId);
          setCurrentOrg(current || data.organizations?.[0] || null);
        }
      } catch (error) {
        console.error('Failed to fetch organizations:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrganizations();
  }, []);

  const handleSwitch = async (org: Organization) => {
    if (org.id === currentOrg?.id) {
      setIsOpen(false);
      return;
    }

    setIsSwitching(true);

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/v1/auth/switch-organization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ organizationId: org.id }),
      });

      if (response.ok) {
        const data = await response.json();

        // Update tokens with new org context
        localStorage.setItem('accessToken', data.accessToken);
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }

        setCurrentOrg(org);
        setIsOpen(false);

        // Reload the page to refresh data with new org context
        window.location.reload();
      } else {
        console.error('Failed to switch organization');
      }
    } catch (error) {
      console.error('Error switching organization:', error);
    } finally {
      setIsSwitching(false);
    }
  };

  // Don't render if only one organization or loading
  if (isLoading) {
    return (
      <div className={cn('h-9 w-32 animate-pulse bg-muted rounded-md', className)} />
    );
  }

  if (!currentOrg || organizations.length <= 1) {
    // Show just the org name without dropdown
    return currentOrg ? (
      <div className={cn('flex items-center gap-2 px-3 py-2', className)}>
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{currentOrg.name}</span>
      </div>
    ) : null;
  }

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="ghost"
        className="flex items-center gap-2 h-9"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSwitching}
      >
        <Building2 className="h-4 w-4" />
        <span className="max-w-[150px] truncate">{currentOrg.name}</span>
        <span className="text-xs text-muted-foreground capitalize">
          ({currentOrg.role})
        </span>
        <ChevronDown className={cn(
          'h-4 w-4 transition-transform',
          isOpen && 'rotate-180'
        )} />
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-1 w-64 rounded-md border bg-popover p-1 shadow-lg z-50">
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Switch Organization
            </div>

            <div className="max-h-60 overflow-y-auto">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                    'hover:bg-accent hover:text-accent-foreground',
                    'focus:bg-accent focus:text-accent-foreground focus:outline-none',
                    org.id === currentOrg.id && 'bg-accent/50'
                  )}
                  onClick={() => handleSwitch(org)}
                  disabled={isSwitching}
                >
                  <Building2 className="h-4 w-4 shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="font-medium truncate">{org.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {org.role}
                      {org.isPrimary && ' • Primary'}
                    </div>
                  </div>
                  {org.id === currentOrg.id && (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
