import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallback,
});

/**
 * OAuth callback handler
 *
 * Social auth routes redirect here with tokens in the URL fragment:
 * /auth/callback#access_token=xxx&refresh_token=xxx&expires_in=900
 *
 * This component extracts the tokens, stores them, and redirects to the dashboard.
 */
function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Parse tokens from URL hash
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);

    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const errorParam = params.get('error');

    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      return;
    }

    if (accessToken && refreshToken) {
      // Store tokens
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      // Clear the hash from URL for security
      window.history.replaceState(null, '', window.location.pathname);

      // Redirect to dashboard
      navigate({ to: '/' });
    } else {
      // No tokens found, check query params for error
      const searchParams = new URLSearchParams(window.location.search);
      const queryError = searchParams.get('error');

      if (queryError) {
        setError(decodeURIComponent(queryError));
      } else {
        setError('Authentication failed. No tokens received.');
      }
    }
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="text-destructive text-lg font-medium">
            Authentication Error
          </div>
          <p className="text-muted-foreground">{error}</p>
          <a
            href="/login"
            className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}
