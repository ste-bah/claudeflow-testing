# TASK-AGT-001: Agent Definition Format + Template Directory

```
Task ID:       TASK-AGT-001
Status:        READY
Implements:    REQ-DEF-001, REQ-DEF-002, REQ-DEF-003, REQ-DEF-004, REQ-DEF-005, REQ-DEF-006, REQ-DEF-007
Depends On:    None
Complexity:    Medium
Guardrails:    GR-001 (depth=1 constraint awareness), GR-004 (token budget enforcement)
NFRs:          NFR-003 (file-based definitions), NFR-004 (SKILL.md compatibility)
Security:      Low risk — file creation only, no I/O to external services. Verify template files contain no hardcoded secrets or PII.
```

## Context

Every feature in PRD-AGENT-001 depends on a well-defined agent definition format. This task establishes the canonical directory structure, file schemas, token counting utility, and a `_template/` directory with production-ready example files. All subsequent tasks (create-agent, run-agent, tool factory) import or reference the conventions defined here.

The `_template/` directory serves dual purpose: (1) documentation-by-example for users who want to manually create agents, and (2) a structural reference for the `/create-agent` skill that generates agents programmatically.

## Scope

### In Scope
- Template directory at `.claude/agents/custom/_template/` with all 6 files
- Exact content for each template file (agent.md, context.md, tools.md, behavior.md, memory-keys.json, meta.json)
- JSON Schema definitions for `meta.json` and `memory-keys.json`
- Token counting utility module at `src/agent-system/token-counter.ts`
- Agent name sanitization utility at `src/agent-system/name-utils.ts`
- Agent definition validation utility at `src/agent-system/validator.ts`
- Constants file at `src/agent-system/constants.ts` (token limits, file list, paths)
- Unit tests for all utilities

### Out of Scope
- The `/create-agent` skill (TASK-AGT-004)
- The `/run-agent` skill (TASK-AGT-005)
- MemoryGraph registration logic (covered in TASK-AGT-004)
- Behavior rule MemoryGraph schema (TASK-AGT-007)
- Evolution/autolearn fields in meta.json beyond the base schema (TASK-AGT-013+)

## Key Design Decisions

1. **TypeScript for utilities**: All agent-system utilities are TypeScript modules under `src/agent-system/`. Skills (YAML markdown) will shell out to these via `npx tsx` or inline the logic directly. The utilities exist for testability and reuse.
2. **Character-based token estimation**: Use the heuristic `Math.ceil(text.length / 4)` as the primary estimator. This avoids a dependency on tiktoken (which requires native bindings) and is accurate to within ~10% for English text. A `tokenEstimate(text: string): number` function is the single entry point.
3. **Strict validation in validator.ts**: The validator checks directory structure, file existence, JSON schema conformance, and token budgets. It returns a structured result with errors and warnings (not exceptions).
4. **Agent name sanitization**: Names are lowercased, spaces and underscores replaced with hyphens, non-alphanumeric-hyphen characters stripped, leading/trailing hyphens removed, consecutive hyphens collapsed. Max length: 50 characters.
5. **meta.json is auto-generated**: Users never hand-write meta.json. It is created by `/create-agent` and updated by `/run-agent`. The template includes a fully populated example for documentation purposes.
6. **Token limits are constants, not config**: Hard-coded in `constants.ts` per PRD REQ-DEF-003. No runtime override mechanism in Phase 1.
7. **agent.md follows the Master Prompt Framework**: The template agent.md uses the structure from `docs2/ai_agent_prompt_guide.md` — INTENT, SCOPE, CONSTRAINTS, FORBIDDEN OUTCOMES, EDGE CASES, WHEN IN DOUBT. This produces watertight agent definitions that leave no room for misinterpretation. The `/create-agent` skill (TASK-AGT-004) auto-generates this structure from natural language; users never need to know the framework exists.

## Detailed Specifications

