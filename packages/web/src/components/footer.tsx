import { PLATFORM_NAME, PLATFORM_VERSION } from '@/lib/theme-defaults';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/40">
      <div className="flex items-center justify-between px-4 py-3 text-sm text-muted-foreground">
        <span>&copy; {currentYear} Viaanix. All rights reserved.</span>
        <span>
          {PLATFORM_NAME} v{PLATFORM_VERSION}
        </span>
      </div>
    </footer>
  );
}
