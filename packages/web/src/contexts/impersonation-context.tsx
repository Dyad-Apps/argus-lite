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
import { createApiClient, apiClient } from '@/lib/api-client';

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
  endImpersonation: (sessionId?: string) => Promise<void>;
  revokeSession: (sessionId: string) => Promise<void>;
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

  const endImpersonation = useCallback(async (forceSessionId?: string) => {
    const sessionId = forceSessionId || state.sessionId || localStorage.getItem(STORAGE_KEYS.SESSION_ID);
    const originalAccessToken =
      state.originalAccessToken ||
      localStorage.getItem(STORAGE_KEYS.ORIGINAL_ACCESS_TOKEN);
    const originalRefreshToken =
      state.originalRefreshToken ||
      localStorage.getItem(STORAGE_KEYS.ORIGINAL_REFRESH_TOKEN);

    // If we are NOT actively impersonating locally (e.g. cleaning up a zombie session from Security tab),
    // just use the standard client which uses the current (Admin) token.
    if (!state.isActive && !localStorage.getItem(STORAGE_KEYS.IS_IMPERSONATING)) {
      try {
        await apiClient.post('/admin/impersonate/end', { sessionId });
        window.location.reload();
        return;
      } catch (err) {
        console.error('Failed to end session via standard client:', err);
        throw err;
      }
    }

    // If we ARE impersonating, we must use the STASHED admin token to end it.
    if (sessionId) {
      try {
        // Use a temporary API client with the ORIGINAL tokens
        const adminClient = createApiClient({
          tokenStorage: {
            getAccessToken: () => state.originalAccessToken || localStorage.getItem(STORAGE_KEYS.ORIGINAL_ACCESS_TOKEN),
            getRefreshToken: () => state.originalRefreshToken || localStorage.getItem(STORAGE_KEYS.ORIGINAL_REFRESH_TOKEN),
            setTokens: (access, refresh) => {
              localStorage.setItem(STORAGE_KEYS.ORIGINAL_ACCESS_TOKEN, access);
              localStorage.setItem(STORAGE_KEYS.ORIGINAL_REFRESH_TOKEN, refresh);
            },
            clearTokens: () => {
              localStorage.removeItem(STORAGE_KEYS.ORIGINAL_ACCESS_TOKEN);
              localStorage.removeItem(STORAGE_KEYS.ORIGINAL_REFRESH_TOKEN);
            }
          },
          onAuthError: () => { },
        });

        await adminClient.post('/admin/impersonate/end', { sessionId });
      } catch (err) {
        console.error('Failed to end impersonation session on server:', err);
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
  }, [state.sessionId, state.originalAccessToken, state.originalRefreshToken, state.isActive]);

  const revokeSession = useCallback(async (sessionIdToRevoke: string) => {
    // Similar to endImpersonation, but for specific sessions and without ending the CURRENT local session
    // unless it matches the revoked one.
    try {
      const adminClient = createApiClient({
        tokenStorage: {
          getAccessToken: () => state.originalAccessToken || localStorage.getItem(STORAGE_KEYS.ORIGINAL_ACCESS_TOKEN),
          getRefreshToken: () => state.originalRefreshToken || localStorage.getItem(STORAGE_KEYS.ORIGINAL_REFRESH_TOKEN),
          setTokens: (access, refresh) => {
            localStorage.setItem(STORAGE_KEYS.ORIGINAL_ACCESS_TOKEN, access);
            localStorage.setItem(STORAGE_KEYS.ORIGINAL_REFRESH_TOKEN, refresh);
          },
          clearTokens: () => { }
        },
        onAuthError: () => { },
      });

      await adminClient.post(`/admin/impersonate/sessions/${sessionIdToRevoke}/revoke`);

      // If we revoked our OWN active session, we should trigger a full cleanup
      const currentSessionId = state.sessionId || localStorage.getItem(STORAGE_KEYS.SESSION_ID);
      if (currentSessionId === sessionIdToRevoke) {
        await endImpersonation();
      }
    } catch (err) {
      console.error('Failed to revoke session:', err);
      throw err;
    }
  }, [state, endImpersonation]);

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
        revokeSession,
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
