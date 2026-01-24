# Test Coverage Report

This document provides an overview of test coverage for the ArgusIQ Lite platform.

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests with watch mode
pnpm test:watch

# Run tests with coverage report
cd packages/api && pnpm test:coverage
```

## Test Files

### API Package (`packages/api`)

| File | Description | Status |
|------|-------------|--------|
| `src/app.test.ts` | Health endpoints integration tests | ✅ Existing (4 tests) |
| `src/db/schema/organizations.test.ts` | Organization schema & multi-tenant model | ✅ New (15 tests) |
| `src/db/schema/organization-hierarchy.test.ts` | Deep nesting & LTREE queries (ADR-001) | ✅ New (14 tests) |
| `src/db/schema/users.test.ts` | User schema & organization context | ✅ New (12 tests) |
| `src/db/schema/user-organizations.test.ts` | User-org relationships & roles | ✅ New (15 tests) |
| `src/utils/jwt.test.ts` | JWT token utilities | ✅ New (14 tests) |

## Coverage Summary

### Multi-Tenant Model (ADR-001)

| Feature | Unit Tests | Integration Tests | Notes |
|---------|-----------|-------------------|-------|
| Organization hierarchy schema | ✅ | ❌ | Schema validation tests |
| LTREE path format | ✅ | ❌ | Type-level tests |
| Parent/child relationships | ✅ | ❌ | Constraint validation |
| Root organization rules | ✅ | ❌ | Business rule tests |
| org_code uniqueness per root | ✅ | ❌ | Needs DB integration |
| User-organization junction | ✅ | ❌ | Role-based access tests |
| Time-limited access | ✅ | ❌ | Expiration filtering |
| Hierarchy queries (LTREE) | ✅ | ❌ | Unit tests for query patterns |
| 6+ level deep hierarchies | ✅ | ❌ | Tests 6, 10, 20, 100 levels |
| 10K+ tenant performance | ❌ | ❌ | Needs load testing |

### Subdomain Routing (ADR-002)

| Feature | Unit Tests | Integration Tests | Notes |
|---------|-----------|-------------------|-------|
| User root_organization_id | ✅ | ❌ | Schema tests |
| Email unique per root | ✅ | ❌ | Type-level tests |
| Primary organization | ✅ | ❌ | Schema tests |
| JWT structure (current) | ✅ | ❌ | Documents current impl |
| JWT with tenant context | ❌ | ❌ | NOT IMPLEMENTED |
| Subdomain resolver middleware | ❌ | ❌ | NOT IMPLEMENTED |
| Tenant switching API | ❌ | ❌ | NOT IMPLEMENTED |

### Authentication

| Feature | Unit Tests | Integration Tests | Notes |
|---------|-----------|-------------------|-------|
| JWT signing/verification | ✅ | ❌ | Core JWT tests |
| Token expiration | ✅ | ❌ | 15-minute expiry |
| Access token validation | ✅ | ❌ | Type checking |
| Health endpoints | ✅ | ❌ | Integration tests |

## Test Categories

### Schema Tests

These tests verify the Drizzle ORM schema definitions match ADR requirements:

- **Organization Schema**: Verifies all hierarchy fields (parent_id, root_id, path, depth, is_root)
- **User Schema**: Verifies organization context fields (root_organization_id, primary_organization_id)
- **User-Organizations Schema**: Verifies junction table with roles and expiration

### Type-Level Tests

These tests verify TypeScript type definitions:

- **NewOrganization type**: Allows all required fields for root and child orgs
- **NewUser type**: Requires organization context fields
- **NewUserOrganization type**: Supports roles and time-limited access

### Business Rule Tests

These tests document business rules that will be enforced:

- Root orgs must have subdomain, non-root must not
- Root orgs reference themselves, children reference root
- Email unique per root organization
- Only one primary organization per user

## Gap Analysis

### Tests Needed

1. **Integration Tests**
   - Database-level constraint testing
   - LTREE query performance
   - RLS policy enforcement
   - Multi-root data isolation

2. **API Tests**
   - Auth flow with organization context
   - Organization CRUD with hierarchy
   - User-organization management

3. **E2E Tests**
   - Full authentication flow
   - Tenant switching
   - Cross-tenant isolation

### Implementation Gaps (Require Code First)

Before testing, these features need implementation:

1. Subdomain resolver middleware
2. Enhanced JWT with tenant context
3. Tenant switching API (`POST /auth/switch-tenant`)

## Coverage Targets

| Category | Current | Target |
|----------|---------|--------|
| Statements | ~20% | 80% |
| Branches | ~15% | 75% |
| Functions | ~25% | 80% |
| Lines | ~20% | 80% |

## Running Coverage Report

```bash
cd packages/api
pnpm test:coverage
```

Coverage reports are generated in:
- `packages/api/coverage/` (HTML report)
- Console output (text summary)

## Next Steps

1. [ ] Add integration tests with test database
2. [ ] Implement missing ADR-002 features
3. [ ] Add tests for new features
4. [ ] Set up CI coverage reporting
5. [ ] Add load tests for LTREE performance

---

*Last Updated: 2026-01-24*
