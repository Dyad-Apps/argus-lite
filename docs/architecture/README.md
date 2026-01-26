# Argus IQ - Implementation Architecture

> **Version:** 2.0.0
> **Last Updated:** January 2026
> **Status:** Phase 6 Complete

## Overview

Argus IQ is a multi-tenant SaaS platform built with a modern TypeScript stack. This document provides a comprehensive overview of the system architecture, implementation phases, and technical decisions made during development.

## Table of Contents

- [System Overview](#system-overview)
- [Technology Stack](#technology-stack)
- [Architecture Principles](#architecture-principles)
- [Phase Documents](#phase-documents)
- [Component Overview](#component-overview)
- [Implementation Changes Log](#implementation-changes-log)

---

## System Overview

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Application<br/>React + Vite]
        MOBILE[Mobile App<br/>Future]
    end

    subgraph "API Gateway"
        LB[Load Balancer<br/>ALB/NLB]
    end

    subgraph "Application Layer"
        API1[API Server 1<br/>Fastify + Node.js]
        API2[API Server 2<br/>Fastify + Node.js]
        API3[API Server N<br/>Fastify + Node.js]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL 17<br/>Primary Database)]
        VALKEY[(Valkey<br/>Cache + Sessions)]
    end

    subgraph "Monitoring"
        PROM[Prometheus<br/>Metrics Collection]
        GRAFANA[Grafana<br/>Dashboards]
        NODE_EXP[Node Exporter<br/>Host Metrics]
    end

    subgraph "External Services"
        SENTRY[Sentry<br/>Error Tracking]
        IDP[Identity Providers<br/>Google, GitHub, OIDC, SAML]
    end

    WEB --> LB
    MOBILE --> LB
    LB --> API1
    LB --> API2
    LB --> API3

    API1 --> PG
    API2 --> PG
    API3 --> PG

    API1 --> VALKEY
    API2 --> VALKEY
    API3 --> VALKEY

    API1 --> SENTRY
    API1 --> IDP

    PROM -->|scrape /metrics| API1
    PROM -->|scrape /metrics| API2
    PROM -->|scrape /metrics| API3
    PROM -->|scrape| NODE_EXP
    GRAFANA -->|query| PROM
```

## Technology Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Runtime** | Node.js | 22.x | JavaScript runtime |
| **Language** | TypeScript | 5.x | Type-safe development |
| **API Framework** | Fastify | 5.x | High-performance HTTP server |
| **Database** | PostgreSQL | 17 | Primary data store |
| **ORM** | Drizzle ORM | 0.45.x | Type-safe database queries |
| **Cache** | Valkey | 8.x | Redis-compatible caching |
| **Validation** | Zod | 4.x | Runtime type validation |
| **Authentication** | Passport.js | 0.7.x | Multi-strategy authentication |
| **Metrics** | Prometheus | 2.54.x | Metrics collection & alerting |
| **Dashboards** | Grafana | 11.3.x | Metrics visualization |
| **App Metrics** | prom-client | 15.x | Node.js Prometheus client |
| **Package Manager** | pnpm | 9.x | Fast, disk-efficient package manager |
| **Monorepo** | pnpm workspaces | - | Multi-package management |

---

## Architecture Principles

### 1. Multi-Organization Model

> **Terminology Note:** In Argus IQ, we use "Organization" rather than "Tenant". The terms are equivalent in multi-tenancy literature, but "Organization" better reflects the business model.

#### Core Concepts

```mermaid
graph TB
    subgraph "User Access Model"
        USER[User: jane@acme.com]

        ORG1[Acme Corp<br/>PRIMARY ORG]
        ORG2[Acme Subsidiary]
        ORG3[Partner Inc]

        USER -->|"Primary (login default)"| ORG1
        USER -->|"Can switch to"| ORG2
        USER -->|"Can switch to"| ORG3
    end

    subgraph "Shared Assets"
        ASSET1[Shared Equipment]
        ORG1 -.->|"View/Edit"| ASSET1
        ORG3 -.->|"View Only"| ASSET1
    end
```

#### Key Behaviors

| Behavior | Description |
|----------|-------------|
| **Primary Organization** | Every user has a primary org (the one they first signed up with). Login always lands here. |
| **Multi-Org Access** | Users may have access to additional organizations with different roles in each. |
| **Organization Switcher** | If a user has multi-org access, a dropdown allows switching context without re-login. |
| **Cross-Org Data Sharing** | Organizations can share assets. The data model supports cross-org visibility with configurable permissions. |
| **White-Label Access** | Organizations can have custom subdomains (e.g., `acme.argusiq.com`) with branded login pages. |

#### Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant API
    participant DB

    User->>Browser: Navigate to acme.argusiq.com
    Browser->>API: GET / (with subdomain: acme)
    API->>DB: Lookup org by subdomain
    DB-->>API: Org config (branding, SSO settings)
    API-->>Browser: White-labeled login page

    User->>Browser: Login (email/password or SSO)
    Browser->>API: POST /auth/login
    API->>DB: Validate credentials
    API->>DB: Get user's primary_organization_id
    API->>DB: Get user's accessible organizations
    API-->>Browser: JWT with primary org context + org list

    Note over Browser: User sees primary org dashboard
    Note over Browser: Org switcher shows accessible orgs

    User->>Browser: Switch to "Partner Inc"
    Browser->>API: POST /auth/switch-organization
    API-->>Browser: New JWT with Partner Inc context
```

#### Data Model Implications (ADR-001/002 Aligned)

```sql
-- Organizations support unlimited hierarchy via LTREE (ADR-001)
organizations (
    id,
    org_code,              -- Human-readable code for switching (e.g., 'WALMART')
    parent_organization_id,-- Self-reference for tree structure
    root_organization_id,  -- Data isolation key
    is_root,               -- TRUE for top-level orgs
    path,                  -- LTREE path (e.g., 'radio.walmart.northeast')
    depth,                 -- Level in hierarchy (0 = root)
    subdomain,             -- For root orgs only (acme.argusiq.com)
    can_have_children      -- Whether this org can create child orgs
)

-- Users belong to a root organization for data isolation (ADR-002)
users (
    email,                     -- Unique per root_organization_id
    root_organization_id,      -- Data isolation boundary
    primary_organization_id    -- Default org on login
)

-- User-Organization access with time-limited support
user_organizations (
    user_id,
    organization_id,
    role,              -- Role within that org
    is_primary,        -- TRUE for default org
    expires_at         -- Optional expiration for contractor access
)

-- Cross-org asset sharing (within same root org)
asset_shares (
    asset_id,
    owner_organization_id,
    shared_with_organization_id,
    permission_level   -- 'view', 'edit', 'admin'
)
```

#### White-Label Subdomain Routing

| URL | Behavior |
|-----|----------|
| `app.argusiq.com` | Default Argus IQ branding, standard login |
| `acme.argusiq.com` | Acme Corp branding, may enforce Acme SSO |
| `partner.argusiq.com` | Partner Inc branding with custom theme |

#### Administrative Hierarchy

```mermaid
graph TB
    subgraph "Platform Level"
        SYSADMIN[System Admin<br/>Platform Owner]
    end

    subgraph "Organization Level"
        ORG_ADMIN1[Org Admin<br/>Acme Corp]
        ORG_ADMIN2[Org Admin<br/>Partner Inc]
    end

    subgraph "User Level"
        USER1[Members/Viewers]
    end

    SYSADMIN -->|"Creates & manages"| ORG_ADMIN1
    SYSADMIN -->|"Creates & manages"| ORG_ADMIN2
    ORG_ADMIN1 -->|"Manages"| USER1
```

| Role | Scope | Capabilities |
|------|-------|--------------|
| **System Admin** | Platform-wide | Create/delete organizations, configure platform defaults, manage all SSO providers, impersonate users, view all audit logs, set white-label defaults |
| **Organization Admin** | Single org | Configure org white-labeling (within platform limits), set up org-specific SSO, manage org members, view org audit logs |
| **Organization Member** | Single org | Standard access based on assigned role |

#### System Admin Capabilities

**Organization Management:**
- Create new organizations with subdomain allocation
- Enable/disable organizations
- Set organization plan/tier (affects feature availability)
- Configure billing and usage limits

**White-Label Configuration (Platform Defaults):**
- Default logo, favicon, colors
- Default login background
- Email templates and branding
- Terms of service, privacy policy URLs

**SSO Provider Management:**
- Configure platform-wide SSO providers (available to all orgs)
- Enable/disable SSO providers per organization
- Manage SAML certificates and OIDC credentials
- Set SSO enforcement policies

**Security & Compliance:**
- View cross-organization audit logs
- Configure password policies
- Set session timeout defaults
- Manage API rate limits

#### Organization Admin Capabilities

**White-Label Customization:**
- Upload organization logo
- Set organization colors (primary, accent)
- Configure login page background image
- Customize email templates (if allowed by plan)

**SSO Configuration:**
- Enable/configure SSO from platform-available providers
- Set SSO as required or optional for org members
- Configure SCIM provisioning (if available)
- Manage SSO group mappings to roles

**Member Management:**
- Invite users to organization
- Assign roles within organization
- Remove members
- View organization audit logs

#### Configuration Data Model

```sql
-- Platform-level settings (managed by System Admin)
platform_settings (
    key,                    -- e.g., 'default_logo_url', 'password_min_length'
    value,
    updated_by,
    updated_at
)

-- Organization white-label settings
organization_branding (
    organization_id,
    logo_url,
    favicon_url,
    primary_color,          -- e.g., '#1890FF'
    accent_color,
    login_background_url,
    login_background_type,  -- 'image', 'particles', 'solid'
    custom_css,             -- Advanced customization (enterprise only)
    updated_at
)

-- Organization SSO configuration
organization_sso_config (
    organization_id,
    provider_type,          -- 'oidc', 'saml', 'google', 'github'
    provider_name,          -- Display name
    config,                 -- JSONB with provider-specific settings
    is_enabled,
    is_required,            -- If true, password login disabled
    created_at,
    updated_at
)
```

### 2. Row-Level Security (RLS)

Every data access is scoped to an organization using PostgreSQL Row-Level Security (RLS). This provides:
- Data isolation at the database level
- Protection against cross-organization data leakage
- Simplified application code (no manual org filtering)
- Support for cross-org sharing via explicit share records

### 4. Security-First Approach
- All endpoints require authentication by default
- JWT tokens with short expiration (15 minutes)
- Refresh token rotation
- Rate limiting on all endpoints
- Input validation with Zod schemas

### 5. Horizontal Scalability
- Stateless API servers
- Session data in Valkey (Redis-compatible)
- Database connection pooling
- Health checks for load balancer integration

### 6. Developer Experience
- Full TypeScript across all packages
- Shared types between frontend and backend
- Comprehensive API documentation
- Local development with Docker Compose

---

## Phase Documents

### [Phase 1: Authentication & Multi-Organization](./phase-1-auth-multi-org.md)
Covers user authentication, organization management, role-based access control, and SSO integration.

**Key Components:**
- JWT authentication with refresh tokens
- Multi-organization support
- Role-based access control (RBAC)
- **[ADDED]** SSO integration (Google, GitHub, OIDC, SAML)

### [Phase 1b: RBAC, Groups & Tenant Profiles](./phase-1b-rbac-tenant-profiles.md)
Covers advanced RBAC system, user groups, and tenant profile configuration templates.

**Key Components:**
- **[NEW]** Tenant profiles with capabilities and limits
- **[NEW]** User groups with membership management
- **[NEW]** Full RBAC with roles, permissions, and assignments
- **[NEW]** Role inheritance via groups and SSO
- **[NEW]** Scope-based permissions (organization, children, tree)

### [Phase 2: Database & Row-Level Security](./phase-2-database-rls.md)
Covers database schema design, multi-tenant data isolation, and migration strategies.

**Key Components:**
- PostgreSQL schema design
- Row-Level Security (RLS) policies
- Migration management with Drizzle
- Connection pooling

### [Phase 3: CI/CD & Deployment](./phase-3-cicd-deployment.md)
Covers continuous integration, deployment pipelines, and infrastructure automation.

**Key Components:**
- GitHub Actions workflows
- Docker containerization
- Environment promotion (dev → staging → production)
- Automated rollback strategies

### [Phase 4: RBAC System UI](./phase-4-rbac-ui.md)
Covers the user interface implementation for organization management, user/group management, and role management.

**Key Components:**
- **[NEW]** Organization hierarchy tree view
- **[NEW]** Organization details with tabbed interface
- **[NEW]** User management with groups and roles tabs
- **[NEW]** Role permission matrix editor
- **[NEW]** Create role/group/user wizards

### [Phase 5: Security Features](./phase-5-security-features.md)
Covers SSO connection management, user impersonation, and two-factor authentication.

**Key Components:**
- **[NEW]** SSO connection CRUD management
- **[NEW]** User impersonation with JWT token swap
- **[NEW]** Impersonation sessions with audit logging
- **[NEW]** Security page with SSO, impersonation, and 2FA tabs
- **[NEW]** Impersonation banner and context

### [Phase 6: Platform Settings & Branding](./phase-6-platform-settings.md)
Covers platform-wide settings and white-labeling/branding customization.

**Key Components:**
- **[NEW]** Platform settings key-value store
- **[NEW]** System admin roles (super_admin, support, billing)
- **[NEW]** Settings page with general/mail server/notifications tabs
- **[NEW]** White-labeling branding editor
- **[NEW]** Secret setting handling with masking

---

## Component Overview

```mermaid
graph LR
    subgraph "packages/api"
        AUTH[Auth Module]
        ROUTES[Route Handlers]
        PLUGINS[Fastify Plugins]
        DB[Database Layer]
        MW[Middleware]
    end

    subgraph "packages/shared"
        TYPES[Shared Types]
        UTILS[Utilities]
        CACHE[Cache Client]
        LOGGER[Logger Config]
    end

    subgraph "packages/web"
        REACT[React App]
        HOOKS[Custom Hooks]
        COMPONENTS[UI Components]
    end

    ROUTES --> AUTH
    ROUTES --> DB
    AUTH --> DB
    MW --> DB

    AUTH --> TYPES
    ROUTES --> TYPES
    DB --> TYPES

    REACT --> TYPES
    REACT --> HOOKS
    HOOKS --> TYPES
```

### Package Structure

```
argusiq-lite/
├── packages/
│   ├── api/                    # Backend API server
│   │   ├── src/
│   │   │   ├── auth/           # Authentication strategies
│   │   │   ├── db/             # Database schema & migrations
│   │   │   ├── middleware/     # Request middleware
│   │   │   ├── plugins/        # Fastify plugins (incl. metrics)
│   │   │   ├── routes/         # API route handlers
│   │   │   └── services/       # Business logic (incl. Prometheus client)
│   │   └── Dockerfile
│   │
│   ├── shared/                 # Shared code
│   │   └── src/
│   │       ├── types/          # TypeScript types
│   │       ├── cache/          # Valkey client
│   │       └── logger/         # Pino configuration
│   │
│   └── web/                    # Frontend application
│       └── src/
│           ├── components/
│           ├── hooks/
│           └── pages/
│
├── monitoring/                 # Observability stack
│   ├── prometheus.yml          # Prometheus scrape config
│   ├── alerts.yml              # Alert rules
│   └── grafana/
│       ├── provisioning/       # Auto-provisioned datasources
│       └── dashboards/         # Pre-built dashboards
│
├── docs/                       # Documentation
│   └── architecture/           # Architecture docs
│
├── scripts/                    # Build & utility scripts
│
└── .github/                    # CI/CD workflows
    └── workflows/
```

---

## Implementation Changes Log

This section documents significant changes made during implementation that deviated from or extended the original specification.

### Sprint 1 Changes

| Change | Category | Description | Rationale |
|--------|----------|-------------|-----------|
| **ADR-001 Alignment** | Database | Unlimited recursive org trees with PostgreSQL LTREE | Support complex enterprise hierarchies |
| **ADR-002 Alignment** | Database | Root organization isolation via `root_organization_id` | Complete data isolation per enterprise |
| **LTREE Extension** | Database | Added LTREE for efficient tree queries (O(1) ancestor/descendant) | Performance at scale |
| **Hierarchy Triggers** | Database | Auto-calculate `path`, `depth` on organization changes | Maintain data integrity |
| **Time-Limited Access** | Database | `user_organizations.expires_at` for contractor access | Support temporary access patterns |
| **Email per Root Org** | Database | Composite unique index `(email, root_organization_id)` | Same email in different tenants |
| **SSO Support Added** | Authentication | Added Passport.js strategies for Google, GitHub, OIDC, and SAML 2.0 | Enterprise requirement for single sign-on |
| **Identity Providers Table** | Database | New `identity_providers` table for storing SSO configurations per organization | Support multiple IdPs per tenant |
| **User Identities Table** | Database | New `user_identities` table linking users to external accounts | Enable account linking across providers |
| **RLS Context Middleware** | Security | Automatic PostgreSQL session variable setting for RLS | Simplify tenant isolation in queries |
| **PostgreSQL Port Change** | Infrastructure | Changed from 5432 to 5433 | Avoid conflicts with existing local PostgreSQL |
| **Migration Safety Workflow** | CI/CD | Added workflow to block destructive migrations | Prevent production data loss |

### Sprint 2 Changes (Phases 4-6)

| Change | Category | Description | Rationale |
|--------|----------|-------------|-----------|
| **RBAC UI Components** | Frontend | Organization hierarchy tree view, tabbed details pages | Visual organization management |
| **User Management Tabs** | Frontend | Users page with Users/Groups/Roles tabs | Unified user/group/role management |
| **Role Permission Matrix** | Frontend | Visual permission editor for custom roles | Intuitive permission configuration |
| **SSO Connections** | Security | CRUD API for SSO provider management | Organization-level SSO configuration |
| **Impersonation System** | Security | JWT-based user impersonation with sessions | Support and debugging capability |
| **Impersonation Banner** | Frontend | Prominent banner during impersonation | Clear visual indicator of impersonation |
| **Platform Settings** | Backend | Key-value store for system configuration | Centralized platform configuration |
| **System Admin Roles** | Security | super_admin, support, billing roles | Fine-grained admin access control |
| **Secret Settings** | Security | Encrypted storage, masked API responses | Protect sensitive configuration |
| **White-Labeling** | Frontend | Branding editor with logo, colors, login customization | Platform customization capability |
| **Settings Tabs** | Frontend | General/Mail Server/Notifications tabs | Organized settings management |

### Detailed Change: SSO Support

**Original Scope:** Basic JWT authentication with email/password
**Extended Scope:** Full SSO support with multiple identity providers

```mermaid
graph TB
    subgraph "Original Design"
        A1[Email/Password] --> A2[JWT Token]
    end

    subgraph "Extended Design"
        B1[Email/Password]
        B2[Google OAuth]
        B3[GitHub OAuth]
        B4[OIDC Provider]
        B5[SAML 2.0]

        B1 --> B6[Auth Service]
        B2 --> B6
        B3 --> B6
        B4 --> B6
        B5 --> B6

        B6 --> B7[JWT Token]
        B6 --> B8[User Identity Linking]
    end
```

**Impact:**
- 2 new database tables
- 4 new authentication strategies
- New SSO routes (`/api/v1/sso/*`)
- Identity management endpoints

### Detailed Change: User Impersonation

**Purpose:** Allow system administrators to access the platform as another user for support and debugging purposes.

```mermaid
sequenceDiagram
    participant Admin
    participant API
    participant ImpersonationService
    participant DB

    Admin->>API: POST /impersonation/start
    API->>DB: Verify admin is super_admin
    API->>ImpersonationService: Create session
    ImpersonationService->>DB: Store session
    ImpersonationService-->>API: Impersonation JWT
    API-->>Admin: Token with impersonator claims

    Note over Admin: Works as target user

    Admin->>API: POST /impersonation/end
    API->>DB: Close session
    API-->>Admin: Original admin token
```

**Impact:**
- New `impersonation_sessions` database table
- New impersonation service with JWT token management
- New impersonation routes (`/api/v1/impersonation/*`)
- ImpersonationContext for frontend state management
- ImpersonationBanner component

### Detailed Change: Platform Settings

**Purpose:** Centralized key-value store for platform-wide configuration managed by system admins.

**Features:**
- Secret settings with encrypted storage and masked API responses
- System admin roles (super_admin, support, billing) with different access levels
- Platform branding configuration for white-labeling
- Settings organized by category (security, rate limits, features, email)

**Impact:**
- New `platform_settings`, `system_admins`, `platform_branding` database tables
- Settings and branding API routes
- Settings page with tabbed UI (General, Mail Server, Notifications)
- Branding editor with live preview

---

## Quick Links

- [Phase 1: Authentication & Multi-Organization](./phase-1-auth-multi-org.md)
- [Phase 1b: RBAC, Groups & Tenant Profiles](./phase-1b-rbac-tenant-profiles.md)
- [Phase 2: Database & Row-Level Security](./phase-2-database-rls.md)
- [Phase 3: CI/CD & Deployment](./phase-3-cicd-deployment.md)
- [Phase 4: RBAC System UI](./phase-4-rbac-ui.md)
- [Phase 5: Security Features](./phase-5-security-features.md)
- [Phase 6: Platform Settings & Branding](./phase-6-platform-settings.md)

---

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 9+
- Docker & Docker Compose
- PostgreSQL client (optional, for direct DB access)

### Local Development

```bash
# Clone the repository
git clone <repository-url>
cd argusiq-lite

# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL, Valkey)
docker compose up -d

# Copy environment file
cp .env.example .env

# Build the API package (required for migrations)
cd packages/api
pnpm build

# Run database migrations (applies schema + RLS + LTREE)
# Windows:
set DATABASE_URL=postgresql://argus:argus_dev@localhost:5433/argus
node dist/db/migrate.js

# Linux/Mac:
DATABASE_URL="postgresql://argus:argus_dev@localhost:5433/argus" node dist/db/migrate.js

# Start development server (from project root)
cd ../..
pnpm dev
```

### Monitoring Stack (Optional)

The project includes a full Prometheus + Grafana monitoring stack for observability.

```bash
# Start monitoring services (Prometheus, Grafana, Node Exporter)
docker compose --profile monitoring up -d
```

**Access URLs:**

| Service | URL | Credentials |
|---------|-----|-------------|
| API | http://localhost:3040 | - |
| Web App | http://localhost:5173 | - |
| API Metrics | http://localhost:3040/metrics | - |
| Grafana | http://localhost:3001 | admin / argus_dev |
| Prometheus | http://localhost:9090 | - |
| Node Exporter | http://localhost:9100/metrics | - |

**Pre-configured Dashboards:**
- Grafana auto-provisions the "Argus System Health" dashboard showing CPU, memory, disk, API latency, request rates, and error rates.

**Application Metrics:**
The API exposes Prometheus metrics at `/metrics`:
- `argus_http_requests_total` - HTTP request counter by method, route, status
- `argus_http_request_duration_seconds` - Request latency histogram
- `argus_active_connections` - Current active connections
- `argus_database_pool_*` - Database connection pool metrics
- `argus_cache_operations_total` - Cache hit/miss counters

See [monitoring/README.md](../../monitoring/README.md) for full documentation including AWS deployment configuration.

### Database Migration

The migration runner applies:
1. **Drizzle schema migrations** - Table structure from TypeScript schema
2. **Custom SQL migrations** - RLS policies, LTREE extension, triggers, and helper functions

```bash
# View migration status
docker exec argus-db psql -U argus -d argus -c "SELECT * FROM pg_extension;"
docker exec argus-db psql -U argus -d argus -c "SELECT COUNT(*) FROM pg_policies;"
docker exec argus-db psql -U argus -d argus -c "SELECT tgname FROM pg_trigger WHERE tgname LIKE 'trg_%';"
```

### Environment Variables

See [.env.example](../../.env.example) for all configuration options.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `VALKEY_URL` | Yes | Valkey/Redis connection string |
| `JWT_SECRET` | Yes | Secret for JWT signing |
| `NODE_ENV` | No | Environment (development/production) |
| `SENTRY_DSN` | No | Sentry error tracking DSN |
| `METRICS_ENABLED` | No | Enable Prometheus metrics (default: true) |
| `PROMETHEUS_ENDPOINT` | No | Prometheus URL for queries (default: http://localhost:9090) |
| `PROMETHEUS_AUTH` | No | Auth method: 'none' or 'sigv4' for AWS (default: none) |
| `AWS_REGION` | No | AWS region (required when PROMETHEUS_AUTH=sigv4) |
