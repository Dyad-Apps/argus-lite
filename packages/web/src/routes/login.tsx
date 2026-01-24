import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Github } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

// Login form validation schema
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// Google icon component
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

// Branding configuration type
interface BrandingConfig {
  logoUrl?: string;
  primaryColor?: string;
  welcomeText?: string;
  subtitle?: string;
  backgroundType?: 'default' | 'solid' | 'image' | 'particles';
  backgroundUrl?: string;
  backgroundColor?: string;
  ssoProviders?: Array<{
    id: string;
    name: string;
    type: 'google' | 'github' | 'oidc' | 'saml';
  }>;
  ssoRequired?: boolean;
}

// Hook to get organization branding and SSO providers
function useOrganizationBranding(): {
  branding: BrandingConfig;
  isLoading: boolean;
  organizationId?: string;
} {
  const [branding, setBranding] = useState<BrandingConfig>({
    welcomeText: 'Welcome',
    subtitle: 'Sign in to your account',
    backgroundType: 'default',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string>();

  useEffect(() => {
    async function fetchBrandingAndProviders() {
      try {
        // Extract subdomain from hostname
        const hostname = window.location.hostname;
        const parts = hostname.split('.');

        // Check if we have a subdomain (e.g., acme.argusiq.com)
        // Skip for localhost or direct IP access
        if (parts.length >= 3 && !hostname.includes('localhost')) {
          const subdomain = parts[0];

          // Fetch organization branding by subdomain
          const response = await fetch(`/api/v1/organizations/branding?subdomain=${subdomain}`);

          if (response.ok) {
            const data = await response.json();
            setBranding((prev) => ({
              ...prev,
              logoUrl: data.logoUrl,
              primaryColor: data.primaryColor,
              welcomeText: data.loginWelcomeText || 'Welcome',
              subtitle: data.loginSubtitle || 'Sign in to your account',
              backgroundType: data.loginBackgroundType || 'default',
              backgroundUrl: data.loginBackgroundUrl,
              backgroundColor: data.loginBackgroundColor,
              ssoProviders: data.ssoProviders,
              ssoRequired: data.ssoRequired,
            }));
            setOrganizationId(data.organizationId);
          }
        }

        // Fetch available social auth providers (Google, GitHub via env vars)
        const providersResponse = await fetch('/api/v1/auth/providers');
        if (providersResponse.ok) {
          const providersData = await providersResponse.json();
          setBranding((prev) => ({
            ...prev,
            ssoProviders: providersData.providers?.map((p: { type: string; name: string; enabled: boolean }) => ({
              id: p.type, // Use type as id for social providers
              name: p.name,
              type: p.type as 'google' | 'github' | 'oidc' | 'saml',
            })) || prev.ssoProviders,
          }));
        }
      } catch (error) {
        console.error('Failed to fetch organization branding:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchBrandingAndProviders();
  }, []);

  return { branding, isLoading, organizationId };
}

function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { branding, isLoading: isBrandingLoading, organizationId } = useOrganizationBranding();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...values,
          organizationId, // Include org context if from white-label domain
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setFormError(data.error?.message || 'Invalid email or password');
        setIsSubmitting(false);
        return;
      }

      // Store tokens
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);

      // Navigate to dashboard
      navigate({ to: '/' });
    } catch (error) {
      setFormError('Network error. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleSocialLogin = (providerType: string) => {
    // For social login (Google, GitHub), use the simpler auth endpoints
    // No returnUrl needed - defaults to /auth/callback
    window.location.href = `/api/v1/auth/${providerType}`;
  };

  const handleEnterpriseSSO = () => {
    // For enterprise SSO, redirect to SSO discovery endpoint
    // This could also open a modal to enter work email
    window.location.href = '/api/v1/sso/discover';
  };

  // Loading state
  if (isBrandingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Check if only SSO is allowed (no password login)
  const showPasswordForm = !branding.ssoRequired;

  // Default social providers if none configured
  const socialProviders = branding.ssoProviders?.filter(
    (p) => p.type === 'google' || p.type === 'github'
  ) || [];

  const enterpriseProviders = branding.ssoProviders?.filter(
    (p) => p.type === 'oidc' || p.type === 'saml'
  ) || [];

  return (
    <div className="min-h-screen w-full relative">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        {branding.backgroundType === 'image' && branding.backgroundUrl ? (
          <div
            className="w-full h-full bg-cover bg-center"
            style={{ backgroundImage: `url(${branding.backgroundUrl})` }}
          />
        ) : branding.backgroundType === 'solid' && branding.backgroundColor ? (
          <div
            className="w-full h-full"
            style={{ backgroundColor: branding.backgroundColor }}
          />
        ) : (
          // Default gradient background
          <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        )}
      </div>

      {/* Login Card */}
      <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
        <Card className="w-full max-w-md shadow-2xl bg-background/80 backdrop-blur-sm border-white/20">
          <CardHeader className="text-center space-y-2">
            {/* Logo */}
            {branding.logoUrl && (
              <div className="flex justify-center mb-4">
                <img
                  src={branding.logoUrl}
                  alt="Logo"
                  className="h-12 object-contain"
                />
              </div>
            )}

            <CardTitle
              className="text-3xl font-bold"
              style={branding.primaryColor ? { color: branding.primaryColor } : undefined}
            >
              {branding.welcomeText}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {branding.subtitle}
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Social Login Buttons */}
            {socialProviders.length > 0 && (
              <div className="space-y-3">
                {/* Google Button - only show if configured */}
                {socialProviders.find((p) => p.type === 'google') && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleSocialLogin('google')}
                  >
                    <GoogleIcon className="h-5 w-5 mr-2" />
                    Continue with Google
                  </Button>
                )}

                {/* GitHub Button - only show if configured */}
                {socialProviders.find((p) => p.type === 'github') && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleSocialLogin('github')}
                  >
                    <Github className="h-5 w-5 mr-2" />
                    Continue with GitHub
                  </Button>
                )}
              </div>
            )}

            {/* Enterprise SSO configured */}
            {enterpriseProviders.length > 0 && (
              <>
                {socialProviders.length > 0 && (
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <Separator className="w-full" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background/80 px-2 text-muted-foreground">
                        Or
                      </span>
                    </div>
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleEnterpriseSSO}
                >
                  Sign in with your Organization
                </Button>
              </>
            )}

            {/* Divider */}
            {showPasswordForm && (socialProviders.length > 0 || enterpriseProviders.length > 0 || !branding.ssoProviders?.length) && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background/80 px-2 text-muted-foreground">
                    Or continue with email
                  </span>
                </div>
              </div>
            )}

            {/* Password Login Form */}
            {showPasswordForm && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {formError && (
                    <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive text-center">
                      {formError}
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="you@example.com"
                            type="email"
                            autoComplete="email"
                            disabled={isSubmitting}
                            className={cn(
                              fieldState.error && 'border-destructive'
                            )}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              placeholder="Enter your password"
                              type={showPassword ? 'text' : 'password'}
                              autoComplete="current-password"
                              disabled={isSubmitting}
                              className={cn(
                                'pr-10',
                                fieldState.error && 'border-destructive'
                              )}
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                    style={branding.primaryColor ? { backgroundColor: branding.primaryColor } : undefined}
                  >
                    {isSubmitting ? 'Signing in...' : 'Sign in'}
                  </Button>

                  <div className="text-center text-sm text-muted-foreground">
                    <a
                      href="/forgot-password"
                      className="hover:text-primary underline-offset-4 hover:underline"
                    >
                      Forgot your password?
                    </a>
                  </div>
                </form>
              </Form>
            )}

            {/* SSO Required Message */}
            {branding.ssoRequired && !enterpriseProviders.length && !socialProviders.length && (
              <div className="text-center text-sm text-muted-foreground">
                <p>Contact your administrator to configure single sign-on.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
