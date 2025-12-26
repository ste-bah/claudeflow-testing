---
description: Deep research using the Universal Self-Learning God Agent with DAI-002 pipeline orchestration
---

Use the Universal Self-Learning God Agent for deep research using the multi-phase PhD research pipeline with 43+ specialized agents available in `.claude/agents/phdresearch/`.

## DAI-002 Integration

This command uses the DAI-002 multi-agent sequential pipeline orchestration:
- **RULE-004**: All agents execute SEQUENTIALLY (no parallel execution)
- **RULE-005**: Memory coordination via InteractionStore (not claude-flow)
- **RULE-007**: Forward-looking prompts with workflow context

For simple research tasks, use:
```bash
npx tsx src/god-agent/universal/cli.ts research "$ARGUMENTS" --json
```

For complex research requiring the full PhD pipeline with 43+ specialized agents, follow the detailed phases below.

**Query**: $ARGUMENTS

---

## CRITICAL INSTRUCTION FOR CLAUDE CODE

**YOU MUST spawn specialized PhD research sub-agents using the Task tool.**

**DO NOT** just call `agent.research()` - that method is a simple placeholder that does NOT orchestrate sub-agents.

**DO** follow the 7-phase pipeline below, spawning each agent SEQUENTIALLY using Task().

---

## Memory System: God Agent InteractionStore

**All agents use God Agent's InteractionStore** (NOT claude-flow):
- **Pre-task hook** automatically injects relevant context from InteractionStore
- **Post-task hook** automatically extracts TASK COMPLETION SUMMARY and stores findings
- Agents MUST emit TASK COMPLETION SUMMARY format for proper memory coordination

---

## Pre-Flight: Initialize

Before spawning any agents:

```bash
mkdir -p docs/research
npx tsx src/god-agent/universal/cli.ts status
```

---

## PHASE 1: FOUNDATION (Agents 1-4)

Execute these agents SEQUENTIALLY (one per message, wait for completion):

### Agent 1/25: step-back-analyzer

```
Task("step-back-analyzer", `
## YOUR TASK
Establish high-level guiding principles for researching: "$ARGUMENTS"

## WORKFLOW CONTEXT
Agent #1/25 | Previous: None | Next: self-ask-decomposer (needs principles)

## DELIVERABLES
1. Core research principles for this topic
2. Success criteria for excellent research
3. Anti-patterns to avoid
4. Evaluation framework

## EXECUTION
1. Analyze the research question deeply
2. Extract fundamental principles
3. Save doc: docs/research/$SLUG/00-principles.md

## TASK COMPLETION SUMMARY (REQUIRED FORMAT)

**What I Did**: [1-2 sentence summary]

