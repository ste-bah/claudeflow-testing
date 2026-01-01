# PhD Pipeline Fix - Planning Document

**Document ID**: PLAN-PHD-001
**Version**: 1.0
**Created**: 2026-01-01
**Status**: Draft

---

## 1. Executive Summary

This document outlines the comprehensive plan to fix the PhD Pipeline system, which currently has critical misconfigurations that prevent proper execution of the 45-agent research workflow.

### Core Problems Identified

| Problem | Severity | Impact |
|---------|----------|--------|
| 43 incorrect agent keys in `phd-pipeline-config.ts` | **CRITICAL** | Pipeline cannot spawn correct agents |
| Lost prompts in new `god-research.md` (1797→208 lines) | **CRITICAL** | Agents lack proper context/instructions |
| Missing TASK COMPLETION SUMMARY injection | **HIGH** | Agents cannot coordinate via memory |
| Workflow context not injected into prompts | **HIGH** | Agents lack sequential coordination info |

---

## 2. Problem Statement

### 2.1 The Agent Key Mismatch

The `phd-pipeline-config.ts` file defines 48 agents with keys that **do not exist** in the actual `.claude/agents/phdresearch/` folder.

**Configuration Keys (WRONG - software engineering focused):**
```
algorithm-designer, assumption-identifier, data-structure-architect,
dependency-mapper, edge-case-handler, interface-designer, etc.
```

**Actual phdresearch Agent Files (CORRECT - PhD research focused):**
```
abstract-writer.md, adversarial-reviewer.md, analysis-planner.md,
apa-citation-specialist.md, bias-detector.md, chapter-synthesizer.md, etc.
```

**Match Analysis:**
- **Total config keys**: 48
- **Total phdresearch files**: 46
- **Keys that match**: Only 5 (abstract-writer, adversarial-reviewer, contradiction-analyzer, ethics-reviewer, step-back-analyzer)
- **Mismatched keys**: 43

### 2.2 Lost Prompt Context

