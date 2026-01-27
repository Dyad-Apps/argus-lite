# Argus IQ Lite - AntiGravity Instructions for Gemini

## Project Context

This is a **pnpm monorepo** implementing a meta-data driven IoT platform with multi-tenant architecture.

### Critical Reference Paths
- **Architecture Spec**: `C:\source\platform-argus-mgmt\planning\META_MODEL_SPECIFICATION.md`
- **UI Reference**: `C:\source\platfromresearch\Research\reference-ui`
- **Current Project**: `C:\source\argusiq-lite`

## Mandatory Analysis Steps

### Before ANY Code Changes:

1. **Explore the Codebase First**
   ```
   - Use Grep to find similar implementations
   - Use Glob to locate related files
   - Read existing implementations to understand patterns
   - Check both packages/api and packages/web for related code
   ```

2. **Understand the Pattern**
   ```
   - How are similar features implemented?
   - What's the data flow? (DB → API → State → UI)
   - What conventions exist? (naming, structure, error handling)
   - What shared utilities are available?
   ```

3. **Check External References**
   ```
   - Does META_MODEL_SPECIFICATION.md define this?
   - Is there a UI reference in platfromresearch?
   - Are there existing ADRs or docs?
   ```

4. **Create a Plan**
   ```
   - List ALL files that need changes
   - Identify what patterns you're following
   - Note any new patterns and WHY they're needed
   - Estimate testing impact
   ```

## Architecture Patterns to Follow

### Backend (packages/api)
- **Database**: Drizzle ORM with PostgreSQL, RLS for multi-tenancy
- **API**: Fastify with modular route structure
- **Auth**: JWT with refresh tokens, Passport.js for SSO
- **Validation**: Zod schemas, shared with frontend
- **Organization**: `/src/routes/[domain]/[feature].ts`

### Frontend (packages/web)
- **Routing**: TanStack Router with file-based routes
- **State**: TanStack Query for server state, context for UI state
- **Forms**: React Hook Form + Zod validation
- **UI**: Radix UI primitives + custom theme system
- **Theming**: CSS variables, defined in theme-provider.tsx
- **Organization**: `/src/routes/[path]/route.tsx` + `/src/components/[domain]/`

### Shared (packages/shared)
- **Types**: Shared TypeScript types and Zod schemas
- **Utils**: Common utilities used by both API and web
- **Validation**: Schema definitions for API contracts

## Common Mistakes to AVOID

### ❌ Anti-Pattern: Immediate Local Fix
```typescript
// User asks: "Fix the login error"
// BAD: Just patch the login form
export function LoginForm() {
  const handleSubmit = async (data) => {
    try {
      await login(data)
    } catch (e) {
      alert('Error!') // Quick fix without understanding root cause
    }
  }
}
```

### ✅ Correct Pattern: Systematic Analysis
```typescript
// GOOD: Understand the full auth flow first
// 1. Search for: existing error handling patterns
// 2. Find: ErrorBoundary, toast notifications, error util
// 3. Check: API error response format
// 4. Review: auth flow in auth-provider.tsx
// 5. Plan: Use existing error handling, update auth context
// 6. Implement: Consistent with existing patterns

export function LoginForm() {
  const { login } = useAuth() // Use existing auth context
  const { toast } = useToast() // Use existing toast system

  const handleSubmit = async (data) => {
    try {
      await login(data)
    } catch (e) {
      // Use existing error handling pattern
      const message = getErrorMessage(e)
      toast.error(message)
    }
  }
}
```

## Decision-Making Framework

When facing implementation choices:

1. **Is there an existing pattern?** → Follow it
2. **Multiple approaches exist?** → Ask user which to follow
3. **Need a new pattern?** → Explain why existing ones don't work, get approval
4. **Unsure about scope?** → Ask before making assumptions

## Example Workflow

### User Request: "Add organization settings page"

#### Step 1: Discovery (Don't skip this!)
```bash
# Search for existing organization code
grep -r "organization" packages/web/src
# Find settings patterns
grep -r "settings" packages/web/src
# Check API routes
ls packages/api/src/routes/organizations/
```

#### Step 2: Analysis
```
Found:
- /organizations route exists with table view
- Settings pattern in /settings route with tabs
- API has GET /orgs/:id and PATCH /orgs/:id endpoints
- Form pattern uses react-hook-form + zod
- Uses Dialog component for edit modals
```

#### Step 3: Plan (Present to User)
```markdown
Plan for Organization Settings:

Files to modify:
1. packages/web/src/routes/organizations/$orgId.route.tsx (NEW)
   - Follow /settings structure with tabs
   - Tabs: General, Members, Billing, Integrations

2. packages/api/src/routes/organizations/update.ts (EXISTS)
   - Already has PATCH endpoint
   - Add validation for new fields

3. packages/shared/src/schemas/organization.ts (MODIFY)
   - Add updateOrganizationSchema

Pattern following:
- Reusing TabLayout from settings
- Following form pattern from users page
- Using existing API endpoint

Alternatives considered:
- Modal edit (rejected: too much data for modal)
- Dedicated settings app (rejected: overkill for now)
```

#### Step 4: Wait for User Approval

#### Step 5: Implement Systematically

## Testing Requirements

Before marking any task complete:
- ✅ TypeScript compiles with no errors
- ✅ Follows existing patterns in the codebase
- ✅ No console errors in browser/terminal
- ✅ Tested the happy path manually
- ✅ Considered edge cases

## Multi-Tenant Awareness

ALWAYS remember:
- This is a multi-tenant system
- All org-scoped data MUST respect org_id
- Use RLS context middleware in API
- Check existing queries for org_id filtering patterns
- Don't break tenant isolation

## Questions to Ask Yourself

Before making changes:
1. Have I searched for similar code?
2. Do I understand the full data flow?
3. Am I following existing patterns?
4. Have I checked the external specs?
5. Is this a band-aid or a real solution?
6. What could break from this change?
7. Should I ask the user for clarification?

## When to Ask for Guidance

ASK before:
- Creating new architectural patterns
- Making breaking changes
- Choosing between multiple valid approaches
- Modifying shared schemas or core utilities
- Changing auth/security related code

## Success Metrics

A good implementation:
- ✅ Follows existing patterns
- ✅ Considers the full system
- ✅ Has a clear rationale
- ✅ Minimal new abstractions
- ✅ Properly scoped (not over/under-engineered)
- ✅ Respects multi-tenant architecture
- ✅ Maintainable by future developers
