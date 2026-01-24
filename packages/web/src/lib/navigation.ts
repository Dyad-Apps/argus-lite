import {
  LayoutDashboard,
  Building2,
  Users,
  Settings,
  Shield,
  Activity,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  isActive?: boolean;
  items?: NavItem[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const mainNavigation: NavSection[] = [
  {
    title: 'Main',
    items: [
      {
        title: 'Dashboard',
        url: '/',
        icon: LayoutDashboard,
      },
      {
        title: 'Organizations',
        url: '/organizations',
        icon: Building2,
      },
      {
        title: 'Users',
        url: '/users',
        icon: Users,
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        title: 'Roles & Permissions',
        url: '/roles',
        icon: Shield,
      },
      {
        title: 'Activity Log',
        url: '/activity',
        icon: Activity,
      },
      {
        title: 'Settings',
        url: '/settings',
        icon: Settings,
      },
    ],
  },
];
