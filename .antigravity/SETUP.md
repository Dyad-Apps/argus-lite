# AntiGravity + Gemini Setup Guide

Quick guide to configure Gemini for holistic code analysis in AntiGravity.

## Step 1: Get Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key

## Step 2: Configure Environment

Add to your environment variables or `.env` file:

```bash
# Windows (PowerShell)
$env:GEMINI_API_KEY="your_api_key_here"

# Or add to .env file in project root
echo "GEMINI_API_KEY=your_api_key_here" >> .env
```

## Step 3: Load System Instructions in AntiGravity

AntiGravity should read from `.antigravity/system-prompt.md`.

If not automatic, configure in AntiGravity settings:

```json
{
  "antigravity.ai.systemInstructions": "${workspaceFolder}/.antigravity/system-prompt.md",
  "antigravity.ai.projectInstructions": "${workspaceFolder}/.antigravity/instructions.md"
}
```

## Step 4: Configure Model and Parameters

In AntiGravity settings or `.antigravity/config.json`:

```json
{
  "ai": {
    "provider": "gemini",
    "model": "gemini-1.5-pro-latest",
    "temperature": 0.2,
    "maxTokens": 8192
  }
}
```

## Step 5: Enable Agent Workflow

```json
{
  "agent": {
    "workflow": {
      "enforceDiscoveryPhase": true,
      "requirePlanApproval": true,
      "minFilesReadBeforeWrite": 3
    }
  }
}
```

## Step 6: Test the Configuration

Open AntiGravity and try this prompt:

```
Task: Add a new "archived" filter to the organizations page.

BEFORE making any changes:
1. Search for existing filter implementations
2. Find the organizations page component
3. Understand how filters are currently structured
4. Create a plan and wait for my approval

Then implement it.
```

Expected behavior:
- Gemini should search/grep for filters
- Read organizations page files
- Present findings and a plan
- WAIT for your approval
- Only then implement

## Step 7: If Gemini Skips Analysis

If Gemini jumps straight to implementation, push back:

```
STOP. You skipped the discovery phase.

Go back and:
1. Search for filter implementations in the codebase
2. Read at least 3 related files
3. Document what patterns you found
4. Present a plan

Do not write code until I approve the plan.
```

## Verification Checklist

✅ Gemini searches for similar code before implementing
✅ Gemini reads multiple files to understand patterns
✅ Gemini presents a plan before coding
✅ Gemini waits for approval
✅ Gemini follows existing patterns instead of inventing new ones
✅ Gemini considers system-wide implications

## Common Issues

### Issue: Gemini still makes quick fixes

**Solution:** Strengthen your prompts with explicit phases:

```
[DISCOVERY PHASE]
Task: [X]

Step 1: Search and analyze only. Report findings.
(Do not proceed to implementation)
```

### Issue: Gemini creates new patterns instead of following existing

**Solution:** Add pattern enforcement:

```
[PATTERN-STRICT]
Task: [X]

Requirements:
- MUST follow existing patterns
- MUST NOT create new patterns without justification
- Show me what pattern you found first
```

### Issue: Gemini doesn't wait for approval

**Solution:** Be explicit:

```
Task: [X]

Process:
1. Discovery (then STOP and report)
2. Planning (then STOP and wait for my approval)
3. Implementation (only after I say "approved")
```

## Advanced: Create Prompt Shortcuts

Create reusable prompt templates:

### Discovery Mode
```
[DISCOVERY ONLY]
Task: [X]

Search for:
1. Similar implementations
2. Related files
3. Existing patterns

Report your findings. Do not implement.
```

### Planning Mode
```
[PLANNING ONLY]
Based on your discovery, create a detailed plan:
- Files to modify
- Pattern to follow
- Risks/edge cases

Wait for approval.
```

### Implementation Mode
```
[IMPLEMENTATION]
Plan approved. Execute step by step:
1. [First file change]
2. [Second file change]
...

Verify each step works before proceeding.
```

## Model Selection Guide

### For Complex Features / Architecture Decisions
```json
{
  "model": "gemini-1.5-pro-latest",
  "temperature": 0.2
}
```

### For Simple Edits Following Known Patterns
```json
{
  "model": "gemini-2.0-flash-exp",
  "temperature": 0.3
}
```

### For Exploration / Discovery
```json
{
  "model": "gemini-1.5-pro-latest",
  "temperature": 0.4
}
```

## Monitoring Progress

After a few days of use, evaluate:

1. **Pattern Adherence**
   - Is Gemini following existing patterns?
   - Or creating new abstractions unnecessarily?

2. **Analysis Depth**
   - Does Gemini search before coding?
   - Does it read related files?

3. **Planning Quality**
   - Are plans detailed and accurate?
   - Do they consider edge cases?

4. **Root Cause Focus**
   - Does Gemini fix symptoms or root causes?
   - Does it identify systemic issues?

## Iterative Improvement

As you use the system:

1. Note when Gemini makes good decisions
2. Note when it makes poor decisions
3. Update `.antigravity/system-prompt.md` with examples
4. Add project-specific patterns to `.antigravity/instructions.md`
5. Create shortcuts for common workflows

## Example Session

**Good Session Flow:**

```
You: "Add user role filtering to the users page"

Gemini:
"I'll help add role filtering. Let me first understand the existing implementation.

Searching for:
1. Existing filter implementations
2. Users page structure
3. Role-related code

[performs searches...]

Found:
- Organizations page has filter by status
- Uses Radix Select component
- Filter state in URL params via useSearch()
- API supports ?role=admin query param

Plan:
1. Add role Select to users page header
2. Use existing filter pattern from organizations
3. Update useQuery to include role param
4. No API changes needed

Files to modify:
- packages/web/src/routes/users/route.tsx

Ready to proceed?"

You: "Approved"

Gemini: "Implementing..."
```

**Bad Session Flow (needs correction):**

```
You: "Add user role filtering"

Gemini: "I'll create a RoleFilter component..."

You: "STOP. You didn't analyze the codebase first.

Search for existing filter implementations.
Show me what patterns exist.
Then create a plan and wait for approval."

Gemini: "You're right. Let me search first..."
```

## Next Steps

1. Test with a simple task
2. Evaluate Gemini's behavior
3. Adjust system prompt based on results
4. Add project-specific patterns as you discover them
5. Build up a library of proven prompt templates

## Support

If you encounter persistent issues:

1. Share example of bad behavior
2. Share your current prompt
3. Check system prompt is loaded correctly
4. Verify temperature and model settings
5. Consider if task is too vague (add more constraints)

## Success Criteria

After setup, you should see:
- ✅ 80% less "quick fix" behavior
- ✅ More thorough analysis before changes
- ✅ Better pattern consistency
- ✅ Fewer regressions and bugs
- ✅ More maintainable code
- ✅ Less technical debt accumulation
