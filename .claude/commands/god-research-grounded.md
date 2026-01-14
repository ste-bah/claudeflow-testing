---
description: Grounded research - Local corpus as authoritative ground truth + Perplexity external enrichment with strict provenance separation.
---

# god-research-grounded

**Query**: $ARGUMENTS

## Mission

Run the PhD research pipeline in **grounded enrichment** mode:

1. **ALWAYS** run Phase 9 REPORT first (local corpus = ground truth)
2. **ALWAYS** supplement with Perplexity for external context
3. Local sources are AUTHORITATIVE - external sources ENRICH but don't override
4. Strict provenance separation between local and external

---

## MODE PHILOSOPHY

```
┌─────────────────────────────────────────────────────────────┐
│                    GROUNDED ENRICHMENT                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   LOCAL CORPUS (Ground Truth)     EXTERNAL (Enrichment)     │
│   ─────────────────────────       ──────────────────────    │
│   • Aristotle primary texts       • Modern interpretations   │
│   • Scholarly commentary          • Recent scholarship       │
│   • Your curated PDFs             • Cross-domain connections │
│   • Knowledge Units (KUs)         • Contemporary debates     │
│   • Reasoning Edges               • State-of-the-art views   │
│                                                              │
│   AUTHORITATIVE WEIGHT: 1.0       ENRICHMENT WEIGHT: 0.7    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## EXECUTION PROTOCOL

### Step 1: Initialize Session (Grounded Mode)

```bash
npx tsx src/god-agent/cli/phd-cli.ts init "$ARGUMENTS" --data-source hybrid --json
```

**Override tool permissions manually** - in grounded mode, Perplexity is ALWAYS allowed:

```json
{
  "toolPermissions": {
    "webSearch": false,
    "webFetch": false,
    "perplexity": true
  }
}
```

### Step 2: Run Phase 9 REPORT (Local Ground Truth)

Read the local corpus findings:
```bash
cat docs/research/<slug>/phase9/report.json | jq '.retrieval.phase4_payload.results | length'
```

**This establishes your ground truth:**
- Retrieved chunks from corpus PDFs
- Matched Knowledge Units
- Reasoning edges

### Step 3: Perplexity Enrichment

Use the `mcp__perplexity__perplexity_research` tool to gather external context:

```
Query: "[Original query] - seeking modern scholarly perspectives and recent developments"
```

**Perplexity provides:**
- Contemporary academic interpretations
- Recent journal articles and books
- Cross-disciplinary connections
- State-of-the-art debates

### Step 4: Synthesis with Provenance Separation

Structure your answer with clear provenance:

```markdown
## Answer

### From Local Corpus (Ground Truth)

[Claims supported by local corpus]

**Local Provenance:**
- ku_00ddb2542e3d3dfa: "Phantasiai are not logically dependent on the resulting action..."
  - Source: Nussbaum (1985), pp. 50-52
- chunk_11fdf613d40f9939:00006: "Phantasia is known by like..."
  - Source: White (1985), pp. 11-12

### External Enrichment (Perplexity)

