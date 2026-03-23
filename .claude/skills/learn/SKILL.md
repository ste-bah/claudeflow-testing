---
name: learn
description: Self-directed research on a topic via web search. Stores key takeaways in MemoryGraph. Can auto-select topics based on knowledge gaps. Use with /loop for autonomous background learning.
---

# Learn — Self-Directed Research

Research a topic via web search and store key findings in MemoryGraph.

## Input

- With argument: `/learn Zod schema validation patterns` — research that topic
- Without argument: auto-select a topic based on knowledge gaps

## Auto-Topic Selection (when no argument)

Only activate auto-selection when MemoryGraph has 10+ memories. Otherwise use seed topics.

### Selection logic:
1. Call `mcp__memorygraph__get_memory_statistics` to check memory count
2. If 10+ memories: call `mcp__memorygraph__search_memories` with limit 50, group by tags, find project technologies with few memories
3. Prioritize topics relevant to active projects (Market Terminal, TLA, persistent memory system)
4. Avoid topics already tagged `self-learned` in the last 24 hours

### Seed topics (fallback when <10 memories or no clear gaps):
- FalkorDB Cypher query optimization
- LanceDB advanced filtering and indexing
- TypeScript MCP server best practices
- FastAPI async patterns and performance
- React hook testing patterns with Vitest
- Terraform provider development patterns

## Research Execution

### Step 0: Check budget
Read `.persistent-memory/learn-session-count.txt`. If it exists and was modified less than 1 hour ago, parse the number. If >= 3, say "Learning budget reached (3/3 this session). Resume next session." and STOP — do not proceed to Step 1.

If the file doesn't exist or is older than 1 hour, the count is 0 (new session).

### Step 1: Search (max 3 queries)
Use `WebSearch` with targeted queries. Example:
```
WebSearch: "FalkorDB Cypher query optimization best practices 2026"
```

If the first search returns good results, don't search again. Only use additional searches if the first was too broad or missed the mark.

### Step 2: Deep read (max 1 fetch)
Pick the most relevant search result and use `WebFetch` to read it:
```
WebFetch: url="https://...", prompt="Extract the 3-5 most important practical takeaways about [topic]. Focus on actionable insights, not theory."
```

### Step 3: Extract takeaways
From the search results and fetched content, identify 3-5 key takeaways that are:
- Actionable (can be applied in code or architecture decisions)
- Non-obvious (not things any developer would already know)
- Relevant to our projects (Market Terminal, TLA, persistent memory, god-agent)

### Step 4: Store in MemoryGraph
Call `mcp__memorygraph__store_memory` with:
- **type**: `technology`
- **title**: `Self-learned: [topic]`
- **content**: 3-5 bullet point takeaways (max 800 chars). Include source URL at the end.
- **tags**: `["self-learned", "[topic-tag-1]", "[topic-tag-2]"]`
- **importance**: 0.3 (self-learned starts low, grows if accessed)

### Step 5: Log
Append to `.persistent-memory/learn-log.jsonl`:
```json
{"timestamp":"ISO","topic":"[topic]","auto_selected":true/false,"source_url":"...","memory_id":"..."}
```

### Step 6: Increment budget counter
Read the current count from `.persistent-memory/learn-session-count.txt` (default 0 if missing or stale).
Write the incremented count back: `echo "N" > .persistent-memory/learn-session-count.txt`

### Step 7: Report
One line: `Learned: [topic] — [single most important takeaway] (N/3 this session)`

## Session Budget

Maximum 3 `/learn` invocations per session. If budget is exhausted, say: "Learning budget reached (3/3 this session). Resume next session."

Track count in `.persistent-memory/learn-session-count.txt`. Reset on each session start (file older than 1 hour = reset).

## Rules

- Max 3 WebSearch calls per invocation
- Max 1 WebFetch call per invocation
- Max 800 chars stored per memory (concise takeaways, not articles)
- All self-learned memories tagged with `self-learned`
- Importance starts at 0.3 (below user-stated knowledge)
- Never store copyrighted content verbatim — summarize and attribute source URL
- Never learn about the memory system itself
- Do NOT modify CLAUDE.md
- If WebSearch returns nothing useful, say so honestly and don't store a memory
