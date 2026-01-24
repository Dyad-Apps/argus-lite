/**
 * API Client with automatic token refresh
 *
 * Provides a fetch wrapper that automatically handles:
 * - Adding authorization headers
 * - Refreshing tokens on 401 responses
 * - Redirecting to login on auth failures
 */

interface TokenStorage {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  setTokens: (access: string, refresh: string) => void;
  clearTokens: () => void;
}

/** Default token storage using localStorage */
const defaultTokenStorage: TokenStorage = {
  getAccessToken: () => localStorage.getItem('accessToken'),
  getRefreshToken: () => localStorage.getItem('refreshToken'),
  setTokens: (access, refresh) => {
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
  },
  clearTokens: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },
};

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

/**
 * Subscribes to token refresh completion
 */
function subscribeToRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

/**
 * Notifies all subscribers with the new token
 */
function onRefreshed(token: string) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

/**
 * Attempts to refresh the access token
 */
async function refreshAccessToken(
  storage: TokenStorage
): Promise<string | null> {
  const refreshToken = storage.getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    storage.setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

interface ApiClientOptions {
  baseUrl?: string;
  tokenStorage?: TokenStorage;
  onAuthError?: () => void;
}

/**
 * Creates an API client with automatic token refresh
 */
export function createApiClient(options: ApiClientOptions = {}) {
  const {
    baseUrl = '/api/v1',
    tokenStorage = defaultTokenStorage,
    onAuthError = () => {
      window.location.href = '/login';
    },
  } = options;

  /**
   * Makes an authenticated API request with automatic token refresh
   */
  async function request<T = unknown>(
    endpoint: string,
    init: RequestInit = {}
  ): Promise<T> {
    const accessToken = tokenStorage.getAccessToken();

    // Add authorization header if we have a token
    const headers = new Headers(init.headers);
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
    if (!headers.has('Content-Type') && init.body) {
      headers.set('Content-Type', 'application/json');
    }

    const url = endpoint.startsWith('/') ? `${baseUrl}${endpoint}` : endpoint;

    let response = await fetch(url, {
      ...init,
      headers,
    });

    // If we get a 401 and have a refresh token, try to refresh
    if (response.status === 401 && tokenStorage.getRefreshToken()) {
      // If already refreshing, wait for it to complete
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeToRefresh(async (newToken) => {
            try {
              headers.set('Authorization', `Bearer ${newToken}`);
              const retryResponse = await fetch(url, { ...init, headers });
              if (!retryResponse.ok) {
                throw new Error('Request failed after token refresh');
              }
              resolve(retryResponse.json());
            } catch (error) {
              reject(error);
            }
          });
        });
      }

      isRefreshing = true;

      try {
        const newToken = await refreshAccessToken(tokenStorage);

        if (newToken) {
          isRefreshing = false;
          onRefreshed(newToken);

          // Retry the original request
          headers.set('Authorization', `Bearer ${newToken}`);
          response = await fetch(url, { ...init, headers });
        } else {
          // Refresh failed, clear tokens and redirect
          isRefreshing = false;
          tokenStorage.clearTokens();
          onAuthError();
          throw new Error('Session expired');
        }
      } catch (error) {
        isRefreshing = false;
        tokenStorage.clearTokens();
        onAuthError();
        throw error;
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(
        errorData.error?.message || `Request failed: ${response.status}`
      );
      (error as any).status = response.status;
      (error as any).data = errorData;
      throw error;
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return null as T;
    }

    return response.json();
  }

  return {
    get: <T = unknown>(endpoint: string, init?: RequestInit) =>
      request<T>(endpoint, { ...init, method: 'GET' }),

    post: <T = unknown>(endpoint: string, body?: unknown, init?: RequestInit) =>
      request<T>(endpoint, {
        ...init,
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      }),

    patch: <T = unknown>(endpoint: string, body?: unknown, init?: RequestInit) =>
      request<T>(endpoint, {
        ...init,
        method: 'PATCH',
        body: body ? JSON.stringify(body) : undefined,
      }),

    delete: <T = unknown>(endpoint: string, init?: RequestInit) =>
      request<T>(endpoint, { ...init, method: 'DELETE' }),

    request,
  };
}

/** Default API client instance */
export const apiClient = createApiClient();

// Re-export for convenience
export { defaultTokenStorage };