[Claims from external sources - these ENRICH but don't override local]

**External Provenance:**
- https://example.com/article: "Recent scholarship suggests..."
  - Reason: Contemporary interpretation not in corpus
- https://example.com/paper: "2024 developments show..."
  - Reason: Recency - published after corpus compilation

### Integrated Synthesis

[Where local and external agree/disagree, local is authoritative]
```

---

## PROVENANCE RULES

### Local Sources (Authoritative)
| Prefix | Type | Weight |
|--------|------|--------|
| `ku_*` | Knowledge Unit | 1.0 |
| `ru_*` | Reasoning Unit | 1.0 |
| `chunk_*` | Document chunk | 1.0 |
| `edge_*` | Reasoning edge | 1.0 |

### External Sources (Enrichment)
| Source | Type | Weight |
|--------|------|--------|
| Perplexity | Research | 0.7 |
| WebSearch | Discovery | 0.5 |
| WebFetch | Verification | 0.6 |

### Conflict Resolution
When local and external sources conflict:
1. **Local wins** - it's your curated ground truth
2. **Note the disagreement** - valuable for research
3. **External provides context** - why the debate exists

---

## PERPLEXITY INTEGRATION

### Research Query Pattern

```python
# Use perplexity_research for deep research
messages = [
    {
        "role": "system",
        "content": "You are a scholarly research assistant. Provide academic perspectives with citations."
    },
    {
        "role": "user",
        "content": f"""
Research query: {query}

I have local corpus findings on this topic. I need external scholarly enrichment:
1. Contemporary academic interpretations
2. Recent publications (2020-2026)
3. Cross-disciplinary perspectives
4. Ongoing debates in the field

Provide sources with URLs where possible.
"""
    }
]
```

### Quick Lookup Pattern

```python
# Use perplexity_ask for quick facts
messages = [
    {"role": "user", "content": f"What is the current scholarly consensus on {topic}?"}
]
```

---

## EXAMPLE: Aristotle + AI Query

**Query**: "How do modern AI systems implement something analogous to Aristotle's phantasia?"

### Step 1: Local Ground Truth
```
Retrieved from corpus:
- White (1985): Phantasia in De Anima III.3-8
- Frede (1992): Cognitive Role of Phantasia
- Nussbaum (1985): Phantasia and Action

Key local claims:
- Phantasia mediates between perception and thought
- Not identical to perception or belief
- Enables action by presenting objects as desirable
```

### Step 2: Perplexity Enrichment
```
External findings:
- Modern AI "imagination" in generative models (2024)
- Dreamer/World Models research (Hafner et al.)
- Predictive processing frameworks
- Embodied cognition parallels
```

### Step 3: Grounded Synthesis
```
LOCAL (Ground Truth): Aristotle's phantasia is a cognitive capacity that...
[supported by ku_*, chunk_*]

EXTERNAL (Enrichment): Contemporary AI research echoes this with...
[supported by URLs from Perplexity]

INTEGRATION: The parallel suggests that...
[synthesis noting which claims are local vs external]
```

---

## OUTPUT FORMAT

Every grounded research output MUST include:

```markdown
# Research: [Query]

## Methodology
- Mode: Grounded Enrichment
- Local Corpus: [X chunks, Y KUs, Z edges]
- External Source: Perplexity Research

## Local Corpus Findings (Ground Truth)

### Key Claims
1. [Claim] — ku_xxx / chunk_xxx
2. [Claim] — ku_xxx / chunk_xxx

### Source Documents
- Author (Year): Title, pages
- Author (Year): Title, pages

## External Enrichment (Perplexity)

### Contemporary Perspectives
1. [Claim] — URL
2. [Claim] — URL

### Recent Developments
- [Finding] — URL (2024)
- [Finding] — URL (2025)

## Integrated Answer

[Synthesis where LOCAL is authoritative, EXTERNAL enriches]

## Provenance Ledger

| Claim | Local Source | External Source | Authority |
|-------|--------------|-----------------|-----------|
| ... | ku_xxx | URL | Local |
| ... | — | URL | External |
| ... | chunk_xxx | URL | Both (local primary) |
```

---

## WHEN TO USE GROUNDED MODE

- You have a curated local corpus you trust
- You want external context but NOT to override your sources
- Research requires both historical depth AND contemporary relevance
- You need strict provenance tracking
- Scholarly rigor with modern enrichment

---

## COMPARISON

| Feature | Local | Hybrid | Grounded | External |
|---------|-------|--------|----------|----------|
| Local Corpus | Always | First | **Always (Authoritative)** | Optional |
| External Tools | Never | Conditional | **Always (Perplexity)** | Always |
| Local Authority | 1.0 | 1.0 | **1.0 (Primary)** | 0.5 |
| External Authority | N/A | 0.7 | **0.7 (Enrichment)** | 1.0 |
| Provenance Separation | N/A | Required | **Required + Weighted** | Optional |