### Constants (`src/agent-system/constants.ts`)

```typescript
// Agent definition file names (order matters for Context Envelope assembly)
export const AGENT_FILES = [
  'agent.md',
  'context.md',
  'tools.md',
  'behavior.md',
  'memory-keys.json',
  'meta.json',
] as const;

// Required files (agent.md is the only required file per REQ-DEF-001)
export const REQUIRED_FILES = ['agent.md'] as const;

// Token hard limits per file (REQ-DEF-003)
export const TOKEN_LIMITS: Record<string, number> = {
  'agent.md': 3_000,
  'context.md': 5_000,
  'tools.md': 2_000,
  'behavior.md': 1_500,
};

// Total controllable prompt limit (all files + memory + behavior rules + task)
export const TOTAL_CONTROLLABLE_TOKEN_LIMIT = 15_000;

// Paths
export const AGENTS_BASE_DIR = '.claude/agents';
export const CUSTOM_AGENTS_DIR = '.claude/agents/custom';
export const TEMPLATE_DIR = '.claude/agents/custom/_template';
export const ARCHIVED_AGENTS_DIR = '.claude/agents/archived';
export const VERSIONS_DIR = '.claude/agents/versions';
export const TRACES_DIR = '.claude/agents/traces';

// Name constraints
export const AGENT_NAME_MAX_LENGTH = 50;
export const AGENT_NAME_PATTERN = /^[a-z][a-z0-9-]*[a-z0-9]$/;
export const AGENT_NAME_MIN_LENGTH = 2;

// Reserved names (cannot be used as agent names)
export const RESERVED_NAMES = new Set([
  '_template',
  'archived',
  'versions',
  'traces',
  'custom',
]);
```

### Token Counter (`src/agent-system/token-counter.ts`)

```typescript
/**
 * Estimate token count for a string using character-based heuristic.
 * Accuracy: within ~10% for English text, ~20% for code.
 * Uses ceil(length / 4) which slightly overestimates (safe for budget enforcement).
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count (integer >= 0)
 */
export function tokenEstimate(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Check if text exceeds a token limit.
 *
 * @param text - The text to check
 * @param limit - The token limit
 * @returns Object with `within` boolean, `estimate` count, and `limit`
 */
export function checkTokenBudget(
  text: string,
  limit: number
): { within: boolean; estimate: number; limit: number; overage: number } {
  const estimate = tokenEstimate(text);
  return {
    within: estimate <= limit,
    estimate,
    limit,
    overage: Math.max(0, estimate - limit),
  };
}

/**
 * Compute token breakdown for all definition files in an agent directory.
 *
 * @param files - Map of filename to file content
 * @param tokenLimits - Per-file token limits (from constants)
 * @returns Per-file breakdown and total
 */
export function computeTokenBreakdown(
  files: Record<string, string>,
  tokenLimits: Record<string, number>
): {
  perFile: Record<string, { estimate: number; limit: number; within: boolean }>;
  totalEstimate: number;
  totalLimit: number;
  totalWithin: boolean;
} {
  const perFile: Record<string, { estimate: number; limit: number; within: boolean }> = {};
  let totalEstimate = 0;

  for (const [filename, content] of Object.entries(files)) {
    const limit = tokenLimits[filename] ?? Infinity;
    const estimate = tokenEstimate(content);
    perFile[filename] = { estimate, limit, within: estimate <= limit };
    // Only count markdown files toward controllable total (not JSON metadata)
    if (filename.endsWith('.md')) {
      totalEstimate += estimate;
    }
  }

  return {
    perFile,
    totalEstimate,
    totalLimit: TOTAL_CONTROLLABLE_TOKEN_LIMIT,
    totalWithin: totalEstimate <= TOTAL_CONTROLLABLE_TOKEN_LIMIT,
  };
}

import { TOTAL_CONTROLLABLE_TOKEN_LIMIT } from './constants.js';
```

