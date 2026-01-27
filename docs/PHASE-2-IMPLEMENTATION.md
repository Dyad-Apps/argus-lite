# Phase 2: Subdomain Routing - Implementation Complete

**Status:** ✅ Complete
**Date:** January 27, 2026
**ADR:** ADR-002 - Subdomain-Based Root Tenant Identification

## Overview

Phase 2 implements subdomain-based routing for multi-tenant organization access. Users can now access their organizations via custom subdomains (e.g., `acme.argusiq.com`), and switch between organizations they have access to without re-authenticating.

## What Was Implemented

### 1. Subdomain Resolver Middleware ✅

**File:** [packages/api/src/middleware/subdomain-resolver.ts](../packages/api/src/middleware/subdomain-resolver.ts)

A Fastify plugin that runs **before authentication** to establish organization context:

**Features:**
- Extracts subdomain from request hostname
- Resolves subdomain to root organization ID via database lookup
- Attaches organization context to request object:
  - `request.subdomain` - Extracted subdomain string
  - `request.rootOrganizationId` - Resolved organization ID
  - `request.rootOrganization` - Organization details (name, subdomain, active status)
- Handles edge cases:
  - Localhost and IP addresses (for development)
  - Multi-level subdomains (takes rightmost subdomain)
  - Ignored subdomains (e.g., `www`, `api`)
  - Default subdomain when none provided
- Validates organization exists and is active
- Excludes health check and metrics routes

**Configuration (via environment variables):**
```bash
BASE_DOMAIN=argusiq.com              # Required to enable subdomain routing
DEFAULT_SUBDOMAIN=app                 # Fallback subdomain (optional)
IGNORE_SUBDOMAINS=www,api            # Subdomains to ignore (optional)
REQUIRE_ORGANIZATION=true             # Reject requests without valid org (optional)
```

**Example Flow:**
```
Request: https://acme.argusiq.com/api/v1/auth/login
↓
Middleware extracts "acme" from hostname
↓
Queries database: SELECT * FROM organizations WHERE subdomain = 'acme' AND is_root = true
↓
Attaches to request:
  request.subdomain = "acme"
  request.rootOrganizationId = "uuid-of-acme-org"
  request.rootOrganization = { id, name, subdomain, isActive }
```

---

### 2. Enhanced JWT Token Structure ✅

**File:** [packages/api/src/utils/jwt.ts](../packages/api/src/utils/jwt.ts)

Added `OrganizationContext` to JWT payload per ADR-002:

**New Interface:**
```typescript
interface OrganizationContext {
  rootOrganizationId: OrganizationId;          // Data isolation boundary
  currentOrganizationId: OrganizationId;        // Active organization context
  accessibleOrganizationIds: OrganizationId[];  // All orgs user can access
}

interface AccessTokenPayload {
  sub: UserId;
  email: string;
  type: 'access';
  org?: OrganizationContext;  // NEW: Organization context
  impersonation?: ImpersonationClaims;
}
```

**Updated Function Signature:**
```typescript
// Before
signAccessToken(userId: UserId, email: string): string

// After
signAccessToken(
  userId: UserId,
  email: string,
  organizationContext?: OrganizationContext,
  impersonation?: ImpersonationClaims
): string
```

**JWT Example:**
```json
{
  "sub": "user-uuid",
  "email": "john@acme.com",
  "type": "access",
  "org": {
    "rootOrganizationId": "acme-root-uuid",
    "currentOrganizationId": "acme-northeast-uuid",
    "accessibleOrganizationIds": ["acme-root-uuid", "acme-northeast-uuid", "acme-southeast-uuid"]
  },
  "iat": 1706371200,
  "exp": 1706372100
}
```

---

### 3. Updated Authentication Plugin ✅

**File:** [packages/api/src/plugins/auth.ts](../packages/api/src/plugins/auth.ts)

Extended `AuthUser` interface to include organization context:

```typescript
interface AuthUser {
  id: UserId;
  email: string;
  organizationContext?: OrganizationContext;  // NEW
}
```

Both `authenticate` and `optionalAuth` decorators now extract and attach the full organization context from the JWT to `request.user`.

---

### 4. Updated Login Flow ✅

**File:** [packages/api/src/routes/v1/auth.ts](../packages/api/src/routes/v1/auth.ts)

