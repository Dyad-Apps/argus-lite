import { Link } from '@tanstack/react-router';
import { Rocket, FileText, Code, Library, type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface QuickLink {
  icon: LucideIcon;
  label: string;
  path: string;
  color: string;
}

const links: QuickLink[] = [
  { icon: Rocket, label: 'Get Started', path: '/', color: 'text-blue-500' },
  { icon: FileText, label: 'Organizations', path: '/organizations', color: 'text-indigo-500' },
  { icon: Code, label: 'API Docs', path: '/settings', color: 'text-pink-500' },
  { icon: Library, label: 'Users', path: '/users', color: 'text-orange-500' },
];

export function QuickLinks() {
  return (
    <Card className="h-full">
      <CardContent className="p-4 h-full flex flex-col">
        <div className="flex items-center gap-1 mb-3">
          <span className="text-xs font-bold uppercase text-muted-foreground tracking-wide">
            Quick Access
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 flex-1">
          {links.map((link) => (
            <Link
              key={link.label}
              to={link.path}
              className="flex items-center gap-2 p-2 border rounded hover:bg-muted/50 cursor-pointer transition-colors"
            >
              <div className={`p-1 bg-muted rounded ${link.color}`}>
                <link.icon className="h-3 w-3" />
              </div>
              <span className="text-xs font-medium truncate">{link.label}</span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
