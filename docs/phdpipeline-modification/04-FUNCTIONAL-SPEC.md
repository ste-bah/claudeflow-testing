# PhD Pipeline Fix - Functional Specification

**Spec ID**: SPEC-FUNC-PHD-001
**Version**: 1.0
**Created**: 2026-01-01
**Implements**: PRD-2026-001
**Constitution**: CONST-PHD-001

---

## 1. Document Purpose

This Functional Specification defines WHAT the PhD Pipeline system must do after the fix is applied. It serves as the bridge between the PRD requirements and the Technical Specification (how to build it).

---

## 2. System Overview

### 2.1 System Description

The PhD Pipeline is a multi-agent orchestration system that coordinates 46 specialized AI agents (45 sequential + 1 support) across 7 phases to conduct comprehensive academic research, producing a complete research paper.

### 2.2 System Boundaries

**In Scope**:
- Agent key configuration (`phd-pipeline-config.ts`)
- Prompt injection system (`phd-cli.ts`)
- Session management
- Phase transitions

**Out of Scope**:
- Individual agent behavior (defined in `.md` files)
- FinalStageOrchestrator (Phase 8 - already working)
- InteractionStore/DESC systems

---

## 3. Complete Agent Mapping

### 3.1 Phase 1: FOUNDATION (6 Agents)

| Order | Agent Key | File | Purpose |
|-------|-----------|------|---------|
| 1 | step-back-analyzer | step-back-analyzer.md | Establish guiding research principles |
| 2 | self-ask-decomposer | self-ask-decomposer.md | Decompose into 15-20 research questions |
| 3 | construct-definer | construct-definer.md | Define key constructs and variables |
| 4 | ambiguity-clarifier | ambiguity-clarifier.md | Resolve terminology ambiguities |
| 5 | research-planner | research-planner.md | Create ReWOO research plan |
| 6 | dissertation-architect | dissertation-architect.md | Design and LOCK chapter structure |

**Phase 1 Exit Criteria**:
- Research principles documented
- 15-20 questions generated
- All constructs defined
- Ambiguities resolved
- Research plan created
- Chapter structure LOCKED

### 3.2 Phase 2: DISCOVERY (7 Agents)

| Order | Agent Key | File | Purpose |
|-------|-----------|------|---------|
| 7 | literature-mapper | literature-mapper.md | Systematic literature search |
| 8 | citation-extractor | citation-extractor.md | Extract APA citations |
| 9 | methodology-scanner | methodology-scanner.md | Scan methodology patterns |
| 10 | systematic-reviewer | systematic-reviewer.md | PRISMA-compliant review |
| 11 | source-tier-classifier | source-tier-classifier.md | Classify Tier 1/2/3 sources |
| 12 | quality-assessor | quality-assessor.md | CASP/JBI quality assessment |
| 13 | context-tier-manager | context-tier-manager.md | Organize hot/warm/cold tiers |

**Phase 2 Exit Criteria**:
- Literature map complete
- Citations extracted (15+ per claim)
- Methodologies cataloged
- Systematic review done
- Sources classified (80%+ Tier 1/2)
- Context tiers organized

### 3.3 Phase 3: ANALYSIS (7 Agents)

| Order | Agent Key | File | Purpose |
|-------|-----------|------|---------|
| 14 | theoretical-framework-analyst | theoretical-framework-analyst.md | Analyze theoretical frameworks |
| 15 | gap-hunter | gap-hunter.md | Identify 10+ research gaps |
| 16 | contradiction-analyzer | contradiction-analyzer.md | Find 10+ contradictions |
| 17 | bias-detector | bias-detector.md | Detect 8+ bias types |
| 18 | risk-analyst | risk-analyst.md | FMEA risk analysis (15+ modes) |
| 19 | ethics-reviewer | ethics-reviewer.md | IRB compliance review |
| 20 | validity-guardian | validity-guardian.md | Protect all 4 validity types |

**Phase 3 Exit Criteria**:
- Frameworks analyzed
- Gaps identified
- Contradictions documented
- Biases detected
- Risks assessed
- Ethics reviewed
- Validity protected

### 3.4 Phase 4: SYNTHESIS (7 Agents)

| Order | Agent Key | File | Purpose |
|-------|-----------|------|---------|
| 21 | evidence-synthesizer | evidence-synthesizer.md | Meta/narrative synthesis |
| 22 | pattern-analyst | pattern-analyst.md | Identify 10+ meta-patterns |
| 23 | thematic-synthesizer | thematic-synthesizer.md | Synthesize recurring themes |
| 24 | theory-builder | theory-builder.md | Construct theoretical framework |
| 25 | hypothesis-generator | hypothesis-generator.md | Generate testable hypotheses |
| 26 | model-architect | model-architect.md | Build structural models |
| 27 | opportunity-identifier | opportunity-identifier.md | Identify research opportunities |

