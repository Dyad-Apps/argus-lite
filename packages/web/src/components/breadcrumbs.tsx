import { Link, useLocation } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { mainNavigation } from '@/lib/navigation';
import { apiClient } from '@/lib/api-client';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface ResolvedEntities {
  [key: string]: string; // segment -> name
}

/**
 * Generates breadcrumbs from the current path by iterating segments
 */
function getBreadcrumbs(pathname: string, resolvedNames: ResolvedEntities): BreadcrumbItem[] {
  const breadcrumbs: BreadcrumbItem[] = [];

  // Always start with Home
  breadcrumbs.push({ label: 'Home', href: '/' });

  // If we're on home, just return Home
  if (pathname === '/') {
    return breadcrumbs;
  }

  const segments = pathname.split('/').filter(Boolean);
  let currentPath = '';

  // Flatten navigation for easy lookup
  const allNavItems = mainNavigation.flatMap((section) => section.items);

  segments.forEach((segment) => {
    currentPath += `/${segment}`;

    // Check if this specific path corresponds to a navigation item
    const navItem = allNavItems.find((item) => item.url === currentPath);

    if (navItem) {
      breadcrumbs.push({ label: navItem.title, href: navItem.url });
    } else {
      // Logic for dynamic segments (like IDs)
      let label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');

      // If we have a resolved name for this segment (GUID), use it
      if (resolvedNames[segment]) {
        label = resolvedNames[segment];
      }

      breadcrumbs.push({
        label,
        href: currentPath,
      });
    }
  });

  return breadcrumbs;
}

export function Breadcrumbs() {
  const location = useLocation();
  const [resolvedNames, setResolvedNames] = useState<ResolvedEntities>({});

  useEffect(() => {
    async function resolveEntities() {
      const segments = location.pathname.split('/').filter(Boolean);
      const newResolvedNames: ResolvedEntities = {};

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const prevSegment = segments[i - 1]; // e.g. "organizations", "users"

        // Only try to resolve if it looks like a UUID (simplistic helper check)
        if (segment.length > 20 && prevSegment) {
          // Check if we already have it
          if (resolvedNames[segment]) {
            newResolvedNames[segment] = resolvedNames[segment];
            continue;
          }

          try {
            if (prevSegment === 'organizations') {
              const res = await apiClient.get<{ name: string }>(`/organizations/${segment}`);
              newResolvedNames[segment] = res.name;
            } else if (prevSegment === 'users') {
              const res = await apiClient.get<{ firstName: string | null; lastName: string | null; email: string }>(`/users/${segment}`);
              const fullName = res.firstName || res.lastName
                ? `${res.firstName || ''} ${res.lastName || ''}`.trim()
                : res.email;
              newResolvedNames[segment] = fullName;
            }
          } catch (e) {
            // Ignore errors, keep ID/default label
            console.debug('Failed to resolve breadcrumb name', e);
          }
        }
      }

      setResolvedNames(prev => ({ ...prev, ...newResolvedNames }));
    }

    resolveEntities();
  }, [location.pathname]);

  const breadcrumbs = getBreadcrumbs(location.pathname, resolvedNames);

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
      {breadcrumbs.map((item, index) => {
        const isLast = index === breadcrumbs.length - 1;

        return (
          <div key={index} className="flex items-center gap-1.5">
            {index > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {isLast ? (
              <span className="font-medium text-foreground">{item.label}</span>
            ) : item.href ? (
              <Link
                to={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
                // Prevent navigation if it's just the current page (though isLast handles visual style)
                disabled={isLast}
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-muted-foreground">{item.label}</span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
