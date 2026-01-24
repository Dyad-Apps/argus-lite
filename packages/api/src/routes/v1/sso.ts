/**
 * SSO routes - Single Sign-On authentication flows
 *
 * Supports:
 * - OAuth2 social logins (Google, GitHub)
 * - OpenID Connect (Okta, Auth0, generic)
 * - SAML 2.0 (Enterprise SSO) - requires additional setup
 */

import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { Errors } from '@argus/shared';
import { ssoService } from '../../auth/sso-service.js';
import {
  getOidcAuthUrl,
  handleOidcCallback,
  normalizeSamlProfile,
  type SamlProfile,
} from '../../auth/strategies/index.js';
import type { SsoProfile, SsoSessionState } from '../../auth/sso-types.js';
import type {
  SocialConfig,
  OidcConfig,
  SamlConfig,
} from '../../db/schema/identity-providers.js';
import { getRefreshTokenRepository } from '../../repositories/index.js';
import { signAccessToken } from '../../utils/index.js';

// State storage (use Redis in production)
const stateStore = new Map<string, SsoSessionState>();

function generateState(): string {
  return randomBytes(32).toString('hex');
}

function storeState(state: string, data: SsoSessionState): void {
  stateStore.set(state, data);
  // Clean up after 10 minutes
  setTimeout(() => stateStore.delete(state), 10 * 60 * 1000);
}

function getAndClearState(state: string): SsoSessionState | undefined {
  const data = stateStore.get(state);
  stateStore.delete(state);
  return data;
}