**Phase 4 Exit Criteria**:
- Evidence synthesized
- Patterns identified
- Themes synthesized
- Theory constructed
- Hypotheses generated
- Model built
- Opportunities identified

### 3.5 Phase 5: DESIGN (4 Agents)

| Order | Agent Key | File | Purpose |
|-------|-----------|------|---------|
| 28 | method-designer | method-designer.md | Design research methodology |
| 29 | analysis-planner | analysis-planner.md | Plan statistical analysis |
| 30 | sampling-strategist | sampling-strategist.md | Create sampling strategy |
| 31 | instrument-developer | instrument-developer.md | Develop measurement instruments |

**Phase 5 Exit Criteria**:
- Methodology designed
- Analysis planned
- Sampling specified
- Instruments developed

### 3.6 Phase 6: WRITING (8 Agents - Dynamic)

| Order | Agent Key | File | Purpose |
|-------|-----------|------|---------|
| 32+ | introduction-writer | introduction-writer.md | Write introduction chapter |
| 33+ | literature-review-writer | literature-review-writer.md | Write literature review |
| 34+ | methodology-writer | methodology-writer.md | Write methodology section |
| 35+ | results-writer | results-writer.md | Write results chapter |
| 36+ | discussion-writer | discussion-writer.md | Write discussion chapter |
| 37+ | conclusion-writer | conclusion-writer.md | Write conclusion chapter |
| 38+ | abstract-writer | abstract-writer.md | Write abstract (last) |
| - | apa-citation-specialist | apa-citation-specialist.md | Format citations (support) |

**NOTE**: Phase 6 is DYNAMIC. The actual writers spawned depend on the LOCKED chapter structure from `dissertation-architect`. The chapter-synthesizer may also be used in this phase.

**Phase 6 Exit Criteria**:
- All chapters written per locked structure
- APA 7th formatting applied
- Word count targets met

### 3.7 Phase 7: QA/VALIDATION (6 Agents)

| Order | Agent Key | File | Purpose |
|-------|-----------|------|---------|
| 39 | adversarial-reviewer | adversarial-reviewer.md | Red team critique |
| 40 | confidence-quantifier | confidence-quantifier.md | Quantify confidence scores |
| 41 | citation-validator | citation-validator.md | Validate all citations |
| 42 | reproducibility-checker | reproducibility-checker.md | Check reproducibility |
| 43 | consistency-validator | consistency-validator.md | Validate consistency |
| 44 | chapter-synthesizer | chapter-synthesizer.md | Synthesize chapters |
| 45 | file-length-manager | file-length-manager.md | Manage file lengths |

**Phase 7 Exit Criteria**:
- Adversarial review complete
- Confidence scores assigned
- Citations validated
- Reproducibility checked
- Consistency validated
- Files properly sized

### 3.8 Phase 8: FINAL ASSEMBLY (Existing)

| Component | File | Purpose |
|-----------|------|---------|
| FinalStageOrchestrator | final-stage-orchestrator.ts | Assemble final paper |

**Already implemented - no changes required.**

---

## 4. Functional Requirements Mapping

### 4.1 Agent Configuration Functions

| ID | Function | Input | Output | Implements |
|----|----------|-------|--------|------------|
| FUNC-CFG-01 | getAgentConfig(key) | Agent key string | AgentConfig object | REQ-KEY-01 |
| FUNC-CFG-02 | getAllAgents() | None | AgentConfig[] | REQ-KEY-01 |
| FUNC-CFG-03 | getPhaseAgents(phase) | Phase number (1-7) | AgentConfig[] | REQ-KEY-03 |
| FUNC-CFG-04 | validateAgentKey(key) | Agent key string | boolean | REQ-KEY-02 |

### 4.2 Prompt Injection Functions

| ID | Function | Input | Output | Implements |
|----|----------|-------|--------|------------|
| FUNC-PROMPT-01 | buildAgentPrompt(key, context) | Key, session context | Complete prompt | REQ-PROMPT-01 |
| FUNC-PROMPT-02 | injectTaskSummary(prompt) | Base prompt | Prompt + TASK COMPLETION SUMMARY | REQ-PROMPT-01 |
| FUNC-PROMPT-03 | injectWorkflowContext(prompt, order, total, prev, next) | Prompt, metadata | Prompt + workflow context | REQ-PROMPT-02 |
| FUNC-PROMPT-04 | injectMemoryCommands(prompt, domains) | Prompt, domains | Prompt + retrieval/storage commands | REQ-PROMPT-03, REQ-PROMPT-04 |