### Name Utilities (`src/agent-system/name-utils.ts`)

```typescript
import {
  AGENT_NAME_MAX_LENGTH,
  AGENT_NAME_MIN_LENGTH,
  AGENT_NAME_PATTERN,
  RESERVED_NAMES,
} from './constants.js';

/**
 * Sanitize a user-provided agent name to lowercase-hyphenated format.
 * EC-DEF-001: "SEC Filing Analyzer" → "sec-filing-analyzer"
 *
 * @param raw - Raw user input (may contain spaces, special chars, mixed case)
 * @returns Sanitized name
 * @throws Error if the result is empty, too short, or reserved
 */
export function sanitizeAgentName(raw: string): string {
  if (!raw || !raw.trim()) {
    throw new Error('Agent name cannot be empty.');
  }

  let name = raw
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, '-')       // spaces and underscores → hyphens
    .replace(/[^a-z0-9-]/g, '')    // strip non-alphanumeric-hyphen
    .replace(/^[0-9-]+/, '')       // strip leading digits and hyphens (pattern requires ^[a-z])
    .replace(/-+/g, '-')           // collapse consecutive hyphens
    .replace(/^-+/, '')            // strip leading hyphens
    .replace(/-+$/, '');           // strip trailing hyphens

  if (name.length > AGENT_NAME_MAX_LENGTH) {
    name = name.substring(0, AGENT_NAME_MAX_LENGTH).replace(/-+$/, '');
  }

  if (name.length < AGENT_NAME_MIN_LENGTH) {
    throw new Error(
      `Agent name '${raw}' is too short after sanitization (result: '${name}'). ` +
      `Minimum length: ${AGENT_NAME_MIN_LENGTH} characters.`
    );
  }

  if (!AGENT_NAME_PATTERN.test(name)) {
    throw new Error(
      `Agent name '${raw}' is invalid after sanitization (result: '${name}'). ` +
      `Must match pattern: ${AGENT_NAME_PATTERN}`
    );
  }

  if (RESERVED_NAMES.has(name)) {
    throw new Error(
      `Agent name '${name}' is reserved. Choose a different name.`
    );
  }

  return name;
}

/**
 * Check if an agent name already exists in the custom agents directory.
 *
 * @param name - Sanitized agent name
 * @param basePath - Absolute path to the custom agents directory
 * @returns true if the agent directory exists
 */
export function agentExists(name: string, basePath: string): boolean {
  const fs = require('fs');
  const path = require('path');
  return fs.existsSync(path.join(basePath, name));
}
```

### Validator (`src/agent-system/validator.ts`)

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { REQUIRED_FILES, AGENT_FILES, TOKEN_LIMITS, TOTAL_CONTROLLABLE_TOKEN_LIMIT } from './constants.js';
import { tokenEstimate, checkTokenBudget } from './token-counter.js';

export interface ValidationError {
  file: string;
  code: string;
  message: string;
}

export interface ValidationWarning {
  file: string;
  code: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  tokenBreakdown: Record<string, { estimate: number; limit: number; within: boolean }>;
  totalTokens: number;
}

/**
 * Validate an agent definition directory.
 *
 * Checks:
 * 1. Required files exist (agent.md)
 * 2. JSON files parse correctly (meta.json, memory-keys.json)
 * 3. Per-file token budgets are within limits
 * 4. Total controllable tokens within 15,000 limit
 * 5. meta.json conforms to schema
 * 6. memory-keys.json conforms to schema
 *
 * @param agentDir - Absolute path to the agent directory
 * @returns ValidationResult with errors, warnings, and token breakdown
 */