export async function ssoRoutes(app: FastifyInstance): Promise<void> {
  const refreshTokenRepo = getRefreshTokenRepository();

  // Helper to generate tokens after SSO auth
  async function generateTokens(
    profile: SsoProfile,
    request: { headers: { 'user-agent'?: string }; ip: string }
  ) {
    const result = await ssoService.authenticateWithProfile(profile);

    const accessToken = signAccessToken(result.user.id, result.user.email);
    const { token: refreshToken } = await refreshTokenRepo.create(
      result.user.id,
      {
        userAgent: request.headers['user-agent'],
        ipAddress: request.ip,
      }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName ?? null,
        lastName: result.user.lastName ?? null,
        isNewUser: result.isNewUser,
      },
    };
  }

  // GET /sso/providers - List available SSO providers
  app.withTypeProvider<ZodTypeProvider>().get(
    '/providers',
    {
      schema: {
        querystring: z.object({
          organizationId: z.string().uuid().optional(),
        }),
        response: {
          200: z.object({
            providers: z.array(
              z.object({
                id: z.string(),
                type: z.string(),
                name: z.string(),
                displayName: z.string().nullable(),
              })
            ),
          }),
        },
      },
    },
    async (request) => {
      const { organizationId } = request.query;
      const providers =
        await ssoService.getProvidersForOrganization(organizationId);
      return { providers };
    }
  );

  // GET /sso/:providerId/authorize - Initiate SSO flow
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:providerId/authorize',
    {
      schema: {
        params: z.object({
          providerId: z.string().uuid(),
        }),
        querystring: z.object({
          returnUrl: z.string().url().optional(),
          organizationId: z.string().uuid().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { providerId } = request.params;
      const { returnUrl, organizationId } = request.query;

      const provider = await ssoService.getProviderById(providerId);
      if (!provider || !provider.enabled) {
        throw Errors.notFound('Identity provider not found');
      }

      const state = generateState();
      const nonce = generateState();
      const baseUrl = `${request.protocol}://${request.hostname}`;
      const callbackUrl = `${baseUrl}/api/v1/sso/${providerId}/callback`;

      storeState(state, {
        providerId,
        returnUrl,
        organizationId,
        nonce,
      });

      let authUrl: string;

      switch (provider.type) {
        case 'google': {
          const config = provider.config as SocialConfig;
          authUrl =
            `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${config.clientId}&` +
            `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
            `response_type=code&` +
            `scope=${encodeURIComponent((config.scopes ?? ['openid', 'email', 'profile']).join(' '))}&` +
            `state=${state}&` +
            `access_type=offline&` +
            `prompt=consent`;
          break;
        }

        case 'github': {
          const config = provider.config as SocialConfig;
          authUrl =
            `https://github.com/login/oauth/authorize?` +
            `client_id=${config.clientId}&` +
            `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
            `scope=${encodeURIComponent((config.scopes ?? ['user:email', 'read:user']).join(' '))}&` +
            `state=${state}`;
          break;
        }

        case 'oidc':
        case 'okta':
        case 'microsoft': {
          const config = provider.config as OidcConfig;
          authUrl = await getOidcAuthUrl(
            providerId,
            config,
            callbackUrl,
            state,
            nonce
          );
          break;
        }

        case 'saml': {
          const config = provider.config as SamlConfig;
          // SAML redirects to IdP entry point with RelayState for state tracking
          authUrl = `${config.entryPoint}?RelayState=${state}`;
          break;
        }

        default:
          throw Errors.badRequest(`Unsupported provider type: ${provider.type}`);
      }

      return reply.redirect(authUrl);
    }
  );

  // GET /sso/:providerId/callback - OAuth2/OIDC callback
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:providerId/callback',
    {
      schema: {
        params: z.object({
          providerId: z.string().uuid(),
        }),
        querystring: z.object({
          code: z.string().optional(),
          state: z.string().optional(),
          error: z.string().optional(),
          error_description: z.string().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { providerId } = request.params;
      const { code, state, error, error_description } = request.query;

      // Handle OAuth errors
      if (error) {
        const errorMsg = error_description ?? error;
        return reply.redirect(`/login?error=${encodeURIComponent(errorMsg)}`);
      }

      if (!code || !state) {
        return reply.redirect('/login?error=Missing authorization code');
      }

      const storedState = getAndClearState(state);
      if (!storedState || storedState.providerId !== providerId) {
        return reply.redirect('/login?error=Invalid state parameter');
      }

      const provider = await ssoService.getProviderById(providerId);
      if (!provider || !provider.enabled) {
        return reply.redirect('/login?error=Provider not found');
      }

      try {
        const baseUrl = `${request.protocol}://${request.hostname}`;
        const callbackUrl = `${baseUrl}/api/v1/sso/${providerId}/callback`;

        let profile: SsoProfile;

        switch (provider.type) {
          case 'google': {
            // Exchange code for tokens using Google API
            const config = provider.config as SocialConfig;
            const tokenResponse = await fetch(
              'https://oauth2.googleapis.com/token',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                  code,
                  client_id: config.clientId,
                  client_secret: config.clientSecret,
                  redirect_uri: callbackUrl,
                  grant_type: 'authorization_code',
                }),
              }
            );
            const tokens = (await tokenResponse.json()) as {
              access_token: string;
            };

            // Get user info
            const userResponse = await fetch(
              'https://www.googleapis.com/oauth2/v2/userinfo',
              {
                headers: { Authorization: `Bearer ${tokens.access_token}` },
              }
            );
            const userInfo = (await userResponse.json()) as {
              id: string;
              email: string;
              verified_email: boolean;
              given_name?: string;
              family_name?: string;
              name?: string;
              picture?: string;
            };

            profile = {
              providerId,
              externalId: userInfo.id,
              email: userInfo.email,
              emailVerified: userInfo.verified_email,
              firstName: userInfo.given_name,
              lastName: userInfo.family_name,
              displayName: userInfo.name,
              avatarUrl: userInfo.picture,
              rawProfile: userInfo,
            };
            break;
          }

          case 'github': {
            // Exchange code for tokens using GitHub API
            const config = provider.config as SocialConfig;
            const tokenResponse = await fetch(
              'https://github.com/login/oauth/access_token',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                },
                body: JSON.stringify({
                  code,
                  client_id: config.clientId,
                  client_secret: config.clientSecret,
                }),
              }
            );
            const tokens = (await tokenResponse.json()) as {
              access_token: string;
            };

            // Get user info
            const userResponse = await fetch('https://api.github.com/user', {
              headers: {
                Authorization: `Bearer ${tokens.access_token}`,
                'User-Agent': 'ArgusIQ',
              },
            });
            const userInfo = (await userResponse.json()) as {
              id: number;
              login: string;
              name?: string;
              email?: string;
              avatar_url?: string;
            };

            // Get primary email if not in profile
            let email = userInfo.email;
            if (!email) {
              const emailsResponse = await fetch(
                'https://api.github.com/user/emails',
                {
                  headers: {
                    Authorization: `Bearer ${tokens.access_token}`,
                    'User-Agent': 'ArgusIQ',
                  },
                }
              );
              const emails = (await emailsResponse.json()) as Array<{
                email: string;
                primary: boolean;
                verified: boolean;
              }>;
              const primaryEmail = emails.find((e) => e.primary && e.verified);
              email = primaryEmail?.email;
            }

            if (!email) {
              return reply.redirect(
                '/login?error=Could not get email from GitHub'
              );
            }

            const nameParts = userInfo.name?.split(' ') ?? [];
            profile = {
              providerId,
              externalId: String(userInfo.id),
              email,
              emailVerified: true,
              firstName: nameParts[0],
              lastName: nameParts.slice(1).join(' ') || undefined,
              displayName: userInfo.name ?? userInfo.login,
              avatarUrl: userInfo.avatar_url,
              rawProfile: userInfo,
            };
            break;
          }

          case 'oidc':
          case 'okta':
          case 'microsoft': {
            const config = provider.config as OidcConfig;
            profile = await handleOidcCallback(
              providerId,
              config,
              callbackUrl,
              code,
              state,
              storedState.nonce!
            );
            break;
          }

          default:
            return reply.redirect('/login?error=Unsupported provider type');
        }

        // Generate tokens
        const result = await generateTokens(profile, request);

        // Redirect with tokens (use fragment for security)
        const returnUrl = storedState.returnUrl ?? '/';
        const tokenFragment = `#access_token=${result.accessToken}&refresh_token=${result.refreshToken}&expires_in=${result.expiresIn}`;

        return reply.redirect(returnUrl + tokenFragment);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Authentication failed';
        return reply.redirect(`/login?error=${encodeURIComponent(message)}`);
      }
    }
  );

  // POST /sso/:providerId/callback - SAML callback (POST binding)
  app.withTypeProvider<ZodTypeProvider>().post(
    '/:providerId/callback',
    {
      schema: {
        params: z.object({
          providerId: z.string().uuid(),
        }),
        body: z.object({
          SAMLResponse: z.string(),
          RelayState: z.string().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { providerId } = request.params;
      const { SAMLResponse, RelayState } = request.body;

      const storedState = RelayState ? getAndClearState(RelayState) : undefined;
      if (!storedState || storedState.providerId !== providerId) {
        return reply.redirect('/login?error=Invalid SAML state');
      }

      const provider = await ssoService.getProviderById(providerId);
      if (!provider || !provider.enabled || provider.type !== 'saml') {
        return reply.redirect('/login?error=SAML provider not found');
      }

      try {
        // Decode SAML response (base64)
        const decodedResponse = Buffer.from(SAMLResponse, 'base64').toString(
          'utf-8'
        );

        // Basic parsing of SAML assertion
        // In production, use a proper SAML library for validation
        const nameIdMatch = decodedResponse.match(
          /<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/
        );
        const emailMatch =
          decodedResponse.match(
            /<saml:Attribute Name="email"[^>]*>\s*<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/
          ) ??
          decodedResponse.match(
            /<saml:Attribute Name="http:\/\/schemas\.xmlsoap\.org\/ws\/2005\/05\/identity\/claims\/emailaddress"[^>]*>\s*<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/
          );

        const email = emailMatch?.[1] ?? nameIdMatch?.[1];
        if (!email) {
          return reply.redirect(
            '/login?error=Could not extract email from SAML response'
          );
        }

        const samlProfile: SamlProfile = {
          nameID: nameIdMatch?.[1],
          email,
        };

        const profile = normalizeSamlProfile(providerId, samlProfile);

        // Generate tokens
        const result = await generateTokens(profile, request);
        const returnUrl = storedState.returnUrl ?? '/';
        const tokenFragment = `#access_token=${result.accessToken}&refresh_token=${result.refreshToken}&expires_in=${result.expiresIn}`;

        return reply.redirect(returnUrl + tokenFragment);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'SAML processing failed';
        return reply.redirect(`/login?error=${encodeURIComponent(message)}`);
      }
    }
  );

  // GET /sso/identities - Get current user's linked identities
  app.withTypeProvider<ZodTypeProvider>().get(
    '/identities',
    {
      preHandler: app.authenticate,
      schema: {
        response: {
          200: z.object({
            identities: z.array(
              z.object({
                id: z.string(),
                providerType: z.string(),
                providerName: z.string(),
                email: z.string().nullable(),
                lastUsedAt: z.string().nullable(),
                createdAt: z.string(),
              })
            ),
          }),
        },
      },
    },
    async (request) => {
      const identities = await ssoService.getUserIdentities(request.user!.id);
      return {
        identities: identities.map((i) => ({
          ...i,
          lastUsedAt: i.lastUsedAt?.toISOString() ?? null,
          createdAt: i.createdAt.toISOString(),
        })),
      };
    }
  );

  // DELETE /sso/identities/:identityId - Unlink an identity
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/identities/:identityId',
    {
      preHandler: app.authenticate,
      schema: {
        params: z.object({
          identityId: z.string().uuid(),
        }),
        response: {
          204: z.null(),
          400: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.string(),
              message: z.string(),
              timestamp: z.string(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { identityId } = request.params;
      await ssoService.unlinkIdentity(request.user!.id, identityId);
      return reply.status(204).send(null);
    }
  );
}