### 4.3 Pipeline Operation Functions

| ID | Function | Input | Output | Implements |
|----|----------|-------|--------|------------|
| FUNC-PIPE-01 | initPipeline(query) | Research query | SessionState | REQ-PIPE-01 |
| FUNC-PIPE-02 | getNextAgent(sessionId) | Session ID | NextAgentResult | REQ-PIPE-02 |
| FUNC-PIPE-03 | completeAgent(sessionId, key) | Session ID, agent key | CompletionResult | REQ-PIPE-03 |
| FUNC-PIPE-04 | getSessionStatus(sessionId) | Session ID | SessionStatus | REQ-PIPE-05 |
| FUNC-PIPE-05 | resumeSession(sessionId) | Session ID | SessionState | REQ-PIPE-05 |

---

## 5. Data Structures

### 5.1 AgentConfig

```typescript
interface AgentConfig {
  key: string;              // Agent identifier (must match file name)
  name: string;             // Display name
  phase: number;            // Phase number (1-7)
  order: number;            // Order within pipeline (1-45)
  file: string;             // Path to .md file
  promptTemplate: string;   // Base prompt with placeholders
  memoryDomains: string[];  // InteractionStore domains to query
  storageDomains: string[]; // Domains to store outputs
  nextAgent: string | null; // Key of next agent (null if phase final)
  prevAgent: string | null; // Key of previous agent (null if first)
}
```

### 5.2 SessionState

```typescript
interface SessionState {
  sessionId: string;
  slug: string;
  query: string;
  currentPhase: number;
  currentAgentIndex: number;
  completedAgents: string[];
  status: 'initializing' | 'running' | 'complete' | 'error';
  createdAt: string;
  updatedAt: string;
}
```

### 5.3 NextAgentResult

```typescript
interface NextAgentResult {
  sessionId: string;
  status: 'next' | 'complete';
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
  agent?: {
    key: string;
    prompt: string;
    phase: number;
    order: number;
  };
  desc?: {
    episodesInjected: number;
    episodeIds: string[];
  };
  slug?: string;  // Only on complete
  summary?: object; // Only on complete
}
```

### 5.4 TASK COMPLETION SUMMARY Format

```markdown
## TASK COMPLETION SUMMARY

**What I Did**: [1-2 sentence summary]

**Files Created/Modified**:
- `docs/research/$SLUG/[filename].md` - [Description]

**InteractionStore Entries** (for orchestration):
- Domain: `research/[domain]`, Tags: `['tag1', 'tag2']` - [Description]

**Next Agent Guidance**: [What next agent should query]
```

### 5.5 Workflow Context Format

```markdown
## WORKFLOW CONTEXT
Agent #N/45 | Previous: [agent-key] | Next: [agent-key]
```

---

## 6. State Transitions

### 6.1 Session State Machine

```
[init] -> initializing -> running -> complete
                  |
                  v
                error (recoverable via resume)
```

### 6.2 Phase Transitions

```
Phase 1 (Foundation)     - Agents 1-6
    |
    v
Phase 2 (Discovery)      - Agents 7-13
    |
    v
Phase 3 (Analysis)       - Agents 14-20
    |
    v
Phase 4 (Synthesis)      - Agents 21-27
    |
    v
Phase 5 (Design)         - Agents 28-31
    |
    v
Phase 6 (Writing)        - Agents 32-38 (dynamic)
    |
    v
Phase 7 (QA)             - Agents 39-45
    |
    v
Phase 8 (Final Assembly) - FinalStageOrchestrator
```

---

## 7. Validation Rules

### 7.1 Agent Key Validation

| Rule | Description | Error |
|------|-------------|-------|
| VAL-KEY-01 | Key must exist in phdresearch folder | `AgentNotFound: {key}` |
| VAL-KEY-02 | Key must not be duplicate | `DuplicateAgent: {key}` |
| VAL-KEY-03 | Phase must be 1-7 | `InvalidPhase: {phase}` |
| VAL-KEY-04 | Order must be 1-45 | `InvalidOrder: {order}` |

### 7.2 Prompt Validation

| Rule | Description | Error |
|------|-------------|-------|
| VAL-PROMPT-01 | Must contain YOUR TASK section | `MissingTaskSection` |
| VAL-PROMPT-02 | Must contain WORKFLOW CONTEXT | `MissingWorkflowContext` |
| VAL-PROMPT-03 | Must contain TASK COMPLETION SUMMARY | `MissingTaskSummaryFormat` |
| VAL-PROMPT-04 | Must have valid placeholders | `InvalidPlaceholder: {name}` |

