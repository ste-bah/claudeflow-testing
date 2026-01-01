# Product Requirements Document: PhD Pipeline Configuration Fix

**PRD ID**: PRD-2026-001
**Version**: 1.0
**Created**: 2026-01-01
**Last Updated**: 2026-01-01
**Status**: Draft
**Owner**: ClaudeFlow Pipeline Team

---

## 1. Executive Summary

### 1.1 Purpose

This PRD defines the requirements for fixing the PhD Pipeline system, which orchestrates 45 specialized AI agents to conduct comprehensive academic research. The current implementation has critical misconfigurations that prevent proper agent coordination and prompt injection.

### 1.2 Scope

- Fix 43 incorrect agent key mappings in `phd-pipeline-config.ts`
- Restore rich prompt templates from original `god-research.md.bak`
- Ensure TASK COMPLETION SUMMARY format injection
- Maintain backward compatibility with existing sessions

### 1.3 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Agent Key Accuracy | 100% | All 46 keys match phdresearch files |
| Prompt Completeness | 100% | All agents receive full context |
| Pipeline Success Rate | 100% | Init → Phase 8 completes without errors |
| Lint/TypeCheck Pass | 100% | Zero errors on `npm run lint` and `npx tsc` |

---

## 2. Problem Statement

### 2.1 Current State

The PhD Pipeline system was designed to orchestrate 45 specialized research agents through 7 phases plus final assembly. However, the current implementation has critical failures:

1. **Agent Key Mismatch**: `phd-pipeline-config.ts` defines 48 agent keys that do not correspond to actual agent files in `.claude/agents/phdresearch/`

2. **Lost Context**: The new `god-research.md` (208 lines) delegates to `phd-cli` but the CLI uses the misconfigured pipeline, losing all rich prompts from the original (1797 lines)

