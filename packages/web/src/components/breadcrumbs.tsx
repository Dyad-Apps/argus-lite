import { Link, useLocation } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { mainNavigation } from '@/lib/navigation';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * Generates breadcrumbs from the current path
 */
function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const breadcrumbs: BreadcrumbItem[] = [];

  // Always start with Home
  breadcrumbs.push({ label: 'Home', href: '/' });

  // If we're on home, just return Home
  if (pathname === '/') {
    return breadcrumbs;
  }

  // Find the matching navigation item
  const allNavItems = mainNavigation.flatMap((section) => section.items);
  const currentItem = allNavItems.find(
    (item) => pathname === item.url || pathname.startsWith(item.url + '/')
  );

  if (currentItem) {
    breadcrumbs.push({ label: currentItem.title });
  } else {
    // Fallback: use path segments
    const segments = pathname.split('/').filter(Boolean);
    segments.forEach((segment) => {
      breadcrumbs.push({
        label: segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '),
      });
    });
  }

  return breadcrumbs;
}

export function Breadcrumbs() {
  const location = useLocation();
  const breadcrumbs = getBreadcrumbs(location.pathname);

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
