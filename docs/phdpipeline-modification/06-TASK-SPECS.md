# PhD Pipeline Fix - Task Specifications

**Document ID**: TASK-PHD-001
**Version**: 1.0
**Created**: 2026-01-01
**Status**: Draft
**Implements**: TECH-PHD-001

---

## Overview

This document defines atomic task specifications for implementing the PhD Pipeline fix. Each task follows the Constitution format (RULE-017, RULE-027) with explicit acceptance criteria and verification steps.

### Task Categories

| Domain | Task Range | Description |
|--------|------------|-------------|
| CONFIG | TASK-CONFIG-001 to TASK-CONFIG-003 | Pipeline configuration changes |
| CLI | TASK-CLI-001 to TASK-CLI-004 | phd-cli enhancements |
| VALIDATE | TASK-VALIDATE-001 to TASK-VALIDATE-002 | Validation and testing |
| DOCS | TASK-DOCS-001 | Documentation updates |

### Execution Order

Tasks MUST be executed in this order per Constitution RULE-015:

```
TASK-CONFIG-001 → TASK-CONFIG-002 → TASK-CONFIG-003 →
TASK-CLI-001 → TASK-CLI-002 → TASK-CLI-003 → TASK-CLI-004 →
TASK-VALIDATE-001 → TASK-VALIDATE-002 →
TASK-DOCS-001
```

---

## TASK-CONFIG-001: Define TypeScript Interfaces

**Priority**: P0
**Estimated Model**: Sonnet 4.5
**Dependencies**: None
**Implements**: REQ-KEY-01, NFR-CODE-01

### Description

Add TypeScript interfaces for agent configuration, session state, and result types to `phd-pipeline-config.ts`.

### Acceptance Criteria

- [ ] `AgentConfig` interface defined with all required fields
- [ ] `PipelineConfig` interface defined
- [ ] `PhaseDefinition` interface defined
- [ ] `SessionState` interface defined
- [ ] `NextAgentResult` interface defined
- [ ] `InitResult` interface defined
- [ ] All fields have explicit types (no `any`)
- [ ] JSDoc comments on all interfaces
- [ ] `npx tsc --noEmit` passes

### Implementation Details

**File**: `src/god-agent/cli/phd-pipeline-config.ts`

**Code to Add**:

```typescript
/**
 * Configuration for a single PhD research agent
 */
export interface AgentConfig {
  /** Unique identifier matching phdresearch file (without .md) */
  key: string;
  /** Human-readable agent name */
  name: string;
  /** Pipeline phase (1-7) */
  phase: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** Order within phase (1-based) */
  order: number;
  /** Agent's primary function description */
  description: string;
  /** Memory domains this agent reads from */
  memoryReads: string[];
  /** Memory domain this agent writes to */
  memoryWrites: string;
  /** Optional: Is this agent dynamic (Phase 6 writers) */
  isDynamic?: boolean;
}

/**
 * Phase metadata
 */
export interface PhaseDefinition {
  /** Phase number (1-7) */
  number: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** Phase name */
  name: string;
  /** Agent keys in execution order */
  agentKeys: string[];
  /** Is this phase dynamic (agents determined at runtime) */
  isDynamic: boolean;
}

/**
 * Complete pipeline configuration
 */
export interface PipelineConfig {
  /** All agent configurations */
  agents: AgentConfig[];
  /** Total agent count (excluding dynamic) */
  totalAgents: number;
  /** Phase definitions */
  phases: PhaseDefinition[];
}
```

### Verification Commands

```bash
# Type check
npx tsc --noEmit

# No any casts
grep -n "as any" src/god-agent/cli/phd-pipeline-config.ts
# Expected: 0 results
```

### Constitution Compliance

| Rule | Compliance |
|------|------------|
| RULE-002 | No `as any` casts |
| RULE-006 | All fields have explicit types |
| RULE-009 | Interfaces are complete and usable |

---

## TASK-CONFIG-002: Replace Agent Key Mapping

**Priority**: P0
**Estimated Model**: Sonnet 4.5
**Dependencies**: TASK-CONFIG-001
**Implements**: REQ-KEY-01, REQ-KEY-02, REQ-KEY-03, REQ-KEY-04

### Description

Replace all 43 incorrect agent keys with the correct 46 phdresearch agent configurations.

### Acceptance Criteria

- [ ] All 43 incorrect keys removed
- [ ] All 46 correct agent configurations added
- [ ] Each agent has correct phase assignment (1-7)
- [ ] Each agent has correct order within phase
- [ ] Each agent has `memoryReads` and `memoryWrites` configured
- [ ] Phase 6 agents marked with `isDynamic: true`
- [ ] `npx tsc --noEmit` passes

