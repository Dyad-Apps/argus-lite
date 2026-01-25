import {
  Home,
  Building2,
  Users,
  Settings,
  Shield,
  Activity,
  Layers,
  Lock,
  Paintbrush,
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
        title: 'Home',
        url: '/',
        icon: Home,
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
        title: 'Organization Profiles',
        url: '/organization-profiles',
        icon: Layers,
      },
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
        title: 'Security',
        url: '/security',
        icon: Lock,
      },
      {
        title: 'White Labeling',
        url: '/branding',
        icon: Paintbrush,
      },
      {
        title: 'Settings',
        url: '/settings',
        icon: Settings,
      },
    ],
  },
];
