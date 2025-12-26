---
description: Store knowledge directly in the Universal Self-Learning God Agent
---

Store knowledge directly in the Universal Self-Learning God Agent for future retrieval. This allows you to:
1. Add facts, patterns, procedures, or insights
2. Tag knowledge for better retrieval
3. Build domain expertise manually
4. Prime the agent with important information

**Knowledge:** $ARGUMENTS

Execute the God Agent CLI to store knowledge:

```bash
npx tsx src/god-agent/universal/cli.ts learn "$ARGUMENTS"
```

**Options** (add to the command):
- `--domain patterns` - Domain namespace (default: "general")
- `--category pattern` - Category: fact, pattern, procedure, example, insight
- `--tags "design,factory"` - Comma-separated tags for filtering

**Examples:**
```bash
# Store a simple fact
npx tsx src/god-agent/universal/cli.ts learn "REST APIs should use proper HTTP status codes"

# Store with metadata
npx tsx src/god-agent/universal/cli.ts learn "Factory pattern enables flexible object creation" --domain patterns --category pattern --tags "design,factory,creational"

# Store from a file
npx tsx src/god-agent/universal/cli.ts learn --file ./docs/learnings.md --domain "project/docs" --category fact
```

The knowledge will be:
- Embedded into the vector database
- Tagged for retrieval (auto-extracted or specified)
- Available for future queries
- Contributing to domain expertise

**Query stored knowledge:**
```bash
npx tsx src/god-agent/universal/cli.ts query --domain "patterns" --tags "factory" --limit 5
```
