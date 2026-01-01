# PhD Pipeline Fix - Project Constitution

**Constitution ID**: CONST-PHD-001
**Version**: 1.0
**Created**: 2026-01-01
**Status**: ACTIVE
**Authority**: This document is IMMUTABLE during implementation. Changes require new version.

---

## Preamble

This Constitution establishes the binding rules, principles, and constraints that govern all implementation work on the PhD Pipeline Fix project. Every code change, specification, and task MUST comply with these rules. Non-compliance is grounds for rejection.

---

## PART I: GOVERNING PRINCIPLES

### PRINCIPLE-01: Intent as Truth

The PRD (PRD-2026-001) is the authoritative source for "what" the system must do. When specifications conflict with PRD intent, PRD wins. When implementation conflicts with specifications, specifications win.

**Hierarchy of Authority**:
1. Constitution (this document) - IMMUTABLE
2. PRD - Requirements truth
3. Functional Specification - What to build
4. Technical Specification - How to build
5. Task Specifications - Atomic work units

### PRINCIPLE-02: Machine-First Readability

All specifications use stable identifiers that enable cross-referencing:

| Type | Format | Example |
|------|--------|---------|
| Requirement | REQ-DOMAIN-## | REQ-KEY-01 |
| User Story | US-## | US-01 |
| Non-Functional | NFR-DOMAIN-## | NFR-CODE-01 |
| Edge Case | EC-## | EC-01 |
| Task | TASK-DOMAIN-### | TASK-CONFIG-001 |
| Rule | RULE-### | RULE-001 |

### PRINCIPLE-03: Context Persistence

All agent work MUST:
1. Read relevant context before starting
2. Store decisions and artifacts in memory
3. Provide explicit guidance for subsequent agents
4. Use TASK COMPLETION SUMMARY format

---

## PART II: ABSOLUTE RULES (NON-NEGOTIABLE)

### Section A: Code Quality Rules

#### RULE-001: No Placeholder Code
```
PROHIBITED:
- TODO comments
- FIXME comments
- PLACEHOLDER comments
- STUB comments
- "Will be implemented later"
- Empty function bodies
- Minimal/scaffold implementations
```

**Enforcement**: grep scan, pre-commit hook
**Consequence**: Immediate rejection

#### RULE-002: No Type Bypass
```
PROHIBITED:
- `as any` casts
- `@ts-ignore` comments
- `@ts-nocheck` comments
- Implicit any (unless tsconfig allows)
```

**Enforcement**: TypeScript strict mode, lint rules
**Consequence**: Immediate rejection

#### RULE-003: No Unsafe Execution
```
PROHIBITED:
- exec() calls (use execFile instead)
- eval() calls
- new Function() from strings
- Shell injection vectors
```

**Enforcement**: grep scan, security review
**Consequence**: Immediate rejection

#### RULE-004: No Hardcoded Dimensions
```
PROHIBITED:
- 768 as embedding dimension (Sprint 8 migration complete)
- Magic numbers without named constants
- Hardcoded paths without configuration
```

**Enforcement**: Pattern search
**Consequence**: Immediate rejection

#### RULE-005: Complete Error Handling
```
REQUIRED:
- All errors MUST be thrown with context
- No silent catch blocks
- No empty catch blocks
- Error messages MUST include:
  - What failed
  - Why it failed (if known)
  - How to fix (if known)
```

**Enforcement**: Code review
**Consequence**: Revision required

#### RULE-006: Type Safety
```
REQUIRED:
- All functions MUST have explicit return types
- All parameters MUST have explicit types
- Interfaces/types for all data structures
- No implicit any
```

**Enforcement**: TypeScript compiler
**Consequence**: Build failure

### Section B: Testing Rules

#### RULE-007: Verification Commands
```
REQUIRED before marking any task complete:

# 1. Prohibited patterns (must return 0 results)
grep -rn "TODO\|FIXME\|PLACEHOLDER\|stub\|not implemented" --include="*.ts" src/

# 2. Type bypass (must return 0 results)
grep -rn "as any" --include="*.ts" src/

# 3. Unsafe exec (must return 0 results)
grep -rn "exec(" --include="*.ts" src/ | grep -v execFile

# 4. Linting
npm run lint

# 5. Type checking
npx tsc --noEmit
```

**Enforcement**: Self-verification checklist
**Consequence**: Task not considered complete

#### RULE-008: Real Tests Only
```
PROHIBITED:
- Mock data in production code
- Fake return values
- Tests that don't actually test functionality
- Skipped tests without documented reason
```