### 7.3 Session Validation

| Rule | Description | Error |
|------|-------------|-------|
| VAL-SESS-01 | Session ID must exist | `SessionNotFound: {id}` |
| VAL-SESS-02 | Agent must be next in sequence | `OutOfOrderAgent: {key}` |
| VAL-SESS-03 | Cannot complete same agent twice | `AlreadyCompleted: {key}` |

---

## 8. Error Handling

### 8.1 Error Categories

| Category | Code Range | Recovery |
|----------|------------|----------|
| Configuration | 100-199 | Fix config, restart |
| Session | 200-299 | Resume session |
| Agent | 300-399 | Retry agent |
| Phase | 400-499 | Resume from checkpoint |

### 8.2 Error Codes

| Code | Name | Description |
|------|------|-------------|
| 100 | AGENT_NOT_FOUND | Agent key has no corresponding file |
| 101 | INVALID_CONFIG | Configuration validation failed |
| 200 | SESSION_NOT_FOUND | Session ID not found |
| 201 | SESSION_CORRUPT | Session file corrupted |
| 300 | AGENT_SPAWN_FAILED | Failed to spawn agent |
| 301 | AGENT_TIMEOUT | Agent exceeded time limit |
| 400 | PHASE_INCOMPLETE | Previous phase not complete |

---

## 9. Acceptance Criteria

### 9.1 Configuration Acceptance (AC-CFG-*)

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-CFG-01 | All 46 agent keys map to existing files | `ls .claude/agents/phdresearch/*.md` count matches config |
| AC-CFG-02 | No orphan keys in config | Every config key has file |
| AC-CFG-03 | All phases 1-7 have assigned agents | Phase query returns agents |
| AC-CFG-04 | Agent order is correct (1-45) | Sequential verification |

### 9.2 Prompt Acceptance (AC-PROMPT-*)

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-PROMPT-01 | TASK COMPLETION SUMMARY in all prompts | Template validation |
| AC-PROMPT-02 | Workflow context in all prompts | Template validation |
| AC-PROMPT-03 | Placeholders resolved correctly | Runtime verification |
| AC-PROMPT-04 | Memory commands included | Template validation |

### 9.3 Pipeline Acceptance (AC-PIPE-*)

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-PIPE-01 | Init returns valid session | Integration test |
| AC-PIPE-02 | All 45 agents spawn sequentially | End-to-end test |
| AC-PIPE-03 | Phase transitions correct | State machine test |
| AC-PIPE-04 | Resume works after interruption | Recovery test |

---

## 10. Dependencies

### 10.1 Upstream Dependencies

| Component | Purpose | Required Version |
|-----------|---------|------------------|
| Node.js | Runtime | 18+ |
| TypeScript | Language | 5.0+ |
| tsx | Execution | Latest |

### 10.2 Internal Dependencies

| Component | Purpose |
|-----------|---------|
| InteractionStore | Memory coordination |
| DESC | Episode injection |
| FinalStageOrchestrator | Phase 8 |

---

## Appendix A: Complete Agent Key List (46 Agents)

```
# Phase 1: Foundation (6)
step-back-analyzer
self-ask-decomposer
construct-definer
ambiguity-clarifier
research-planner
dissertation-architect

# Phase 2: Discovery (7)
literature-mapper
citation-extractor
methodology-scanner
systematic-reviewer
source-tier-classifier
quality-assessor
context-tier-manager

# Phase 3: Analysis (7)
theoretical-framework-analyst
gap-hunter
contradiction-analyzer
bias-detector
risk-analyst
ethics-reviewer
validity-guardian

# Phase 4: Synthesis (7)
evidence-synthesizer
pattern-analyst
thematic-synthesizer
theory-builder
hypothesis-generator
model-architect
opportunity-identifier

# Phase 5: Design (4)
method-designer
analysis-planner
sampling-strategist
instrument-developer

# Phase 6: Writing (8 - dynamic spawning)
introduction-writer
literature-review-writer
methodology-writer
results-writer
discussion-writer
conclusion-writer
abstract-writer
apa-citation-specialist

# Phase 7: QA (7)
adversarial-reviewer
confidence-quantifier
citation-validator
reproducibility-checker
consistency-validator
chapter-synthesizer
file-length-manager
```

**Total: 46 agent files, 45 in sequential pipeline (apa-citation-specialist is support)**

---

**Document Status**: Ready for Technical Specification