### Implementation Details

**File**: `src/god-agent/cli/phd-pipeline-config.ts`

**Keys to Remove** (43 total):
```
algorithm-designer, assumption-identifier, boundary-conditions-checker,
code-generator, complexity-analyzer, concurrency-handler, constraint-identifier,
data-structure-architect, dependency-mapper, edge-case-handler,
error-handler-designer, implementation-planner, input-validator,
interface-designer, invariant-identifier, memory-optimizer,
modular-decomposer, output-formatter, parallelism-analyzer,
pattern-recognizer, performance-analyzer, precondition-checker,
proof-constructor, protocol-designer, recursion-analyzer,
refactoring-advisor, resource-manager, return-type-designer,
reusability-analyzer, scalability-planner, security-analyzer,
side-effect-tracker, simplification-expert, state-manager,
structure-validator, syntax-analyzer, system-integrator,
temporal-analyst, termination-prover, testability-advisor,
type-inference-engine, validation-expert, verification-planner
```

**Keys to Add** (46 total - per Technical Spec Section 4.1):

Phase 1 (6): step-back-analyzer, self-ask-decomposer, construct-definer, ambiguity-clarifier, research-planner, dissertation-architect

Phase 2 (7): literature-mapper, citation-extractor, methodology-scanner, systematic-reviewer, source-tier-classifier, quality-assessor, context-tier-manager

Phase 3 (7): theoretical-framework-analyst, gap-hunter, contradiction-analyzer, bias-detector, risk-analyst, ethics-reviewer, validity-guardian

Phase 4 (7): evidence-synthesizer, pattern-analyst, thematic-synthesizer, theory-builder, hypothesis-generator, model-architect, opportunity-identifier

Phase 5 (4): method-designer, analysis-planner, sampling-strategist, instrument-developer

Phase 6 (8): introduction-writer, literature-review-writer, methodology-writer, results-writer, discussion-writer, conclusion-writer, abstract-writer, apa-citation-specialist

Phase 7 (7): adversarial-reviewer, confidence-quantifier, citation-validator, reproducibility-checker, consistency-validator, chapter-synthesizer, file-length-manager

### Verification Commands

```bash
# Count agents (should be 46)
grep -c "key:" src/god-agent/cli/phd-pipeline-config.ts

# Verify no old keys remain
grep -E "algorithm-designer|assumption-identifier|code-generator" src/god-agent/cli/phd-pipeline-config.ts
# Expected: 0 results

# Verify agent files exist
for key in step-back-analyzer self-ask-decomposer construct-definer; do
  ls .claude/agents/phdresearch/${key}.md
done
```

### Constitution Compliance

| Rule | Compliance |
|------|------------|
| RULE-018 | All keys map to existing files |
| RULE-019 | Phase assignments match original |
| RULE-001 | No placeholder configurations |

---

## TASK-CONFIG-003: Add Phase Definitions

**Priority**: P0
**Estimated Model**: Sonnet 4.5
**Dependencies**: TASK-CONFIG-002
**Implements**: REQ-KEY-03, REQ-PIPE-04

### Description

Add the `PHD_PHASES` constant with complete phase definitions including agent ordering.

### Acceptance Criteria

- [ ] 7 phases defined (1-7)
- [ ] Each phase has correct `name`
- [ ] Each phase has correct `agentKeys` array in order
- [ ] Phase 6 marked as `isDynamic: true`
- [ ] All other phases marked as `isDynamic: false`
- [ ] Exported from module
- [ ] `npx tsc --noEmit` passes

### Implementation Details

**File**: `src/god-agent/cli/phd-pipeline-config.ts`

**Code to Add**:

