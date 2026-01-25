# Phase 1b: RBAC, Groups, and Tenant Profiles

> **Version:** 1.0.0
> **Last Updated:** January 2026
> **Status:** Foundation Complete

## Overview

This document describes the Role-Based Access Control (RBAC) system, user groups, and tenant profiles implemented as an extension to Phase 1. These features enable fine-grained permission management, user organization via groups, and configurable organization templates.

## Table of Contents

- [System Architecture](#system-architecture)
- [Tenant Profiles](#tenant-profiles)
- [User Groups](#user-groups)
- [Roles & Permissions](#roles--permissions)
- [API Endpoints](#api-endpoints)
- [Data Flow Diagrams](#data-flow-diagrams)
- [Implementation Details](#implementation-details)

---

## System Architecture

```mermaid
graph TB
    subgraph "Identity & Access Management"
        USER[User]
        GROUP[User Group]
        ROLE[Role]
        PERM[Permissions]
    end

    subgraph "Organization Management"
        ORG[Organization]
        PROFILE[Tenant Profile]
        CAPS[Capabilities]
        LIMITS[Limits]
    end

    USER -->|belongs to| GROUP
    USER -->|assigned| ROLE
    GROUP -->|assigned| ROLE
    ROLE -->|contains| PERM

    ORG -->|uses| PROFILE
    PROFILE -->|defines| CAPS
    PROFILE -->|defines| LIMITS

    ORG -->|contains| USER
    ORG -->|contains| GROUP
    ORG -->|has custom| ROLE
```

---

## Tenant Profiles

Tenant profiles are configuration templates that define capabilities and resource limits for organizations. They enable consistent configuration across similar organization types.

### Profile Types

```mermaid
graph LR
    subgraph "Profile Types"
        ROOT[Root Profile<br/>For root organizations only]
        CHILD[Child Profile<br/>For child organizations only]
        UNIVERSAL[Universal Profile<br/>For any organization]
    end

    subgraph "Organizations"
        ROOT_ORG[Root Organization]
        CHILD_ORG[Child Organization]
    end

    ROOT --> ROOT_ORG
    CHILD --> CHILD_ORG
    UNIVERSAL --> ROOT_ORG
    UNIVERSAL --> CHILD_ORG
```

### Capabilities Configuration

| Capability | Description | Default |
|------------|-------------|---------|
| `whiteLabeling` | Custom branding allowed | false |
| `ssoEnabled` | SSO authentication available | false |
| `mfaEnabled` | Multi-factor authentication available | true |
| `apiAccess` | API key access allowed | false |
| `aiFeatures` | AI-powered features available | false |
| `advancedAnalytics` | Advanced analytics dashboard | false |
| `customIntegrations` | Custom integration support | false |
| `canHaveChildren` | Can create child organizations | false |
| `maxChildDepth` | Maximum depth of child hierarchy | 0 |

### Limits Configuration

| Limit | Description | Type |
|-------|-------------|------|
| `maxUsers` | Maximum users in organization | number |
| `maxDevices` | Maximum devices | number |
| `maxAssets` | Maximum assets | number |
| `maxDashboards` | Maximum dashboards | number |
| `maxApiKeys` | Maximum API keys | number |
| `maxChildOrganizations` | Maximum child orgs | number |
| `dataRetentionDays` | Data retention period | number |
| `storageGb` | Storage quota in GB | number |

### Example Profiles

```mermaid
graph TD
    subgraph "Enterprise Profile"
        E_CAP[Capabilities: ALL]
        E_LIM["Limits:<br/>Users: 10,000<br/>Storage: 1TB<br/>Children: 100"]
    end

    subgraph "Standard Profile"
        S_CAP["Capabilities:<br/>SSO, MFA, API"]
        S_LIM["Limits:<br/>Users: 100<br/>Storage: 50GB<br/>Children: 10"]
    end

    subgraph "Starter Profile"
        ST_CAP["Capabilities:<br/>MFA only"]
        ST_LIM["Limits:<br/>Users: 10<br/>Storage: 5GB<br/>Children: 0"]
    end
```

---

## User Groups

Groups allow organizing users within an organization and assigning roles at the group level.

### Group Structure

```mermaid
graph TB
    subgraph "Organization"
        ORG[Acme Corp]

        subgraph "Groups"
            G1[Engineering]
            G2[Sales]
            G3[Operations]
            G4[Project Alpha Team]
        end

        subgraph "Users"
            U1[alice@acme.com]
            U2[bob@acme.com]
            U3[carol@acme.com]
        end
    end

    ORG --> G1
    ORG --> G2
    ORG --> G3
    ORG --> G4

    G1 --> U1
    G1 --> U2
    G2 --> U2
    G2 --> U3
    G4 --> U1
    G4 --> U3
```

### Group Membership Model

```
user_groups (
    id,
    organization_id,  -- FK to organizations
    name,
    description,
    created_by,
    created_at,
    updated_at
)

user_group_memberships (
    user_id,          -- FK to users
    group_id,         -- FK to user_groups
    added_at,
    added_by          -- FK to users
)
```

---

## Roles & Permissions

### Role Hierarchy

```mermaid
graph TB
    subgraph "System Roles (Global)"
        SR1[Platform Owner]
        SR2[Platform Admin]
        SR3[Organization Owner]
        SR4[Organization Admin]
        SR5[Member]
        SR6[Viewer]
    end

    subgraph "Custom Roles (Per Org)"
        CR1[Project Manager]
        CR2[Analyst]
        CR3[External Auditor]
    end

    SR1 --> SR2
    SR2 --> SR3
    SR3 --> SR4
    SR4 --> SR5
    SR5 --> SR6

    style SR1 fill:#f96,stroke:#333
    style SR2 fill:#f96,stroke:#333
    style CR1 fill:#9cf,stroke:#333
    style CR2 fill:#9cf,stroke:#333
    style CR3 fill:#9cf,stroke:#333
```

### Role Scope

| Scope | Description | Use Case |
|-------|-------------|----------|
| `organization` | Role applies only within the assigned organization | Most roles |
| `children` | Role applies to organization and all direct children | Regional manager |
| `tree` | Role applies to entire organization tree | Global administrator |

### Permission Model

```mermaid
graph LR
    subgraph "Role"
        R[Organization Admin]
    end

    subgraph "Resource Permissions"
        P1["organizations: read, update"]
        P2["users: create, read, update, delete"]
        P3["groups: create, read, update, delete"]
        P4["roles: read"]
    end

    subgraph "Menu Access"
        M1[dashboard]
        M2[users]
        M3[groups]
        M4[settings]
    end

    subgraph "Custom Permissions"
        C1["canExportData: true"]
        C2["canImpersonate: false"]
    end

    R --> P1
    R --> P2
    R --> P3
    R --> P4
    R --> M1
    R --> M2
    R --> M3
    R --> M4
    R --> C1
    R --> C2
```

### Role Assignment Sources

```mermaid
sequenceDiagram
    participant User
    participant DirectAssign as Direct Assignment
    participant Group as Group Membership
    participant SSO as SSO Provider
    participant Inherit as Parent Org

    Note over User: User can receive roles from multiple sources

    DirectAssign->>User: source: 'direct'<br/>Admin manually assigns
    Group->>User: source: 'group'<br/>Inherits from group role
    SSO->>User: source: 'sso'<br/>Provisioned via SAML/OIDC claims
    Inherit->>User: source: 'inherited'<br/>Inherits from parent org
```

---

## API Endpoints

### Tenant Profiles

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/tenant-profiles` | List all profiles |
| `GET` | `/api/v1/tenant-profiles/:id` | Get profile by ID |
| `POST` | `/api/v1/tenant-profiles` | Create new profile |
| `PATCH` | `/api/v1/tenant-profiles/:id` | Update profile |
| `DELETE` | `/api/v1/tenant-profiles/:id` | Delete profile (non-system only) |

### Groups

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/organizations/:orgId/groups` | List org groups |
| `GET` | `/api/v1/organizations/:orgId/groups/:id` | Get group details |
| `POST` | `/api/v1/organizations/:orgId/groups` | Create group |
| `PATCH` | `/api/v1/organizations/:orgId/groups/:id` | Update group |
| `DELETE` | `/api/v1/organizations/:orgId/groups/:id` | Delete group |
| `GET` | `/api/v1/organizations/:orgId/groups/:id/members` | List group members |
| `POST` | `/api/v1/organizations/:orgId/groups/:id/members` | Add member |
| `DELETE` | `/api/v1/organizations/:orgId/groups/:id/members/:userId` | Remove member |

### Roles

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/roles/system` | List system roles |
| `GET` | `/api/v1/organizations/:orgId/roles` | List org roles |
| `GET` | `/api/v1/organizations/:orgId/roles/:id` | Get role details |
| `POST` | `/api/v1/organizations/:orgId/roles` | Create custom role |
| `PATCH` | `/api/v1/organizations/:orgId/roles/:id` | Update role |
| `DELETE` | `/api/v1/organizations/:orgId/roles/:id` | Delete role |

### Role Assignments

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/organizations/:orgId/users/:userId/roles` | Get user's roles |
| `POST` | `/api/v1/organizations/:orgId/users/:userId/roles` | Assign role to user |
| `DELETE` | `/api/v1/organizations/:orgId/users/:userId/roles/:roleId` | Remove role from user |
| `POST` | `/api/v1/organizations/:orgId/groups/:groupId/roles` | Assign role to group |
| `DELETE` | `/api/v1/organizations/:orgId/groups/:groupId/roles/:roleId` | Remove role from group |

---

## Data Flow Diagrams

### Permission Resolution Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant AuthMiddleware as Auth Middleware
    participant PermService as Permission Service
    participant DB

    Client->>API: Request protected resource
    API->>AuthMiddleware: Validate JWT
    AuthMiddleware->>PermService: Check permissions

    PermService->>DB: Get user direct roles
    PermService->>DB: Get user groups
    PermService->>DB: Get group roles

    Note over PermService: Merge all role permissions
    Note over PermService: Apply scope restrictions

    PermService-->>AuthMiddleware: Permission result

    alt Has Permission
        AuthMiddleware->>API: Continue to handler
        API-->>Client: 200 OK with data
    else No Permission
        AuthMiddleware-->>Client: 403 Forbidden
    end
```

### Organization Profile Assignment Flow

```mermaid
sequenceDiagram
    participant Admin
    participant API
    participant OrgRepo as Organization Repository
    participant ProfileRepo as Profile Repository
    participant DB

    Admin->>API: Create organization with profileId
    API->>ProfileRepo: Validate profile exists
    ProfileRepo->>DB: SELECT from tenant_profiles
    DB-->>ProfileRepo: Profile data

    alt Profile exists and active
        ProfileRepo-->>API: Profile valid
        API->>OrgRepo: Create organization
        OrgRepo->>DB: INSERT with profile_id
        DB-->>OrgRepo: New organization
        OrgRepo-->>API: Organization created
        API-->>Admin: 201 Created
    else Profile not found
        ProfileRepo-->>API: Profile not found
        API-->>Admin: 404 Not Found
    end
```

### Group Role Inheritance Flow

```mermaid
sequenceDiagram
    participant Admin
    participant API
    participant GroupRepo
    participant RoleRepo
    participant DB

    Note over Admin: Assign role to group
    Admin->>API: POST /groups/:id/roles
    API->>GroupRepo: Verify group exists
    API->>RoleRepo: Verify role exists
    API->>RoleRepo: Assign role to group
    RoleRepo->>DB: INSERT into group_role_assignments

    Note over DB: All group members now inherit this role

    DB-->>RoleRepo: Assignment created
    RoleRepo-->>API: Success
    API-->>Admin: 201 Created

    Note over Admin: Later: Check user permissions
    Admin->>API: GET /users/:id/roles
    API->>RoleRepo: Get user roles
    RoleRepo->>DB: Get direct assignments
    RoleRepo->>DB: Get group memberships
    RoleRepo->>DB: Get group role assignments
    DB-->>RoleRepo: All roles (direct + inherited)
    RoleRepo-->>API: Combined role list
    API-->>Admin: User's effective roles
```

---

## Implementation Details

### Database Schema

```
┌─────────────────────────────────────────────────────────────────┐
│                      tenant_profiles                            │
├─────────────────────────────────────────────────────────────────┤
│ id              UUID PRIMARY KEY                                │
│ name            VARCHAR(100) NOT NULL                           │
│ description     VARCHAR(500)                                    │
│ type            ENUM('root','child','universal')                │
│ is_system       BOOLEAN DEFAULT false                           │
│ capabilities    JSONB                                           │
│ limits          JSONB                                           │
│ is_active       BOOLEAN DEFAULT true                            │
│ created_at      TIMESTAMP WITH TIME ZONE                        │
│ updated_at      TIMESTAMP WITH TIME ZONE                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        user_groups                              │
├─────────────────────────────────────────────────────────────────┤
│ id              UUID PRIMARY KEY                                │
│ organization_id UUID NOT NULL REFERENCES organizations          │
│ name            VARCHAR(100) NOT NULL                           │
│ description     VARCHAR(500)                                    │
│ created_by      UUID REFERENCES users                           │
│ created_at      TIMESTAMP WITH TIME ZONE                        │
│ updated_at      TIMESTAMP WITH TIME ZONE                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   user_group_memberships                        │
├─────────────────────────────────────────────────────────────────┤
│ user_id         UUID NOT NULL REFERENCES users                  │
│ group_id        UUID NOT NULL REFERENCES user_groups            │
│ added_at        TIMESTAMP WITH TIME ZONE                        │
│ added_by        UUID REFERENCES users                           │
│ PRIMARY KEY (user_id, group_id)                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                          roles                                  │
├─────────────────────────────────────────────────────────────────┤
│ id              UUID PRIMARY KEY                                │
│ name            VARCHAR(100) NOT NULL                           │
│ description     VARCHAR(500)                                    │
│ organization_id UUID REFERENCES organizations (NULL=system)     │
│ is_system       BOOLEAN DEFAULT false                           │
│ default_scope   ENUM('organization','children','tree')          │
│ permissions     JSONB                                           │
│ priority        VARCHAR(10) DEFAULT '0'                         │
│ created_at      TIMESTAMP WITH TIME ZONE                        │
│ updated_at      TIMESTAMP WITH TIME ZONE                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   user_role_assignments                         │
├─────────────────────────────────────────────────────────────────┤
│ user_id         UUID NOT NULL REFERENCES users                  │
│ role_id         UUID NOT NULL REFERENCES roles                  │
│ organization_id UUID NOT NULL REFERENCES organizations          │
│ scope           ENUM('organization','children','tree')          │
│ source          ENUM('direct','group','sso','inherited')        │
│ assigned_at     TIMESTAMP WITH TIME ZONE                        │
│ assigned_by     UUID REFERENCES users                           │
│ expires_at      TIMESTAMP WITH TIME ZONE                        │
│ PRIMARY KEY (user_id, role_id, organization_id)                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   group_role_assignments                        │
├─────────────────────────────────────────────────────────────────┤
│ group_id        UUID NOT NULL REFERENCES user_groups            │
│ role_id         UUID NOT NULL REFERENCES roles                  │
│ scope           ENUM('organization','children','tree')          │
│ assigned_at     TIMESTAMP WITH TIME ZONE                        │
│ assigned_by     UUID REFERENCES users                           │
│ PRIMARY KEY (group_id, role_id)                                 │
└─────────────────────────────────────────────────────────────────┘
```

### File Structure

```
packages/
├── api/
│   └── src/
│       ├── db/schema/
│       │   ├── tenant-profiles.ts      # Profile schema
│       │   ├── user-groups.ts          # Groups schema
│       │   └── roles.ts                # Roles & assignments schema
│       ├── repositories/
│       │   ├── tenant-profile.repository.ts
│       │   ├── group.repository.ts
│       │   └── role.repository.ts
│       └── routes/v1/
│           ├── tenant-profiles.ts
│           ├── groups.ts
│           └── roles.ts
│
└── shared/
    └── src/schemas/
        ├── tenant-profile.schema.ts    # Zod validation
        ├── group.schema.ts
        └── role.schema.ts
```

---

## Testing

Tests are located in `packages/api/src/db/schema/`:

- `tenant-profiles.test.ts` - 12 tests covering profile types, capabilities, limits
- `user-groups.test.ts` - 11 tests covering groups and memberships
- `roles.test.ts` - 25 tests covering roles, permissions, and assignments

Run tests:
```bash
cd packages/api
pnpm test
```

---

## Next Steps (Phase 2)

- Organization hierarchy tree view UI
- Organization details tabs
- Profile assignment UI
- Group management UI
- Role management UI with permission matrix editor
