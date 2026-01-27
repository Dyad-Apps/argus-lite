/**
 * Social Authentication Routes
 *
 * Simple OAuth2 social login (Google, GitHub) that works with environment variables.
 * No database configuration required - just set the env vars.
 *
 * For enterprise SSO with per-organization providers, use /api/v1/sso routes instead.
 */

import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { Errors, createUserId, createOrganizationId } from '@argus/shared';
import { getUserRepository, getRefreshTokenRepository, getUserOrganizationRepository, getOrganizationRepository } from '../../repositories/index.js';
import { signAccessToken } from '../../utils/index.js';
import { sql } from '../../db/index.js';

// State storage for CSRF protection
// Enhanced to include organizationId for org-scoped SSO
const stateStore = new Map<string, { returnUrl?: string; organizationId?: string; createdAt: number }>();

function generateState(): string {
  return randomBytes(32).toString('hex');
}

function storeState(state: string, returnUrl?: string, organizationId?: string): void {
  stateStore.set(state, { returnUrl, organizationId, createdAt: Date.now() });
  // Clean up after 10 minutes
  setTimeout(() => stateStore.delete(state), 10 * 60 * 1000);
}

function validateAndClearState(state: string): { returnUrl?: string; organizationId?: string } | null {
  const data = stateStore.get(state);
  if (!data) return null;

  // Check if state is not older than 10 minutes
  if (Date.now() - data.createdAt > 10 * 60 * 1000) {
    stateStore.delete(state);
    return null;
  }

  stateStore.delete(state);
  return { returnUrl: data.returnUrl, organizationId: data.organizationId };
}