```typescript
export const PHD_PHASES: PhaseDefinition[] = [
  {
    number: 1,
    name: 'Foundation',
    agentKeys: [
      'step-back-analyzer', 'self-ask-decomposer', 'construct-definer',
      'ambiguity-clarifier', 'research-planner', 'dissertation-architect'
    ],
    isDynamic: false
  },
  {
    number: 2,
    name: 'Discovery',
    agentKeys: [
      'literature-mapper', 'citation-extractor', 'methodology-scanner',
      'systematic-reviewer', 'source-tier-classifier', 'quality-assessor',
      'context-tier-manager'
    ],
    isDynamic: false
  },
  {
    number: 3,
    name: 'Analysis',
    agentKeys: [
      'theoretical-framework-analyst', 'gap-hunter', 'contradiction-analyzer',
      'bias-detector', 'risk-analyst', 'ethics-reviewer', 'validity-guardian'
    ],
    isDynamic: false
  },
  {
    number: 4,
    name: 'Synthesis',
    agentKeys: [
      'evidence-synthesizer', 'pattern-analyst', 'thematic-synthesizer',
      'theory-builder', 'hypothesis-generator', 'model-architect',
      'opportunity-identifier'
    ],
    isDynamic: false
  },
  {
    number: 5,
    name: 'Design',
    agentKeys: [
      'method-designer', 'analysis-planner', 'sampling-strategist',
      'instrument-developer'
    ],
    isDynamic: false
  },
  {
    number: 6,
    name: 'Writing',
    agentKeys: [
      'introduction-writer', 'literature-review-writer', 'methodology-writer',
      'results-writer', 'discussion-writer', 'conclusion-writer',
      'abstract-writer', 'apa-citation-specialist'
    ],
    isDynamic: true
  },
  {
    number: 7,
    name: 'QA/Validation',
    agentKeys: [
      'adversarial-reviewer', 'confidence-quantifier', 'citation-validator',
      'reproducibility-checker', 'consistency-validator', 'chapter-synthesizer',
      'file-length-manager'
    ],
    isDynamic: false
  }
];
```

### Verification Commands

```bash
# Type check
npx tsc --noEmit

# Verify export
grep "export const PHD_PHASES" src/god-agent/cli/phd-pipeline-config.ts

# Count phases (should be 7)
grep -c "number:" src/god-agent/cli/phd-pipeline-config.ts | grep -E "^7$"
```

### Constitution Compliance

| Rule | Compliance |
|------|------------|
| RULE-019 | Phase order preserved |
| RULE-022 | Phase transitions defined |

---

## TASK-CLI-001: Add Agent File Validation

**Priority**: P0
**Estimated Model**: Sonnet 4.5
**Dependencies**: TASK-CONFIG-002
**Implements**: REQ-PIPE-01, EC-01, RULE-018

### Description

Add `validateAgentFiles()` function to verify all agent configuration keys have corresponding `.md` files.

### Acceptance Criteria

- [ ] Function returns `Promise<string[]>` (error messages)
- [ ] Empty array returned when all files exist
- [ ] Descriptive error message for each missing file
- [ ] Error message includes expected file path
- [ ] Called during pipeline initialization
- [ ] `npx tsc --noEmit` passes

### Implementation Details

**File**: `src/god-agent/cli/phd-cli.ts`

**Code to Add**:

```typescript
import { promises as fs } from 'fs';
import * as path from 'path';
import { PHD_AGENTS } from './phd-pipeline-config';

/**
 * Validate all agent files exist
 * @returns Array of validation errors (empty if all valid)
 */
export async function validateAgentFiles(): Promise<string[]> {
  const errors: string[] = [];
  const agentsDir = path.join(process.cwd(), '.claude', 'agents', 'phdresearch');

  for (const agent of PHD_AGENTS) {
    const filePath = path.join(agentsDir, `${agent.key}.md`);

    try {
      await fs.access(filePath);
    } catch {
      errors.push(
        `Missing agent file for key "${agent.key}": ` +
        `Expected at ${filePath}`
      );
    }
  }

  return errors;
}
```

### Verification Commands

```bash
# Type check
npx tsc --noEmit

# Run validation (should return empty)
npx tsx -e "import { validateAgentFiles } from './src/god-agent/cli/phd-cli'; validateAgentFiles().then(e => console.log(e.length === 0 ? 'PASS' : e))"
```

### Constitution Compliance

| Rule | Compliance |
|------|------------|
| RULE-005 | Descriptive error messages |
| RULE-006 | Explicit return type |
| RULE-018 | Validates key-file mapping |

---

## TASK-CLI-002: Implement Prompt Builder

**Priority**: P0
**Estimated Model**: Sonnet 4.5
**Dependencies**: TASK-CONFIG-003
**Implements**: REQ-PROMPT-01, REQ-PROMPT-02, REQ-PROMPT-03, REQ-PROMPT-04

### Description

Implement `buildAgentPrompt()` function that generates complete prompts with TASK COMPLETION SUMMARY format, workflow context, and memory commands.

### Acceptance Criteria

