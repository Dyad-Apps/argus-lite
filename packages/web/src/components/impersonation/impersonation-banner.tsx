/**
 * Impersonation Banner
 *
 * Displays a persistent banner when an admin is impersonating another user.
 * Shows who is being impersonated and provides a quick way to end the session.
 */

import { AlertTriangle, X, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useImpersonationSafe } from '@/contexts/impersonation-context';

export function ImpersonationBanner() {
  const impersonation = useImpersonationSafe();

  // Don't render if not impersonating or context not available
  if (!impersonation?.isActive || !impersonation.impersonatedUser) {
    return null;
  }

  const { impersonatedUser, endImpersonation } = impersonation;
  const displayName = impersonatedUser.name || impersonatedUser.email;

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between gap-4 relative z-50">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
        <div className="flex items-center gap-2">
          <User className="h-4 w-4" />
          <span className="font-medium">
            Viewing as: <strong>{displayName}</strong>
          </span>
          <span className="text-amber-800 text-sm">
            ({impersonatedUser.email})
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-amber-800">
          Actions performed will be logged to your admin account
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={endImpersonation}
          className="bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300"
        >
          <X className="h-4 w-4 mr-1" />
          End Session
        </Button>
      </div>
    </div>
  );
}
