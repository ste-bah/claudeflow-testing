# PhD Pipeline Documentation

**Version**: 1.0.0
**Last Updated**: 2026-01-01
**Status**: Production

---

## Overview

The PhD Pipeline is a multi-agent orchestration system designed for comprehensive academic research. It coordinates **46 specialized agents** across **7 phases** (plus Phase 8 for final assembly), guiding research from initial problem decomposition through final dissertation synthesis.

### Key Features

- **46 Specialized Research Agents**: Each agent has a specific role in the research process
- **7 Sequential Phases**: Foundation, Literature, Analysis, Synthesis, Methods, Writing, Quality
- **Phase 8 Final Assembly**: FinalStageOrchestrator combines all outputs into a coherent dissertation
- **Memory Coordination**: ClaudeFlow memory system enables agent-to-agent data passing
- **99.9% Sequential Execution**: Agents execute in strict order per RULE-015

---

## Architecture Diagram

```
+===========================================================================+
|                           PHD PIPELINE ARCHITECTURE                        |
+===========================================================================+

   PHASE 1: FOUNDATION (6 agents)
   +-------------------------------------------------------------------+
   | self-ask-decomposer -> step-back-analyzer -> ambiguity-clarifier  |
   |          -> construct-definer -> theoretical-framework-analyst    |
   |                        -> research-planner                        |
   +-------------------------------------------------------------------+
                                    |
                                    v
   PHASE 2: LITERATURE (5 agents)
   +-------------------------------------------------------------------+
   | literature-mapper -> source-tier-classifier -> methodology-scanner|
   |          -> context-tier-manager -> systematic-reviewer           |
   +-------------------------------------------------------------------+
                                    |
                                    v
   PHASE 3: ANALYSIS (6 agents)
   +-------------------------------------------------------------------+
   | quality-assessor -> contradiction-analyzer -> bias-detector       |
   |        -> risk-analyst -> evidence-synthesizer -> gap-hunter      |
   +-------------------------------------------------------------------+
                                    |
                                    v
   PHASE 4: SYNTHESIS (6 agents)
   +-------------------------------------------------------------------+
   | pattern-analyst -> thematic-synthesizer -> theory-builder         |
   |   -> hypothesis-generator -> model-architect -> opportunity-identifier|
   +-------------------------------------------------------------------+
                                    |
                                    v
   PHASE 5: METHODS (6 agents)
   +-------------------------------------------------------------------+
   | method-designer -> sampling-strategist -> instrument-developer    |
   |       -> analysis-planner -> ethics-reviewer -> validity-guardian |
   +-------------------------------------------------------------------+
                                    |
                                    v
   PHASE 6: WRITING (8 agents)
   +-------------------------------------------------------------------+
   | dissertation-architect -> abstract-writer -> introduction-writer  |
   |   -> literature-review-writer -> methodology-writer -> results-writer|
   |            -> discussion-writer -> conclusion-writer              |
   +-------------------------------------------------------------------+
                                    |
                                    v
   PHASE 7: QUALITY (9 agents)
   +-------------------------------------------------------------------+
   | apa-citation-specialist -> citation-extractor -> citation-validator|
   |   -> adversarial-reviewer -> confidence-quantifier                |
   |   -> reproducibility-checker -> consistency-validator             |
   |        -> file-length-manager -> chapter-synthesizer              |
   +-------------------------------------------------------------------+
                                    |
                                    v
   PHASE 8: FINAL ASSEMBLY
   +-------------------------------------------------------------------+
   |                    FinalStageOrchestrator                         |
   |  - Scans all agent outputs                                        |
   |  - Maps outputs to chapters semantically                          |
   |  - Synthesizes final dissertation                                 |
   |  - Generates table of contents                                    |
   +-------------------------------------------------------------------+
                                    |
                                    v
                        [Final Dissertation Output]
```

---

## Quick Start Guide

### Prerequisites

1. Node.js 18+ installed
2. ClaudeFlow installed (`npm install -g claude-flow` or use `npx`)
3. Project initialized with `.claude/agents/phdresearch/` directory

### Initialize a New Research Session

```bash
# Initialize the pipeline with a research topic
npx phd-cli init "Your research topic here"

# Example:
npx phd-cli init "impact of artificial intelligence on healthcare outcomes"
```

This returns a session ID (e.g., `a1b2c3d4-e5f6-...`).

### Execute Agents Sequentially

```bash
# Get the next agent to execute
npx phd-cli next <session-id>

# Example:
npx phd-cli next a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Mark Agent Complete and Advance

```bash
# Mark current agent as complete
npx phd-cli complete <session-id>

# With JSON output:
npx phd-cli complete <session-id> --json
```

### Check Session Status

```bash
# Get current session status
npx phd-cli status <session-id>

# With JSON output for scripting:
npx phd-cli status <session-id> --json
```

### Validate Agent Configuration

```bash
# Verify all 46 agent files exist
npx phd-cli validate-agents

# With verbose output:
npx phd-cli validate-agents --verbose
```

---

## Directory Structure

```
project-root/
+-- .claude/
|   +-- agents/
|       +-- phdresearch/           # 46 agent definition files
|           +-- self-ask-decomposer.md
|           +-- step-back-analyzer.md
|           +-- ... (44 more agents)
+-- .phd-sessions/                 # Session state files
|   +-- <session-id>.json
+-- docs/
|   +-- research/
|       +-- <topic-slug>/          # Research outputs per topic
|           +-- 01-self-ask-decomposer.md
|           +-- 02-step-back-analyzer.md
|           +-- ...
|           +-- 05-chapter-structure.md
|           +-- final/             # Phase 8 outputs
|               +-- chapters/
|               +-- final-paper.md
+-- src/
    +-- god-agent/
        +-- cli/
            +-- phd-cli.ts              # Main CLI implementation
            +-- phd-pipeline-config.ts  # Agent and phase definitions
            +-- final-stage/            # Phase 8 orchestrator
```

---

## Related Documentation

| Document | Description |
|----------|-------------|
| [AGENTS.md](./AGENTS.md) | Complete reference of all 46 agents |
| [PHASES.md](./PHASES.md) | Detailed phase documentation |
| [CLI-REFERENCE.md](./CLI-REFERENCE.md) | Full CLI command reference |
| [MEMORY-INTEGRATION.md](./MEMORY-INTEGRATION.md) | Memory coordination guide |

---

## Constitution Compliance

The PhD Pipeline adheres to the following Constitution rules:

| Rule | Description |
|------|-------------|
| RULE-015 | 99.9% Sequential execution - agents execute in order |
| RULE-018 | Agent Key Validity - all keys must have corresponding files |
| RULE-019 | Phase Assignment - all 46 agents assigned to exactly one phase |
| RULE-020 | Prompt Template Requirements - 5-part prompts for all agents |
| RULE-021 | Session Persistence - sessions stored in `.phd-sessions/` |
| RULE-022 | Phase Transitions - Phase N completes before Phase N+1 |
| RULE-025 | Memory Syntax - positional arguments for memory commands |

---

## Support

For issues or questions:

1. Check the detailed documentation in this directory
2. Review agent files in `.claude/agents/phdresearch/`
3. Examine session state in `.phd-sessions/<session-id>.json`
4. Run `npx phd-cli validate-agents --verbose` to verify configuration
