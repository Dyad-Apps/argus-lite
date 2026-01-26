# Database Schema Reference

> **Version:** 2.0.0
> **Last Updated:** January 2026
> **Database:** PostgreSQL 17 with LTREE extension

## Overview

This document provides a comprehensive reference for all database tables in the Argus IQ platform. The schema supports:

- **Multi-tenancy** with root organization isolation
- **Unlimited recursive organization hierarchies** using PostgreSQL LTREE
- **Full RBAC** with roles, groups, and scoped permissions
- **SSO integration** with multiple identity providers
- **Entity management** for Assets, Devices, Persons, Activities, and Spaces
- **Time-series telemetry** and event-driven processing
- **Audit logging** for compliance and security

---

## Table of Contents

1. [Authentication & Users](#1-authentication--users)
2. [Organizations & Multi-Tenancy](#2-organizations--multi-tenancy)
3. [RBAC & Permissions](#3-rbac--permissions)
4. [Security Features](#4-security-features)
5. [Platform Configuration](#5-platform-configuration)
6. [Entity Management](#6-entity-management)
7. [Telemetry & Events](#7-telemetry--events)
8. [Enums Reference](#8-enums-reference)

---

## 1. Authentication & Users

### users

Core authentication and identity table with multi-organization support.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT random | Unique user identifier |
| `email` | VARCHAR(255) | NOT NULL | Email address (unique per root org) |
| `password_hash` | VARCHAR(255) | NULLABLE | Argon2 hash (null for SSO-only users) |
| `first_name` | VARCHAR(100) | | User's first name |
| `last_name` | VARCHAR(100) | | User's last name |
| `avatar_url` | VARCHAR(500) | | Profile picture URL |
| `root_organization_id` | UUID | FK, NOT NULL | Data isolation boundary |
| `primary_organization_id` | UUID | FK, NOT NULL | Default org after login |
| `status` | ENUM | DEFAULT 'active' | active, inactive, suspended, deleted |
| `email_verified_at` | TIMESTAMP | | When email was verified |
| `last_login_at` | TIMESTAMP | | Most recent login |
| `mfa_enabled` | BOOLEAN | DEFAULT false | 2FA enabled flag |
| `mfa_secret` | VARCHAR(255) | | TOTP secret (encrypted) |
| `deleted_at` | TIMESTAMP | | Soft delete timestamp |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Record creation time |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last modification time |

**Indexes:**
- `idx_users_email_root` - UNIQUE(email, root_organization_id)
- `idx_users_status` - Filter by status
- `idx_users_root_org` - Root org lookups
- `idx_users_primary_org` - Primary org lookups

**Foreign Keys:**
- `root_organization_id` → organizations(id) ON DELETE CASCADE
- `primary_organization_id` → organizations(id) ON DELETE CASCADE

---

### refresh_tokens

JWT refresh token storage with family-based rotation tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Token identifier |
| `user_id` | UUID | FK, NOT NULL | Token owner |
| `token_hash` | VARCHAR(64) | UNIQUE, NOT NULL | SHA-256 hash of token |
| `family_id` | UUID | | Token family for rotation |
| `is_revoked` | BOOLEAN | DEFAULT false | Revocation flag |
| `expires_at` | TIMESTAMP | NOT NULL | Token expiration |
| `last_used_at` | TIMESTAMP | | Last refresh time |
| `revoked_at` | TIMESTAMP | | When revoked |
| `user_agent` | VARCHAR(500) | | Client user agent |
| `ip_address` | VARCHAR(45) | | Client IP (IPv6 compatible) |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Token creation time |

**Security Note:** If a revoked token is reused, the entire family is invalidated (theft detection).

---

### password_reset_tokens

Short-lived tokens for password reset flow.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Token identifier |
| `user_id` | UUID | FK, NOT NULL | User requesting reset |
| `token_hash` | VARCHAR(64) | UNIQUE, NOT NULL | SHA-256 hash |
| `expires_at` | TIMESTAMP | NOT NULL | 1 hour expiration |
| `used_at` | TIMESTAMP | | When token was consumed |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Request time |

---

## 2. Organizations & Multi-Tenancy

### organizations

Multi-tenant organizations with unlimited recursive hierarchy.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Organization identifier |
| `name` | VARCHAR(255) | NOT NULL | Display name |
| `slug` | VARCHAR(100) | UNIQUE, NOT NULL | URL-safe identifier |
| `org_code` | VARCHAR(50) | NOT NULL | Human-readable code for switching |
| `parent_organization_id` | UUID | FK (self) | Parent in hierarchy |
| `root_organization_id` | UUID | FK (self) | Top-level isolation boundary |
| `is_root` | BOOLEAN | DEFAULT false | True for top-level orgs |
| `path` | TEXT | | LTREE path (e.g., 'radio.walmart.northeast') |
| `depth` | INTEGER | DEFAULT 0 | Level in hierarchy (0 = root) |
| `can_have_children` | BOOLEAN | DEFAULT false | Allow child creation |
| `subdomain` | VARCHAR(63) | UNIQUE | Only for root orgs (acme.argusiq.com) |
| `description` | VARCHAR(1000) | | Organization description |
| `profile_id` | UUID | FK | Organization profile template |
| `plan` | ENUM | DEFAULT 'free' | Subscription tier |
| `is_active` | BOOLEAN | DEFAULT true | Active/disabled flag |
| `settings` | JSONB | | Custom settings |
| `quota_overrides` | JSONB | | Override profile limits |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Creation time |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes:**
- `idx_organizations_slug` - Slug lookups
- `idx_organizations_subdomain` - Subdomain routing
- `idx_organizations_parent` - Parent lookups
- `idx_organizations_root` - Root org filtering
- `idx_organizations_org_code_root` - UNIQUE(org_code, root_organization_id)

---

### organization_branding

White-labeling configuration per organization.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Branding config identifier |
| `organization_id` | UUID | FK, UNIQUE, NOT NULL | Organization |
| `logo_url` | TEXT | | Light mode logo |
| `logo_dark_url` | TEXT | | Dark mode logo |
| `favicon_url` | TEXT | | Browser favicon |
| `primary_color` | VARCHAR(7) | | Hex color (#1890FF) |
| `accent_color` | VARCHAR(7) | | Hex color |
| `login_background_type` | ENUM | DEFAULT 'particles' | default, solid, image, particles |
| `login_background_url` | TEXT | | Background image URL |
| `login_background_color` | VARCHAR(7) | | Solid background color |
| `login_welcome_text` | VARCHAR(100) | | Welcome message |
| `login_subtitle` | VARCHAR(200) | | Subtitle text |
| `custom_css` | TEXT | | Enterprise custom CSS |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Creation time |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last update |

---

### user_organizations

Many-to-many relationship between users and organizations with roles.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `user_id` | UUID | PK, FK | User reference |
| `organization_id` | UUID | PK, FK | Organization reference |
| `role` | ENUM | NOT NULL | owner, admin, member, viewer |
| `is_primary` | BOOLEAN | DEFAULT false | Default org after login |
| `expires_at` | TIMESTAMP | | Time-limited access (contractors) |
| `joined_at` | TIMESTAMP | DEFAULT NOW() | Membership start |
| `invited_by` | UUID | FK | User who sent invite |

**Primary Key:** Composite (user_id, organization_id)

---

### organization_invitations

Email-based invitations to join organizations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Invitation identifier |
| `organization_id` | UUID | FK, NOT NULL | Target organization |
| `email` | VARCHAR(255) | NOT NULL | Invitee email |
| `role` | ENUM | NOT NULL | Assigned role |
| `status` | ENUM | DEFAULT 'pending' | pending, accepted, declined, expired, cancelled |
| `token_hash` | VARCHAR(64) | UNIQUE, NOT NULL | Invitation token hash |
| `invited_by` | UUID | FK, NOT NULL | Inviter user |
| `expires_at` | TIMESTAMP | NOT NULL | Invitation expiry |
| `accepted_at` | TIMESTAMP | | When accepted |
| `accepted_by` | UUID | FK | User who accepted |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Creation time |

---

### organization_profiles

Configuration templates defining organization capabilities and limits.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Profile identifier |
| `name` | VARCHAR(100) | NOT NULL | Profile name |
| `description` | VARCHAR(500) | | Profile description |
| `type` | ENUM | NOT NULL | root, child, universal |
| `is_system` | BOOLEAN | DEFAULT false | Cannot be deleted |
| `capabilities` | JSONB | | Feature flags (ssoEnabled, whiteLabeling, etc.) |
| `limits` | JSONB | | Resource limits (maxUsers, maxDevices, etc.) |
| `is_active` | BOOLEAN | DEFAULT true | Active flag |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Creation time |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last update |

**Capabilities JSONB Structure:**
```json
{
  "whiteLabeling": true,
  "ssoEnabled": true,
  "mfaEnabled": true,
  "apiAccess": true,
  "advancedAnalytics": false
}
```

**Limits JSONB Structure:**
```json
{
  "maxUsers": 100,
  "maxDevices": 1000,
  "maxAssets": 5000,
  "maxChildOrganizations": 10,
  "apiRateLimit": 1000
}
```

---

## 3. RBAC & Permissions

### user_groups

Groups for organizing users and bulk role assignment.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Group identifier |
| `organization_id` | UUID | FK, NOT NULL | Owning organization |
| `name` | VARCHAR(100) | NOT NULL | Group name |
| `description` | VARCHAR(500) | | Group description |
| `created_by` | UUID | FK | Creator user |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Creation time |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last update |

---

### user_group_memberships

Junction table for user-group membership.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `user_id` | UUID | PK, FK | User reference |
| `group_id` | UUID | PK, FK | Group reference |
| `added_at` | TIMESTAMP | DEFAULT NOW() | Membership start |
| `added_by` | UUID | FK | User who added member |

**Primary Key:** Composite (user_id, group_id)

---

### roles

RBAC roles with system and custom organization roles.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Role identifier |
| `name` | VARCHAR(100) | NOT NULL | Role name |
| `description` | VARCHAR(500) | | Role description |
| `organization_id` | UUID | FK | Null = system role |
| `is_system` | BOOLEAN | DEFAULT false | System roles are immutable |
| `default_scope` | ENUM | | organization, children, tree |
| `permissions` | JSONB | NOT NULL | Permission matrix |
| `priority` | VARCHAR(10) | DEFAULT '0' | Conflict resolution order |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Creation time |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last update |

**Permissions JSONB Structure:**
```json
{
  "users": { "create": true, "read": true, "update": true, "delete": false },
  "organizations": { "create": false, "read": true, "update": false, "delete": false },
  "assets": { "create": true, "read": true, "update": true, "delete": true },
  "audit_logs": { "read": true }
}
```

---

### user_role_assignments

Direct role assignments to users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `user_id` | UUID | PK, FK | User reference |
| `role_id` | UUID | PK, FK | Role reference |
| `organization_id` | UUID | PK, FK | Org context |
| `scope` | ENUM | | organization, children, tree |
| `source` | ENUM | DEFAULT 'direct' | direct, group, sso, inherited |
| `assigned_at` | TIMESTAMP | DEFAULT NOW() | Assignment time |
| `assigned_by` | UUID | FK | Assigning user |
| `expires_at` | TIMESTAMP | | Time-limited assignment |

**Primary Key:** Composite (user_id, role_id, organization_id)

---

### group_role_assignments

Role assignments to groups (users inherit via membership).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `group_id` | UUID | PK, FK | Group reference |
| `role_id` | UUID | PK, FK | Role reference |
| `scope` | ENUM | | organization, children, tree |
| `assigned_at` | TIMESTAMP | DEFAULT NOW() | Assignment time |
| `assigned_by` | UUID | FK | Assigning user |

**Primary Key:** Composite (group_id, role_id)

---

## 4. Security Features

### identity_providers

SSO provider configurations (OIDC, SAML, social).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Provider identifier |
| `organization_id` | UUID | FK | Null = global provider |
| `type` | ENUM | NOT NULL | oidc, saml, google, microsoft, github, okta |
| `name` | VARCHAR(100) | NOT NULL | Internal name |
| `display_name` | VARCHAR(255) | | UI display name |
| `config` | JSONB | NOT NULL | Provider-specific config (encrypted) |
| `allowed_domains` | JSONB | | Email domain restrictions |
| `enabled` | BOOLEAN | DEFAULT true | Provider enabled |
| `auto_create_users` | BOOLEAN | DEFAULT false | Create users on first login |
| `auto_link_users` | BOOLEAN | DEFAULT false | Link by email match |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Creation time |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last update |

**Unique Constraint:** (organization_id, name)

---

### user_identities

Links users to external SSO accounts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Identity link identifier |
| `user_id` | UUID | FK, NOT NULL | Local user |
| `provider_id` | UUID | FK, NOT NULL | Identity provider |
| `external_id` | VARCHAR(255) | NOT NULL | ID from provider |
| `email` | VARCHAR(255) | | Email from provider |
| `profile` | JSONB | | Profile data from provider |
| `access_token` | VARCHAR(2000) | | OAuth access token |
| `refresh_token` | VARCHAR(2000) | | OAuth refresh token |
| `token_expires_at` | TIMESTAMP | | Token expiration |
| `last_used_at` | TIMESTAMP | | Last SSO login |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Link creation |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last update |

**Unique Constraint:** (provider_id, external_id)

---

### impersonation_sessions

Audit trail for admin/support staff impersonating users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Session identifier |
| `impersonator_id` | UUID | FK, NOT NULL | Admin/support user |
| `target_user_id` | UUID | FK, NOT NULL | User being impersonated |
| `organization_id` | UUID | FK | Org context |
| `reason` | TEXT | NOT NULL | Audit reason (required) |
| `status` | ENUM | DEFAULT 'active' | active, ended, expired, revoked |
| `started_at` | TIMESTAMP | DEFAULT NOW() | Session start |
| `ended_at` | TIMESTAMP | | Session end |
| `expires_at` | TIMESTAMP | NOT NULL | Auto-expiry time |
| `ip_address` | VARCHAR(45) | | Admin IP address |
| `user_agent` | VARCHAR(500) | | Admin browser |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Record creation |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes:**
- `idx_impersonation_sessions_impersonator`
- `idx_impersonation_sessions_target`
- `idx_impersonation_sessions_status`
- `idx_impersonation_sessions_expires`

---

### audit_logs

Security and compliance event tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | BIGSERIAL | PK | Log entry identifier |
| `category` | ENUM | NOT NULL | Event category |
| `action` | VARCHAR(100) | NOT NULL | Specific action |
| `user_id` | UUID | FK | Acting user |
| `user_email` | VARCHAR(255) | | User email (denormalized) |
| `organization_id` | UUID | FK | Org context |
| `resource_type` | VARCHAR(100) | | Affected resource type |
| `resource_id` | VARCHAR(100) | | Affected resource ID |
| `details` | JSONB | | Additional context |
| `outcome` | VARCHAR(20) | DEFAULT 'success' | success, failure |
| `request_id` | VARCHAR(36) | | Correlation ID |
| `ip_address` | VARCHAR(45) | | Client IP |
| `user_agent` | VARCHAR(500) | | Client browser |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Event time |

**Categories:** authentication, authorization, user_management, organization_management, data_access, data_modification, system

---

## 5. Platform Configuration

### platform_settings

Global key-value configuration store for system admins.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Setting identifier |
| `key` | VARCHAR(100) | UNIQUE, NOT NULL | Setting key |
| `value` | JSONB | NOT NULL | Setting value |
| `description` | TEXT | | Setting description |
| `is_secret` | BOOLEAN | DEFAULT false | Mask in UI |
| `updated_by` | UUID | FK | Last editor |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last update |

**Common Keys:**
- `security.password_min_length`
- `security.password_require_uppercase`
- `security.session_timeout_minutes`
- `security.mfa_enabled`
- `rate_limit.requests_per_minute`
- `features.self_registration_enabled`
- `email.smtp_host`, `email.smtp_port`, etc.

---

### system_admins

Platform-level administrator accounts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Admin record identifier |
| `user_id` | UUID | FK, UNIQUE, NOT NULL | Linked user |
| `role` | ENUM | DEFAULT 'support' | super_admin, org_admin, support, billing |
| `is_active` | BOOLEAN | DEFAULT true | Active flag |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Creation time |
| `created_by` | UUID | FK | Creating admin |

**System Roles:**
- `super_admin` - Full platform access, can impersonate any non-super-admin user
- `org_admin` - Organization admin, can impersonate users within their organization(s) only
- `support` - Read-only access with limited impersonation
- `billing` - Billing and subscription management only

---

### platform_branding

Default branding for platform login pages.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Branding identifier |
| `logo_url` | TEXT | | Default logo |
| `logo_dark_url` | TEXT | | Default dark mode logo |
| `favicon_url` | TEXT | | Default favicon |
| `primary_color` | VARCHAR(7) | DEFAULT '#1890FF' | Default primary color |
| `accent_color` | VARCHAR(7) | | Default accent color |
| `login_background_type` | VARCHAR(20) | DEFAULT 'particles' | Background type |
| `login_background_url` | TEXT | | Background image URL |
| `login_welcome_text` | VARCHAR(100) | DEFAULT 'Welcome' | Welcome text |
| `login_subtitle` | VARCHAR(200) | | Subtitle |
| `terms_of_service_url` | TEXT | | ToS link |
| `privacy_policy_url` | TEXT | | Privacy link |
| `support_url` | TEXT | | Support link |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last update |
| `updated_by` | UUID | FK | Last editor |

---

## 6. Entity Management

### type_definitions

Registry of entity type definitions mapping to base types.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Type definition identifier |
| `tenant_id` | UUID | FK, NOT NULL | Owning organization |
| `project_id` | UUID | FK | Optional project scope |
| `name` | VARCHAR(100) | NOT NULL | Internal name |
| `display_name` | VARCHAR(255) | NOT NULL | UI display name |
| `description` | TEXT | | Type description |
| `inherits_from` | ENUM | NOT NULL | Asset, Device, Person, Activity, Space |
| `property_mappings` | JSONB | | Custom property definitions |
| `semantic_tags` | TEXT[] | | Classification tags |
| `industry_vertical` | VARCHAR(100) | | Industry (retail, healthcare, etc.) |
| `default_icon` | VARCHAR(100) | | Default icon name |
| `default_color` | VARCHAR(7) | | Default color |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Creation time |
| `created_by` | UUID | | Creator |
| `version` | INTEGER | DEFAULT 1 | Schema version |

**Unique Constraint:** (tenant_id, name)

---

### entities

Concrete instances of type definitions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Entity identifier |
| `tenant_id` | UUID | FK, NOT NULL | Owning organization |
| `type_definition_id` | UUID | FK | Type definition |
| `base_type` | ENUM | NOT NULL | Asset, Device, Person, Activity, Space |
| `name` | VARCHAR(255) | NOT NULL | Entity name |
| `display_name` | VARCHAR(255) | | UI display name |
| `serial_number` | VARCHAR(100) | | Serial/identifier |
| `lifecycle_status` | ENUM | | commissioning, active, maintenance, decommissioned |
| `health_score` | SMALLINT | | 0-100 health score |
| `location_ref` | UUID | | Space reference |
| `mac_address` | VARCHAR(17) | | Device MAC address |
| `connectivity_status` | ENUM | | online, offline, degraded |
| `firmware_version` | VARCHAR(50) | | Device firmware |
| `last_seen` | TIMESTAMP | | Last device check-in |
| `identity_id` | UUID | | Person's user link |
| `work_role` | VARCHAR(100) | | Person's job role |
| `activity_type` | VARCHAR(100) | | Activity classification |
| `start_timestamp` | TIMESTAMP | | Activity start |
| `end_timestamp` | TIMESTAMP | | Activity end |
| `activity_status` | ENUM | | pending, in_progress, completed, cancelled |
| `parent_id` | UUID | FK | Space parent |
| `space_type` | VARCHAR(50) | | building, floor, room, zone |
| `boundary_coordinates` | JSONB | | GeoJSON polygon |
| `environment_state` | JSONB | | Temperature, humidity, etc. |
| `properties` | JSONB | | Custom properties |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Creation time |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last update |
| `created_by` | UUID | | Creator |

---

### entity_edges

Typed relationships between entities (graph edges).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Edge identifier |
| `tenant_id` | UUID | FK, NOT NULL | Owning organization |
| `source_entity_id` | UUID | FK, NOT NULL | Source entity |
| `source_entity_type` | ENUM | | Source base type |
| `target_entity_id` | UUID | FK, NOT NULL | Target entity |
| `target_entity_type` | ENUM | | Target base type |
| `relationship_type` | ENUM | NOT NULL | Relationship type |
| `metadata` | JSONB | | Additional edge data |
| `valid_from` | TIMESTAMP | | Temporal validity start |
| `valid_until` | TIMESTAMP | | Temporal validity end |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Creation time |

**Relationship Types:** CONTAINED_IN, CHILD_OF, ADJACENT_TO, MONITORED_BY, CONTROLLED_BY, FED_BY, POWERED_BY, OWNED_BY, ASSIGNED_TO, RESPONSIBLE_FOR, DEPENDS_ON, BACKUP_FOR, PART_OF

---

## 7. Telemetry & Events

### telemetry_history

Time-series telemetry data from entities.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | BIGSERIAL | PK | Record identifier |
| `tenant_id` | UUID | FK, NOT NULL | Owning organization |
| `entity_id` | UUID | NOT NULL | Source entity |
| `entity_type` | ENUM | | Entity base type |
| `metric_key` | VARCHAR(100) | NOT NULL | Metric name |
| `value` | DOUBLE PRECISION | NOT NULL | Metric value |
| `quality` | ENUM | DEFAULT 'good' | good, uncertain, bad |
| `timestamp` | TIMESTAMP | NOT NULL | Measurement time |
| `received_at` | TIMESTAMP | DEFAULT NOW() | Ingestion time |

**Indexes:**
- `idx_telemetry_entity_time` - (entity_id, timestamp)
- `idx_telemetry_metric_time` - (metric_key, timestamp)
- `idx_telemetry_composite` - (entity_id, metric_key, timestamp)

**Note:** Consider TimescaleDB hypertable for production scale.

---

### system_events

Event-driven logic layer capturing all system events.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | BIGSERIAL | PK | Event identifier |
| `tenant_id` | UUID | FK, NOT NULL | Owning organization |
| `event_type` | VARCHAR(100) | NOT NULL | Event classification |
| `entity_id` | UUID | | Related entity |
| `entity_type` | ENUM | | Entity base type |
| `payload` | JSONB | NOT NULL | Event data |
| `processed` | BOOLEAN | DEFAULT false | Processing flag |
| `processed_at` | TIMESTAMP | | Processing time |
| `processing_result` | JSONB | | Processing output |
| `correlation_id` | UUID | | Event correlation |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Event time |

**Indexes:**
- `idx_events_unprocessed` - (processed, created_at) for queue polling

---

### permission_audit_log

Audit trail for permission checks and security enforcement.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | BIGSERIAL | PK | Record identifier |
| `tenant_id` | UUID | FK, NOT NULL | Organization |
| `person_id` | UUID | NOT NULL | Acting person |
| `entity_id` | UUID | NOT NULL | Target entity |
| `action` | VARCHAR(100) | NOT NULL | Attempted action |
| `permission_level` | VARCHAR(50) | NOT NULL | Required permission |
| `granted` | BOOLEAN | NOT NULL | Access granted |
| `denial_reason` | VARCHAR(500) | | Denial explanation |
| `checked_at` | TIMESTAMP | DEFAULT NOW() | Check time |

---

## 8. Enums Reference

### User & Authentication
| Enum | Values |
|------|--------|
| `user_status` | active, inactive, suspended, deleted |
| `organization_role` | owner, admin, member, viewer |
| `invitation_status` | pending, accepted, declined, expired, cancelled |
| `identity_provider_type` | oidc, saml, google, microsoft, github, okta |
| `impersonation_status` | active, ended, expired, revoked |

### Organization & Platform
| Enum | Values |
|------|--------|
| `organization_plan` | free, starter, professional, enterprise |
| `login_background_type` | default, solid, image, particles |
| `system_role` | super_admin, org_admin, support, billing |
| `profile_type` | root, child, universal |

### RBAC
| Enum | Values |
|------|--------|
| `role_scope` | organization, children, tree |
| `role_source` | direct, group, sso, inherited |

### Audit
| Enum | Values |
|------|--------|
| `audit_category` | authentication, authorization, user_management, organization_management, data_access, data_modification, system |

### Entity Management
| Enum | Values |
|------|--------|
| `base_type` | Asset, Device, Person, Activity, Space |
| `lifecycle_status` | commissioning, active, maintenance, decommissioned |
| `connectivity_status` | online, offline, degraded |
| `activity_status` | pending, in_progress, completed, cancelled |
| `telemetry_quality` | good, uncertain, bad |
| `relationship_type` | CONTAINED_IN, CHILD_OF, ADJACENT_TO, MONITORED_BY, CONTROLLED_BY, FED_BY, POWERED_BY, OWNED_BY, ASSIGNED_TO, RESPONSIBLE_FOR, DEPENDS_ON, BACKUP_FOR, PART_OF |

---

## Entity Relationship Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     users       │────<│user_organizations│>────│  organizations  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                               │
        │  ┌─────────────────┐                         │
        └──│ user_identities │                         │
           └─────────────────┘                         │
                    │                                   │
           ┌─────────────────┐                         │
           │identity_providers│─────────────────────────┤
           └─────────────────┘                         │
                                                       │
┌─────────────────┐     ┌─────────────────┐           │
│   user_groups   │────<│user_group_member│           │
└─────────────────┘     └─────────────────┘           │
        │                                              │
        │  ┌─────────────────┐                        │
        └──│group_role_assign│                        │
           └─────────────────┘                        │
                    │                                  │
           ┌─────────────────┐     ┌─────────────────┐│
           │      roles      │────<│user_role_assign │├
           └─────────────────┘     └─────────────────┘│
                                                      │
           ┌─────────────────┐                        │
           │org_profiles     │────────────────────────┘
           └─────────────────┘

           ┌─────────────────┐
           │platform_settings│
           └─────────────────┘

           ┌─────────────────┐
           │  system_admins  │
           └─────────────────┘

           ┌─────────────────┐
           │impersonation_   │
           │   sessions      │
           └─────────────────┘
```

---

## Migration History

| Migration | Description |
|-----------|-------------|
| 0001 | Initial schema (users, organizations, auth) |
| 0002 | Add RBAC tables (roles, groups, assignments) |
| 0003 | Add organization profiles |
| 0004 | Add impersonation sessions |

---

[← Back to Architecture Overview](./architecture/README.md)
