/**
 * Impersonation Context
 *
 * Manages global impersonation state including:
 * - Token swapping (original admin token <-> impersonation token)
 * - Impersonation status tracking
 * - Visual indicator state for the banner
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';

interface ImpersonatedUser {
  id: string;
  email: string;
  name?: string;
}

interface ImpersonationState {
  isActive: boolean;
  sessionId: string | null;
  impersonatedUser: ImpersonatedUser | null;
  originalAccessToken: string | null;
  originalRefreshToken: string | null;
}

interface ImpersonationContextValue extends ImpersonationState {
  startImpersonation: (
    sessionId: string,
    impersonationToken: string,
    targetUser: ImpersonatedUser
  ) => void;
  endImpersonation: () => Promise<void>;
}

const ImpersonationContext = createContext<ImpersonationContextValue | null>(
  null
);

const STORAGE_KEYS = {
  SESSION_ID: 'impersonationSessionId',
  ORIGINAL_ACCESS_TOKEN: 'originalAccessToken',
  ORIGINAL_REFRESH_TOKEN: 'originalRefreshToken',
  IMPERSONATED_USER: 'impersonatedUser',
  IS_IMPERSONATING: 'isImpersonating',
} as const;

interface ImpersonationProviderProps {
  children: ReactNode;
}

export function ImpersonationProvider({ children }: ImpersonationProviderProps) {
  const [state, setState] = useState<ImpersonationState>(() => {
    // Initialize from localStorage on mount
    const isActive = localStorage.getItem(STORAGE_KEYS.IS_IMPERSONATING) === 'true';
    const sessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
    const originalAccessToken = localStorage.getItem(STORAGE_KEYS.ORIGINAL_ACCESS_TOKEN);
    const originalRefreshToken = localStorage.getItem(STORAGE_KEYS.ORIGINAL_REFRESH_TOKEN);
    const impersonatedUserStr = localStorage.getItem(STORAGE_KEYS.IMPERSONATED_USER);

    let impersonatedUser: ImpersonatedUser | null = null;
    if (impersonatedUserStr) {
      try {
        impersonatedUser = JSON.parse(impersonatedUserStr);
      } catch {
        // Invalid JSON, ignore
      }
    }

    return {
      isActive,
      sessionId,
      impersonatedUser,
      originalAccessToken,
      originalRefreshToken,
    };
  });

  const startImpersonation = useCallback(
    (
      sessionId: string,
      impersonationToken: string,
      targetUser: ImpersonatedUser
    ) => {
      // Store original tokens before swapping
      const currentAccessToken = localStorage.getItem('accessToken');
      const currentRefreshToken = localStorage.getItem('refreshToken');

      if (!currentAccessToken) {
        console.error('Cannot start impersonation: no access token');
        return;
      }

      // Save original tokens
      localStorage.setItem(STORAGE_KEYS.ORIGINAL_ACCESS_TOKEN, currentAccessToken);
      if (currentRefreshToken) {
        localStorage.setItem(STORAGE_KEYS.ORIGINAL_REFRESH_TOKEN, currentRefreshToken);
      }

      // Save impersonation state
      localStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
      localStorage.setItem(STORAGE_KEYS.IMPERSONATED_USER, JSON.stringify(targetUser));
      localStorage.setItem(STORAGE_KEYS.IS_IMPERSONATING, 'true');

      // Swap to impersonation token
      localStorage.setItem('accessToken', impersonationToken);
      // Remove refresh token during impersonation (impersonation tokens can't be refreshed)
      localStorage.removeItem('refreshToken');

      setState({
        isActive: true,
        sessionId,
        impersonatedUser: targetUser,
        originalAccessToken: currentAccessToken,
        originalRefreshToken: currentRefreshToken,
      });
    },
    []
  );

  const endImpersonation = useCallback(async () => {
    const sessionId = state.sessionId || localStorage.getItem(STORAGE_KEYS.SESSION_ID);
    const originalAccessToken =
      state.originalAccessToken ||
      localStorage.getItem(STORAGE_KEYS.ORIGINAL_ACCESS_TOKEN);
    const originalRefreshToken =
      state.originalRefreshToken ||
      localStorage.getItem(STORAGE_KEYS.ORIGINAL_REFRESH_TOKEN);

    // Call the API to end the session on the backend
    if (sessionId) {
      try {
        // Use the original admin token to end the session
        await fetch('/api/v1/admin/impersonate/end', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${originalAccessToken}`,
          },
          body: JSON.stringify({ sessionId }),
        });
      } catch (err) {
        console.error('Failed to end impersonation session on server:', err);
        // Continue with local cleanup even if server call fails
      }
    }

    // Restore original tokens
    if (originalAccessToken) {
      localStorage.setItem('accessToken', originalAccessToken);
    }
    if (originalRefreshToken) {
      localStorage.setItem('refreshToken', originalRefreshToken);
    }

    // Clear impersonation state from localStorage
    localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
    localStorage.removeItem(STORAGE_KEYS.ORIGINAL_ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.ORIGINAL_REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.IMPERSONATED_USER);
    localStorage.removeItem(STORAGE_KEYS.IS_IMPERSONATING);

    setState({
      isActive: false,
      sessionId: null,
      impersonatedUser: null,
      originalAccessToken: null,
      originalRefreshToken: null,
    });

    // Reload the page to reset all state with the admin token
    window.location.reload();
  }, [state.sessionId, state.originalAccessToken, state.originalRefreshToken]);

  // Check on mount if impersonation is active but tokens are inconsistent
  useEffect(() => {
    const isActive = localStorage.getItem(STORAGE_KEYS.IS_IMPERSONATING) === 'true';
    const originalToken = localStorage.getItem(STORAGE_KEYS.ORIGINAL_ACCESS_TOKEN);

    // If marked as impersonating but no original token, clean up
    if (isActive && !originalToken) {
      localStorage.removeItem(STORAGE_KEYS.IS_IMPERSONATING);
      localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
      localStorage.removeItem(STORAGE_KEYS.IMPERSONATED_USER);
      setState({
        isActive: false,
        sessionId: null,
        impersonatedUser: null,
        originalAccessToken: null,
        originalRefreshToken: null,
      });
    }
  }, []);

  return (
    <ImpersonationContext.Provider
      value={{
        ...state,
        startImpersonation,
        endImpersonation,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const context = useContext(ImpersonationContext);
  if (!context) {
    throw new Error(
      'useImpersonation must be used within an ImpersonationProvider'
    );
  }
  return context;
}

// Optional hook for components that may be outside the provider
export function useImpersonationSafe() {
  return useContext(ImpersonationContext);
}