**Enforcement**: Test coverage review
**Consequence**: Immediate rejection

### Section C: Implementation Rules

#### RULE-009: Fully Working Code
```
REQUIRED:
- Every function MUST do what its name says
- Every function MUST be fully implemented
- Code MUST compile without errors
- Code MUST run without errors
```

**Enforcement**: Functional testing
**Consequence**: Revision required

#### RULE-010: Single Responsibility
```
REQUIRED:
- Each function: < 50 lines, single purpose
- Each file: < 500 lines
- Each class: < 100 lines, single concept
```

**Enforcement**: Code review, line count check
**Consequence**: Refactoring required

#### RULE-011: No Breaking Changes
```
REQUIRED:
- phd-cli interface MUST remain unchanged
- Session schema MUST remain compatible
- Existing functionality MUST continue working
```

**Enforcement**: Integration testing
**Consequence**: Immediate rejection

### Section D: Memory Coordination Rules

#### RULE-012: TASK COMPLETION SUMMARY Format
```
REQUIRED output format for all agents:

## TASK COMPLETION SUMMARY

**What I Did**: [1-2 sentence summary]

**Files Created/Modified**:
- `path/to/file.ext` - [Description]

**Memory Locations**:
- `project/namespace/key` - [What it contains]

**Next Agent Guidance**: [What subsequent agents need]
```

**Enforcement**: Prompt template verification
**Consequence**: Memory coordination failure

#### RULE-013: Workflow Context Injection
```
REQUIRED in all agent prompts:

## WORKFLOW CONTEXT
Agent #N/45 | Previous: [agent] (memory: [key]) | Next: [agent] (needs: [what])
```

**Enforcement**: Prompt template verification
**Consequence**: Agent coordination failure

#### RULE-014: Memory Key Naming
```
REQUIRED format:
project/research/[agent-key]/[artifact-type]

Examples:
- project/research/step-back-analyzer/principles
- project/research/dissertation-architect/structure
```

**Enforcement**: Key format validation
**Consequence**: Memory retrieval failure

### Section E: Process Rules

#### RULE-015: Sequential Execution
```
REQUIRED (99.9% of cases):
- Implementation agents execute SEQUENTIALLY
- Each agent completes before next starts
- Memory stored before proceeding
- No parallel implementation
```

**Enforcement**: ClaudeFlow methodology
**Consequence**: Coordination failure

#### RULE-016: Block on Uncertainty
```
REQUIRED:
- If blocked, STOP immediately
- Report: BLOCKED, TASK ID, REASON, NEED
- Do NOT fake implementation
- Do NOT use placeholder code
```

**Enforcement**: Self-reporting
**Consequence**: Audit trail maintained

#### RULE-017: Acceptance Criteria
```
REQUIRED:
- Every task MUST have acceptance criteria
- Every criterion MUST be verifiable
- Task not complete until ALL criteria met
```

**Enforcement**: Definition of Done checklist
**Consequence**: Task rejection

---

## PART III: DOMAIN-SPECIFIC RULES

### Section F: Agent Configuration Rules

#### RULE-018: Agent Key Validity
```
REQUIRED:
- Every key in phd-pipeline-config.ts MUST have corresponding file
- File location: .claude/agents/phdresearch/{key}.md
- No orphan keys (key without file)
- No orphan files (file without key) - unless intentional
```

**Enforcement**: Startup validation
**Consequence**: Pipeline initialization failure

#### RULE-019: Phase Assignment
```
REQUIRED:
- All 46 agents assigned to exactly one phase (1-7)
- Phase order preserved from original .bak
- Agent order within phase preserved
```

**Enforcement**: Configuration review
**Consequence**: Incorrect execution order

#### RULE-020: Prompt Template Requirements
```
REQUIRED in every agent prompt:
1. YOUR TASK section - What to accomplish
2. WORKFLOW CONTEXT - Position in pipeline
3. MEMORY RETRIEVAL - Commands to get context
4. MEMORY STORAGE - Where to store outputs
5. TASK COMPLETION SUMMARY - Output format
```

**Enforcement**: Template validation
**Consequence**: Incomplete agent context

### Section G: Pipeline Operation Rules

#### RULE-021: Session Persistence
```
REQUIRED:
- Sessions persist to .phd-sessions/
- Session ID returned on init
- Session state updated on complete
- Resume from any interruption point
```

**Enforcement**: Session management tests
**Consequence**: Progress loss

