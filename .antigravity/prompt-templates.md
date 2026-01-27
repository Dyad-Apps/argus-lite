# Prompt Templates for Holistic Code Analysis

## Template 1: Discovery-First Prompt

Use this template when asking Gemini to make changes:

```
Task: [Your request]

BEFORE making any changes:
1. Use grep/search to find ALL related code
2. Read at least 3-5 related files to understand patterns
3. List what you found and what patterns exist
4. Create a plan showing which files you'll modify and why
5. Wait for my approval

Then and only then, implement the changes.
```

### Example Usage:

**Instead of:**
> "Add a delete button to the organizations table"

**Use:**
> "Add a delete button to the organizations table.
>
> BEFORE making any changes:
> 1. Search for existing delete implementations in the codebase
> 2. Find the organizations table component and related API routes
> 3. Understand how deletes are handled (soft vs hard delete, permissions, etc.)
> 4. Check if there's a pattern for confirmation dialogs
> 5. List all files that need changes
> 6. Create a plan and wait for my approval"

---

## Template 2: Architecture-Aware Prompt

```
Task: [Your request]

Requirements:
- Follow existing patterns in packages/{api,web,shared}
- Check external specs in C:\source\platform-argus-mgmt\planning if relevant
- Maintain multi-tenant isolation (respect org_id)
- Use existing utilities and components (don't recreate)

Process:
1. Show me what you found in the codebase
2. Explain what pattern you'll follow
3. List specific files and changes
4. Wait for approval
```

---

## Template 3: Root Cause Analysis

For bug fixes, use this:

```
Problem: [Description of bug]

Analysis required:
1. Find the failing code path
2. Trace the data flow from source to error
3. Identify the root cause (not just the symptom)
4. Check if similar bugs exist elsewhere
5. Propose a fix that addresses the root cause
6. Consider if this reveals a systemic issue

Provide your analysis before suggesting fixes.
```

---

## Template 4: Pattern-Following Enforcement

```
Task: [Feature request]

Pattern Analysis:
1. Find similar features in the codebase
2. Document the patterns you found:
   - File structure
   - Component composition
   - API design
   - State management
   - Error handling
3. Explain which pattern you'll follow and why
4. If creating a new pattern, justify why existing ones don't work

Present this analysis before coding.
```

---

## Template 5: Scope Assessment

```
Task: [Your request]

Impact Assessment:
1. List ALL files that will be affected
2. Identify dependent systems (API, UI, DB, etc.)
3. Note any breaking changes
4. List what needs testing
5. Estimate ripple effects

Only proceed after we've reviewed the scope.
```

---

## Example: Real-World Comparison

### ❌ BAD: Myopic Request
```
"The login button isn't working, fix it"
```

**Result:** Gemini patches the button's onClick handler without understanding why it broke.

### ✅ GOOD: Holistic Request
```
"The login button isn't working.

Investigation steps:
1. Check browser console for errors
2. Trace the auth flow: button → form → API → response
3. Check if the API endpoint changed
4. Verify the auth context is working
5. Look for recent changes to auth code
6. Identify the root cause

Provide your investigation findings before suggesting a fix.
If this is symptomatic of a larger issue, identify that too."
```

**Result:** Gemini discovers that the auth provider wasn't wrapped correctly after a recent refactor, fixes the root cause, and checks for similar issues.

---

## Technique: Multi-Turn Enforcement

Break complex tasks into phases:

### Turn 1: Discovery
```
"I need to add user profile editing.

For now, just do discovery:
- Search for existing profile code
- Find form patterns in the codebase
- Check the API for profile endpoints
- Look at similar edit features

Report what you found, don't make changes yet."
```

### Turn 2: Planning
```
"Based on your findings, create a detailed plan:
- Which pattern will you follow?
- What files need changes?
- What's the data flow?
- Any risks or edge cases?

Just the plan, no implementation."
```

### Turn 3: Implementation
```
"The plan looks good. Now implement it step by step, starting with [X]."
```

---

## Anti-Pattern Detection Prompts

Add these to your prompts to catch bad behavior:

### Warning Signs
```
- If you're creating a new component, did you check if one exists?
- If you're writing a new utility, did you check packages/shared?
- If you're using inline styles, did you check the theme system?
- If you're hardcoding values, should they be in config?
- If you're copy-pasting code, should it be abstracted?
```

### Checkpoints
```
Stop and ask yourself:
1. Am I following existing patterns? (Yes/No - if No, why?)
2. Have I read related code? (Yes/No - if No, do it now)
3. Is this addressing root cause or just symptoms? (Root cause/Symptom)
4. Will this maintainer understand this in 6 months? (Yes/No)
5. Am I over-engineering? (Yes/No)
```

---

## Project-Specific Shortcuts

For this project (argusiq-lite), use these:

### Quick Pattern Check
```
"Before implementing [feature], show me:
1. How users page handles similar functionality
2. What the API pattern is in packages/api/src/routes
3. What shared schemas exist in packages/shared"
```

### Architecture Alignment
```
"Check if this aligns with:
1. The META_MODEL_SPECIFICATION.md in platform-argus-mgmt
2. The reference UI in platfromresearch
3. The existing multi-tenant patterns"
```

### Multi-Tenant Validation
```
"For this change:
1. Show me how it respects org_id filtering
2. Verify it uses RLS context
3. Check it doesn't leak data between tenants
4. Test with multiple org scenarios"
```

---

## Forcing Deep Analysis

When Gemini gives a shallow response, push back:

```
"That's a surface-level solution. Go deeper:
1. Why did this problem occur in the first place?
2. Are there similar problems elsewhere?
3. What's the underlying architecture issue?
4. How can we prevent this category of issues?

Don't just fix the bug, improve the system."
```

---

## Useful Configuration Flags

Add these to your prompts to modify Gemini's behavior:

- `[THOROUGH]` - Extra comprehensive analysis required
- `[PATTERN-STRICT]` - Must follow existing patterns exactly
- `[NO-NEW-PATTERNS]` - Cannot create new patterns without approval
- `[ROOT-CAUSE]` - Must identify root cause, not symptoms
- `[SYSTEM-WIDE]` - Consider system-wide implications
- `[CONSULT-SPECS]` - Must check external specification docs

Example:
```
"[THOROUGH] [PATTERN-STRICT] Add organization member invitation feature"
```
