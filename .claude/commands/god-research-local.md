---
description: Local-only research (Phase 9 REPORT/ANSWER only). No web tools allowed.
---

# god-research-local

Use the PhD Pipeline CLI (`phd-cli`) in **local** mode. This mode is **Phase 9-only**: it runs local REPORT + ANSWER against the on-disk corpus and produces artifacts under `docs/research/<slug>/phase9/`.

**Query**: $ARGUMENTS

---

## MODE: LOCAL (NON-NEGOTIABLE)

- External tools are **PROHIBITED** (no WebSearch, WebFetch, Perplexity, etc.)
- The programmatic tool gate enforces this restriction at the session level
- Do NOT attempt to run the 46-agent pipeline. Local mode ends after Phase 9.

---

## WHAT THIS MODE PROVIDES

### Phase 9 REPORT
- **Coverage Grade**: NONE | LOW | MED | HIGH (how well corpus covers query)
- **Retrieved Chunks**: Semantic search results from local vector DB
- **Knowledge Units (KUs)**: Extracted facts and definitions
- **Reasoning Edges (RUs)**: Causal and relational links
- **Gap Analysis**: What the corpus cannot answer

### Phase 9 ANSWER
- **Grounded Synthesis**: Answers backed by local evidence only
- **Claim-Evidence Structure**: Each claim traces to corpus sources
- **Provenance Separation**: All sources are local (ku_*, ru_*, doc:line)

---

## AGENT CAPABILITIES (GAP-A01)

In local mode, only agents with `canRunLocalOnly: true` are permitted:

| Agent | Phase | Purpose |
|-------|-------|---------|
| step-back-analyzer | 1 | Foundation reasoning |
| self-ask-decomposer | 1 | Query decomposition |
| construct-definer | 1 | Key construct definition |
| theoretical-framework-analyst | 2 | Framework analysis |
| evidence-synthesizer | 2 | Evidence synthesis |
| contradiction-analyzer | 2 | Contradiction detection |
| thematic-synthesizer | 3 | Theme synthesis |
| theory-builder | 3 | Theory construction |
| dissertation-architect | 3 | Structure planning |
| methodology-writer | 5 | Method design |
| adversarial-reviewer | 7 | Adversarial review |
| consistency-validator | 7 | Consistency checking |

---

## EXECUTION PROTOCOL

### Step 1: Initialize (runs Phase 9 immediately)

```bash
npx tsx src/god-agent/cli/phd-cli.ts init "$ARGUMENTS" --data-source local --json
```

This will:
1. Create a new session with `dataSourceMode: "local"`
2. Set `toolPermissions: { webSearch: false, webFetch: false, perplexity: false }`
3. Run Phase 9 REPORT against local corpus
4. Store coverage grade for agent prompt injection
5. Return session ID and first agent details

### Step 2: Review REPORT Output

Check the Phase 9 REPORT for coverage:
- `docs/research/<slug>/phase9/report.json`
- `docs/research/<slug>/phase9/report_summary.md`

### Step 3: Run ANSWER (if coverage permits)

If coverage grade is MED or HIGH, proceed with Phase 9 ANSWER:

```bash
python3 scripts/interaction/answer.py --query "$ARGUMENTS" --enable_synthesis --format json
```

### Step 4: Validate Provenance (Optional)

Ensure all claims have local-only provenance:

```bash
python3 scripts/interaction/validate_provenance.py --answer docs/research/<slug>/phase9/answer.json --strict
```

---

## TOOL PERMISSIONS (Programmatic Gate)

The session manager enforces tool restrictions programmatically:

```typescript
// From session-manager.ts
if (dataSourceMode === 'local') {
  return {
    webSearch: false,
    webFetch: false,
    perplexity: false
  };
}
```

Any attempt to use external tools will be blocked at the session level.

---

## OUTPUT ARTIFACTS

All outputs go to `docs/research/<slug>/phase9/`:

- `report.json` - Full Phase 9 REPORT
- `report_summary.md` - Human-readable coverage summary
- `answer.json` - Phase 9 ANSWER with claims
- `answer_final.md` - Synthesized narrative answer

---

## WHEN TO USE LOCAL MODE

- Your corpus is comprehensive for the research topic
- You need reproducible, corpus-grounded answers
- External sources could contaminate results
- You're testing corpus coverage quality
- Compliance requires local-only data sources
