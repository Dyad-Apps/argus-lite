# Development Guide for Claude

> **Purpose**: This guide helps maintain consistency and quality when implementing new features. Claude should reference this document when working on the codebase.

## 🎯 Core Principles

1. **Test as You Build** - Add tests alongside new code, not afterwards
2. **Schema Changes Require Migrations** - Never update TypeScript schemas without creating SQL migrations
3. **Holistic Approach** - Check dependencies and related code before making changes
4. **Documentation First** - Update docs when adding features

---

## ✅ Checklist: Adding New Features

### Before Writing Code

- [ ] Read existing code to understand patterns
- [ ] Check for similar implementations to follow
- [ ] Identify all affected files (schema, repository, routes, types)
- [ ] Plan database changes if needed

### When Writing Code

**1. Database Schema Changes:**
```bash
# If adding/modifying tables or columns:
1. Update packages/api/src/db/schema/*.ts
2. Generate migration: cd packages/api && npx drizzle-kit generate
3. Review the generated migration SQL
4. Apply migration: npx tsx src/db/migrate-single.ts XXXX_migration.sql
5. Update seed script if needed
6. Commit schema + migration together
```

**2. Repository Layer** (if needed):
```bash
# Create repository following existing patterns
1. Create packages/api/src/repositories/my-feature.repository.ts
2. Export from packages/api/src/repositories/index.ts
3. Add repository to DI/singleton pattern
4. CREATE TEST FILE: my-feature.repository.test.ts
   - Target: 80%+ coverage
   - Template: user.repository.test.ts
   - Test CRUD operations, errors, edge cases
```

**3. Route Layer**:
```bash
# Create routes following existing patterns
1. Create packages/api/src/routes/v1/my-feature.ts
2. Register in packages/api/src/routes/v1/index.ts
3. Add Zod schemas for validation
4. CONSIDER: Add route tests (50-60% coverage target)
   - Template: auth.routes.test.ts (once fixed)
   - Test critical happy paths and error cases
```

**4. Types and Validation**:
```bash
# Update shared types
1. Update packages/shared/src/schemas/*.ts (Zod schemas)
2. Update packages/shared/src/types/*.ts (TypeScript types)
3. Export from packages/shared/src/index.ts
```

### After Writing Code

- [ ] Run tests: `npm run test`
- [ ] Check coverage: `npm run test:coverage`
- [ ] Run TypeScript check: `npm run typecheck`
- [ ] Test manually in UI
- [ ] Update documentation if needed

---

## 📋 Test Coverage Targets

| Layer | Target Coverage | Priority | Template File |
|-------|----------------|----------|---------------|
| Repositories | 80%+ | HIGH | user.repository.test.ts |
| Utilities | 90%+ | HIGH | password.test.ts |
| Services | 70%+ | MEDIUM | audit.service.test.ts |
| Routes | 50-60% | MEDIUM | (Add as needed) |
| Middleware | 60%+ | LOW | (Add as needed) |

**Current Overall Coverage: 30.13%**
- Repositories: 81.5% ✅
- Utilities: 93.54% ✅
- Services: 17.68% (audit.service: 100%)
- Routes: 11.29% (add incrementally)

---

## 🔍 Common Patterns to Follow

### Repository Pattern
```typescript
// See: packages/api/src/repositories/user.repository.ts
export class MyFeatureRepository {
  async create(data: NewMyFeature, trx?: Transaction): Promise<MyFeature> {
    const executor = getExecutor(trx);
    const result = await executor.insert(myFeatures).values(data).returning();
    return result[0];
  }

  async findById(id: string, trx?: Transaction): Promise<MyFeature | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(myFeatures)
      .where(eq(myFeatures.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  // ... more methods
}

// Singleton export
let myFeatureRepository: MyFeatureRepository | null = null;
export function getMyFeatureRepository(): MyFeatureRepository {
  if (!myFeatureRepository) {
    myFeatureRepository = new MyFeatureRepository();
  }
  return myFeatureRepository;
}
```

### Route Pattern
```typescript
// See: packages/api/src/routes/v1/users.ts
export async function myFeatureRoutes(app: FastifyInstance): Promise<void> {
  const repo = getMyFeatureRepository();

  // All routes require authentication
  app.addHook('preHandler', app.authenticate);

  // GET /my-features - List with pagination
  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        querystring: z.object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(20),
        }),
        response: {
          200: myFeatureListResponseSchema,
        },
      },
    },
    async (request) => {
      // Check organization access via request.user!.organizationId
      const result = await repo.findAll({
        organizationId: request.user!.organizationId,
        page: request.query.page,
        pageSize: request.query.pageSize,
      });

      return { data: result.data, pagination: result.pagination };
    }
  );
}
```

### Audit Logging Pattern
```typescript
// See: packages/api/src/services/audit.service.ts
import { auditService } from '../../services/audit.service.js';

// After important operations:
await auditService.logUserAction(
  'action_name',
  userId,
  organizationId,
  {
    resourceType: 'my_feature',
    resourceId: myFeature.id,
    changes: { field: 'old' → 'new' },
  }
);
```

---

## 🚨 Critical Reminders

### Schema Drift Prevention
```
❌ WRONG:
1. Update TypeScript schema
2. Deploy code
→ Runtime errors because database doesn't match!

✅ CORRECT:
1. Update TypeScript schema
2. Generate migration (drizzle-kit generate)
3. Apply migration to database
4. Commit schema + migration together
```