- [ ] Function accepts AgentConfig, SessionState, agentFileContent, descEpisodes
- [ ] Prompt includes `## YOUR TASK` section
- [ ] Prompt includes `## WORKFLOW CONTEXT` with Agent #N/46
- [ ] Prompt includes `## MEMORY RETRIEVAL` with commands
- [ ] Prompt includes `## MEMORY STORAGE` with target key
- [ ] Prompt includes `## TASK COMPLETION SUMMARY` format
- [ ] Prompt includes `## IMPORTANT RULES` section
- [ ] DESC episodes injected when provided
- [ ] `npx tsc --noEmit` passes

### Implementation Details

**File**: `src/god-agent/cli/phd-cli.ts`

**Code to Add**:

```typescript
import { AgentConfig, PHD_PHASES } from './phd-pipeline-config';
import { SessionState } from './phd-cli-types';

/**
 * Get phase name by number
 */
function getPhaseNameByNumber(phaseNum: number): string {
  const phase = PHD_PHASES.find(p => p.number === phaseNum);
  return phase?.name ?? `Phase ${phaseNum}`;
}

/**
 * Calculate absolute position in pipeline
 */
function calculatePosition(agent: AgentConfig, session: SessionState): number {
  let position = 0;
  for (const phase of PHD_PHASES) {
    if (phase.number < agent.phase) {
      position += phase.agentKeys.length;
    } else if (phase.number === agent.phase) {
      position += agent.order;
      break;
    }
  }
  return position;
}

/**
 * Build complete agent prompt with all required sections
 */
export function buildAgentPrompt(
  agent: AgentConfig,
  session: SessionState,
  agentFileContent: string,
  descEpisodes: string[]
): string {
  const position = calculatePosition(agent, session);
  const prevAgent = getPreviousAgent(agent);
  const nextAgent = getNextAgent(agent);

  return `## YOUR TASK

You are the ${agent.name} (Agent #${position}/46).

${agentFileContent}

---

## WORKFLOW CONTEXT

Agent #${position}/46 | Phase ${agent.phase}: ${getPhaseNameByNumber(agent.phase)}
Previous: ${prevAgent ? `${prevAgent.key} (stored at: ${prevAgent.memoryWrites})` : 'None (you are first)'}
Next: ${nextAgent ? `${nextAgent.key} (needs: ${nextAgent.memoryReads.join(', ')})` : 'Phase transition'}

---

## MEMORY RETRIEVAL

Before starting, retrieve relevant context:

${agent.memoryReads.length > 0
  ? agent.memoryReads.map(key =>
      `npx claude-flow memory retrieve "${key}" --namespace "research"`
    ).join('\n')
  : 'No prior context required (you are first in the pipeline).'}

${descEpisodes.length > 0 ? `
### Relevant Prior Solutions (DESC Episodes)

${descEpisodes.join('\n\n')}
` : ''}

---

## MEMORY STORAGE

Store your outputs at:

\`\`\`bash
npx claude-flow memory store "${agent.memoryWrites}" '<your-output-json>' --namespace "research"
\`\`\`

---

## TASK COMPLETION SUMMARY

When complete, provide this EXACT format:

\`\`\`markdown
## TASK COMPLETION SUMMARY

**What I Did**: [1-2 sentence summary of your work]

**Files Created/Modified**:
- \`docs/research/${session.slug}/[filename].md\` - [Description]

**Memory Locations**:
- \`${agent.memoryWrites}\` - [What it contains]

**Next Agent Guidance**: [What ${nextAgent?.name ?? 'the next phase'} should retrieve/know]
\`\`\`

---

## IMPORTANT RULES

1. Complete ALL work - no placeholders, no TODOs
2. Store output in memory before completing
3. Follow the TASK COMPLETION SUMMARY format exactly
4. If blocked, report: BLOCKED | ${agent.key} | [REASON] | [NEED]
`;
}
```

### Verification Commands

```bash
# Type check
npx tsc --noEmit