#### RULE-022: Phase Transitions
```
REQUIRED:
- Phase N completes before Phase N+1 starts
- All agents in phase complete before transition
- Phase 7 → Phase 8 automatic
```

**Enforcement**: State machine validation
**Consequence**: Incorrect ordering

#### RULE-023: Error Recovery
```
REQUIRED:
- Descriptive error messages
- Clear recovery instructions
- No silent failures
- Session state preserved on error
```

**Enforcement**: Error handling review
**Consequence**: Debugging difficulty

---

## PART IV: SUBAGENT RULES

### Section H: Model Selection

#### RULE-024: Model Assignment
```
REQUIRED model selection by task type:

| Task Type | Model | Rationale |
|-----------|-------|-----------|
| Architecture/Planning | Opus 4.5 | Complex reasoning |
| Code Implementation | Sonnet 4.5 | Balance of speed/quality |
| File Updates/Simple | Haiku 4.5 | Efficiency |
```

**Enforcement**: Task specification review
**Consequence**: Suboptimal resource usage

### Section I: ClaudeFlow Compliance

#### RULE-025: Memory Syntax
```
REQUIRED (positional arguments):
npx claude-flow memory store "<key>" '<json-value>' --namespace "<namespace>"

PROHIBITED (flag-based):
npx claude-flow memory store --key "..." --value "..."
```

**Enforcement**: Command validation
**Consequence**: Memory operation failure

#### RULE-026: Four-Part Context
```
REQUIRED in every subagent prompt:
1. TASK - What to do
2. WORKFLOW CONTEXT - Position, dependencies
3. MEMORY RETRIEVAL - What to read
4. MEMORY STORAGE - What to write
```

**Enforcement**: Prompt template review
**Consequence**: Context loss

---

## PART V: COMPLETION REQUIREMENTS

### Section J: Task Completion Report

#### RULE-027: Completion Report Format
```
REQUIRED format for task completion:

TASK: [Task ID]
STATUS: [COMPLETE / BLOCKED / FAILED]

ACCEPTANCE CRITERIA MET:
- [ ] Criterion 1
- [ ] Criterion 2

CONSTITUTION COMPLIANCE:
- RULE-###: [How code complies]

IMPLEMENTATION:
- Files changed: [list]
- Functions added/modified: [list]

VERIFICATION:
- Prohibited patterns: [PASS/FAIL]
- Lint: [PASS/FAIL]
- Type check: [PASS/FAIL]
- Tests: [X/Y passed]

CLAUDEFLOW:
- Memories left at: [path]
- Next agent should read: [memory key]
```

**Enforcement**: Report validation
**Consequence**: Task not accepted

### Section K: Definition of Done

#### RULE-028: Universal Definition of Done
```
A task is DONE when ALL of the following are true:

□ All acceptance criteria met
□ All relevant RULE-### complied with
□ npm run lint passes
□ npx tsc --noEmit passes
□ No prohibited patterns found
□ TASK COMPLETION SUMMARY provided
□ Memory stored for next agents
□ Completion report submitted
```

**Enforcement**: Checklist verification
**Consequence**: Task remains open

---

## PART VI: AMENDMENT PROCESS

### RULE-029: Constitution Changes
```
This Constitution is IMMUTABLE during the current implementation phase.

To propose changes:
1. Document proposed change with rationale
2. Assess impact on existing work
3. Obtain user approval
4. Create new Constitution version
5. All subsequent work follows new version
```

---

## Appendix: Quick Reference

### Prohibited Patterns (grep checks)
```bash
# Must return 0 results
grep -rn "TODO\|FIXME\|PLACEHOLDER\|stub" --include="*.ts" src/
grep -rn "as any" --include="*.ts" src/
grep -rn "exec(" --include="*.ts" src/ | grep -v execFile
grep -rn "768" --include="*.ts" src/ | grep -i dimension
```

### Required Validations
```bash
npm run lint          # Must pass
npx tsc --noEmit      # Must pass
npm run test          # Must pass
```

### Memory Key Format
```
project/research/{agent-key}/{artifact-type}
```

### TASK COMPLETION SUMMARY
```markdown
## TASK COMPLETION SUMMARY

**What I Did**: [summary]
**Files Created/Modified**: [list]
**Memory Locations**: [keys]
**Next Agent Guidance**: [guidance]
```

---

**END OF CONSTITUTION**

*This Constitution is binding for all implementation work on the PhD Pipeline Fix project (PRD-2026-001).*
