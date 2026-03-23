---
name: recall
description: Search all memory stores for context relevant to a topic or task. Queries MemoryGraph (keywords + fuzzy) and LanceDB (semantic vectors) and presents results in labeled sections.
---

# Recall — Cross-Store Memory Search

Search all available memory stores for context relevant to the given query.

## Input

The user provides a query after `/recall`, e.g.:
```
/recall authentication timeout handling
/recall XSS prevention patterns
/recall src/api/routes/watchlist.py
```

If no query is provided, ask: "What topic should I search for?"

## Search Strategy

Run these searches. Call them all before presenting results (do not wait between calls):

### Search 1: MemoryGraph keyword search
Call `mcp__memorygraph__search_memories` with:
- `query`: the user's query
- `limit`: 10
- `search_tolerance`: "normal"

This finds memories by keyword and tag matching. Best for exact terms, acronyms, file paths.

### Search 2: MemoryGraph fuzzy recall
Call `mcp__memorygraph__recall_memories` with:
- `query`: the user's query
- `limit`: 10

This finds memories by natural language fuzzy matching. Best for conceptual queries like "how does auth work" where exact keywords may not match.

### Search 3: LanceDB semantic search (if available)
Call `mcp__lancedb-memory__retrieve_context` with:
- `query`: the user's query
- `limit`: 5
- `token_budget`: 1500

This finds memories by vector similarity. Best for finding related content even when no keywords overlap.

If LanceDB MCP is not connected, skip this search and note: "(LanceDB not available — keyword search only)"

## Present Results

Present results in two labeled sections. Do NOT attempt to merge or deduplicate across stores — they return different data structures.

```
## MemoryGraph Results (N found)
1. **[title]** (importance: X.XX, type: Y)
   [first 80 chars of content]
   Tags: [tags]
   Relationships: [N] linked memories

2. ...

## Vector Search Results (N found)
1. **[title]** (similarity: X.XX, importance: Y.YY)
   [content snippet]

2. ...

## No Results
If both searches return nothing: "No relevant memories found for '[query]'."
```

## Rules

- This is a READ-ONLY operation. Do NOT store any memories.
- Do NOT modify any files.
- If one store returns nothing, still show results from the other.
- Keep output concise — show top 5 from each store, not all results.