**Files Created/Modified**:
- \`docs/research/$SLUG/00-principles.md\` - Research principles

**InteractionStore Entries** (for orchestration):
- Domain: \`research/meta\`, Tags: \`['principles', 'foundation']\` - Core research principles, success criteria, anti-patterns

**ReasoningBank Feedback**:
- Quality: [0-1 based on completeness]

**Next Agent Guidance**: self-ask-decomposer should query domain \`research/meta\` with tag \`principles\`
`, "step-back-analyzer")
```

### Agent 2/25: self-ask-decomposer (WAIT for Agent 1)

```
Task("self-ask-decomposer", `
## YOUR TASK
Decompose "$ARGUMENTS" into 15-20 essential research questions

## WORKFLOW CONTEXT
Agent #2/25 | Previous: step-back-analyzer | Next: research-planner

## CONTEXT RETRIEVAL
Pre-task hook will inject context from domain \`research/meta\` with tag \`principles\`

## DELIVERABLES
1. 15-20 prioritized research questions
2. Confidence assessment for each (0-100%)
3. Knowledge gaps identified
4. Investigation priority order

## EXECUTION
1. Review injected principles context
2. Generate essential questions using Self-Ask methodology
3. Prioritize by importance and feasibility
4. Save doc: docs/research/$SLUG/01-questions.md

## TASK COMPLETION SUMMARY (REQUIRED FORMAT)

**What I Did**: [1-2 sentence summary]

**Files Created/Modified**:
- \`docs/research/$SLUG/01-questions.md\` - Research questions

**InteractionStore Entries** (for orchestration):
- Domain: \`research/meta\`, Tags: \`['questions', 'self-ask']\` - 15-20 prioritized research questions with confidence scores

**Next Agent Guidance**: research-planner should query domain \`research/meta\` with tags \`principles\`, \`questions\`
`, "self-ask-decomposer")
```

### Agent 3/25: research-planner (WAIT for Agent 2)

```
Task("research-planner", `
## YOUR TASK
Create comprehensive ReWOO research plan for: "$ARGUMENTS"

## WORKFLOW CONTEXT
Agent #3/25 | Previous: self-ask-decomposer | Next: dissertation-architect

## CONTEXT RETRIEVAL
Pre-task hook will inject context from domain \`research/meta\`

## DELIVERABLES
1. Complete research roadmap (ReWOO methodology)
2. Task dependency graph
3. Resource requirements
4. Quality gates for each phase

## EXECUTION
1. Review injected context (principles, questions)
2. Plan all research tasks UPFRONT before execution
3. Map dependencies between phases
4. Define quality gates
5. Save doc: docs/research/$SLUG/02-research-plan.md

## TASK COMPLETION SUMMARY (REQUIRED FORMAT)

**What I Did**: [1-2 sentence summary]

**Files Created/Modified**:
- \`docs/research/$SLUG/02-research-plan.md\` - Research plan

**InteractionStore Entries** (for orchestration):
- Domain: \`research/execution\`, Tags: \`['plan', 'rewoo', 'dependencies']\` - Complete research roadmap with task dependencies

**Next Agent Guidance**: dissertation-architect should query domains \`research/meta\`, \`research/execution\`
`, "research-planner")
```

### Agent 4/25: dissertation-architect (WAIT for Agent 3)

```
Task("dissertation-architect", `
## YOUR TASK
Design and LOCK dissertation chapter structure for: "$ARGUMENTS"

## WORKFLOW CONTEXT
Agent #4/25 (PHASE 1 FINAL) | Previous: research-planner | Next: Phase 2 agents

## CONTEXT RETRIEVAL
Pre-task hook will inject context from domains \`research/meta\`, \`research/execution\`

## DELIVERABLES
1. Complete chapter structure (7-12 chapters)
2. Chapter titles and content outline
3. Section breakdown per chapter
4. Page/word targets per section

## STRUCTURE FORMAT
{
  "locked": true,
  "totalChapters": N,
  "chapters": [
    {"number": 1, "title": "Introduction", "sections": ["Background", "Problem Statement", "Research Questions", "Significance"]},
    {"number": 2, "title": "Literature Review", "sections": [...]},
    ...
  ]
}

## CRITICAL
- This structure is LOCKED - all writing agents MUST follow it
- Do not change after Phase 2 begins
- Save doc: docs/research/$SLUG/03-chapter-structure.md

## TASK COMPLETION SUMMARY (REQUIRED FORMAT)

**What I Did**: [1-2 sentence summary]

**Files Created/Modified**:
- \`docs/research/$SLUG/03-chapter-structure.md\` - Chapter structure (LOCKED)

**InteractionStore Entries** (for orchestration):
- Domain: \`research/structure\`, Tags: \`['chapters', 'locked', 'source-of-truth']\` - LOCKED chapter structure JSON

**Next Agent Guidance**: ALL subsequent agents MUST query domain \`research/structure\` with tag \`chapters\` before writing
`, "dissertation-architect")
```

---

## PHASE 2: DISCOVERY (Agents 5-7)

### Agent 5/25: literature-mapper

```
Task("literature-mapper", `
## YOUR TASK
Execute systematic literature search for: "$ARGUMENTS"

## WORKFLOW CONTEXT
Agent #5/25 | Previous: dissertation-architect | Next: systematic-reviewer

## CONTEXT RETRIEVAL
Pre-task hook will inject context from \`research/execution\`, \`research/structure\`

## EXECUTION
1. Use Perplexity for web research: mcp__perplexity__perplexity_research
2. Build citation network
3. Identify key authors and seminal works
4. Map theoretical clusters
5. Save doc: docs/research/$SLUG/04-literature-map.md

## TASK COMPLETION SUMMARY (REQUIRED FORMAT)

**What I Did**: [summary]

**Files Created/Modified**:
- \`docs/research/$SLUG/04-literature-map.md\` - Literature map

**InteractionStore Entries**:
- Domain: \`research/literature\`, Tags: \`['sources', 'citations', 'authors']\` - Literature map with citation network

**Next Agent Guidance**: systematic-reviewer should query domain \`research/literature\`
`, "literature-mapper")
```

### Agent 6/25: systematic-reviewer (WAIT)

```
Task("systematic-reviewer", `
## YOUR TASK
Conduct PRISMA-compliant systematic review of literature for: "$ARGUMENTS"

## WORKFLOW CONTEXT
Agent #6/25 | Previous: literature-mapper | Next: source-tier-classifier

## CONTEXT RETRIEVAL
Pre-task hook will inject context from \`research/literature\`

## EXECUTION
1. Apply inclusion/exclusion criteria
2. Quality assessment of sources
3. Extract key findings
4. Synthesize across studies
5. Save doc: docs/research/$SLUG/05-systematic-review.md

## TASK COMPLETION SUMMARY (REQUIRED FORMAT)

**What I Did**: [summary]

**Files Created/Modified**:
- \`docs/research/$SLUG/05-systematic-review.md\` - Systematic review

**InteractionStore Entries**:
- Domain: \`research/synthesis\`, Tags: \`['systematic-review', 'prisma', 'findings']\` - PRISMA-compliant review findings

**Next Agent Guidance**: source-tier-classifier should query domain \`research/synthesis\`
`, "systematic-reviewer")
```

### Agent 7/25: source-tier-classifier (WAIT)

```
Task("source-tier-classifier", `
## YOUR TASK
Classify all sources into Tier 1/2/3 quality levels

## WORKFLOW CONTEXT
Agent #7/25 (PHASE 2 FINAL) | Previous: systematic-reviewer | Next: Phase 3

## CONTEXT RETRIEVAL
Pre-task hook will inject context from \`research/synthesis\`

## TIER DEFINITIONS
- Tier 1: Peer-reviewed journals, meta-analyses
- Tier 2: Conference papers, government reports
- Tier 3: Grey literature, news sources

## REQUIREMENT
Ensure 80%+ sources are Tier 1/2
Save doc: docs/research/$SLUG/06-source-quality.md

## TASK COMPLETION SUMMARY (REQUIRED FORMAT)

**What I Did**: [summary]

**Files Created/Modified**:
- \`docs/research/$SLUG/06-source-quality.md\` - Source quality assessment

**InteractionStore Entries**:
- Domain: \`research/quality\`, Tags: \`['source-tiers', 'quality-assessment']\` - Source tier classifications

**Next Agent Guidance**: Phase 3 agents should query domains \`research/synthesis\`, \`research/quality\`
`, "source-tier-classifier")
```

---

## PHASE 3: ARCHITECTURE (Agents 8-10)

### Agent 8/25: theoretical-framework-analyst

```
Task("theoretical-framework-analyst", `
## YOUR TASK
Identify and analyze theoretical frameworks for: "$ARGUMENTS"

## WORKFLOW CONTEXT
Agent #8/25 | Previous: source-tier-classifier | Next: contradiction-analyzer

## CONTEXT RETRIEVAL
Pre-task hook will inject context from \`research/synthesis\`, \`research/quality\`

## EXECUTION
1. Identify theoretical frameworks from literature
2. Assess theoretical contributions
3. Map theory relationships
4. Save doc: docs/research/$SLUG/07-theoretical-framework.md

## TASK COMPLETION SUMMARY (REQUIRED FORMAT)

**What I Did**: [summary]

**Files Created/Modified**:
- \`docs/research/$SLUG/07-theoretical-framework.md\`

**InteractionStore Entries**:
- Domain: \`research/theory\`, Tags: \`['frameworks', 'theoretical-grounding']\` - Theoretical framework analysis

**Next Agent Guidance**: contradiction-analyzer should query domain \`research/theory\`
`, "theoretical-framework-analyst")
```

### Agent 9/25: contradiction-analyzer

```
Task("contradiction-analyzer", `
## YOUR TASK
Identify contradictions and inconsistencies in literature for: "$ARGUMENTS"

## WORKFLOW CONTEXT
Agent #9/25 | Previous: theoretical-framework-analyst | Next: risk-analyst

## CONTEXT RETRIEVAL
Pre-task hook will inject context from \`research/theory\`, \`research/synthesis\`

## EXECUTION
1. Identify 10+ contradictions in literature
2. Reconcile with evidence
3. Document conflicting findings
4. Save doc: docs/research/$SLUG/08-contradictions.md

## TASK COMPLETION SUMMARY (REQUIRED FORMAT)

**What I Did**: [summary]

**Files Created/Modified**:
- \`docs/research/$SLUG/08-contradictions.md\`

**InteractionStore Entries**:
- Domain: \`research/contradictions\`, Tags: \`['conflicts', 'inconsistencies']\` - Contradiction analysis

**Next Agent Guidance**: risk-analyst should query domains \`research/theory\`, \`research/contradictions\`
`, "contradiction-analyzer")
```

### Agent 10/25: risk-analyst

```
Task("risk-analyst", `
## YOUR TASK
Conduct FMEA risk analysis for research on: "$ARGUMENTS"

## WORKFLOW CONTEXT
Agent #10/25 (PHASE 3 FINAL) | Previous: contradiction-analyzer | Next: Phase 4

## CONTEXT RETRIEVAL
Pre-task hook will inject context from \`research/theory\`, \`research/contradictions\`

## EXECUTION
1. Identify failure modes
2. Calculate RPN scores
3. Propose mitigations
4. Save doc: docs/research/$SLUG/09-risk-analysis.md

## TASK COMPLETION SUMMARY (REQUIRED FORMAT)

**What I Did**: [summary]

**Files Created/Modified**:
- \`docs/research/$SLUG/09-risk-analysis.md\`

**InteractionStore Entries**:
- Domain: \`research/risks\`, Tags: \`['fmea', 'mitigations', 'rpn']\` - Risk analysis with RPN scores

**Next Agent Guidance**: Phase 4 agents should query all research/* domains
`, "risk-analyst")
```

---

## PHASE 4: SYNTHESIS (Agents 11-13)

### Agent 11/25: evidence-synthesizer

```
Task("evidence-synthesizer", `
## YOUR TASK
Synthesize evidence across studies for: "$ARGUMENTS"

## WORKFLOW CONTEXT
Agent #11/25 | Previous: risk-analyst | Next: pattern-analyst

## TASK COMPLETION SUMMARY (REQUIRED FORMAT)
[Include InteractionStore entry for domain \`research/evidence\`]
`, "evidence-synthesizer")
```

### Agent 12/25: pattern-analyst

```
Task("pattern-analyst", `
## YOUR TASK
Identify patterns and themes across literature for: "$ARGUMENTS"

## WORKFLOW CONTEXT
Agent #12/25 | Previous: evidence-synthesizer | Next: theory-builder

## TASK COMPLETION SUMMARY (REQUIRED FORMAT)
[Include InteractionStore entry for domain \`research/patterns\`]
`, "pattern-analyst")
```

### Agent 13/25: theory-builder

```
Task("theory-builder", `
## YOUR TASK
Construct theoretical framework for: "$ARGUMENTS"

## WORKFLOW CONTEXT
Agent #13/25 (PHASE 4 FINAL) | Previous: pattern-analyst | Next: Phase 5

## TASK COMPLETION SUMMARY (REQUIRED FORMAT)
[Include InteractionStore entry for domain \`research/theory\` with tag \`constructed\`]
`, "theory-builder")
```

---

## PHASE 5: DESIGN (Agents 14-15)

### Agent 14/25: method-designer

```
Task("method-designer", `
## YOUR TASK
Design research methodology for: "$ARGUMENTS"

## WORKFLOW CONTEXT
Agent #14/25 | Previous: theory-builder | Next: sampling-strategist

## TASK COMPLETION SUMMARY (REQUIRED FORMAT)
[Include InteractionStore entry for domain \`research/methods\`]
`, "method-designer")
```

### Agent 15/25: sampling-strategist

```
Task("sampling-strategist", `
## YOUR TASK
Create sampling strategy for: "$ARGUMENTS"

## WORKFLOW CONTEXT
Agent #15/25 (PHASE 5 FINAL) | Previous: method-designer | Next: Phase 6 Writing

## TASK COMPLETION SUMMARY (REQUIRED FORMAT)
[Include InteractionStore entry for domain \`research/sampling\`]
`, "sampling-strategist")
```

---

## PHASE 6: WRITING (Agents 16-21)

**CRITICAL**: All writing agents MUST query domain `research/structure` with tag `chapters` for the LOCKED structure.

### Agent 16/25: introduction-writer

```
Task("introduction-writer", `
## YOUR TASK
Write Introduction chapter for: "$ARGUMENTS"

## WORKFLOW CONTEXT
Agent #16/25 | Previous: sampling-strategist | Next: literature-review-writer

## CRITICAL
Query domain \`research/structure\` for LOCKED chapter structure FIRST

## TASK COMPLETION SUMMARY (REQUIRED FORMAT)
[Include InteractionStore entry for domain \`research/manuscript\` with tag \`introduction\`]

Save to: docs/research/$SLUG/chapters/ch01-introduction.md
`, "introduction-writer")
```

### Agent 17/25: literature-review-writer
### Agent 18/25: methodology-writer
### Agent 19/25: results-writer
### Agent 20/25: discussion-writer
### Agent 21/25: conclusion-writer

(Follow same pattern - query `research/structure`, store to `research/manuscript` with appropriate tags)

---

## PHASE 7: QA (Agents 22-25)

### Agent 22/25: adversarial-reviewer

```
Task("adversarial-reviewer", `
## YOUR TASK
Red team critique of the research on: "$ARGUMENTS"

## WORKFLOW CONTEXT
Agent #22/25 | Previous: conclusion-writer | Next: confidence-quantifier

## PERSONALITY
INTJ + Enneagram 8 - Brutal honesty, challenge everything

## EXECUTION
1. Challenge all assumptions
2. Identify logical weaknesses
3. Find alternative explanations
4. Stress-test all claims (85% confidence threshold)
5. Save critique: docs/research/$SLUG/QA-adversarial-review.md

## TASK COMPLETION SUMMARY (REQUIRED FORMAT)

**What I Did**: [summary]

**Files Created/Modified**:
- \`docs/research/$SLUG/QA-adversarial-review.md\`

**InteractionStore Entries**:
- Domain: \`research/qa\`, Tags: \`['adversarial', 'critique', 'weaknesses']\` - Red team findings

**ReasoningBank Feedback**:
- Quality: [0-1], Outcome: [positive/negative based on research quality]

**Next Agent Guidance**: confidence-quantifier should query domain \`research/qa\`
`, "adversarial-reviewer")
```

### Agent 23/25: confidence-quantifier
### Agent 24/25: citation-validator
### Agent 25/25: consistency-validator

(Follow same pattern with appropriate domains and tags)

---

## OUTPUT STRUCTURE

All outputs go to: `docs/research/[topic-slug]/`

```
docs/research/[topic]/
├── 00-principles.md
├── 01-questions.md
├── 02-research-plan.md
├── 03-chapter-structure.md
├── 04-literature-map.md
├── 05-systematic-review.md
├── 06-source-quality.md
├── 07-theoretical-framework.md
├── 08-contradictions.md
├── 09-risk-analysis.md
├── 10-evidence-synthesis.md
├── 11-patterns.md
├── 12-theory.md
├── 13-methodology.md
├── 14-sampling.md
├── chapters/
│   ├── ch01-introduction.md
│   ├── ch02-literature-review.md
│   ├── ch03-methodology.md
│   ├── ch04-results.md
│   ├── ch05-discussion.md
│   └── ch06-conclusion.md
├── QA-adversarial-review.md
├── QA-confidence-scores.md
├── QA-citation-validation.md
├── QA-consistency-check.md
└── DISSERTATION.md (compiled)
```

---

## INTERACTIONSTORE DOMAIN REFERENCE

```
research/meta              # principles, questions
research/execution         # research plan, dependencies
research/structure         # LOCKED chapter structure (SOURCE OF TRUTH)
research/literature        # sources, citations, authors
research/synthesis         # systematic review findings
research/quality           # source tier classifications
research/theory            # theoretical frameworks
research/contradictions    # conflicts, inconsistencies
research/risks             # FMEA analysis, mitigations
research/evidence          # evidence synthesis
research/patterns          # pattern analysis
research/methods           # research methodology
research/sampling          # sampling strategy
research/manuscript        # chapter drafts (tagged by chapter)
research/qa                # QA findings (adversarial, confidence, citations, consistency)
```

---

## EXECUTION CHECKLIST

- [ ] Create output directory: `mkdir -p docs/research/$SLUG`
- [ ] Phase 1: Foundation (4 agents) - SEQUENTIAL
- [ ] Phase 2: Discovery (3 agents) - SEQUENTIAL
- [ ] Phase 3: Architecture (3 agents) - SEQUENTIAL
- [ ] Phase 4: Synthesis (3 agents) - SEQUENTIAL
- [ ] Phase 5: Design (2 agents) - SEQUENTIAL
- [ ] Phase 6: Writing (6 agents) - SEQUENTIAL
- [ ] Phase 7: QA (4 agents) - SEQUENTIAL
- [ ] Compile final dissertation
- [ ] Provide ReasoningBank feedback for entire workflow

**TOTAL: 25 specialized agents executed sequentially**

---

## HOOKS INTEGRATION

The Claude Code hooks automatically handle memory coordination:

1. **Pre-Task Hook** (`pre-task.sh`):
   - Detects agent type from prompt
   - Queries InteractionStore for relevant domains
   - Injects context into agent prompt

2. **Post-Task Hook** (`post-task.sh`):
   - Parses TASK COMPLETION SUMMARY from agent output
   - Extracts InteractionStore entries (domain, tags, content)
   - Stores findings in InteractionStore
   - Submits quality feedback to ReasoningBank

**Agents do NOT need to manually run memory commands** - emit TASK COMPLETION SUMMARY and hooks handle storage.