export function validateAgentDefinition(agentDir: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const tokenBreakdown: Record<string, { estimate: number; limit: number; within: boolean }> = {};
  let totalTokens = 0;

  // Check directory exists
  if (!fs.existsSync(agentDir) || !fs.statSync(agentDir).isDirectory()) {
    return {
      valid: false,
      errors: [{ file: agentDir, code: 'DIR_NOT_FOUND', message: `Directory does not exist: ${agentDir}` }],
      warnings: [],
      tokenBreakdown: {},
      totalTokens: 0,
    };
  }

  // Check required files
  for (const file of REQUIRED_FILES) {
    const filePath = path.join(agentDir, file);
    if (!fs.existsSync(filePath)) {
      errors.push({
        file,
        code: 'REQUIRED_FILE_MISSING',
        message: `Required file '${file}' not found. EC-DEF-005: Invalid agent definition.`,
      });
    }
  }

  // Validate each file that exists
  for (const file of AGENT_FILES) {
    const filePath = path.join(agentDir, file);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf-8');

    // Token budget check for markdown files
    if (file.endsWith('.md')) {
      const limit = TOKEN_LIMITS[file];
      if (limit) {
        const budget = checkTokenBudget(content, limit);
        tokenBreakdown[file] = { estimate: budget.estimate, limit, within: budget.within };
        totalTokens += budget.estimate;
        if (!budget.within) {
          warnings.push({
            file,
            code: 'TOKEN_BUDGET_EXCEEDED',
            message: `${file} exceeds token limit: ${budget.estimate} tokens (limit: ${limit}). EC-DEF-003: Will be truncated.`,
          });
        }
      }
    }

    // JSON validation
    if (file === 'meta.json') {
      try {
        const meta = JSON.parse(content);
        const metaErrors = validateMetaJson(meta);
        errors.push(...metaErrors.map(msg => ({ file, code: 'INVALID_META_JSON', message: msg })));
      } catch {
        errors.push({ file, code: 'JSON_PARSE_ERROR', message: `${file} is not valid JSON.` });
      }
    }

    if (file === 'memory-keys.json') {
      try {
        const memKeys = JSON.parse(content);
        const memErrors = validateMemoryKeysJson(memKeys);
        errors.push(...memErrors.map(msg => ({ file, code: 'INVALID_MEMORY_KEYS', message: msg })));
      } catch {
        errors.push({ file, code: 'JSON_PARSE_ERROR', message: `${file} is not valid JSON.` });
      }
    }
  }

  // Total controllable token check
  if (totalTokens > TOTAL_CONTROLLABLE_TOKEN_LIMIT) {
    warnings.push({
      file: '*',
      code: 'TOTAL_TOKEN_BUDGET_EXCEEDED',
      message: `Total controllable tokens (${totalTokens}) exceed limit (${TOTAL_CONTROLLABLE_TOKEN_LIMIT}). Context will be truncated at runtime.`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    tokenBreakdown,
    totalTokens,
  };
}

/**
 * Validate meta.json against schema. Returns array of error messages.
 */
function validateMetaJson(meta: unknown): string[] {
  const errors: string[] = [];
  if (typeof meta !== 'object' || meta === null) {
    return ['meta.json must be a JSON object.'];
  }
  const m = meta as Record<string, unknown>;

  // Required fields
  if (typeof m.created !== 'string') errors.push("meta.json: 'created' must be an ISO 8601 string.");
  if (typeof m.last_used !== 'string') errors.push("meta.json: 'last_used' must be an ISO 8601 string.");
  if (typeof m.version !== 'number' || !Number.isInteger(m.version) || m.version < 1)
    errors.push("meta.json: 'version' must be a positive integer.");
  if (typeof m.author !== 'string' || !['user', 'auto'].includes(m.author))
    errors.push("meta.json: 'author' must be 'user' or 'auto'.");
  if (typeof m.invocation_count !== 'number' || !Number.isInteger(m.invocation_count) || m.invocation_count < 0)
    errors.push("meta.json: 'invocation_count' must be a non-negative integer.");

  return errors;
}

/**
 * Validate memory-keys.json against schema. Returns array of error messages.
 */
function validateMemoryKeysJson(memKeys: unknown): string[] {
  const errors: string[] = [];
  if (typeof memKeys !== 'object' || memKeys === null) {
    return ['memory-keys.json must be a JSON object.'];
  }
  const mk = memKeys as Record<string, unknown>;

  if (mk.recall_queries !== undefined) {
    if (!Array.isArray(mk.recall_queries)) {
      errors.push("memory-keys.json: 'recall_queries' must be an array of strings.");
    } else if (!mk.recall_queries.every((q: unknown) => typeof q === 'string')) {
      errors.push("memory-keys.json: each entry in 'recall_queries' must be a string.");
    }
  }

  if (mk.leann_queries !== undefined) {
    if (!Array.isArray(mk.leann_queries)) {
      errors.push("memory-keys.json: 'leann_queries' must be an array of strings.");
    } else if (!mk.leann_queries.every((q: unknown) => typeof q === 'string')) {
      errors.push("memory-keys.json: each entry in 'leann_queries' must be a string.");
    }
  }

  if (mk.tags !== undefined) {
    if (!Array.isArray(mk.tags)) {
      errors.push("memory-keys.json: 'tags' must be an array of strings.");
    } else if (!mk.tags.every((t: unknown) => typeof t === 'string')) {
      errors.push("memory-keys.json: each entry in 'tags' must be a string.");
    }
  }

  return errors;
}
```

### meta.json JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "agent-meta-v1",
  "title": "Agent Meta",
  "description": "Auto-generated metadata for a custom agent definition (REQ-DEF-005).",
  "type": "object",
  "required": ["created", "last_used", "version", "author", "invocation_count"],
  "properties": {
    "created": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 timestamp of agent creation."
    },
    "last_used": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 timestamp of last /run-agent invocation."
    },
    "version": {
      "type": "integer",
      "minimum": 1,
      "description": "Incremented on any definition file change."
    },
    "author": {
      "type": "string",
      "enum": ["user", "auto"],
      "description": "'user' if created via /create-agent, 'auto' if created by evolution."
    },
    "invocation_count": {
      "type": "integer",
      "minimum": 0,
      "description": "Total number of /run-agent invocations."
    },
    "generation": {
      "type": "integer",
      "minimum": 0,
      "default": 0,
      "description": "Incremented only on evolution actions (FIX, DERIVED, CAPTURED). Phase 4 field."
    },
    "parent_agent": {
      "type": "string",
      "description": "Name of parent agent if this is a DERIVED agent. Phase 4 field."
    },
    "evolution_type": {
      "type": "string",
      "enum": ["CREATED", "FIX", "DERIVED", "CAPTURED"],
      "description": "How this agent version was created. Phase 4 field."
    },
    "quality": {
      "type": "object",
      "description": "Quality counters. Phase 4 field — initialized to zeros in Phase 1.",
      "properties": {
        "total_selections": { "type": "integer", "minimum": 0 },
        "total_completions": { "type": "integer", "minimum": 0 },
        "total_fallbacks": { "type": "integer", "minimum": 0 },
        "applied_rate": { "type": "number", "minimum": 0, "maximum": 1 },
        "completion_rate": { "type": "number", "minimum": 0, "maximum": 1 },
        "effective_rate": { "type": "number", "minimum": 0, "maximum": 1 },
        "fallback_rate": { "type": "number", "minimum": 0, "maximum": 1 }
      }
    }
  },
  "additionalProperties": true
}
```

### memory-keys.json JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "agent-memory-keys-v1",
  "title": "Agent Memory Keys",
  "description": "MemoryGraph recall queries and LEANN code search queries for context injection (REQ-DEF-007).",
  "type": "object",
  "properties": {
    "recall_queries": {
      "type": "array",
      "items": { "type": "string", "minLength": 1 },
      "description": "MemoryGraph key paths to recall on /run-agent invocation."
    },
    "leann_queries": {
      "type": "array",
      "items": { "type": "string", "minLength": 1 },
      "description": "LEANN semantic code search queries. Skipped silently if LEANN is not running (EC-DEF-006)."
    },
    "tags": {
      "type": "array",
      "items": { "type": "string", "minLength": 1 },
      "description": "Tags for MemoryGraph agent registration (used in REQ-DEF-006)."
    }
  },
  "additionalProperties": false
}
```

### Template Files

#### `.claude/agents/custom/_template/agent.md`

This template follows the Master Prompt Framework from `docs2/ai_agent_prompt_guide.md`. The `/create-agent` skill (TASK-AGT-004) auto-generates this structure from natural language descriptions. The framework's 12 Principles (Specificity, Harm Prohibition, Scope Anchoring, Intent Declaration, Negative Space, Preserve Behavior, Quality Requirements, Environmental Constraints, Reversibility, Source Specification, Cascade Prevention, Good Faith) are embedded in the generation prompt — NOT in the template itself.

```markdown
# {Agent Name}

## INTENT
{What this agent does and why it exists. 2-3 sentences.
Example: "Analyze SEC 10-K filings to identify revenue recognition risks,
policy changes, and audit flags so that financial due diligence is systematic
and no critical disclosures are missed."}

## SCOPE
### In Scope
- {Capability 1}: {specific description}
- {Capability 2}: {specific description}
- {Capability 3+}: {as needed}

### Out of Scope
- {What this agent explicitly does NOT do}
- {What should be delegated to other agents or done manually}

## CONSTRAINTS
- You run at depth=1 and CANNOT spawn subagents or use the Task/Agent tool
- You MUST complete your task directly using the tools available to you
- {Domain-specific constraint 1}
- {Domain-specific constraint 2}

## FORBIDDEN OUTCOMES
- DO NOT {specific prohibited behavior 1}
- DO NOT {specific prohibited behavior 2}
- DO NOT fabricate data or present assumptions as facts
- DO NOT echo user-provided input in error messages (XSS prevention)

## EDGE CASES
- {Edge case 1}: {expected behavior}
- {Edge case 2}: {expected behavior}
- {Edge case 3}: {expected behavior}

## OUTPUT FORMAT
Respond with:
1. **Summary**: 2-3 sentence overview of findings/results
2. **Details**: Structured analysis or implementation
3. **Confidence**: Self-assessed confidence level (low/medium/high) with reasoning

## WHEN IN DOUBT
If any part of the task is ambiguous, choose the interpretation that:
1. Is most conservative / least risky
2. Follows existing patterns in the codebase or domain
3. Produces verifiable output with citations or references
If still uncertain, state the ambiguity explicitly in your output.
```

#### `.claude/agents/custom/_template/context.md`

```markdown
# Domain Context

## Background
{Domain-specific background knowledge the agent needs. This section provides
the grounding information that shapes how the agent interprets its task.}

## Key Concepts
- **{Concept 1}**: {Definition or explanation}
- **{Concept 2}**: {Definition or explanation}

## Reference Data
{Any schemas, API formats, naming conventions, or reference material.
Keep this focused — only include what the agent needs for its specific role.}

## Common Patterns
{Recurring patterns or conventions in the domain that the agent should follow.}
```

#### `.claude/agents/custom/_template/tools.md`

```markdown
# Tool Instructions

## Primary Tools
- **Read**: Use to examine source files, documentation, or data files
- **Grep**: Use to search for patterns across the codebase
- **Bash**: Use for shell commands when file tools are insufficient

## Tool Usage Guidelines
- Prefer Read over Bash for file content (better UX, no shell escaping issues)
- Use Grep before Read to locate relevant files first
- Batch independent Bash commands in a single call when possible

## Domain-Specific Tool Patterns
{Any tool usage patterns specific to this agent's domain. For example:
- "Use `Bash` with `python -c '...'` for quick data transformations"
- "Use `Grep` with glob `*.py` to find Python implementations"
}
```

#### `.claude/agents/custom/_template/behavior.md`

```markdown
# Behavioral Rules

## Communication
- Be direct and concise — no filler phrases
- Use technical terminology appropriate to the domain
- Cite specific file paths, line numbers, or data points in your analysis

## Quality Standards
- Verify claims by reading actual source files before stating facts
- If uncertain, say so explicitly with your confidence level
- Never fabricate file contents, data, or references

## Process
- Start with reconnaissance (search/read) before analysis
- Present findings in order of importance/severity
- End with actionable recommendations when applicable
```

#### `.claude/agents/custom/_template/memory-keys.json`

```json
{
  "recall_queries": [],
  "leann_queries": [],
  "tags": ["agent-definition"]
}
```

#### `.claude/agents/custom/_template/meta.json`

```json
{
  "created": "2026-01-01T00:00:00Z",
  "last_used": "2026-01-01T00:00:00Z",
  "version": 1,
  "generation": 0,
  "author": "user",
  "invocation_count": 0,
  "quality": {
    "total_selections": 0,
    "total_completions": 0,
    "total_fallbacks": 0,
    "applied_rate": 0,
    "completion_rate": 0,
    "effective_rate": 0,
    "fallback_rate": 0
  }
}
```

## Files to Create

- `src/agent-system/constants.ts` — Token limits, paths, reserved names, file lists
- `src/agent-system/token-counter.ts` — `tokenEstimate()`, `checkTokenBudget()`, `computeTokenBreakdown()`
- `src/agent-system/name-utils.ts` — `sanitizeAgentName()`, `agentExists()`
- `src/agent-system/validator.ts` — `validateAgentDefinition()` with full schema validation
- `src/agent-system/index.ts` — Barrel export for all utilities
- `.claude/agents/custom/_template/agent.md` — Role template with placeholder markers
- `.claude/agents/custom/_template/context.md` — Domain context template
- `.claude/agents/custom/_template/tools.md` — Tool instructions template
- `.claude/agents/custom/_template/behavior.md` — Behavioral rules template
- `.claude/agents/custom/_template/memory-keys.json` — Empty memory keys with schema-valid structure
- `.claude/agents/custom/_template/meta.json` — Example meta with all fields populated
- `tests/agent-system/token-counter.test.ts` — Token counter tests
- `tests/agent-system/name-utils.test.ts` — Name sanitization tests
- `tests/agent-system/validator.test.ts` — Validator tests

## Files to Modify

- None (greenfield)

## Validation Criteria

### Unit Tests

#### token-counter.test.ts
- [ ] `tokenEstimate("")` returns 0
- [ ] `tokenEstimate("hello")` returns a positive integer
- [ ] `tokenEstimate` of a 4000-character string returns ~1000 (within 10%)
- [ ] `checkTokenBudget("short", 1000)` returns `{ within: true, ... }`
- [ ] `checkTokenBudget` with text exceeding limit returns `{ within: false, overage: N }`
- [ ] `computeTokenBreakdown` with multiple files sums only `.md` files for total
- [ ] `computeTokenBreakdown` flags files that exceed their individual limits
- [ ] `computeTokenBreakdown` flags when total exceeds `TOTAL_CONTROLLABLE_TOKEN_LIMIT`

#### name-utils.test.ts
- [ ] `sanitizeAgentName("SEC Filing Analyzer")` returns `"sec-filing-analyzer"`
- [ ] `sanitizeAgentName("my_cool_agent")` returns `"my-cool-agent"`
- [ ] `sanitizeAgentName("  AGENT  ")` returns `"agent"` (after trim, single short name — actually needs min length 2, so this should fail; test with `"  MY AGENT  "` → `"my-agent"`)
- [ ] `sanitizeAgentName("agent!!!name###here")` returns `"agentnamehere"`
- [ ] `sanitizeAgentName("a--b--c")` returns `"a-b-c"` (consecutive hyphens collapsed)
- [ ] `sanitizeAgentName("")` throws Error
- [ ] `sanitizeAgentName("a")` throws Error (too short after sanitization)
- [ ] `sanitizeAgentName("_template")` throws Error (reserved name)
- [ ] `sanitizeAgentName("archived")` throws Error (reserved name)
- [ ] Name longer than 50 chars is truncated to 50 chars max
- [ ] `sanitizeAgentName("123-agent")` returns `"agent"` (leading digits stripped)

#### validator.test.ts
- [ ] Valid template directory passes validation with zero errors
- [ ] Missing `agent.md` produces `REQUIRED_FILE_MISSING` error
- [ ] Invalid JSON in `meta.json` produces `JSON_PARSE_ERROR`
- [ ] `meta.json` missing `created` field produces `INVALID_META_JSON`
- [ ] `meta.json` with `version: 0` produces `INVALID_META_JSON`
- [ ] `meta.json` with `author: "bot"` produces `INVALID_META_JSON`
- [ ] `memory-keys.json` with `recall_queries: "not-array"` produces `INVALID_MEMORY_KEYS`
- [ ] `memory-keys.json` with `recall_queries: [123]` produces `INVALID_MEMORY_KEYS`
- [ ] `agent.md` exceeding 3000 tokens produces `TOKEN_BUDGET_EXCEEDED` warning
- [ ] Total tokens exceeding 15000 produces `TOTAL_TOKEN_BUDGET_EXCEEDED` warning
- [ ] Non-existent directory produces `DIR_NOT_FOUND` error
- [ ] Directory with only `agent.md` (minimum viable agent) passes validation

### Sherlock Gates
- [ ] OPERATIONAL READINESS: `import { tokenEstimate, sanitizeAgentName, validateAgentDefinition } from './src/agent-system/index.js'` resolves without error
- [ ] OPERATIONAL READINESS: `.claude/agents/custom/_template/` directory exists with all 6 files
- [ ] OPERATIONAL READINESS: `_template/meta.json` and `_template/memory-keys.json` parse as valid JSON
- [ ] PARITY: Token limits in `constants.ts` match PRD REQ-DEF-003 exactly (3000, 5000, 2000, 1500, 15000)
- [ ] PARITY: Reserved names include `_template`, `archived`, `versions`, `traces`, `custom`
- [ ] TOKEN BUDGET: Template `agent.md` is under 3000 tokens; template `context.md` under 5000; template `tools.md` under 2000; template `behavior.md` under 1500

### Live Smoke Test
- [ ] Run `validateAgentDefinition` on the `_template/` directory — expect zero errors
- [ ] Create a test agent directory with only `agent.md`, run validator — expect valid
- [ ] Create a test agent directory with `agent.md` of 15000 characters (3750 tokens), run validator — expect TOKEN_BUDGET_EXCEEDED warning on agent.md
- [ ] Run `sanitizeAgentName` with 10 different inputs including edge cases — verify all return valid names or throw appropriate errors

## Test Commands

```bash
# Run all agent-system tests
npx vitest run tests/agent-system/ --reporter=verbose

# Run just token counter tests
npx vitest run tests/agent-system/token-counter.test.ts

# Run just name utils tests
npx vitest run tests/agent-system/name-utils.test.ts

# Run just validator tests
npx vitest run tests/agent-system/validator.test.ts

# Verify template directory structure
ls -la .claude/agents/custom/_template/

# Verify template JSON files parse
node -e "JSON.parse(require('fs').readFileSync('.claude/agents/custom/_template/meta.json', 'utf8')); console.log('meta.json OK')"
node -e "JSON.parse(require('fs').readFileSync('.claude/agents/custom/_template/memory-keys.json', 'utf8')); console.log('memory-keys.json OK')"
```