The original `god-research.md.bak` (1797 lines) contained:
- **Full embedded prompts** for all 45 agents
- **Explicit Task() templates** with complete instructions
- **InteractionStore domain mappings** (19 domains)
- **TASK COMPLETION SUMMARY format** specification
- **Workflow context** (Agent #N/45 | Previous: X | Next: Y)

The new `god-research.md` (208 lines):
- Delegates to `phd-cli`
- Assumes pipeline config is correct (it isn't)
- Lacks fallback prompts
- No explicit TASK COMPLETION SUMMARY enforcement

### 2.3 Missing CLI Injections

The `phd-cli` should inject:
1. **TASK COMPLETION SUMMARY format** - standardized output for memory coordination
2. **Workflow context** - agent position, previous/next agent info
3. **DESC episode injection** - relevant prior solutions
4. **Memory retrieval commands** - specific domains to query

---

## 3. Current State Analysis

### 3.1 File Inventory

| Component | Location | Status |
|-----------|----------|--------|
| Pipeline Config | `src/god-agent/cli/phd-pipeline-config.ts` | ❌ 43 wrong keys |
| phd-cli | `src/god-agent/cli/phd-cli.ts` | ⚠️ Uses wrong config |
| god-research.md | `.claude/commands/god-research.md` | ⚠️ Lost prompts |
| god-research.md.bak | `.claude/commands/god-research.md.bak` | ✅ Reference source |
| phdresearch agents | `.claude/agents/phdresearch/*.md` | ✅ 46 correct agents |
| FinalStageOrchestrator | `src/god-agent/cli/final-stage-orchestrator.ts` | ✅ Phase 8 works |

### 3.2 Actual phdresearch Agent Files (46 total)

```
abstract-writer.md              ethics-reviewer.md           risk-analyst.md
adversarial-reviewer.md         evidence-synthesizer.md      sampling-strategist.md
ambiguity-clarifier.md          file-length-manager.md       self-ask-decomposer.md
analysis-planner.md             gap-hunter.md                source-tier-classifier.md
apa-citation-specialist.md      hypothesis-generator.md      step-back-analyzer.md
bias-detector.md                instrument-developer.md      systematic-reviewer.md
chapter-synthesizer.md          introduction-writer.md       thematic-synthesizer.md
citation-extractor.md           literature-mapper.md         theoretical-framework-analyst.md
citation-validator.md           literature-review-writer.md  theory-builder.md
conclusion-writer.md            method-designer.md           validity-guardian.md
confidence-quantifier.md        methodology-scanner.md
consistency-validator.md        methodology-writer.md
construct-definer.md            model-architect.md
context-tier-manager.md         opportunity-identifier.md
contradiction-analyzer.md       pattern-analyst.md
discussion-writer.md            quality-assessor.md
dissertation-architect.md       reproducibility-checker.md
research-planner.md             results-writer.md
```

### 3.3 Pipeline Phases (from original)

| Phase | Name | Agent Count | Agents |
|-------|------|-------------|--------|
| 1 | Foundation | 6 | step-back-analyzer → dissertation-architect |
| 2 | Discovery | 5 | literature-mapper → context-tier-manager |
| 3 | Architecture | 4 | theoretical-framework-analyst → risk-analyst |
| 4 | Synthesis | 5 | evidence-synthesizer → opportunity-identifier |
| 5 | Design | 10 | method-designer → methodology-writer |
| 6 | Writing | 6 | introduction-writer → abstract-writer |
| 7 | Validation | 9 | adversarial-reviewer → file-length-manager |
| **8** | **Final Assembly** | 1 | FinalStageOrchestrator (already implemented) |

---

## 4. Requirements

### 4.1 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| REQ-FIX-01 | Update all 43 incorrect agent keys in `phd-pipeline-config.ts` | P0 |
| REQ-FIX-02 | Map each config key to correct phdresearch agent file | P0 |
| REQ-FIX-03 | Preserve phase structure (1-7) with correct agent assignments | P0 |
| REQ-FIX-04 | Inject TASK COMPLETION SUMMARY format into all agent prompts | P0 |
| REQ-FIX-05 | Inject workflow context (Agent #N/45, Previous, Next) | P0 |
| REQ-FIX-06 | Include memory retrieval commands in prompts | P1 |
| REQ-FIX-07 | Preserve DESC episode injection capability | P1 |
| REQ-FIX-08 | Ensure Phase 8 finalization continues to work | P1 |

### 4.2 Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-01 | No breaking changes to phd-cli interface | P0 |
| NFR-02 | Maintain backward compatibility with existing sessions | P1 |
| NFR-03 | Code must pass TypeScript type checking | P0 |
| NFR-04 | No TODO/PLACEHOLDER/STUB comments | P0 |
| NFR-05 | All functions must be fully implemented | P0 |

---

## 5. Solution Architecture

### 5.1 Option A: Fix Pipeline Config (Recommended)

**Approach**: Update `phd-pipeline-config.ts` to use correct agent keys and embed rich prompts from original.

**Pros**:
- Minimal changes to existing architecture
- phd-cli continues to work
- DESC injection preserved
- Session management preserved

**Cons**:
- Large file changes
- Requires careful mapping of 43 keys

### 5.2 Option B: Restore Original god-research.md

**Approach**: Revert to `.bak` file with explicit Task() templates.

**Pros**:
- Known working state
- Complete prompts preserved

**Cons**:
- Loses DESC episode injection
- Loses session management
- Loses phd-cli coordination features

### 5.3 Option C: Hybrid Approach

**Approach**: Fix pipeline config AND ensure agent files contain complete prompts.

**Pros**:
- Best of both worlds
- Agents have self-contained prompts
- CLI can still coordinate

**Cons**:
- Most work required
- Potential duplication

**Selected**: **Option A** - Fix Pipeline Config

---

## 6. Implementation Plan

### 6.1 Phase 1: Analysis & Mapping (PRD + Specs)

1. Create detailed PRD document
2. Create Constitution with binding rules
3. Map all 43 incorrect keys → correct phdresearch keys
4. Document phase assignments for all 46 agents
5. Extract prompt templates from `.bak` file

### 6.2 Phase 2: Config Fix Implementation

1. Update `phd-pipeline-config.ts` with correct agent keys
2. Add complete agent prompts to config
3. Implement TASK COMPLETION SUMMARY injection
4. Implement workflow context injection

### 6.3 Phase 3: CLI Enhancement

1. Verify phd-cli properly reads updated config
2. Ensure prompt injection occurs at runtime
3. Test DESC episode injection
4. Verify session persistence

### 6.4 Phase 4: Verification

1. Lint and type check all changes
2. Test pipeline initialization
3. Test agent spawning with correct prompts
4. End-to-end pipeline test

---

## 7. Agent Mapping Reference

### 7.1 Correct Key → File Mapping (to be created)

The following mapping must be established:

| Phase | Order | Correct Agent Key | phdresearch File |
|-------|-------|-------------------|------------------|
| 1 | 1 | step-back-analyzer | step-back-analyzer.md |
| 1 | 2 | self-ask-decomposer | self-ask-decomposer.md |
| 1 | 3 | research-planner | research-planner.md |
| 1 | 4 | construct-definer | construct-definer.md |
| 1 | 5 | ambiguity-clarifier | ambiguity-clarifier.md |
| 1 | 6 | dissertation-architect | dissertation-architect.md |
| ... | ... | ... | ... |

*Full mapping to be completed in Technical Specification*

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing sessions | Medium | High | Maintain session schema compatibility |
| Missing agent files | Low | Critical | Validate all keys before deployment |
| Prompt injection failure | Medium | High | Unit tests for prompt building |
| Phase 8 regression | Low | High | Preserve existing orchestrator |

---

## 9. Success Criteria

- [ ] All 46 phdresearch agents accessible via correct keys
- [ ] Pipeline initializes without errors
- [ ] All agents receive complete prompts with TASK COMPLETION SUMMARY
- [ ] Workflow context correctly injected (Agent #N/45, Previous, Next)
- [ ] DESC episode injection functional
- [ ] Phase 8 FinalStageOrchestrator continues working
- [ ] `npm run lint` passes
- [ ] `npx tsc --noEmit` passes
- [ ] No prohibited patterns (TODO, FIXME, PLACEHOLDER, `as any`)

---

## 10. Next Steps

1. **Create PRD Document** - Detailed requirements following ai-agent-prd.md template
2. **Create Constitution.md** - Binding rules from corerules.md + PRD patterns
3. **Create Functional Specification** - What the system must do
4. **Create Technical Specification** - How to implement it
5. **Create Task Specifications** - Atomic work units
6. **Iterative Review** - Against Constitution until 100% confident
7. **Implementation** - Only after user confirmation

---

## Appendix A: Reference Documents

- `/Users/stevenbahia/Documents/projects/claudeflow-testing/.claude/commands/god-research.md.bak` - Original working prompts
- `/Users/stevenbahia/Documents/projects/claudeflow-testing/docs2/ai-agent-prd.md` - PRD template
- `/Users/stevenbahia/Documents/projects/claudeflow-testing/docs2/prdtospec.md` - Spec development guide
- `/Users/stevenbahia/Documents/projects/claudeflow-testing/docs2/corerules.md` - Core rules
- `/Users/stevenbahia/Documents/projects/claudeflow-testing/docs2/claudeflow.md` - ClaudeFlow methodology

---

**Document Status**: Ready for PRD Development