# Verify prompt contains required sections
npx tsx -e "
import { buildAgentPrompt } from './src/god-agent/cli/phd-cli';
import { PHD_AGENTS } from './src/god-agent/cli/phd-pipeline-config';
const prompt = buildAgentPrompt(PHD_AGENTS[0], {slug:'test'}, 'content', []);
console.log(prompt.includes('TASK COMPLETION SUMMARY') ? 'PASS' : 'FAIL');
"
```

### Constitution Compliance

| Rule | Compliance |
|------|------------|
| RULE-012 | TASK COMPLETION SUMMARY format included |
| RULE-013 | Workflow context injected |
| RULE-020 | All five required sections present |
| RULE-025 | Memory syntax uses positional args |

---

## TASK-CLI-003: Update getNextAgent Function

**Priority**: P0
**Estimated Model**: Sonnet 4.5
**Dependencies**: TASK-CLI-002
**Implements**: REQ-PIPE-02, REQ-PROMPT-05

### Description

Modify `getNextAgent()` to use the new prompt builder and return complete `NextAgentResult`.

### Acceptance Criteria

- [ ] Returns `NextAgentResult` interface
- [ ] Loads agent file from `.claude/agents/phdresearch/`
- [ ] Calls `buildAgentPrompt()` with all parameters
- [ ] Includes DESC episodes when available
- [ ] Returns correct `position` (1-46)
- [ ] Returns correct `previousAgent` and `nextAgent`
- [ ] Error handling for missing agent file
- [ ] `npx tsc --noEmit` passes

### Implementation Details

**File**: `src/god-agent/cli/phd-cli.ts`

**Code to Modify/Add**:

```typescript
import { NextAgentResult } from './phd-pipeline-config';

/**
 * Get next agent with complete prompt
 */
export async function getNextAgent(session: SessionState): Promise<NextAgentResult> {
  // 1. Get current agent config
  const agent = getCurrentAgent(session);
  if (!agent) {
    throw new Error(
      `No agent found for phase ${session.currentPhase}, index ${session.currentAgentIndex}. ` +
      `This indicates a configuration error.`
    );
  }

  // 2. Load agent file content
  const agentFilePath = path.join(
    process.cwd(),
    '.claude',
    'agents',
    'phdresearch',
    `${agent.key}.md`
  );

  let agentFileContent: string;
  try {
    agentFileContent = await fs.readFile(agentFilePath, 'utf-8');
  } catch (error) {
    throw new Error(
      `Agent file not found: ${agentFilePath}. ` +
      `Ensure the file exists for key "${agent.key}". ` +
      `Run 'phd-cli validate' to check all agent files.`
    );
  }

  // 3. Get DESC episodes (if available)
  const descEpisodes = await getRelevantEpisodes(agent.key, session.slug);

  // 4. Build complete prompt
  const prompt = buildAgentPrompt(agent, session, agentFileContent, descEpisodes);

  // 5. Get navigation info
  const prevAgent = getPreviousAgent(agent);
  const nextAgent = getNextAgent(agent);

  // 6. Return result
  return {
    key: agent.key,
    name: agent.name,
    prompt,
    phase: agent.phase,
    position: calculatePosition(agent, session),
    previousAgent: prevAgent?.key ?? null,
    nextAgent: nextAgent?.key ?? null,
    memoryCommands: agent.memoryReads.map(k =>
      `npx claude-flow memory retrieve "${k}" --namespace "research"`
    )
  };
}
```

### Verification Commands

```bash
# Type check
npx tsc --noEmit

# Integration test
npx tsx -e "
import { initPipeline, getNextAgent } from './src/god-agent/cli/phd-cli';
async function test() {
  const init = await initPipeline('test-task');
  console.log(init.firstAgent.key === 'step-back-analyzer' ? 'PASS' : 'FAIL');
  console.log(init.firstAgent.prompt.includes('TASK COMPLETION') ? 'PASS' : 'FAIL');
}
test();
"
```

### Constitution Compliance

| Rule | Compliance |
|------|------------|
| RULE-005 | Descriptive error messages with recovery |
| RULE-006 | Explicit return type |
| RULE-009 | Fully implemented, no stubs |

---

## TASK-CLI-004: Update Pipeline Init and Complete

**Priority**: P0
**Estimated Model**: Sonnet 4.5
**Dependencies**: TASK-CLI-003
**Implements**: REQ-PIPE-01, REQ-PIPE-03, REQ-PIPE-04, REQ-PIPE-05

### Description

Update `initPipeline()` and `completeAgent()` functions to use new configuration and validation.

### Acceptance Criteria

- [ ] `initPipeline()` validates agent files at startup
- [ ] `initPipeline()` creates session with correct initial state
- [ ] `initPipeline()` returns `InitResult` with first agent
- [ ] `completeAgent()` advances to next agent correctly
- [ ] `completeAgent()` handles phase transitions
- [ ] `completeAgent()` returns `pipeline_complete` after Phase 7
- [ ] Session persistence works correctly
- [ ] `npx tsc --noEmit` passes

### Implementation Details

**File**: `src/god-agent/cli/phd-cli.ts`

**Code to Modify**:

```typescript
import { InitResult, PipelineConfig } from './phd-pipeline-config';

/**
 * Initialize PhD research pipeline
 */