3. **Missing Coordination**: Agents do not receive:
   - TASK COMPLETION SUMMARY format specification
   - Workflow context (Agent #N/45, Previous, Next)
   - Memory retrieval commands

### 2.2 Impact

- Pipeline cannot spawn correct agents (43 keys return no file)
- Agents lack proper instructions for memory coordination
- Research output quality degrades due to missing context
- Sessions may fail mid-pipeline

### 2.3 Root Cause

The pipeline configuration was created using software engineering agent keys instead of PhD research agent keys. This was likely a copy-paste error from a different project template.

---

## 3. Target Users and Personas

### 3.1 Primary User: Research Orchestrator (Claude Code)

**Description**: The AI system that invokes the PhD Pipeline via `/god-research` skill

**Needs**:
- Accurate agent key → file mapping
- Complete prompts for each agent
- Clear workflow coordination

**Pain Points**:
- Cannot spawn agents due to key mismatch
- Agents produce inconsistent output without proper prompts

### 3.2 Secondary User: Human Developer

**Description**: Developer maintaining or extending the pipeline

**Needs**:
- Clear configuration structure
- Easy debugging when agents fail
- Type-safe implementation

**Pain Points**:
- Difficult to trace key mismatches
- No validation at compile time

---

## 4. Feature Description and User Stories

### 4.1 Feature Overview

Fix the PhD Pipeline configuration to enable proper agent orchestration with full prompt injection.

### 4.2 User Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-01 | Orchestrator | Initialize pipeline with correct agent keys | All 45 agents can be spawned | P0 |
| US-02 | Orchestrator | Receive complete prompts for each agent | Agents have full context | P0 |
| US-03 | Orchestrator | See workflow context in prompts | Agents know their position | P0 |
| US-04 | Orchestrator | Get TASK COMPLETION SUMMARY format | Memory coordination works | P0 |
| US-05 | Developer | See TypeScript errors for invalid keys | Catch mismatches early | P1 |
| US-06 | Developer | Resume interrupted sessions | Don't lose progress | P1 |

---

## 5. Functional Requirements

### 5.1 Agent Key Mapping (REQ-KEY-*)

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| REQ-KEY-01 | System SHALL map all 46 phdresearch agent files to config keys | P0 | All files in phdresearch folder have corresponding keys |
| REQ-KEY-02 | System SHALL remove all 43 incorrect software engineering keys | P0 | No orphan keys in config |
| REQ-KEY-03 | System SHALL preserve phase assignments (1-7) | P0 | Each agent assigned to correct phase |
| REQ-KEY-04 | System SHALL maintain agent execution order within phases | P0 | Order matches original .bak |

### 5.2 Prompt Injection (REQ-PROMPT-*)

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| REQ-PROMPT-01 | System SHALL inject TASK COMPLETION SUMMARY format | P0 | Format appears in all agent prompts |
| REQ-PROMPT-02 | System SHALL inject workflow context | P0 | "Agent #N/45 \| Previous: X \| Next: Y" in all prompts |
| REQ-PROMPT-03 | System SHALL inject memory retrieval commands | P1 | `npx claude-flow memory retrieve` commands included |
| REQ-PROMPT-04 | System SHALL inject memory storage commands | P1 | Storage locations specified per agent |
| REQ-PROMPT-05 | System SHALL preserve DESC episode injection | P1 | Episodes injected when available |

### 5.3 Pipeline Operations (REQ-PIPE-*)

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| REQ-PIPE-01 | Pipeline SHALL initialize without errors | P0 | `phd-cli init` returns valid session |
| REQ-PIPE-02 | Pipeline SHALL return correct agent on `next` command | P0 | Key matches phdresearch file |
| REQ-PIPE-03 | Pipeline SHALL track completion status per agent | P0 | `complete` updates session state |
| REQ-PIPE-04 | Pipeline SHALL transition to Phase 8 after Phase 7 | P0 | `status: "complete"` returned |
| REQ-PIPE-05 | Pipeline SHALL support session resume | P1 | `resume` restores interrupted session |

---

## 6. Non-Functional Requirements

### 6.1 Code Quality (NFR-CODE-*)

| ID | Requirement | Priority | Metric |
|----|-------------|----------|--------|
| NFR-CODE-01 | Code SHALL pass TypeScript type checking | P0 | `npx tsc --noEmit` returns 0 |
| NFR-CODE-02 | Code SHALL pass linting | P0 | `npm run lint` returns 0 |
| NFR-CODE-03 | Code SHALL have no prohibited patterns | P0 | Zero TODO/FIXME/PLACEHOLDER/`as any` |
| NFR-CODE-04 | Code SHALL use `execFile` not `exec` | P0 | Zero `exec()` calls |

### 6.2 Compatibility (NFR-COMPAT-*)

| ID | Requirement | Priority | Metric |
|----|-------------|----------|--------|
| NFR-COMPAT-01 | Changes SHALL not break phd-cli interface | P0 | All CLI commands work unchanged |
| NFR-COMPAT-02 | Changes SHALL preserve session schema | P1 | Existing sessions can resume |
| NFR-COMPAT-03 | Changes SHALL not affect Phase 8 orchestrator | P0 | Final assembly continues working |

---

## 7. Edge Cases

### 7.1 Documented Edge Cases

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| EC-01 | Agent file missing | Throw descriptive error with file path |
| EC-02 | Session interrupted mid-phase | Resume from last completed agent |
| EC-03 | Invalid session ID | Return clear "session not found" error |
| EC-04 | Phase 8 sources missing | Return error code 2 with missing file list |
| EC-05 | Duplicate agent key | Fail fast with duplicate key error |

---

## 8. Out of Scope

The following are explicitly NOT part of this PRD:

1. **Adding new agents** - Only fixing existing 46 agents
2. **Changing phase structure** - Preserving original 7+1 phases
3. **Modifying FinalStageOrchestrator** - Phase 8 already works
4. **UI/Dashboard changes** - CLI-only scope
5. **Performance optimization** - Functional correctness first

---

## 9. Success Metrics

### 9.1 Quantitative Metrics

| Metric | Baseline | Target | Measurement Method |
|--------|----------|--------|-------------------|
| Agent Key Accuracy | 10.4% (5/48) | 100% | Config keys vs file count |
| Pipeline Init Success | Unknown | 100% | `phd-cli init` tests |
| Agent Spawn Success | ~10% | 100% | All agents loadable |
| Prompt Completeness | 0% | 100% | TASK COMPLETION SUMMARY present |

### 9.2 Qualitative Success Criteria

- All 45 research agents execute with full context
- Memory coordination enables agent-to-agent communication
- Phase 8 final assembly produces complete research paper

---

## 10. Agent Implementation Details

### 10.1 Agent Roles and Responsibilities

The PhD Pipeline uses 46 specialized agents across 7 phases:

**Phase 1: Foundation (6 agents)**
- `step-back-analyzer` - Establishes guiding principles
- `self-ask-decomposer` - Breaks down research questions
- `research-planner` - Creates comprehensive research plan
- `construct-definer` - Defines key constructs
- `ambiguity-clarifier` - Resolves terminology ambiguity
- `dissertation-architect` - Designs chapter structure

**Phase 2: Discovery (5 agents)**
- `literature-mapper` - Systematic literature search
- `source-tier-classifier` - Classifies source quality
- `systematic-reviewer` - PRISMA-compliant review
- `methodology-scanner` - Scans methodology patterns
- `context-tier-manager` - Organizes context tiers

**Phase 3: Architecture (4 agents)**
- `theoretical-framework-analyst` - Analyzes theoretical frameworks
- `contradiction-analyzer` - Identifies contradictions
- `gap-hunter` - Discovers research gaps
- `risk-analyst` - Assesses research risks

**Phase 4: Synthesis (5 agents)**
- `evidence-synthesizer` - Synthesizes evidence
- `bias-detector` - Detects publication bias
- `quality-assessor` - Assesses study quality
- `thematic-synthesizer` - Synthesizes themes
- `opportunity-identifier` - Identifies opportunities

**Phase 5: Design (10 agents)**
- `method-designer` - Designs research methodology
- `theory-builder` - Builds theoretical framework
- `hypothesis-generator` - Generates hypotheses
- `model-architect` - Builds structural models
- `sampling-strategist` - Creates sampling strategy
- `instrument-developer` - Develops instruments
- `analysis-planner` - Plans analysis strategy
- `validity-guardian` - Protects validity
- `ethics-reviewer` - Reviews ethics compliance
- `methodology-writer` - Writes methodology section

**Phase 6: Writing (6 agents)**
- `introduction-writer` - Writes introduction
- `literature-review-writer` - Writes literature review
- `discussion-writer` - Writes discussion
- `results-writer` - Writes results
- `conclusion-writer` - Writes conclusion
- `abstract-writer` - Writes abstract

**Phase 7: Validation (9 agents)**
- `adversarial-reviewer` - Red team critique
- `citation-validator` - Validates citations
- `reproducibility-checker` - Checks reproducibility
- `confidence-quantifier` - Quantifies confidence
- `apa-citation-specialist` - APA formatting
- `citation-extractor` - Extracts citations
- `consistency-validator` - Validates consistency
- `chapter-synthesizer` - Synthesizes chapters
- `file-length-manager` - Manages file lengths

**Phase 8: Final Assembly (1 orchestrator)**
- `FinalStageOrchestrator` - Assembles final paper

### 10.2 Agent Capability Assumptions

| Capability | Assumption |
|------------|------------|
| Model Class | Claude Sonnet 4.5 (subagents) |
| Context Window | 200K tokens |
| Tool Access | File read/write, memory, search |
| Autonomy Level | L3 (Guided Autonomy) |

### 10.3 Tooling and Environment

- **Runtime**: Node.js with TypeScript
- **CLI**: phd-cli.ts via `npx tsx`
- **Memory**: claude-flow memory system
- **Agents**: Claude Code Task() tool

---

## 11. Guardrails and Constraints

### 11.1 Implementation Constraints

| ID | Constraint | Rationale |
|----|------------|-----------|
| GR-01 | No breaking CLI interface changes | Preserve user workflows |
| GR-02 | All changes in single PR | Atomic deployment |
| GR-03 | No external API dependencies | Self-contained system |
| GR-04 | Must pass all existing tests | Regression prevention |

### 11.2 Code Quality Constraints

| ID | Constraint | Enforcement |
|----|------------|-------------|
| GR-05 | No `as any` casts | TypeScript strict mode |
| GR-06 | No `exec()` calls | Code review, grep |
| GR-07 | No TODO/FIXME/PLACEHOLDER | Pre-commit hook |
| GR-08 | No 768D hardcoded values | Pattern search |

---

## 12. Risk and Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing sessions | Medium | High | Version session schema, add migration |
| Missing agent files | Low | Critical | Validate all keys at startup |
| Prompt injection bugs | Medium | High | Unit tests for prompt building |
| Phase 8 regression | Low | High | Integration tests before deployment |
| Performance degradation | Low | Medium | Benchmark before/after |

---

## 13. Human Oversight Checkpoints

| Checkpoint | Trigger | Action Required |
|------------|---------|-----------------|
| Pre-Implementation | All specs complete | User confirms implementation start |
| Post-Config Fix | Config updated | Verify all 46 keys present |
| Post-Prompt Fix | Prompts updated | Review sample prompts |
| Pre-Deploy | All tests pass | User approves merge |

---

## 14. Success Criteria for Delivery

### 14.1 Definition of Done

- [ ] All 46 agent keys correctly mapped in config
- [ ] All agent prompts include TASK COMPLETION SUMMARY format
- [ ] All agent prompts include workflow context
- [ ] `npm run lint` passes with 0 errors
- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] No prohibited patterns (TODO, FIXME, PLACEHOLDER, `as any`, `exec()`)
- [ ] Pipeline init → Phase 8 completes in test
- [ ] Existing session schema compatible
- [ ] Documentation updated

### 14.2 Acceptance Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| AT-01 | Initialize pipeline | Returns valid session with agent 1 |
| AT-02 | Spawn each agent | All 46 agents spawn successfully |
| AT-03 | Complete pipeline | Reaches Phase 8 completion |
| AT-04 | Resume session | Interrupted session continues |
| AT-05 | Final assembly | Produces final-paper.md |

---

## Appendix A: Agent Key Mapping Table

*To be completed in Technical Specification*

## Appendix B: TASK COMPLETION SUMMARY Format

```markdown
## TASK COMPLETION SUMMARY

**What I Did**: [1-2 sentence summary]

**Files Created/Modified**:
- `docs/research/$SLUG/[filename].md` - [Description]

**Memory Locations**:
- `project/research/[key]` - [What it contains]

**Next Agent Guidance**: [What the next agent should retrieve/know]
```

## Appendix C: Workflow Context Format

```
## WORKFLOW CONTEXT
Agent #N/45 | Previous: [agent-key] (stored at [memory-key]) | Next: [agent-key] (needs [what])
```

---

**Document Status**: Ready for Constitution Development
