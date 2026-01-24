import { Link, useLocation } from '@tanstack/react-router';
import { Hexagon } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { mainNavigation } from '@/lib/navigation';
import { PLATFORM_NAME, PLATFORM_VERSION } from '@/lib/theme-defaults';
import { cn } from '@/lib/utils';

// Argus Platform Logo SVG
function ArgusPlatformLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={className}
    >
      <path
        d="M50 5 L90 27.5 L90 72.5 L50 95 L10 72.5 L10 27.5 Z"
        fill="#1890FF"
      />
      <path d="M50 20 L75 75 L65 75 L50 40 L35 75 L25 75 Z" fill="white" />
      <rect x="40" y="55" width="20" height="5" fill="white" />
    </svg>
  );
}

export function AppSidebar() {
  const location = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  // Flatten navigation for simple menu (no sections in collapsed mode)
  const allNavItems = mainNavigation.flatMap((section) => section.items);

  return (
    <TooltipProvider delayDuration={0}>
      <Sidebar collapsible="icon" className="bg-sidebar border-r border-sidebar-border">
        <SidebarHeader className={cn('transition-all', isCollapsed ? 'p-2' : 'p-4')}>
          <div
            className={cn(
              'flex items-center gap-2',
              isCollapsed ? 'justify-center' : 'justify-start'
            )}
          >
            {isCollapsed ? (
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shrink-0 shadow-sm overflow-hidden">
                <Hexagon className="size-5 fill-current" />
              </div>
            ) : (
              <div className="flex items-center gap-3 w-full overflow-hidden">
                <div className="flex aspect-square size-8 items-center justify-center shrink-0 overflow-hidden">
                  <Hexagon className="size-6 text-sidebar-primary" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight overflow-hidden text-sidebar-foreground">
                  <span className="truncate font-bold">{PLATFORM_NAME}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Admin Portal
                  </span>
                </div>
              </div>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarMenu className="gap-1 px-2">
            {allNavItems.map((item) => {
              const isActive =
                location.pathname === item.url ||
                location.pathname.startsWith(item.url + '/');

              const ButtonContent = (
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  className={cn(
                    'w-full transition-all duration-200 ease-in-out h-10 rounded-md',
                    isCollapsed ? 'justify-center px-0' : 'justify-start px-3',
                    isActive
                      ? '!bg-sidebar-primary !text-sidebar-primary-foreground shadow-sm'
                      : 'text-sidebar-foreground hover:!bg-sidebar-accent hover:!text-sidebar-accent-foreground'
                  )}
                >
                  <Link to={item.url} className="flex items-center">
                    <item.icon
                      className={cn('shrink-0', isCollapsed ? 'size-5' : 'size-4 mr-3')}
                    />
                    {!isCollapsed && (
                      <span className="truncate font-medium">{item.title}</span>
                    )}
                  </Link>
                </SidebarMenuButton>
              );

              return (
                <SidebarMenuItem key={item.title}>
                  {isCollapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{ButtonContent}</TooltipTrigger>
                      <TooltipContent
                        side="right"
                        align="center"
                        className="bg-popover text-popover-foreground ml-2 font-medium"
                      >
                        {item.title}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    ButtonContent
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border p-4 bg-sidebar">
          <div
            className={cn(
              'flex items-center gap-3',
              isCollapsed ? 'justify-center' : ''
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center shrink-0">
              <ArgusPlatformLogo className="h-full w-full" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col text-left text-[11px] leading-tight text-sidebar-foreground overflow-hidden">
                <span className="truncate font-bold">
                  {PLATFORM_NAME}
                  <sup className="text-[8px] ml-0.5">TM</sup> - Lite
                </span>
                <span className="truncate opacity-60 mt-0.5 font-medium">
                  Version {PLATFORM_VERSION}
                </span>
              </div>
            )}
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    </TooltipProvider>
  );
}