export async function initPipeline(slug: string): Promise<InitResult> {
  // 1. Validate slug format
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error(
      `Invalid slug format: "${slug}". ` +
      `Expected kebab-case (e.g., "ai-ethics-research"). ` +
      `Fix: Use lowercase letters, numbers, and hyphens only.`
    );
  }

  // 2. Validate all agent files exist
  const validationErrors = await validateAgentFiles();
  if (validationErrors.length > 0) {
    throw new Error(
      `Agent file validation failed:\n` +
      validationErrors.map(e => `  - ${e}`).join('\n') +
      `\nFix: Ensure all .md files exist in .claude/agents/phdresearch/`
    );
  }

  // 3. Create session
  const sessionId = crypto.randomUUID();
  const session: SessionState = {
    sessionId,
    slug,
    currentPhase: 1,
    currentAgentIndex: 0,
    completedAgents: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'active'
  };

  // 4. Persist session
  await saveSession(session);

  // 5. Get first agent
  const firstAgent = await getNextAgent(session);

  return {
    sessionId,
    firstAgent,
    totalAgents: PHD_AGENTS.length
  };
}

/**
 * Mark current agent as complete and advance
 */
export async function completeAgent(
  sessionId: string
): Promise<NextAgentResult | { status: 'phase_complete' | 'pipeline_complete' }> {
  // 1. Load session
  const session = await loadSession(sessionId);
  if (!session) {
    throw new Error(
      `Session not found: "${sessionId}". ` +
      `Fix: Use 'phd-cli resume' to list available sessions.`
    );
  }

  // 2. Mark current agent complete
  const currentAgent = getCurrentAgent(session);
  session.completedAgents.push(currentAgent.key);
  session.updatedAt = new Date().toISOString();

  // 3. Check for next agent in phase
  const currentPhase = PHD_PHASES.find(p => p.number === session.currentPhase);
  const nextIndexInPhase = session.currentAgentIndex + 1;

  if (currentPhase && nextIndexInPhase < currentPhase.agentKeys.length) {
    // Same phase, next agent
    session.currentAgentIndex = nextIndexInPhase;
    await saveSession(session);
    return await getNextAgent(session);
  }

  // 4. Phase complete - check for next phase
  const nextPhase = session.currentPhase + 1;

  if (nextPhase <= 7) {
    // Advance to next phase
    session.currentPhase = nextPhase;
    session.currentAgentIndex = 0;
    await saveSession(session);
    return await getNextAgent(session);
  }

  // 5. All phases complete - transition to Phase 8
  session.currentPhase = 8;
  session.status = 'complete';
  await saveSession(session);

  return { status: 'pipeline_complete' };
}
```

### Verification Commands

```bash
# Type check
npx tsc --noEmit