### Multi-Tenant Isolation
```typescript
// ALWAYS filter by organization
✅ CORRECT:
const data = await repo.findAll({
  organizationId: request.user!.organizationId,
});

❌ WRONG:
const data = await repo.findAll(); // Returns data from all orgs!
```

### Transaction Usage
```typescript
// For operations that span multiple tables
await repo.withTransaction(async (trx) => {
  await userRepo.create(userData, trx);
  await orgRepo.addMember(userId, orgId, trx);
  // Both succeed or both fail
});
```

---

## 📚 Reference Documentation

### Internal Docs
- [TEST_COVERAGE_REPORT.md](../TEST_COVERAGE_REPORT.md) - Testing status and roadmap
- [MIGRATION_GUIDE.md](../MIGRATION_GUIDE.md) - Database migration workflow
- [docs/architecture/](../docs/architecture/) - Architecture decisions

### Key Files to Reference
- **Schema Patterns**: `packages/api/src/db/schema/users.ts`
- **Repository Patterns**: `packages/api/src/repositories/user.repository.ts`
- **Route Patterns**: `packages/api/src/routes/v1/users.ts`
- **Service Patterns**: `packages/api/src/services/audit.service.ts`
- **Test Patterns**: `packages/api/src/repositories/user.repository.test.ts`

### External Resources
- [Fastify Documentation](https://fastify.dev/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Zod Validation](https://zod.dev/)
- [Vitest Testing](https://vitest.dev/)

---

## 🐛 Debugging Checklist

### When Something Breaks After DB Changes

1. **Check migrations applied**:
   ```bash
   ls packages/api/src/db/migrations/*.sql
   # Ensure all are applied in order
   ```

2. **Check for schema drift**:
   ```typescript
   // TypeScript schema defines column → Does migration create it?
   // If not, create missing migration
   ```

3. **Check seed data**:
   ```bash
   npm run db:seed
   # Ensure critical data exists (admin user, system roles, etc.)
   ```

4. **Check for missing foreign keys**:
   - Do related tables exist?
   - Are foreign key columns present?

### When Tests Fail

1. **Check mocks are set up correctly**
2. **Ensure test data has proper UUIDs**
3. **Verify repository methods are mocked**
4. **Check for missing dependencies in test setup**

---

## 🔄 Post-Feature Workflow

After implementing a feature:

1. **Run full test suite**: `npm run test`
2. **Check coverage**: `npm run test:coverage`
3. **Manual testing**: Test in UI/API
4. **Documentation**: Update relevant docs
5. **Git commit**: Use conventional commit messages

### Commit Message Format
```bash
feat: add user profile management

- Add user profile CRUD endpoints
- Create user profile repository with tests
- Add profile_id column via migration 0012
- 85% test coverage on new repository

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## 📝 Notes for Future Features

### Patterns That Work Well
- ✅ Repository pattern with singleton exports
- ✅ Fastify routes with Zod validation
- ✅ Multi-tenant isolation via organizationId
- ✅ Audit logging for important operations
- ✅ Transaction usage for multi-table operations

### Areas for Improvement
- ⚠️ Route test coverage (currently 11.29%)
- ⚠️ Service layer tests (currently 17.68%)
- ⚠️ Authentication strategy tests (currently 1.81%)

### Technical Debt to Address
- [ ] Fix route test setup issues (app initialization)
- [ ] Add integration tests for SSO flows
- [ ] Add E2E tests for critical user flows
- [ ] Add performance tests for large data sets

---

## 🎓 Lessons Learned

### From Recent Work

1. **Always audit schema vs migrations holistically**
   - Don't fix errors reactively
   - Use comprehensive audits to find ALL gaps
   - Create ALL needed migrations at once

2. **Seed scripts must be complete**
   - Include all critical data (not just basic setup)
   - Example: Admin user needs system_admins entry

3. **Test coverage pays off**
   - Repository tests caught many edge cases
   - Well-tested layers give confidence for refactoring

4. **Documentation is crucial**
   - Future Claude instances benefit from clear guides
   - Users benefit from troubleshooting docs

---

## 🚀 Quick Start for New Features

```bash
# 1. Create branch
git checkout -b feature/my-feature

# 2. If database changes needed:
# - Update schema TypeScript file
# - Generate migration
cd packages/api && npx drizzle-kit generate
# - Apply migration
npx tsx src/db/migrate-single.ts XXXX_my_feature.sql

# 3. Create repository (if needed)
# - Copy user.repository.ts as template
# - Create user.repository.test.ts for tests
# - Export from index.ts

# 4. Create routes
# - Copy users.ts as template
# - Register in routes/v1/index.ts

# 5. Update shared types
cd packages/shared
# - Update schemas and types

# 6. Test
cd packages/api
npm run test
npm run test:coverage

# 7. Commit
git add .
git commit -m "feat: add my-feature"
```

---

## 📞 When to Ask User for Clarification

- [ ] When multiple valid approaches exist (ask for preference)
- [ ] When requirements are ambiguous
- [ ] When making architectural decisions
- [ ] When trade-offs exist (performance vs simplicity)
- [ ] When unsure about business rules

---

*Last Updated: 2026-01-28*
*Maintained by: Claude Sonnet 4.5*
*Review: Update this guide as patterns evolve*
