# Gemini-Specific Configuration for Holistic Analysis

## Model Selection for Code Analysis

Different Gemini models have different strengths:

### Recommended: gemini-1.5-pro-latest
```json
{
  "model": "gemini-1.5-pro-latest",
  "temperature": 0.2,
  "topP": 0.95,
  "topK": 40,
  "maxOutputTokens": 8192
}
```

**Why:**
- 1M token context window (can see entire codebase)
- Best reasoning capabilities
- More thorough analysis
- Lower temperature = more focused, deterministic

**Use for:**
- Complex features
- Architecture decisions
- Refactoring
- Bug investigation

### Alternative: gemini-2.0-flash-exp
```json
{
  "model": "gemini-2.0-flash-exp",
  "temperature": 0.3,
  "maxOutputTokens": 8192
}
```

**Why:**
- Faster responses
- Good for simpler tasks
- Still has large context

**Use for:**
- Simple edits
- Following established patterns
- Quick fixes (after root cause analysis)

## Gemini API Configuration

### Request Structure for Deep Analysis

```javascript
{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "Your prompt..."
        }
      ]
    }
  ],
  "systemInstruction": {
    "parts": [
      {
        "text": "[Content from system-prompt.md]"
      }
    ]
  },
  "generationConfig": {
    "temperature": 0.2,
    "topK": 40,
    "topP": 0.95,
    "maxOutputTokens": 8192,
    "stopSequences": []
  },
  "safetySettings": [
    {
      "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
      "threshold": "BLOCK_ONLY_HIGH"
    }
  ],
  "tools": [
    {
      "functionDeclarations": [
        {
          "name": "search_code",
          "description": "Search for code patterns in the codebase",
          "parameters": {
            "type": "object",
            "properties": {
              "query": {
                "type": "string",
                "description": "Search query or regex pattern"
              },
              "file_pattern": {
                "type": "string",
                "description": "File glob pattern to search within"
              }
            },
            "required": ["query"]
          }
        },
        {
          "name": "read_files",
          "description": "Read multiple files to understand context",
          "parameters": {
            "type": "object",
            "properties": {
              "file_paths": {
                "type": "array",
                "items": {
                  "type": "string"
                },
                "description": "Array of file paths to read"
              }
            },
            "required": ["file_paths"]
          }
        },
        {
          "name": "analyze_dependencies",
          "description": "Analyze how files depend on each other",
          "parameters": {
            "type": "object",
            "properties": {
              "entry_file": {
                "type": "string",
                "description": "Starting file for dependency analysis"
              },
              "depth": {
                "type": "integer",
                "description": "How many levels deep to analyze"
              }
            },
            "required": ["entry_file"]
          }
        },
        {
          "name": "create_plan",
          "description": "Create an implementation plan (required before coding)",
          "parameters": {
            "type": "object",
            "properties": {
              "discovery": {
                "type": "string",
                "description": "What you found during exploration"
              },
              "patterns": {
                "type": "string",
                "description": "Existing patterns identified"
              },
              "files_to_modify": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "path": {"type": "string"},
                    "changes": {"type": "string"},
                    "rationale": {"type": "string"}
                  }
                }
              },
              "risks": {
                "type": "string",
                "description": "Potential risks and edge cases"
              }
            },
            "required": ["discovery", "patterns", "files_to_modify"]
          }
        }
      ]
    }
  ]
}
```

## Enforcing Multi-Step Thinking with Function Calling

Make Gemini call analysis functions BEFORE code functions:

```javascript
// Required sequence: search → read → plan → implement
const toolCallSequence = {
  phase1: ["search_code", "read_files", "analyze_dependencies"],
  phase2: ["create_plan"], // Must wait for user approval
  phase3: ["edit_file", "write_file"] // Only after plan approved
};
```

## Temperature and Creativity Settings

### For Discovery/Analysis: Higher Temperature
```json
{
  "temperature": 0.4,
  "topP": 0.95,
  "topK": 64
}
```
- More creative in finding patterns
- Better at connecting disparate code

### For Planning/Implementation: Lower Temperature
```json
{
  "temperature": 0.1,
  "topP": 0.9,
  "topK": 20
}
```
- More deterministic
- Follows patterns strictly
- Less likely to invent new approaches

## Context Window Strategy

Gemini 1.5 Pro has 1M tokens. Use it strategically:

### Priority 1: System Instructions (Always Include)
- System prompt (~5K tokens)
- Project instructions (~3K tokens)
- Prompt templates reference (~2K tokens)

### Priority 2: Relevant Codebase (Dynamic)
```javascript
// Include in order of relevance:
const contextPriority = [
  // Core files related to current task
  "packages/{api,web}/src/routes/[relevant]/**",

  // Shared schemas and types
  "packages/shared/src/**",

  // Similar features (for pattern matching)
  "[files with similar functionality]",

  // External specs (if needed)
  "C:/source/platform-argus-mgmt/planning/META_MODEL_SPECIFICATION.md",

  // Configuration
  "package.json",
  "tsconfig.json",

  // Documentation
  "*.md files"
];
```

### Priority 3: Conversation History
- Keep last 10-15 turns
- Summarize older context

## Gemini Thinking Mode

Enable code execution and thinking steps:

```json
{
  "generationConfig": {
    "responseModalities": ["text"],
    "thoughtProcess": "show",
    "codeExecution": {
      "enabled": true,
      "sandboxed": true
    }
  }
}
```