# Full pipeline test
npx tsx src/god-agent/cli/phd-cli.ts init test-pipeline
npx tsx src/god-agent/cli/phd-cli.ts status <session-id>
```

### Constitution Compliance

| Rule | Compliance |
|------|------------|
| RULE-005 | Complete error handling |
| RULE-021 | Session persistence |
| RULE-022 | Phase transitions |
| RULE-023 | Error recovery |

---

## TASK-VALIDATE-001: Create Unit Tests

**Priority**: P1
**Estimated Model**: Sonnet 4.5
**Dependencies**: TASK-CLI-004
**Implements**: NFR-CODE-01, RULE-008

### Description

Create comprehensive unit tests for the updated pipeline configuration and CLI functions.

### Acceptance Criteria

- [ ] Test `PHD_AGENTS` has 46 entries
- [ ] Test all keys are unique
- [ ] Test all phases assigned correctly (1-7)
- [ ] Test `validateAgentFiles()` returns empty for valid setup
- [ ] Test `buildAgentPrompt()` includes all required sections
- [ ] Test `initPipeline()` creates valid session
- [ ] Test `completeAgent()` advances correctly
- [ ] All tests pass (`npm run test`)

### Implementation Details

**File**: `tests/phd-pipeline.test.ts`

**Test Structure**:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import {
  PHD_AGENTS,
  PHD_PHASES,
  validateAgentFiles,
  buildAgentPrompt,
  initPipeline,
  completeAgent
} from '../src/god-agent/cli/phd-cli';

describe('PHD_AGENTS Configuration', () => {
  it('should have exactly 46 agents', () => {
    expect(PHD_AGENTS.length).toBe(46);
  });

  it('should have unique keys', () => {
    const keys = PHD_AGENTS.map(a => a.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it('should have valid phase assignments (1-7)', () => {
    PHD_AGENTS.forEach(agent => {
      expect(agent.phase).toBeGreaterThanOrEqual(1);
      expect(agent.phase).toBeLessThanOrEqual(7);
    });
  });

  it('should have Phase 6 agents marked as dynamic', () => {
    const phase6Agents = PHD_AGENTS.filter(a => a.phase === 6);
    phase6Agents.forEach(agent => {
      expect(agent.isDynamic).toBe(true);
    });
  });
});

describe('PHD_PHASES Configuration', () => {
  it('should have exactly 7 phases', () => {
    expect(PHD_PHASES.length).toBe(7);
  });

  it('should have Phase 6 marked as dynamic', () => {
    const phase6 = PHD_PHASES.find(p => p.number === 6);
    expect(phase6?.isDynamic).toBe(true);
  });
});

describe('validateAgentFiles', () => {
  it('should return empty array when all files exist', async () => {
    const errors = await validateAgentFiles();
    expect(errors).toHaveLength(0);
  });
});

describe('buildAgentPrompt', () => {
  const mockSession = { slug: 'test', currentPhase: 1, currentAgentIndex: 0 };
  const mockContent = 'Agent instructions here';

  it('should include TASK COMPLETION SUMMARY', () => {
    const prompt = buildAgentPrompt(PHD_AGENTS[0], mockSession, mockContent, []);
    expect(prompt).toContain('## TASK COMPLETION SUMMARY');
  });

  it('should include WORKFLOW CONTEXT', () => {
    const prompt = buildAgentPrompt(PHD_AGENTS[0], mockSession, mockContent, []);
    expect(prompt).toContain('## WORKFLOW CONTEXT');
    expect(prompt).toContain('Agent #1/46');
  });

  it('should include MEMORY RETRIEVAL', () => {
    const prompt = buildAgentPrompt(PHD_AGENTS[1], mockSession, mockContent, []);
    expect(prompt).toContain('## MEMORY RETRIEVAL');
    expect(prompt).toContain('npx claude-flow memory retrieve');
  });

  it('should include DESC episodes when provided', () => {
    const episodes = ['Episode 1 content', 'Episode 2 content'];
    const prompt = buildAgentPrompt(PHD_AGENTS[0], mockSession, mockContent, episodes);
    expect(prompt).toContain('Episode 1 content');
  });
});
```

### Verification Commands

```bash
# Run tests
npm run test -- tests/phd-pipeline.test.ts

# Check coverage
npm run test -- --coverage tests/phd-pipeline.test.ts
```

### Constitution Compliance

| Rule | Compliance |
|------|------------|
| RULE-008 | Real tests that verify functionality |
| RULE-009 | Tests prove code works |

---

## TASK-VALIDATE-002: Integration Testing

**Priority**: P1
**Estimated Model**: Sonnet 4.5
**Dependencies**: TASK-VALIDATE-001
**Implements**: AT-01 through AT-05

### Description

Create integration tests that verify the complete pipeline workflow from init to completion.

### Acceptance Criteria

- [ ] Test pipeline initialization returns valid session
- [ ] Test first agent is `step-back-analyzer`
- [ ] Test complete pipeline cycle (init → all agents → complete)
- [ ] Test session resume functionality
- [ ] Test Phase 8 transition
- [ ] All tests pass

### Implementation Details

**File**: `tests/phd-pipeline.integration.test.ts`

**Test Structure**:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { initPipeline, completeAgent, resumeSession } from '../src/god-agent/cli/phd-cli';
import { promises as fs } from 'fs';
import * as path from 'path';

