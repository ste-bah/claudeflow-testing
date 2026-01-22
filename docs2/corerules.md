```bash
 SUBAGENT MODEL SELECTION
```

| Task Type                 | Model      | Flag                                 |
| ------------------------- | ---------- | ------------------------------------ |
| GNN Training Architecture | Opus 4.5   | `--model claude-opus-4-5-20251101`   |
| Vector Migration Planning | Opus 4.5   | `--model claude-opus-4-5-20251101`   |
| Code Implementation       | Sonnet 4.5 | `--model claude-sonnet-4-5-20250929` |
| Testing/Linting           | Sonnet 4.5 | `--model claude-sonnet-4-5-20250929` |
| File Updates              | Haiku 4.5  | `--model claude-haiku-4-5-20251001`  |

---

## 🔄 CLAUDEFLOW - SUBAGENT REQUIREMENTS

**ALL SUBAGENTS MUST READ `${CLAUDEFLOW_GUIDE}` BEFORE STARTING ANY WORK.**

### Spawning Subagents:
```bash
claude --model claude-sonnet-4-5-20250929 "
MANDATORY FIRST STEP: Read ${CLAUDEFLOW_GUIDE} and follow its patterns exactly.

[rest of task prompt]
"
```

### Subagent Prompt Template:
```
## CLAUDEFLOW COMPLIANCE (MANDATORY)
1. READ FIRST: ${CLAUDEFLOW_GUIDE}
2. Follow ClaudeFlow patterns for:
   - Task decomposition
   - Memory handoff between agents
   - Error reporting format
   - Completion verification
3. Report ClaudeFlow compliance in your completion report

If ClaudeFlow guide conflicts with other instructions, ClaudeFlow wins.
```

### Subagent Memory Protocol:
Per ClaudeFlow, each subagent MUST:
1. **On Start**: Read memories from location specified by parent agent
2. **During**: Document decisions and state changes
3. **On Complete**: Write memories with:
   4. What was accomplished
   5. What files were changed
   6. What the next agent needs to know
   7. Exact memory path for next agent

---

## ⛔ ANTI-BULLSHIT ENFORCEMENT (NON-NEGOTIABLE)

### PROHIBITED BEHAVIORS - IMMEDIATE FAILURE:
```
❌ TODO/PLACEHOLDER/STUB/FIXME comments
❌ Empty or minimal function implementations
❌ Scaffold-only code without logic
❌ Fake/mock data in production code
❌ Hardcoded return values instead of computed results
❌ try/catch that swallow errors silently
❌ Functions that exist but don't work
❌ Unused imports or dead code
❌ "Will be implemented later"
❌ `as any` casts
❌ exec() calls (use execFile)
❌ 768D hardcoded values (Sprint 8 migration)
```

### REQUIRED BEHAVIORS - EVERY TASK:
```
✅ FULLY WORKING code - no partial implementations
✅ REAL error handling - throw/raise with context
✅ REAL tests against REAL functionality
✅ Code MUST compile/run without errors
✅ Code MUST pass linting
✅ Every function MUST do what its name says
✅ If blocked, STOP and report WHY
✅ Must satisfy acceptance criteria in task doc
✅ Must comply with relevant RULE-* from constitution
```

---

## 🔍 SELF-VERIFICATION CHECKLIST

Before marking ANY task complete:

```bash
# 1. Prohibited patterns - must return 0 results
grep -rn "TODO\|FIXME\|PLACEHOLDER\|stub\|not implemented" --include="*.ts" --include="*.js" ${SRC_DIR}/
grep -rn "as any" --include="*.ts" ${SRC_DIR}/
grep -rn "exec(" --include="*.ts" --include="*.js" ${SRC_DIR}/ | grep -v execFile

# 2. Sprint 8 specific - no 768D hardcoding after migration
grep -rn "768" --include="*.ts" ${SRC_DIR}/ | grep -i dimension

# 3. Linting
npm run lint

# 4. Type checking
npx tsc --noEmit

# 5. Tests
npm run test
```

---

## 📜 CONSTITUTION ENFORCEMENT

`${CONSTITUTION}` contains 111 binding rules.

1. **Read constitution BEFORE writing any code**
2. Every code change MUST comply with relevant rules
3. If constitution conflicts with task, **STOP** and alert me
4. Quote specific RULE-\* when making decisions

---

## 🚨 ERROR HANDLING

All failures must immediately halt and log:
- What failed
- Full diagnostic context  
- Enough info to fix

**NO silent failures. NO swallowed exceptions.**

---

## 🛑 WHAT TO DO WHEN STUCK

1. **STOP immediately** - no placeholder code
2. **Report:**
```
BLOCKED: [Task ID from TASKS-VEC-001 or TASKS-GNN-TRAINING]
SPRINT: [8 or 9]
REASON: [Specific technical reason]
NEED: [What you need to proceed]
```
3. **Do not fake it**

---

## 📋 TASK COMPLETION REPORT FORMAT

```
TASK: [Task ID]
SPRINT: [8-VEC / 9-GNN-TRAINING]
STATUS: [COMPLETE / BLOCKED / FAILED]

ACCEPTANCE CRITERIA MET:
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

CONSTITUTION COMPLIANCE:
- RULE-*: [How code complies]

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
- Next agent should read: [memory path]
- Context for next agent: [summary]
```