This makes Gemini:
- Show its reasoning process
- Test code snippets internally
- Verify logic before suggesting

## Safety Settings for Code

Relax some restrictions for coding:

```json
{
  "safetySettings": [
    {
      "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
      "threshold": "BLOCK_MEDIUM_AND_ABOVE"
    },
    {
      "category": "HARM_CATEGORY_HATE_SPEECH",
      "threshold": "BLOCK_ONLY_HIGH"
    },
    {
      "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
      "threshold": "BLOCK_ONLY_HIGH"
    },
    {
      "category": "HARM_CATEGORY_HARASSMENT",
      "threshold": "BLOCK_ONLY_HIGH"
    }
  ]
}
```

## Caching for Performance

Gemini supports context caching for repeated prompts:

```json
{
  "cachedContent": {
    "model": "gemini-1.5-pro-latest",
    "systemInstruction": "[Your system prompt]",
    "contents": [
      // Frequently accessed files
      {
        "role": "user",
        "parts": [
          {"text": "[Contents of core architecture files]"}
        ]
      }
    ],
    "ttl": "3600s"
  }
}
```

**Cache:**
- System instructions
- Core project files
- External specifications
- Common patterns documentation

**Don't cache:**
- Files being actively edited
- Conversation history
- User-specific prompts

## Multi-Turn Conversation Structure

Structure conversations to enforce phases:

```javascript
// Turn 1: Discovery
{
  "systemInstruction": "[Include: You are in DISCOVERY mode. Do not write code.]",
  "contents": [
    {
      "role": "user",
      "parts": [{"text": "Task: Add feature X. DISCOVERY ONLY: Search and analyze."}]
    }
  ]
}

// Turn 2: Planning
{
  "systemInstruction": "[Include: You are in PLANNING mode. Do not write code yet.]",
  "contents": [
    // Previous conversation
    {
      "role": "user",
      "parts": [{"text": "Based on your findings, create a detailed plan."}]
    }
  ]
}

// Turn 3: Implementation
{
  "systemInstruction": "[Include: Plan approved. You are in IMPLEMENTATION mode.]",
  "contents": [
    // Previous conversation + approval
    {
      "role": "user",
      "parts": [{"text": "Plan approved. Implement step 1: [X]"}]
    }
  ]
}
```

## Prompt Chaining for Depth

Force deeper analysis with chained prompts:

```javascript
const analysisChain = [
  {
    prompt: "Search the codebase for [X]",
    waitFor: "search results",
    validate: results => results.length >= 3
  },
  {
    prompt: "Read these 5 files and identify patterns",
    waitFor: "pattern analysis",
    validate: analysis => analysis.includes("pattern")
  },
  {
    prompt: "Create a plan following these patterns",
    waitFor: "implementation plan",
    validate: plan => plan.includes("files to modify")
  },
  {
    prompt: "User approved. Implement step 1",
    waitFor: "code changes"
  }
];
```

## Anti-Shortcut Configuration

Prevent Gemini from skipping analysis:

```json
{
  "constraints": {
    "minSearchesBeforeCode": 2,
    "minFilesReadBeforeCode": 3,
    "requirePlanApproval": true,
    "blockImmediateImplementation": true,
    "enforcePhaseTransitions": true
  }
}
```

## Response Format Enforcement

Use structured output to enforce format:

```json
{
  "generationConfig": {
    "responseSchema": {
      "type": "object",
      "properties": {
        "phase": {
          "type": "string",
          "enum": ["discovery", "planning", "implementation", "verification"]
        },
        "discovery": {
          "type": "object",
          "properties": {
            "searches_performed": {"type": "array"},
            "files_read": {"type": "array"},
            "patterns_found": {"type": "string"}
          }
        },
        "plan": {
          "type": "object",
          "properties": {
            "files_to_modify": {"type": "array"},
            "approach": {"type": "string"},
            "risks": {"type": "string"}
          }
        },
        "implementation": {
          "type": "object",
          "properties": {
            "changes": {"type": "array"},
            "verification": {"type": "string"}
          }
        }
      },
      "required": ["phase"]
    }
  }
}
```

This forces Gemini to output structured responses you can programmatically validate.

## Grounding with Google Search

For external references and best practices:

```json
{
  "tools": [
    {
      "googleSearchRetrieval": {
        "dynamicRetrievalConfig": {
          "mode": "MODE_DYNAMIC",
          "dynamicThreshold": 0.7
        }
      }
    }
  ]
}
```

Useful for:
- "What's the best practice for [X] in React?"
- "How to handle [Y] in Fastify?"
- "Latest security recommendations for [Z]"

## Monitoring and Feedback

Track Gemini's behavior:

```javascript
const metrics = {
  filesReadBeforeWrite: 0,
  searchesPerformed: 0,
  planningStepsCompleted: false,
  patternsIdentified: [],
  timeBetweenPhases: {}
};

// Alert if bad behavior detected:
if (metrics.filesReadBeforeWrite < 3) {
  warnUser("Gemini tried to code without sufficient exploration");
}
```

## Example: Full Configuration

See [.antigravity/config.json](.antigravity/config.json) for complete setup.

Key settings to enforce holistic analysis:
- `temperature: 0.2` - Focused, less random
- `requirePlanningPhase: true` - Must plan before coding
- `minFilesReadBeforeWrite: 3` - Forces exploration
- `contextGatheringDepth: "thorough"` - Deep analysis mode