describe('PhD Pipeline Integration', () => {
  const testSessions: string[] = [];

  afterEach(async () => {
    // Cleanup test sessions
    for (const id of testSessions) {
      const sessionPath = path.join('.phd-sessions', `${id}.json`);
      try {
        await fs.unlink(sessionPath);
      } catch {}
    }
    testSessions.length = 0;
  });

  it('AT-01: should initialize pipeline with valid session', async () => {
    const result = await initPipeline('test-at01');
    testSessions.push(result.sessionId);

    expect(result.sessionId).toBeDefined();
    expect(result.firstAgent.key).toBe('step-back-analyzer');
    expect(result.totalAgents).toBe(46);
  });

  it('AT-02: should spawn each agent successfully', async () => {
    const init = await initPipeline('test-at02');
    testSessions.push(init.sessionId);

    let current = init.firstAgent;
    let agentCount = 1;

    while (true) {
      // Verify agent has complete prompt
      expect(current.prompt).toContain('## TASK COMPLETION SUMMARY');
      expect(current.prompt).toContain('## WORKFLOW CONTEXT');

      // Complete and get next
      const next = await completeAgent(init.sessionId);

      if ('status' in next && next.status === 'pipeline_complete') {
        break;
      }

      current = next as NextAgentResult;
      agentCount++;

      // Safety limit
      if (agentCount > 50) {
        throw new Error('Pipeline exceeded expected agent count');
      }
    }

    expect(agentCount).toBe(46);
  });

  it('AT-04: should resume interrupted session', async () => {
    const init = await initPipeline('test-at04');
    testSessions.push(init.sessionId);

    // Complete first agent
    await completeAgent(init.sessionId);

    // Resume
    const resumed = await resumeSession(init.sessionId);
    expect(resumed.key).toBe('self-ask-decomposer');
  });

  it('AT-03: should reach Phase 8 completion', async () => {
    const init = await initPipeline('test-at03');
    testSessions.push(init.sessionId);

    let result: any = init.firstAgent;
    while (!('status' in result)) {
      result = await completeAgent(init.sessionId);
    }

    expect(result.status).toBe('pipeline_complete');
  });
});
```

### Verification Commands

```bash
# Run integration tests
npm run test -- tests/phd-pipeline.integration.test.ts

# Manual CLI test
npx tsx src/god-agent/cli/phd-cli.ts init manual-test
npx tsx src/god-agent/cli/phd-cli.ts next <session-id>
npx tsx src/god-agent/cli/phd-cli.ts complete <session-id>
```

### Constitution Compliance

| Rule | Compliance |
|------|------------|
| RULE-008 | Real integration tests |
| RULE-011 | Verifies no breaking changes |

---

## TASK-DOCS-001: Update Documentation

**Priority**: P2
**Estimated Model**: Haiku 4.5
**Dependencies**: TASK-VALIDATE-002
**Implements**: PRD Section 14.1

### Description

Update relevant documentation to reflect the pipeline fix changes.

### Acceptance Criteria

- [ ] phd-cli help text updated if needed
- [ ] Any README references updated
- [ ] god-research.md updated to reference correct agents (if needed)
- [ ] No broken links or references

### Implementation Details

Review and update:
1. `src/god-agent/cli/phd-cli.ts` - Help text
2. `.claude/commands/god-research.md` - Skill documentation (if references agents)
3. Any README files that mention phd-pipeline

### Verification Commands

```bash
# Check CLI help
npx tsx src/god-agent/cli/phd-cli.ts --help

# Verify no broken references
grep -r "algorithm-designer\|assumption-identifier" docs/ .claude/
# Expected: 0 results (old keys shouldn't be referenced)
```

### Constitution Compliance

| Rule | Compliance |
|------|------------|
| RULE-001 | No placeholder docs |
| RULE-009 | Documentation is complete |

---

## Summary: Task Dependencies Graph

```
TASK-CONFIG-001 (Interfaces)
        ↓
TASK-CONFIG-002 (Agent Keys)
        ↓
TASK-CONFIG-003 (Phases)
        ↓
   ┌────┴────┐
   ↓         ↓
TASK-CLI-001  TASK-CLI-002
(Validation)  (Prompt Builder)
   └────┬────┘
        ↓
TASK-CLI-003 (getNextAgent)
        ↓
TASK-CLI-004 (Init/Complete)
        ↓
TASK-VALIDATE-001 (Unit Tests)
        ↓
TASK-VALIDATE-002 (Integration)
        ↓
TASK-DOCS-001 (Documentation)
```

---

## Estimated Effort

| Task | Complexity | Estimated Lines | Model |
|------|------------|-----------------|-------|
| TASK-CONFIG-001 | Low | ~50 | Sonnet |
| TASK-CONFIG-002 | Medium | ~400 | Sonnet |
| TASK-CONFIG-003 | Low | ~80 | Sonnet |
| TASK-CLI-001 | Low | ~30 | Sonnet |
| TASK-CLI-002 | Medium | ~100 | Sonnet |
| TASK-CLI-003 | Medium | ~60 | Sonnet |
| TASK-CLI-004 | Medium | ~80 | Sonnet |
| TASK-VALIDATE-001 | Medium | ~100 | Sonnet |
| TASK-VALIDATE-002 | Medium | ~80 | Sonnet |
| TASK-DOCS-001 | Low | ~20 | Haiku |

**Total Estimated**: ~1000 lines of code changes

---

**Document Status**: Ready for Constitution Review
