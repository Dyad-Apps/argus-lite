# ADR-003: Page-Level Development Workflow

> **Status:** Accepted
> **Date:** January 2026
> **Deciders:** Engineering Team

## Context

During the implementation of the dashboard page, we created UI components that displayed fake data (generated system metrics, zeros for message throughput) without proper consideration for:

1. **Data Source Validity** - Using Node.js `os` module for system metrics is meaningless in a distributed deployment
2. **Architectural Coherence** - Components were created to match a reference UI without considering if the data sources exist
3. **Future Scalability** - No clear path to replace mock data with real data sources

This ADR establishes a formal workflow for page-level development to prevent similar issues.

## Decision

Before implementing any new page or significant UI feature, developers must complete a **Page Planning Checklist** that classifies all data sources and determines implementation scope.

### Data Source Classification

All data required by a page must be classified into one of three categories:

| Category | Description | Action |
|----------|-------------|--------|
| **Real DB** | Data exists in PostgreSQL with working CRUD APIs | Implement fully |
| **Deferred** | Schema exists but no data ingestion path | Show "Coming Soon" placeholder |
| **Future Service** | Requires external service integration | Show "Not Configured" placeholder |

### Page Planning Checklist

```markdown
## Page: [Name]

### 1. Data Requirements
- [ ] List all data needed for the page
- [ ] Classify each data source: Real DB / Deferred / Future Service
- [ ] Confirm Real DB sources have working API endpoints

### 2. API Endpoints
| Method | Endpoint | Exists? | Action |
|--------|----------|---------|--------|
| GET | /api/v1/... | Yes/No | Create/Modify/None |

### 3. Feature Scope
- **Implement Now**: [features with Real DB data]
- **Coming Soon**: [features needing Deferred data]
- **Not Configured**: [features requiring Future Services]

### 4. Component Pattern
- [ ] List Page (DataTable with server-side pagination)
- [ ] Detail Page (Tabs layout)
- [ ] Form Page (Create/Edit)
- [ ] Dashboard (Widgets/Cards)

### 5. Authorization
- [ ] Required role: any / admin / super-admin
- [ ] Data scoping: org / root-tree / platform
```

## Available Data Sources

### Real DB (Available Now)

| Table | Status | Can Query |
|-------|--------|-----------|
| `organizations` | Complete | Counts, hierarchy, details |
| `users` | Complete | Counts, list, details |
| `user_organizations` | Complete | Membership, roles |
| `audit_logs` | Schema ready | Events, activity history |
| `identity_providers` | Partial | SSO configuration |
| `organization_branding` | Schema ready | Branding settings |

### Deferred (Schema Exists, No Data)

| Table | Reason | Timeline |
|-------|--------|----------|
| `entities` | No CRUD API, no data ingestion | Phase 2+ |
| `entity_edges` | No entities to relate | Phase 2+ |
| `type_definitions` | Needs CRUD API | Phase 2+ |
| `role_definitions` | Needs CRUD API | Phase 2+ |

### Future Services (Requires External Integration)

| Feature | Required Service | Phase |
|---------|-----------------|-------|
| System metrics (CPU/RAM/Disk) | Prometheus/Grafana | Phase 4+ |
| Message throughput | RabbitMQ/Kafka metrics API | Phase 4+ |
| Device telemetry | MQTT Broker | Phase 4+ |
| Real-time alerts | Alerting service | Phase 4+ |

## Component Patterns

### List Page Pattern

Standard structure for pages displaying collections:

- DataTable with server-side pagination
- Search with debounce (300ms)
- Filter dropdowns
- Row actions menu
- Bulk actions toolbar

**Files**:
- `routes/[resource].tsx` - Route component
- `components/[resource]/[resource]-table.tsx` - DataTable wrapper

### Detail Page Pattern

Standard structure for single-item detail views:

- Header with breadcrumb + action buttons
- Tabbed content area
- Overview tab with key stats
- Activity tab (scoped audit logs)

**Files**:
- `routes/[resource]/$id.tsx` - Route component
- `components/[resource]/[resource]-tabs.tsx` - Tab content

### Placeholder Patterns

For features that cannot be implemented yet:

```tsx
// Coming Soon - for Deferred data
<ComingSoonCard
  title="Device Management"
  description="Device tracking requires Entity API completion"
  phase="Phase 2"
/>

// Not Configured - for Future Services
<NotConfiguredCard
  title="Infrastructure Monitoring"
  description="System metrics require Prometheus integration"
  learnMoreUrl="/docs/infrastructure-setup"
/>
```

## Consequences

### Positive

- **Prevents fake data** - No more components displaying generated/mock data
- **Clear scope** - Teams know what can be implemented vs. what needs placeholders
- **Better UX** - Users see clear "Coming Soon" messages instead of misleading zeros
- **Maintainability** - Easy to track which features are real vs. deferred

### Negative

- **More upfront work** - Requires planning before implementation
- **Slower initial delivery** - Some features will show placeholders instead of fake data

### Neutral

- Establishes precedent for data-source validation across all new features

## Implementation

### Immediate Actions

1. Refactor Dashboard to remove fake data:
   - Delete system metrics charts (no Prometheus)
   - Delete message throughput chart (no message queue)
   - Show placeholder for infrastructure monitoring
   - Keep only real DB data (org/user counts, audit logs)

2. Create shared placeholder components:
   - `ComingSoonCard` - for deferred features
   - `NotConfiguredCard` - for features requiring external services

### Future Enforcement

- PR reviews must verify page planning checklist completion
- Data source classification required in technical design docs

## References

- [Phase 1: Auth & Multi-Org](./architecture/phase-1-auth-multi-org.md)
- [Phase 2: Database & RLS](./architecture/phase-2-database-rls.md)
- [ADR Implementation Status](./ADR-IMPLEMENTATION-STATUS.md)

---

*Last Updated: January 2026*