**Login endpoint changes:**
```typescript
// POST /api/v1/auth/login

// After password verification:
1. Query user's accessible organizations via user_organizations table
2. Build accessibleOrganizationIds array
3. Create OrganizationContext with:
   - rootOrganizationId: user.rootOrganizationId
   - currentOrganizationId: user.primaryOrganizationId
   - accessibleOrganizationIds: [all accessible org IDs]
4. Sign JWT with organization context
5. Return JWT with embedded organization context
```

**Refresh token flow also updated:**
```typescript
// POST /api/v1/auth/refresh

// After token validation:
1. Query user's current accessible organizations
2. Build fresh OrganizationContext
3. Sign new JWT with updated context
4. Return new JWT and rotated refresh token
```

---

### 5. Updated Registration Flow ✅

**File:** [packages/api/src/routes/v1/auth.ts](../packages/api/src/routes/v1/auth.ts)

**Registration endpoint changes:**
```typescript
// POST /api/v1/auth/register

// Accept organization context from two sources:
const targetOrgId = organizationId ?? request.rootOrganizationId;

// 1. Explicit organizationId parameter (for API/testing)
// 2. request.rootOrganizationId from subdomain middleware
```

Users can now register by simply accessing the subdomain (e.g., `https://acme.argusiq.com/register`) without needing to specify organization ID explicitly.

---

### 6. Tenant Switching API ✅

**File:** [packages/api/src/routes/v1/tenant-switch.ts](../packages/api/src/routes/v1/tenant-switch.ts)

New routes for organization switching:

#### `POST /api/v1/auth/switch-organization`

Switch the user's active organization context:

**Request:**
```json
{
  "organizationId": "uuid"  // OR
  "orgCode": "NORTHEAST"
}
```

**Validations:**
- User must have access to target organization
- Organization must be within user's root organization
- Organization must be active
- Membership must not be expired

**Response:**
```json
{
  "accessToken": "new-jwt-with-updated-current-org",
  "expiresIn": 900,
  "organization": {
    "id": "uuid",
    "name": "Acme Northeast",
    "slug": "acme-northeast",
    "orgCode": "NORTHEAST",
    "role": "member"
  }
}
```

**How it works:**
1. Validates user has access to target organization
2. Checks organization is active and within root
3. Queries all accessible organizations
4. Builds new `OrganizationContext` with updated `currentOrganizationId`
5. Issues new JWT with updated context
6. Returns new token and organization details

#### `GET /api/v1/auth/current-organization`

Returns current organization context from JWT:

**Response:**
```json
{
  "rootOrganizationId": "root-uuid",
  "currentOrganizationId": "current-uuid",
  "accessibleOrganizationIds": ["uuid1", "uuid2", "uuid3"],
  "organization": {
    "id": "current-uuid",
    "name": "Acme Northeast",
    "slug": "acme-northeast",
    "orgCode": "NORTHEAST",
    "isActive": true
  }
}
```

---

### 7. Existing Endpoint Updated ✅

**File:** [packages/api/src/routes/v1/auth.ts](../packages/api/src/routes/v1/auth.ts)

#### `GET /api/v1/auth/organizations`

Already existed, returns user's accessible organizations with current context:

**Response:**
```json
{
  "organizations": [
    {
      "id": "uuid1",
      "name": "Acme Corp",
      "slug": "acme-corp",
      "role": "owner",
      "isPrimary": true
    },
    {
      "id": "uuid2",
      "name": "Acme Northeast",
      "slug": "acme-northeast",
      "role": "member",
      "isPrimary": false
    }
  ],
  "currentOrganizationId": "uuid1"
}
```

---

## Architecture Integration

### Middleware Order in App

```typescript
// packages/api/src/app.ts

1. Helmet (security headers)
2. CORS
3. Error handler
4. Sentry
5. Metrics
6. Rate limiting
7. Request context
8. Subdomain resolver ← NEW (runs BEFORE auth)
9. Auth plugin (JWT verification)
10. RLS context (database row-level security)
```