export async function socialAuthRoutes(app: FastifyInstance): Promise<void> {
  const userRepo = getUserRepository();
  const refreshTokenRepo = getRefreshTokenRepository();
  const userOrgRepo = getUserOrganizationRepository();
  const orgRepo = getOrganizationRepository();

  // ============================================================================
  // Google OAuth2
  // ============================================================================

  // GET /auth/google - Initiate Google OAuth
  // Supports org-scoped SSO: pass orgId to use organization's SSO configuration
  app.withTypeProvider<ZodTypeProvider>().get(
    '/google',
    {
      schema: {
        querystring: z.object({
          returnUrl: z.string().optional(),
          orgId: z.string().uuid().optional(), // Organization-scoped SSO
        }),
      },
    },
    async (request, reply) => {
      const { orgId } = request.query;

      // Validate organization if orgId provided
      if (orgId) {
        const org = await orgRepo.findById(createOrganizationId(orgId));
        if (!org || !org.isActive) {
          throw Errors.badRequest('Invalid or inactive organization');
        }
      }

      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) {
        throw Errors.badRequest('Google OAuth not configured. Set GOOGLE_CLIENT_ID in environment.');
      }

      const state = generateState();
      const { returnUrl } = request.query;
      storeState(state, returnUrl, orgId);

      const baseUrl = `${request.protocol}://${request.hostname}`;
      const callbackUrl = `${baseUrl}/api/v1/auth/google/callback`;

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', callbackUrl);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'openid email profile');
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'select_account');

      return reply.redirect(authUrl.toString());
    }
  );

  // GET /auth/google/callback - Handle Google OAuth callback
  app.withTypeProvider<ZodTypeProvider>().get(
    '/google/callback',
    {
      schema: {
        querystring: z.object({
          code: z.string().optional(),
          state: z.string().optional(),
          error: z.string().optional(),
          error_description: z.string().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { code, state, error, error_description } = request.query;

      // Handle OAuth errors
      if (error) {
        const errorMsg = error_description || error;
        return reply.redirect(`/login?error=${encodeURIComponent(errorMsg)}`);
      }

      if (!code || !state) {
        return reply.redirect('/login?error=Missing authorization code');
      }

      // Validate state
      const stateData = validateAndClearState(state);
      if (!stateData) {
        return reply.redirect('/login?error=Invalid or expired state');
      }

      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return reply.redirect('/login?error=Google OAuth not configured');
      }

      try {
        const baseUrl = `${request.protocol}://${request.hostname}`;
        const callbackUrl = `${baseUrl}/api/v1/auth/google/callback`;

        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: callbackUrl,
            grant_type: 'authorization_code',
          }),
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.text();
          app.log.error({ errorData }, 'Google token exchange failed');
          return reply.redirect('/login?error=Failed to authenticate with Google');
        }

        const tokens = await tokenResponse.json() as { access_token: string };

        // Get user info
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });

        if (!userResponse.ok) {
          return reply.redirect('/login?error=Failed to get user info from Google');
        }

        const googleUser = await userResponse.json() as {
          id: string;
          email: string;
          verified_email: boolean;
          given_name?: string;
          family_name?: string;
          picture?: string;
        };

        if (!googleUser.email) {
          return reply.redirect('/login?error=No email returned from Google');
        }

        // Determine target organization from state or default
        const targetOrgId = stateData.organizationId || request.rootOrganizationId;

        // Find or create user
        let user = await userRepo.findByEmail(googleUser.email);

        if (!user) {
          // Auto-create user for social login
          let orgId: string;

          if (targetOrgId) {
            // Use organization from state (org-scoped SSO)
            orgId = targetOrgId;
          } else {
            // Fallback: Get first root organization
            const defaultOrgResult = await sql`
              SELECT id FROM organizations WHERE is_root = true LIMIT 1
            `;

            if (defaultOrgResult.length === 0) {
              return reply.redirect('/login?error=No organization configured. Please contact admin.');
            }

            orgId = defaultOrgResult[0].id;
          }

          // Get organization details for validation
          const targetOrg = await orgRepo.findById(createOrganizationId(orgId));
          if (!targetOrg || !targetOrg.isActive) {
            return reply.redirect('/login?error=Organization is not active');
          }

          // Use rootOrganizationId if this is a child org
          const rootOrgId = targetOrg.rootOrganizationId ?? targetOrg.id;

          user = await userRepo.create({
            email: googleUser.email,
            passwordHash: null, // Social login users don't have passwords
            firstName: googleUser.given_name || null,
            lastName: googleUser.family_name || null,
            rootOrganizationId: rootOrgId,
            primaryOrganizationId: orgId,
            emailVerifiedAt: googleUser.verified_email ? new Date() : null,
            avatarUrl: googleUser.picture || null,
          });

          // Add user to organization
          await sql`
            INSERT INTO user_organizations (user_id, organization_id, role, is_primary)
            VALUES (${user.id}, ${orgId}, 'member', true)
            ON CONFLICT (user_id, organization_id) DO NOTHING
          `;
        }

        // Build organization context for JWT (ADR-002)
        const userId = createUserId(user.id);
        const userOrgs = await userOrgRepo.getUserOrganizations(userId);
        const accessibleOrganizationIds = userOrgs.map((membership) =>
          createOrganizationId(membership.organizationId)
        );

        const organizationContext = {
          rootOrganizationId: createOrganizationId(user.rootOrganizationId),
          currentOrganizationId: createOrganizationId(user.primaryOrganizationId),
          accessibleOrganizationIds,
        };

        // Generate tokens with organization context
        const accessToken = signAccessToken(userId, user.email, organizationContext);
        const { token: refreshToken } = await refreshTokenRepo.create(userId, {
          userAgent: request.headers['user-agent'],
          ipAddress: request.ip,
        });

        // Redirect with tokens in URL fragment to the auth callback handler
        const returnUrl = stateData.returnUrl || '/auth/callback';
        const tokenFragment = `#access_token=${accessToken}&refresh_token=${refreshToken}&expires_in=900`;

        return reply.redirect(returnUrl + tokenFragment);
      } catch (err) {
        app.log.error({ err }, 'Google OAuth error');
        const message = err instanceof Error ? err.message : 'Authentication failed';
        return reply.redirect(`/login?error=${encodeURIComponent(message)}`);
      }
    }
  );

  // ============================================================================
  // GitHub OAuth2
  // ============================================================================

  // GET /auth/github - Initiate GitHub OAuth
  // Supports org-scoped SSO: pass orgId to use organization's SSO configuration
  app.withTypeProvider<ZodTypeProvider>().get(
    '/github',
    {
      schema: {
        querystring: z.object({
          returnUrl: z.string().optional(),
          orgId: z.string().uuid().optional(), // Organization-scoped SSO
        }),
      },
    },
    async (request, reply) => {
      const { orgId } = request.query;

      // Validate organization if orgId provided
      if (orgId) {
        const org = await orgRepo.findById(createOrganizationId(orgId));
        if (!org || !org.isActive) {
          throw Errors.badRequest('Invalid or inactive organization');
        }
      }

      const clientId = process.env.GITHUB_CLIENT_ID;
      if (!clientId) {
        throw Errors.badRequest('GitHub OAuth not configured. Set GITHUB_CLIENT_ID in environment.');
      }

      const state = generateState();
      const { returnUrl } = request.query;
      storeState(state, returnUrl, orgId);

      const baseUrl = `${request.protocol}://${request.hostname}`;
      const callbackUrl = `${baseUrl}/api/v1/auth/github/callback`;

      const authUrl = new URL('https://github.com/login/oauth/authorize');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', callbackUrl);
      authUrl.searchParams.set('scope', 'user:email read:user');
      authUrl.searchParams.set('state', state);

      return reply.redirect(authUrl.toString());
    }
  );

  // GET /auth/github/callback - Handle GitHub OAuth callback
  app.withTypeProvider<ZodTypeProvider>().get(
    '/github/callback',
    {
      schema: {
        querystring: z.object({
          code: z.string().optional(),
          state: z.string().optional(),
          error: z.string().optional(),
          error_description: z.string().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { code, state, error, error_description } = request.query;

      if (error) {
        const errorMsg = error_description || error;
        return reply.redirect(`/login?error=${encodeURIComponent(errorMsg)}`);
      }

      if (!code || !state) {
        return reply.redirect('/login?error=Missing authorization code');
      }

      const stateData = validateAndClearState(state);
      if (!stateData) {
        return reply.redirect('/login?error=Invalid or expired state');
      }

      const clientId = process.env.GITHUB_CLIENT_ID;
      const clientSecret = process.env.GITHUB_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return reply.redirect('/login?error=GitHub OAuth not configured');
      }

      try {
        // Exchange code for tokens
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            code,
            client_id: clientId,
            client_secret: clientSecret,
          }),
        });

        const tokens = await tokenResponse.json() as { access_token?: string; error?: string };

        if (tokens.error || !tokens.access_token) {
          app.log.error({ tokens }, 'GitHub token exchange failed');
          return reply.redirect('/login?error=Failed to authenticate with GitHub');
        }

        // Get user info
        const userResponse = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            'User-Agent': 'ArgusIQ',
          },
        });

        const githubUser = await userResponse.json() as {
          id: number;
          login: string;
          name?: string;
          email?: string;
          avatar_url?: string;
        };

        // Get primary email if not in profile
        let email = githubUser.email;
        if (!email) {
          const emailsResponse = await fetch('https://api.github.com/user/emails', {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
              'User-Agent': 'ArgusIQ',
            },
          });
          const emails = await emailsResponse.json() as Array<{
            email: string;
            primary: boolean;
            verified: boolean;
          }>;
          const primaryEmail = emails.find(e => e.primary && e.verified);
          email = primaryEmail?.email;
        }

        if (!email) {
          return reply.redirect('/login?error=Could not get email from GitHub');
        }

        // Determine target organization from state or default
        const targetOrgId = stateData.organizationId || request.rootOrganizationId;

        // Find or create user
        let user = await userRepo.findByEmail(email);

        if (!user) {
          // Auto-create user for social login
          let orgId: string;

          if (targetOrgId) {
            // Use organization from state (org-scoped SSO)
            orgId = targetOrgId;
          } else {
            // Fallback: Get first root organization
            const defaultOrgResult = await sql`
              SELECT id FROM organizations WHERE is_root = true LIMIT 1
            `;

            if (defaultOrgResult.length === 0) {
              return reply.redirect('/login?error=No organization configured. Please contact admin.');
            }

            orgId = defaultOrgResult[0].id;
          }

          // Get organization details for validation
          const targetOrg = await orgRepo.findById(createOrganizationId(orgId));
          if (!targetOrg || !targetOrg.isActive) {
            return reply.redirect('/login?error=Organization is not active');
          }

          // Use rootOrganizationId if this is a child org
          const rootOrgId = targetOrg.rootOrganizationId ?? targetOrg.id;

          const nameParts = githubUser.name?.split(' ') || [];
          user = await userRepo.create({
            email,
            passwordHash: null,
            firstName: nameParts[0] || githubUser.login,
            lastName: nameParts.slice(1).join(' ') || null,
            rootOrganizationId: rootOrgId,
            primaryOrganizationId: orgId,
            emailVerifiedAt: new Date(),
            avatarUrl: githubUser.avatar_url || null,
          });

          await sql`
            INSERT INTO user_organizations (user_id, organization_id, role, is_primary)
            VALUES (${user.id}, ${orgId}, 'member', true)
            ON CONFLICT (user_id, organization_id) DO NOTHING
          `;
        }

        // Build organization context for JWT (ADR-002)
        const userId = createUserId(user.id);
        const userOrgs = await userOrgRepo.getUserOrganizations(userId);
        const accessibleOrganizationIds = userOrgs.map((membership) =>
          createOrganizationId(membership.organizationId)
        );

        const organizationContext = {
          rootOrganizationId: createOrganizationId(user.rootOrganizationId),
          currentOrganizationId: createOrganizationId(user.primaryOrganizationId),
          accessibleOrganizationIds,
        };

        // Generate tokens with organization context
        const accessToken = signAccessToken(userId, user.email, organizationContext);
        const { token: refreshToken } = await refreshTokenRepo.create(userId, {
          userAgent: request.headers['user-agent'],
          ipAddress: request.ip,
        });

        // Redirect with tokens in URL fragment to the auth callback handler
        const returnUrl = stateData.returnUrl || '/auth/callback';
        const tokenFragment = `#access_token=${accessToken}&refresh_token=${refreshToken}&expires_in=900`;

        return reply.redirect(returnUrl + tokenFragment);
      } catch (err) {
        app.log.error({ err }, 'GitHub OAuth error');
        const message = err instanceof Error ? err.message : 'Authentication failed';
        return reply.redirect(`/login?error=${encodeURIComponent(message)}`);
      }
    }
  );

  // GET /auth/providers - List available social login providers
  // Supports org-scoped providers: pass orgId to get organization's configured SSO
  app.withTypeProvider<ZodTypeProvider>().get(
    '/providers',
    {
      schema: {
        querystring: z.object({
          orgId: z.string().uuid().optional(), // Get org-specific providers
        }),
        response: {
          200: z.object({
            providers: z.array(z.object({
              type: z.string(),
              name: z.string(),
              enabled: z.boolean(),
            })),
          }),
        },
      },
    },
    async (request) => {
      const { orgId } = request.query;
      const providers = [];

      // If orgId provided, return organization-specific SSO connections
      if (orgId) {
        // Get SSO connections from database for this organization
        const ssoConnections = await sql`
          SELECT type, name, display_name, enabled
          FROM identity_providers
          WHERE organization_id = ${orgId} AND enabled = true
          ORDER BY display_name, name
        `;

        for (const connection of ssoConnections) {
          providers.push({
            type: connection.type,
            name: connection.display_name || connection.name,
            enabled: connection.enabled,
          });
        }

        // Fall back to platform-wide providers if org has no specific connections
        if (providers.length === 0) {
          if (process.env.GOOGLE_CLIENT_ID) {
            providers.push({
              type: 'google',
              name: 'Google',
              enabled: true,
            });
          }

          if (process.env.GITHUB_CLIENT_ID) {
            providers.push({
              type: 'github',
              name: 'GitHub',
              enabled: true,
            });
          }
        }
      } else {
        // Platform-wide providers (from environment variables)
        if (process.env.GOOGLE_CLIENT_ID) {
          providers.push({
            type: 'google',
            name: 'Google',
            enabled: true,
          });
        }

        if (process.env.GITHUB_CLIENT_ID) {
          providers.push({
            type: 'github',
            name: 'GitHub',
            enabled: true,
          });
        }
      }

      return { providers };
    }
  );
}
