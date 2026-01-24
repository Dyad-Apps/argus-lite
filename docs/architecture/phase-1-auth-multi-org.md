# Phase 1: Authentication & Multi-Organization

> **Status:** Complete
> **Sprint:** 1
> **Last Updated:** January 2026

## Overview

This phase implements the authentication system and multi-organization support for Argus IQ. The system supports both traditional email/password authentication and enterprise SSO through various identity providers.

## ADR Alignment

This implementation follows the architectural decisions documented in:
- **ADR-001**: Multi-Tenant Model with Unlimited Recursive Organization Trees
- **ADR-002**: Subdomain-Based Root Organization Identification

### Key Design Principles

| Principle | Description |
|-----------|-------------|
| **Root Organization Isolation** | All data is scoped by `root_organization_id` for complete isolation between enterprises |
| **LTREE Hierarchy** | PostgreSQL LTREE extension enables efficient tree queries for unlimited depth |
| **Subdomain = Root Org** | URL subdomain identifies the root organization (e.g., `acme.argusiq.com`) |
| **Email per Root** | Same email can exist in different root organizations |
| **org_code for Switching** | Human-readable code for UI dropdowns, NOT used for login |

## Table of Contents

- [ADR Alignment](#adr-alignment)
- [Components](#components)
- [Authentication Flow](#authentication-flow)
- [SSO Integration](#sso-integration-implementation-change)
- [Multi-Organization Model](#multi-organization-model)
- [Role-Based Access Control](#role-based-access-control)
- [API Reference](#api-reference)
- [How-To Guides](#how-to-guides)

---

## Components

### Component Diagram

```mermaid
graph TB
    subgraph "Authentication Layer"
        AUTH_PLUGIN[Auth Plugin<br/>plugins/auth.ts]
        JWT_SVC[JWT Service<br/>auth/jwt.ts]
        SSO_SVC[SSO Service<br/>auth/sso-service.ts]
    end

    subgraph "Passport Strategies"
        GOOGLE[Google Strategy<br/>strategies/google.ts]
        GITHUB[GitHub Strategy<br/>strategies/github.ts]
        OIDC[OIDC Strategy<br/>strategies/oidc.ts]
        SAML[SAML Strategy<br/>strategies/saml.ts]
    end

    subgraph "Route Handlers"
        AUTH_ROUTES[Auth Routes<br/>routes/v1/auth.ts]
        SSO_ROUTES[SSO Routes<br/>routes/v1/sso.ts]
        ORG_ROUTES[Org Routes<br/>routes/v1/organizations.ts]
    end

    subgraph "Database"
        USERS[(users)]
        ORGS[(organizations)]
        MEMBERS[(org_members)]
        IDP[(identity_providers)]
        IDENTITIES[(user_identities)]
    end

    AUTH_ROUTES --> AUTH_PLUGIN
    SSO_ROUTES --> SSO_SVC
    AUTH_PLUGIN --> JWT_SVC

    SSO_SVC --> GOOGLE
    SSO_SVC --> GITHUB
    SSO_SVC --> OIDC
    SSO_SVC --> SAML

    AUTH_ROUTES --> USERS
    SSO_ROUTES --> IDP
    SSO_ROUTES --> IDENTITIES
    ORG_ROUTES --> ORGS
    ORG_ROUTES --> MEMBERS

    GOOGLE --> IDENTITIES
    GITHUB --> IDENTITIES
    OIDC --> IDENTITIES
    SAML --> IDENTITIES
```

### Component Descriptions

| Component | File | Responsibility |
|-----------|------|----------------|
| **Auth Plugin** | `plugins/auth.ts` | Fastify plugin providing `authenticate` and `optionalAuth` decorators |
| **JWT Service** | `auth/jwt.ts` | Token generation, validation, and refresh |
| **SSO Service** | `auth/sso-service.ts` | Handles SSO callbacks, user creation, account linking |
| **Google Strategy** | `strategies/google.ts` | Google OAuth2 via Passport.js |
| **GitHub Strategy** | `strategies/github.ts` | GitHub OAuth2 via Passport.js |
| **OIDC Strategy** | `strategies/oidc.ts` | Generic OpenID Connect (Okta, Auth0, etc.) |
| **SAML Strategy** | `strategies/saml.ts` | SAML 2.0 for enterprise IdPs |

---

## Authentication Flow

### Email/Password Authentication

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant AuthService
    participant Database
    participant Cache

    Client->>API: POST /api/v1/auth/login
    Note right of Client: { email, password }

    API->>Database: Find user by email
    Database-->>API: User record

    API->>AuthService: Verify password (Argon2)
    AuthService-->>API: Password valid

    API->>AuthService: Generate tokens
    AuthService-->>API: { accessToken, refreshToken }

    API->>Cache: Store refresh token
    Cache-->>API: OK

    API-->>Client: 200 OK
    Note left of API: { accessToken, refreshToken, user }
```

### Token Refresh Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Cache
    participant AuthService

    Client->>API: POST /api/v1/auth/refresh
    Note right of Client: { refreshToken }

    API->>Cache: Validate refresh token
    Cache-->>API: Token valid + userId

    API->>AuthService: Generate new tokens
    AuthService-->>API: { accessToken, refreshToken }

    API->>Cache: Rotate refresh token
    Note right of API: Delete old, store new

    API-->>Client: 200 OK
    Note left of API: { accessToken, refreshToken }
```

### JWT Token Structure

```typescript
// Access Token Payload
interface AccessTokenPayload {
  sub: string;          // User ID
  email: string;
  orgId?: string;       // Current organization context
  role?: OrgRole;       // Role in current organization
  iat: number;          // Issued at
  exp: number;          // Expires (15 minutes)
}

// Refresh Token Payload
interface RefreshTokenPayload {
  sub: string;          // User ID
  jti: string;          // Unique token ID (for revocation)
  iat: number;
  exp: number;          // Expires (7 days)
}
```

---

## SSO Integration (Implementation Change)

> **Change Notice:** SSO support was added during implementation to meet enterprise requirements. This was not in the original specification.

### Supported Identity Providers

| Provider | Protocol | Use Case |
|----------|----------|----------|
| **Google** | OAuth 2.0 | Consumer and Google Workspace |
| **GitHub** | OAuth 2.0 | Developer teams |
| **OIDC** | OpenID Connect | Okta, Auth0, Azure AD, custom IdPs |
| **SAML** | SAML 2.0 | Enterprise IdPs (Okta, OneLogin, ADFS) |

### SSO Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Client
    participant API
    participant IdP as Identity Provider
    participant Database

    User->>Client: Click "Sign in with Google"
    Client->>API: GET /api/v1/sso/{providerId}/authorize
    API-->>Client: 302 Redirect to IdP

    Client->>IdP: Authorization request
    User->>IdP: Authenticate & consent
    IdP-->>Client: 302 Redirect with code

    Client->>API: GET /api/v1/sso/{providerId}/callback?code=xxx
    API->>IdP: Exchange code for tokens
    IdP-->>API: { access_token, id_token }

    API->>IdP: Get user profile
    IdP-->>API: { email, name, picture }

    API->>Database: Find/create user identity
    Database-->>API: User record

    API->>API: Generate JWT tokens

    API-->>Client: 302 Redirect with tokens
    Note left of API: Redirect to app with tokens in URL fragment
```

### Identity Provider Configuration

```mermaid
erDiagram
    organizations ||--o{ identity_providers : "has"
    identity_providers ||--o{ user_identities : "authenticates"
    users ||--o{ user_identities : "has"

    identity_providers {
        uuid id PK
        uuid organization_id FK
        enum type "oidc|saml|google|github|microsoft|okta"
        varchar name
        jsonb config
        boolean enabled
        boolean auto_create_users
        boolean auto_link_users
    }

    user_identities {
        uuid id PK
        uuid user_id FK
        uuid provider_id FK
        varchar external_id
        varchar email
        jsonb profile_data
        timestamp last_login_at
    }
```

### Provider Configuration Examples

#### Google OAuth

```typescript
// identity_providers.config for Google
const googleConfig: SocialConfig = {
  type: 'google',
  clientId: 'your-client-id.apps.googleusercontent.com',
  clientSecret: 'your-client-secret',
  scopes: ['openid', 'email', 'profile'],
};
```

#### OIDC (Okta)

```typescript
// identity_providers.config for OIDC
const oidcConfig: OidcConfig = {
  type: 'oidc',
  issuer: 'https://your-org.okta.com',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  scopes: ['openid', 'email', 'profile'],
};
```

#### SAML 2.0

```typescript
// identity_providers.config for SAML
const samlConfig: SamlConfig = {
  type: 'saml',
  entryPoint: 'https://idp.example.com/sso/saml',
  issuer: 'argus-iq',
  cert: '-----BEGIN CERTIFICATE-----\n...',
  signatureAlgorithm: 'sha256',
};
```

---

## Multi-Organization Model

> **ADR Reference:** ADR-001 (Unlimited Recursive Trees) + ADR-002 (Subdomain Routing)

### Root Organization Concept

Root organizations are the top-level tenants that provide complete data isolation:

```mermaid
graph TB
    subgraph "Platform"
        subgraph "Root: Radio OEM (radio.argusiq.com)"
            R1[Radio OEM<br/>is_root: true<br/>subdomain: radio]
            R1_C1[Walmart<br/>org_code: WALMART]
            R1_C2[Kroger<br/>org_code: KROGER]
            R1_C1_1[Northeast Region<br/>org_code: REGION-NE]
            R1_C1_2[Southeast Region<br/>org_code: REGION-SE]

            R1 --> R1_C1
            R1 --> R1_C2
            R1_C1 --> R1_C1_1
            R1_C1 --> R1_C1_2
        end

        subgraph "Root: MegaCorp (mega.argusiq.com)"
            R2[MegaCorp<br/>is_root: true<br/>subdomain: mega]
            R2_C1[Division A<br/>org_code: DIV-A]
            R2_C2[Division B<br/>org_code: DIV-B]

            R2 --> R2_C1
            R2 --> R2_C2
        end
    end

    style R1 fill:#4CAF50,color:white
    style R2 fill:#2196F3,color:white
```

### LTREE Path Structure

Organizations use PostgreSQL LTREE for efficient hierarchy queries:

| Organization | path | depth | root_organization_id |
|-------------|------|-------|---------------------|
| Radio OEM | `radio` | 0 | `radio-uuid` |
| Walmart | `radio.walmart` | 1 | `radio-uuid` |
| Northeast Region | `radio.walmart.northeast` | 2 | `radio-uuid` |
| Store #123 | `radio.walmart.northeast.store123` | 3 | `radio-uuid` |

### Data Model (ADR-Aligned)

```mermaid
erDiagram
    organizations ||--o{ organizations : "parent_of"
    organizations ||--o{ user_organizations : "has_members"
    organizations ||--o{ organization_branding : "has_branding"
    users ||--o{ user_organizations : "member_of"
    users }o--|| organizations : "root_organization"
    users }o--|| organizations : "primary_organization"

    organizations {
        uuid id PK
        varchar name
        varchar slug UK
        varchar org_code "Human-readable code for switching"
        uuid parent_organization_id FK "Self-reference"
        uuid root_organization_id FK "Data isolation key"
        boolean is_root "True for top-level orgs"
        ltree path "LTREE for tree queries"
        integer depth "Level in hierarchy"
        varchar subdomain UK "Only for root orgs"
        boolean can_have_children
        enum plan "free|starter|professional|enterprise"
        jsonb settings
    }

    users {
        uuid id PK
        varchar email "Unique per root org"
        varchar password_hash "Nullable for SSO users"
        uuid root_organization_id FK "Data isolation"
        uuid primary_organization_id FK "Default after login"
        boolean mfa_enabled
        enum status "active|inactive|suspended"
    }

    user_organizations {
        uuid user_id PK_FK
        uuid organization_id PK_FK
        enum role "owner|admin|member|viewer"
        boolean is_primary "Default org for user"
        timestamp expires_at "Time-limited access"
        timestamp joined_at
    }

    organization_branding {
        uuid id PK
        uuid organization_id FK UK
        text logo_url
        varchar primary_color
        enum login_background_type
        varchar login_welcome_text
    }
```

### Subdomain-Based Authentication (ADR-002)

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant API
    participant DB

    User->>Browser: Navigate to radio.argusiq.com
    Browser->>API: GET /api/v1/organizations/branding?subdomain=radio
    API->>DB: SELECT * FROM organizations WHERE subdomain = 'radio'
    DB-->>API: { id: 'radio-uuid', branding: {...} }
    API-->>Browser: { organizationId, branding, ssoProviders }
    Browser->>Browser: Render branded login page

    User->>Browser: Enter email + password
    Browser->>API: POST /api/v1/auth/login
    Note right of Browser: { email, password, organizationId: 'radio-uuid' }

    API->>DB: Find user WHERE email = ? AND root_organization_id = ?
    Note right of API: Email unique per root org!
    DB-->>API: User record

    API->>API: Verify password, generate JWT
    Note right of API: JWT contains:<br/>root_organization_id<br/>current_organization_id<br/>accessible_organization_ids

    API-->>Browser: { accessToken, refreshToken }
    Browser->>Browser: Store tokens, redirect to dashboard
```

### Organization Switching

Users can switch between organizations they have access to within the same root:

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant API
    participant DB

    User->>UI: Click org switcher dropdown
    UI->>API: GET /api/v1/auth/organizations
    API->>DB: SELECT orgs WHERE user has access
    DB-->>API: [Walmart, Kroger, Northeast Region]
    API-->>UI: { organizations, currentOrganizationId }
    UI->>UI: Display dropdown with org_codes

    User->>UI: Select "KROGER"
    UI->>API: POST /api/v1/auth/switch-organization
    Note right of UI: { organizationId: 'kroger-uuid' }

    API->>DB: Verify user access to org
    API->>API: Generate new JWT with current_organization_id = kroger
    API-->>UI: { accessToken, refreshToken }

    UI->>UI: Reload page with new org context
```

### Organization Context Flow (ADR-002 Aligned)

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Middleware
    participant Database

    Client->>API: GET /api/v1/entities
    Note right of Client: Authorization: Bearer xxx
    Note right of Client: JWT contains org context

    API->>Middleware: Extract JWT
    Note right of Middleware: Decode:<br/>root_organization_id<br/>current_organization_id<br/>accessible_organization_ids

    Middleware->>Middleware: Set request context
    Note right of Middleware: req.user = { id, email, rootOrgId }
    Note right of Middleware: req.organization = { id, role }

    Middleware->>Database: SET app.current_user_id
    Middleware->>Database: SET app.current_org_id
    Middleware->>Database: SET app.current_root_org_id
    Note right of Middleware: For RLS policies

    API->>Database: SELECT * FROM entities
    Note right of Database: RLS filter:<br/>1. root_organization_id check<br/>2. user_can_access_org(tenant_id)

    Database-->>API: Filtered results
    API-->>Client: 200 OK { entities: [...] }
```

### JWT Token Structure (Updated for ADR-002)

```typescript
// Access Token Payload (ADR-002 compliant)
interface AccessTokenPayload {
  sub: string;                    // User ID
  email: string;
  rootOrgId: string;              // Root organization (data isolation)
  currentOrgId: string;           // Current organization context
  accessibleOrgIds: string[];     // All orgs user can switch to
  role: OrgRole;                  // Role in current organization
  iat: number;                    // Issued at
  exp: number;                    // Expires (15 minutes)
}

// Refresh Token Payload
interface RefreshTokenPayload {
  sub: string;                    // User ID
  rootOrgId: string;              // Root organization
  jti: string;                    // Unique token ID
  iat: number;
  exp: number;                    // Expires (7 days)
}
```

---

## Role-Based Access Control

### Role Hierarchy

```mermaid
graph TD
    OWNER[Owner<br/>Full control]
    ADMIN[Admin<br/>Manage members + settings]
    MEMBER[Member<br/>Read/write resources]
    VIEWER[Viewer<br/>Read-only]

    OWNER --> ADMIN
    ADMIN --> MEMBER
    MEMBER --> VIEWER
```

### Permission Matrix

| Permission | Owner | Admin | Member | Viewer |
|------------|-------|-------|--------|--------|
| View resources | Yes | Yes | Yes | Yes |
| Create resources | Yes | Yes | Yes | No |
| Edit resources | Yes | Yes | Yes | No |
| Delete resources | Yes | Yes | No | No |
| Manage members | Yes | Yes | No | No |
| Change member roles | Yes | Yes* | No | No |
| Organization settings | Yes | Yes | No | No |
| Delete organization | Yes | No | No | No |
| Configure SSO | Yes | Yes | No | No |
| View audit logs | Yes | Yes | No | No |

*Admins cannot promote to Owner or demote Owners

### Role Check Implementation

```typescript
// Example: Route with role check
app.delete(
  '/organizations/:orgId/members/:userId',
  {
    preHandler: [
      app.authenticate,
      requireRole(['owner', 'admin']),
    ],
  },
  async (request, reply) => {
    // Only owners and admins can remove members
    const { orgId, userId } = request.params;
    await removeMember(orgId, userId);
    return reply.status(204).send();
  }
);

// Role check middleware
function requireRole(allowedRoles: OrgRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userRole = request.organization?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      throw new ForbiddenError('Insufficient permissions');
    }
  };
}
```

---

## API Reference

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/auth/register` | Create new account |
| `POST` | `/api/v1/auth/login` | Email/password login (includes organizationId for root context) |
| `POST` | `/api/v1/auth/refresh` | Refresh access token |
| `POST` | `/api/v1/auth/logout` | Invalidate refresh token |
| `POST` | `/api/v1/auth/forgot-password` | Request password reset |
| `POST` | `/api/v1/auth/reset-password` | Set new password |
| `GET` | `/api/v1/auth/me` | Get current user |
| `GET` | `/api/v1/auth/organizations` | **NEW:** List user's accessible organizations |
| `POST` | `/api/v1/auth/switch-organization` | **NEW:** Switch organization context |

### SSO Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/sso/providers` | List available SSO providers |
| `GET` | `/api/v1/sso/:providerId/authorize` | Initiate SSO flow |
| `GET` | `/api/v1/sso/:providerId/callback` | Handle IdP callback |
| `GET` | `/api/v1/sso/discover` | Enterprise SSO discovery |
| `GET` | `/api/v1/sso/identities` | List linked identities |
| `DELETE` | `/api/v1/sso/identities/:id` | Unlink identity |

### Organization Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/organizations` | List user's organizations |
| `POST` | `/api/v1/organizations` | Create organization |
| `GET` | `/api/v1/organizations/:id` | Get organization details |
| `PATCH` | `/api/v1/organizations/:id` | Update organization |
| `DELETE` | `/api/v1/organizations/:id` | Delete organization |
| `GET` | `/api/v1/organizations/:id/members` | List members |
| `POST` | `/api/v1/organizations/:id/members` | Add member |
| `PATCH` | `/api/v1/organizations/:id/members/:userId` | Update member role |
| `DELETE` | `/api/v1/organizations/:id/members/:userId` | Remove member |
| `GET` | `/api/v1/organizations/:id/children` | **NEW:** List child organizations |
| `POST` | `/api/v1/organizations/:id/children` | **NEW:** Create child organization |

### Branding Endpoints (White-Label)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/organizations/branding` | Get branding by subdomain (public) |
| `GET` | `/api/v1/organizations/:id/branding` | Get organization branding |
| `PUT` | `/api/v1/organizations/:id/branding` | Update organization branding |

---

## How-To Guides

### How to Add a New SSO Provider (Organization Admin)

1. **Navigate to Organization Settings**
   ```
   Settings > Security > Identity Providers
   ```

2. **Click "Add Provider"**

3. **Select Provider Type**
   - Google (OAuth 2.0)
   - GitHub (OAuth 2.0)
   - OIDC (OpenID Connect)
   - SAML 2.0

4. **Configure Provider**

   For **Google**:
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create OAuth 2.0 credentials
   - Set authorized redirect URI: `https://your-domain.com/api/v1/sso/{providerId}/callback`
   - Copy Client ID and Client Secret

   For **OIDC (Okta)**:
   - Create new OIDC application in Okta Admin
   - Set Sign-in redirect URI: `https://your-domain.com/api/v1/sso/{providerId}/callback`
   - Copy Issuer URL, Client ID, and Client Secret

5. **Enable Auto-Provisioning** (Optional)
   - `Auto-create users`: Automatically create accounts for new SSO users
   - `Auto-link users`: Link SSO accounts to existing users by email

6. **Test the Integration**
   - Open an incognito window
   - Try signing in with the new provider
   - Verify user profile is correctly populated

### How to Implement Custom Authentication Logic

1. **Create a new strategy file**

```typescript
// packages/api/src/auth/strategies/custom.ts
import { Strategy } from 'passport-custom';
import type { SsoProfile } from '../sso-types.js';

export function createCustomStrategy(
  providerId: string,
  config: CustomConfig
): Strategy {
  return new Strategy(async (req, done) => {
    try {
      // Your custom authentication logic
      const token = req.headers['x-custom-token'];
      const profile = await validateCustomToken(token, config);

      const ssoProfile: SsoProfile = {
        providerId,
        externalId: profile.id,
        email: profile.email,
        emailVerified: true,
        displayName: profile.name,
        rawProfile: profile,
      };

      done(null, { profile: ssoProfile });
    } catch (error) {
      done(error as Error);
    }
  });
}
```

2. **Register the strategy**

```typescript
// In sso-service.ts
import { createCustomStrategy } from './strategies/custom.js';

function getStrategy(provider: IdentityProvider) {
  switch (provider.type) {
    case 'custom':
      return createCustomStrategy(provider.id, provider.config);
    // ... other cases
  }
}
```

3. **Add the provider type to the enum**

```typescript
// In db/schema/enums.ts
export const identityProviderTypeEnum = pgEnum('identity_provider_type', [
  'oidc',
  'saml',
  'google',
  'github',
  'microsoft',
  'okta',
  'custom', // Add this
]);
```

### How to Switch Organization Context

```typescript
// Frontend example
const switchOrganization = async (orgId: string) => {
  // Store the selected org
  localStorage.setItem('currentOrgId', orgId);

  // All subsequent API calls include the org header
  api.defaults.headers['X-Organization-Id'] = orgId;

  // Optionally get a new token with org context
  const response = await api.post('/auth/refresh', {
    refreshToken,
    organizationId: orgId,
  });

  // New token has org context embedded
  setAccessToken(response.data.accessToken);
};
```

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| SSO callback fails with "Invalid state" | Session expired or CSRF mismatch | Clear cookies and retry |
| "User not found in organization" | User hasn't been added to org | Admin needs to invite user first |
| Token refresh fails | Refresh token expired or revoked | Re-authenticate with full login |
| SAML assertion invalid | Clock skew or certificate mismatch | Check server time sync and cert |

### Debug Mode

Enable verbose authentication logging:

```bash
# In .env
LOG_LEVEL=debug
```

Check auth-related logs:

```bash
# Filter for auth logs
pnpm dev 2>&1 | grep -E "(auth|sso|jwt)"
```

---

[← Back to Architecture Overview](./README.md) | [Next: Phase 2 - Database & RLS →](./phase-2-database-rls.md)