**Critical:** Subdomain resolver runs **before** authentication so that organization context is available for:
- Registration (to assign new users to correct org)
- Login (to validate user belongs to subdomain's org)
- All authenticated requests (organization context in JWT)

---

## Usage Examples

### Example 1: User Registration via Subdomain

```bash
# User visits https://acme.argusiq.com/register

# Frontend makes request:
POST https://acme.argusiq.com/api/v1/auth/register
{
  "email": "john@acme.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
  # No organizationId needed - taken from subdomain
}

# Backend:
1. Subdomain middleware extracts "acme"
2. Resolves to organization UUID
3. Creates user with rootOrganizationId = acme's UUID
4. User is automatically associated with Acme Corp
```

### Example 2: User Login with Subdomain

```bash
# User visits https://acme.argusiq.com/login

POST https://acme.argusiq.com/api/v1/auth/login
{
  "email": "john@acme.com",
  "password": "SecurePass123!"
}

# Response includes JWT with organization context:
{
  "accessToken": "eyJhbG...",  # Contains org context
  "refreshToken": "...",
  "expiresIn": 900,
  "user": { ... }
}

# Decoded JWT payload:
{
  "sub": "user-uuid",
  "email": "john@acme.com",
  "org": {
    "rootOrganizationId": "acme-uuid",
    "currentOrganizationId": "acme-uuid",
    "accessibleOrganizationIds": ["acme-uuid", "acme-northeast-uuid"]
  }
}
```

### Example 3: Switch Organizations

```bash
# User is in Acme Corp, wants to switch to Acme Northeast

POST /api/v1/auth/switch-organization
Authorization: Bearer <current-jwt>
{
  "organizationId": "acme-northeast-uuid"
}

# Response:
{
  "accessToken": "new-jwt-with-northeast-as-current",
  "expiresIn": 900,
  "organization": {
    "id": "acme-northeast-uuid",
    "name": "Acme Northeast",
    "slug": "acme-northeast",
    "orgCode": "NORTHEAST",
    "role": "member"
  }
}

# Frontend:
1. Replaces old JWT with new one
2. All subsequent requests use new organization context
3. User sees data scoped to Acme Northeast
```

### Example 4: Get Current Organization

```bash
GET /api/v1/auth/current-organization
Authorization: Bearer <jwt>

# Response:
{
  "rootOrganizationId": "acme-uuid",
  "currentOrganizationId": "acme-northeast-uuid",
  "accessibleOrganizationIds": ["acme-uuid", "acme-northeast-uuid", "acme-southeast-uuid"],
  "organization": {
    "id": "acme-northeast-uuid",
    "name": "Acme Northeast",
    "slug": "acme-northeast",
    "orgCode": "NORTHEAST",
    "isActive": true
  }
}
```

---

## Configuration

### Required Environment Variables

None required for basic functionality. Subdomain routing is **optional** and enabled only if `BASE_DOMAIN` is set.

### Optional Environment Variables

```bash
# Enable subdomain routing (leave unset for development without subdomains)
BASE_DOMAIN=argusiq.com

# Default subdomain when none provided (e.g., bare domain access)
DEFAULT_SUBDOMAIN=app

# Subdomains to ignore (treated as if no subdomain)
IGNORE_SUBDOMAINS=www,api,admin

# Whether to require valid organization for all requests
# Set to false to allow requests without subdomain/organization
REQUIRE_ORGANIZATION=true
```

### Development Setup (with Subdomain Support)

**Option 1: Local DNS with .local domain**
```bash
# /etc/hosts (Linux/Mac) or C:\Windows\System32\drivers\etc\hosts (Windows)
127.0.0.1 acme.argusiq.local
127.0.0.1 partner.argusiq.local
127.0.0.1 app.argusiq.local

# .env
BASE_DOMAIN=argusiq.local
DEFAULT_SUBDOMAIN=app
```

**Option 2: Development without Subdomains**
```bash
# .env - don't set BASE_DOMAIN
# Middleware is disabled

# Pass organizationId explicitly in requests
POST /api/v1/auth/register
{
  "organizationId": "uuid",  # Required without subdomain
  "email": "...",
  "password": "..."
}
```

---

## Testing

### Manual Testing Checklist

- [ ] **Subdomain Extraction**
  - [ ] Valid subdomain resolves to organization
  - [ ] Invalid subdomain returns 404
  - [ ] Localhost bypasses subdomain check
  - [ ] Ignored subdomains (www, api) treated as no subdomain

- [ ] **Registration**
  - [ ] Register with subdomain (no organizationId needed)
  - [ ] Register with explicit organizationId
  - [ ] Register without either should fail

- [ ] **Login**
  - [ ] Login returns JWT with organization context
  - [ ] JWT includes rootOrganizationId, currentOrganizationId, accessibleOrganizationIds
  - [ ] Refresh token returns new JWT with organization context

- [ ] **Tenant Switching**
  - [ ] Switch to accessible organization succeeds
  - [ ] Switch to inaccessible organization fails with 403
  - [ ] Switch to inactive organization fails with 403
  - [ ] Switch to org in different root fails with 403
  - [ ] Switch by organizationId works
  - [ ] Switch by orgCode works (when implemented)

- [ ] **Current Organization**
  - [ ] GET /auth/current-organization returns correct context
  - [ ] Organization details match JWT content

### Automated Testing (TODO)

- Unit tests for subdomain extraction logic
- Integration tests for middleware flow
- E2E tests for full authentication flow with subdomains
- Load tests for subdomain resolution performance

---

## Known Limitations

1. **org_code Switching Performance**
   - Current implementation loads all user organizations to find by org_code
   - Should add repository method: `findByOrgCodeWithinRoot(orgCode, rootOrgId)`

2. **Caching**
   - Subdomain → organization lookups hit database on every request
   - Consider Redis cache for frequently accessed subdomains
   - Cache invalidation needed on organization updates

3. **Custom Domains**
   - Not yet implemented
   - Would allow `portal.acme.com` instead of `acme.argusiq.com`
   - Requires DNS validation and SSL certificate management

4. **Multi-Region Support**
   - Subdomain resolution assumes single database
   - Multi-region deployments need consideration for subdomain routing

---

## Future Enhancements

### Performance Optimizations
- [ ] Redis cache for subdomain lookups
- [ ] Optimize org_code switching with direct query
- [ ] Connection pooling for subdomain queries
- [ ] CDN-level subdomain routing

### Features
- [ ] Custom domain support (portal.acme.com)
- [ ] Organization aliases (multiple subdomains for one org)
- [ ] Subdomain reservation/allowlist
- [ ] Organization subdomain change with redirect handling

### Security
- [ ] Rate limiting on subdomain resolution
- [ ] Subdomain enumeration protection
- [ ] Audit logging for organization switches
- [ ] Session invalidation on org switch (optional policy)

---

## Migration Guide

### For Existing Deployments

**Phase 2 is backward compatible.** Existing deployments without subdomain support continue to work:

1. **Without Subdomain Support (Current Behavior)**
   - Don't set `BASE_DOMAIN` environment variable
   - Subdomain middleware is disabled
   - Existing API flows work unchanged
   - Must pass `organizationId` explicitly in registration

2. **Enabling Subdomain Support (New Behavior)**
   - Set `BASE_DOMAIN=your-domain.com`
   - Subdomain middleware activates
   - Users can register/login via subdomain
   - Organization context automatically injected

**No breaking changes to existing functionality.**

### Frontend Updates Needed

1. **Organization Switcher UI**
   ```typescript
   // Call switch-organization API
   const response = await api.post('/auth/switch-organization', {
     organizationId: targetOrgId
   });

   // Update stored JWT
   setAccessToken(response.accessToken);

   // Refresh page or reload data with new org context
   ```

2. **Current Organization Display**
   ```typescript
   // Get current organization from JWT or API
   const { organization } = await api.get('/auth/current-organization');

   // Display in header/sidebar
   <CurrentOrg name={organization.name} />
   ```

3. **Accessible Organizations List**
   ```typescript
   // Get list for switcher dropdown
   const { organizations } = await api.get('/auth/organizations');

   <OrgSwitcher organizations={organizations} />
   ```

---

## Files Changed/Created

### New Files
- `packages/api/src/middleware/subdomain-resolver.ts` - Subdomain resolution middleware
- `packages/api/src/routes/v1/tenant-switch.ts` - Tenant switching routes

### Modified Files
- `packages/api/src/middleware/index.ts` - Export new middleware
- `packages/api/src/utils/jwt.ts` - Add OrganizationContext to JWT
- `packages/api/src/plugins/auth.ts` - Extract org context from JWT
- `packages/api/src/routes/v1/auth.ts` - Update login/register/refresh with org context
- `packages/api/src/routes/v1/index.ts` - Register tenant switching routes
- `packages/api/src/app.ts` - Register subdomain middleware
- `docs/ADR-IMPLEMENTATION-STATUS.md` - Update Phase 2 status to complete

---

## References

- [ADR-002: Subdomain-Based Root Tenant Identification](../Research/architecture/ADR/002-subdomain-routing.md)
- [ADR Implementation Status](./ADR-IMPLEMENTATION-STATUS.md)
- [Architecture README](./architecture/README.md)
- [Organizations Schema](../packages/api/src/db/schema/organizations.ts)

---

**Status:** Phase 2 Complete ✅
**Completion Date:** January 27, 2026
**Next Phase:** Phase 3 - Advanced Features (Optional)
