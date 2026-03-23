---
name: session-summary
description: Store a summary of the current session to MemoryGraph before exiting. Complements the automatic Stop hook (which writes a plain file) by persisting the summary to the graph store with relationships and tags.
---

# Session Summary

Store a structured summary of this session to MemoryGraph. The Stop hook already writes a plain-text summary to `.persistent-memory/last-session-summary.txt` — this skill persists it to MemoryGraph where it can be searched, linked, and included in future briefings.

## What to do

### 1. Reflect on the session (best-effort)

From what you can see in the conversation context, identify:
- What was the main task or topic?
- What key decisions were made?
- What was accomplished (files created/modified, tests passing, etc.)?
- What is pending or unfinished?

NOTE: This is best-effort based on what's visible in your current context. Long sessions or sessions with many files may have incomplete coverage. State what you know, don't fabricate.

### 2. Check for Stop hook data

Read `.persistent-memory/last-session-summary.txt` if it exists. It may contain the last assistant message from a prior session that was not yet stored.

### 3. Store the summary memory

Call `mcp__memorygraph__store_memory` with:
- **type**: `general`
- **title**: `Session summary: [YYYY-MM-DD] — [brief 5-word topic]`
- **content**: A concise summary (<500 chars) covering: what was done, key decisions, what's pending
- **tags**: `["session-summary", "[primary project name]", "[YYYY-MM-DD]"]`
- **importance**: 0.7

### 4. Create relationships (best-effort)

If you can identify specific memories that were recalled or stored during this session (by their titles or IDs visible in the conversation), create RELATED_TO relationships between the session summary and those memories.

If you can't identify specific memories, skip this step. Do not guess.

### 5. Report

Print a one-line confirmation:
```
Session summary stored: [memory_id] — "[title]"
```

## Rules

- Do NOT clear the `consolidation-pending` flag (that's for /memory-garden's 5-stage cycle)
- Do NOT store memories about the memory system itself
- Do NOT modify CLAUDE.md
- Keep content under 500 characters — this is a summary, not a transcript
- If nothing significant happened in the session, say so and don't store a memory
