---
description: Hybrid research (Phase 9 local-first + conditional external supplementation with strict provenance separation).
---

# god-research-hybrid

**Query**: $ARGUMENTS

## Mission

Run the PhD research pipeline in **hybrid** mode:

1. Always run **Phase 9 REPORT** first (local corpus)
2. Use coverage grade + query intent to decide if external tools are allowed
3. If external supplementation is used, it **MUST** be explicitly labeled and separated from local provenance

---

## HYBRID MODE DECISION LOGIC (GAP-H01, GAP-H03)

The programmatic tool gate uses this decision tree:

```
                           ┌─────────────────┐
                           │  Hybrid Mode    │
                           └────────┬────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
           Coverage Grade?                  Query Intent?
                    │                               │
        ┌───────────┴───────────┐      ┌───────────┴───────────┐
        ▼                       ▼      ▼                       ▼
    NONE/LOW               MED/HIGH  Recency?           Outside Corpus?
        │                       │      │                       │
        ▼                       │      ▼                       ▼
    ALLOW EXTERNAL              │  Yes → ALLOW             Yes → ALLOW
                                │  No  ↓                   No  ↓
                                │      └───────────────────────┘
                                │                │
                                └────────────────┴─────────────────┐
                                                                   ▼
                                                        DENY EXTERNAL
                                                        (use local only)
```

---

## QUERY INTENT ANALYSIS (GAP-H03)

The query intent analyzer detects:

### Temporal Markers (triggers external)
- `latest`, `recent`, `current`, `emerging`, `2024`, `2025`, `2026`
- `state-of-the-art`, `cutting-edge`, `breakthrough`, `novel`

### Outside-Corpus Indicators (triggers external)
- AI Models: `GPT-4`, `GPT-5`, `Claude 3`, `Gemini`, `LLaMA`, `Mistral`, `DeepSeek`
- Tech: `blockchain`, `NFT`, `metaverse`, `web3`, `quantum computing`
- Biotech: `CRISPR`, `AlphaFold`, `mRNA vaccine`
- Companies: `SpaceX`, `Starship`, `Neuralink`

---

## EXECUTION PROTOCOL

### Step 1: Initialize Session (Hybrid Mode)

```bash
npx tsx src/god-agent/cli/phd-cli.ts init "$ARGUMENTS" --data-source hybrid --json
```

This will:
1. Create session with `dataSourceMode: "hybrid"`
2. Analyze query intent (`queryIntent` field in session)
3. Run Phase 9 REPORT to get coverage grade
4. Resolve initial tool permissions based on coverage + intent
5. Store `phase9Report` for agent prompt injection

### Step 2: Check Permission Status

The session will contain:

```json
{
  "dataSourceMode": "hybrid",
  "coverageGrade": "MED",
  "queryIntent": {
    "recencyRequired": false,
    "outsideCorpusDomains": [],
    "temporalMarkers": []
  },
  "toolPermissions": {
    "webSearch": false,
    "webFetch": false,
    "perplexity": false
  }
}
```

### Step 3: Conditional External Supplementation

**If external tools are ALLOWED** (LOW coverage or recency/outside-corpus intent):

1. Use WebSearch/Perplexity to gather additional sources
2. **CRITICAL**: Label all external sources explicitly
3. Log tool usage with justification

**If external tools are DENIED** (HIGH/MED coverage, no special intent):

1. Proceed with local corpus only
2. Same as `god-research-local` mode

### Step 4: Run Phase 9 ANSWER

```bash
python3 scripts/interaction/answer.py --query "$ARGUMENTS" --enable_synthesis --format json
```

### Step 5: Validate Provenance Separation

**MANDATORY for hybrid mode**:

```bash
python3 scripts/interaction/validate_provenance.py \
  --answer docs/research/<slug>/phase9/answer.json \
  --strict \
  --format markdown
```

This validates:
- All claims have proper provenance labeling
- External supports have URL + justification
- Mixed provenance is explicitly structured

---

## TOOL USAGE LOGGING (GAP-H04)

All external tool usage is logged to the session audit trail:

```typescript
interface ToolUsageEntry {
  timestamp: string;           // ISO timestamp
  agentKey: string;            // Which agent used the tool
  tool: string;                // webSearch | webFetch | perplexity
  justification: string;       // Why external tool was needed
  coverageGradeAtTime: string; // Coverage grade when used
}
```

Review audit log:
```bash
jq '.toolUsageLog' .phd-sessions/<session-id>.json
```

---

## PROVENANCE SEPARATION REQUIREMENTS

### Local Provenance (prefix patterns)
- `ku_*` - Knowledge Unit IDs
- `ru_*` - Reasoning Unit IDs
- `doc:line` - Document references

### External Provenance (must include)
- `url` - Source URL
- `justification` - Why external was needed
- `accessed` - Timestamp of access

### Mixed Claims (allowed but must be explicit)
```json
{
  "claim_id": "c_001",
  "text": "AI adoption increased 40% in 2024",
  "supports": [
    { "type": "local", "id": "ku_456", "doc": "smith2023.pdf:45" },
    { "type": "external", "url": "https://...", "justification": "2024 data not in corpus" }
  ]
}
```

---

## AGENT PROMPT INJECTION (GAP-A03)

Agents in hybrid mode receive coverage context:

```markdown
## LOCAL CORPUS COVERAGE (Phase 9 REPORT)

| Metric | Value |
|--------|-------|
| Coverage Grade | **MED** |
| Retrieved Chunks | 42 |
| Distinct Documents | 8 |
| Knowledge Units | 15 |
| Reasoning Edges | 7 |

**Gaps Identified**:
- No coverage of 2024 developments
- Missing computational cost analysis

**Mode Policy**: HYBRID - External tools permitted with justification
```

---

## TOOL PERMISSIONS BY COVERAGE

| Coverage Grade | External Tools | Rationale |
|----------------|----------------|-----------|
| NONE | ALLOWED | Corpus has nothing relevant |
| LOW | ALLOWED | Insufficient local coverage |
| MED | CONDITIONAL | Depends on query intent |
| HIGH | DENIED (default) | Corpus is sufficient |

---

## WHEN TO USE HYBRID MODE

- Coverage is uncertain before analysis
- Research topic may span local + recent developments
- You need the best of both worlds with clear separation
- Audit trail of external tool usage is required
- Provenance transparency is important

---

## COMPARISON: LOCAL vs HYBRID vs EXTERNAL

| Feature | Local | Hybrid | External |
|---------|-------|--------|----------|
| Phase 9 REPORT | Yes | Yes | Optional |
| External Tools | Never | Conditional | Always |
| Provenance Separation | N/A | Required | N/A |
| Tool Audit Log | N/A | Yes | Optional |
| Query Intent Analysis | N/A | Yes | N/A |
| Agent Chain | 12 local-capable | All 46 | All 46 |
