# PhD Pipeline Memory Integration

**Version**: 1.0.0
**Memory System**: ClaudeFlow Memory
**Namespace**: `project/research`

---

## Overview

The PhD Pipeline uses the ClaudeFlow memory system for cross-agent data sharing. Each agent reads context from previous agents and stores outputs for subsequent agents, enabling a coordinated research workflow.

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Namespace** | Hierarchical organization for memory keys |
| **Memory Key** | Unique identifier for stored data |
| **Store** | Write data to memory |
| **Retrieve** | Read data from memory |

---

## Memory Namespace

**Primary Namespace**: `project/research`

All PhD Pipeline memory operations use this namespace. Sub-keys are organized by domain:

```
project/research/
+-- meta/                  # Meta-information
|   +-- questions          # Self-ask decomposer questions
|   +-- principles         # Step-back analyzer principles
|   +-- clarifications     # Ambiguity clarifier output
|   +-- strategy           # Research planning strategy
|   +-- tiers              # Context tier information
|   +-- assessment         # Quality assessment metadata
|   +-- risks              # Risk analysis metadata
|   +-- certainty          # Confidence quantifier output
|   +-- replication        # Reproducibility information
+-- foundation/            # Phase 1 outputs
|   +-- decomposition      # Question decomposition
|   +-- framing            # High-level framing
|   +-- definitions        # Term definitions
|   +-- constructs         # Construct definitions
|   +-- framework          # Theoretical framework
|   +-- plan               # Research plan
+-- literature/            # Phase 2 outputs
|   +-- map                # Literature map
|   +-- tiers              # Source tier classifications
|   +-- methods            # Methodology survey
|   +-- context            # Context hierarchy
|   +-- systematic         # Systematic review
+-- analysis/              # Phase 3 outputs
|   +-- quality            # Quality assessment
|   +-- contradictions     # Contradiction analysis
|   +-- bias               # Bias detection
|   +-- risks              # Risk assessment
|   +-- evidence           # Evidence synthesis
|   +-- gaps               # Research gaps
+-- synthesis/             # Phase 4 outputs
|   +-- patterns           # Pattern analysis
|   +-- themes             # Thematic synthesis
|   +-- theory             # Theory construction
|   +-- hypotheses         # Hypothesis generation
|   +-- models             # Conceptual models
|   +-- opportunities      # Research opportunities
|   +-- systematic-review  # Systematic review synthesis
+-- methods/               # Phase 5 outputs
|   +-- design             # Research design
|   +-- sampling           # Sampling strategy
|   +-- instruments        # Research instruments
|   +-- analysis           # Analysis plan
|   +-- ethics             # Ethics review
|   +-- validity           # Validity assessment
+-- writing/               # Phase 6 outputs
|   +-- structure          # Dissertation structure
|   +-- abstract           # Abstract draft
|   +-- introduction       # Introduction chapter
|   +-- literature         # Literature review chapter
|   +-- methodology        # Methodology chapter
|   +-- results            # Results chapter
|   +-- discussion         # Discussion chapter
|   +-- conclusion         # Conclusion chapter
+-- quality/               # Phase 7 outputs
|   +-- citations          # Citation audit
|   +-- extraction         # Extracted citations
|   +-- validation         # Citation validation
|   +-- critique           # Adversarial critique
|   +-- confidence         # Confidence scores
|   +-- reproducibility    # Reproducibility report
|   +-- consistency        # Consistency report
|   +-- structure          # Structure audit
|   +-- synthesis          # Final synthesis
+-- document/              # Document outputs
|   +-- architecture       # Document architecture
|   +-- abstract           # Final abstract
|   +-- chapter1-6         # Chapter content
|   +-- references         # Reference list
|   +-- coherence          # Coherence audit
|   +-- formatting         # Formatting checks
|   +-- final              # Final document
+-- sources/               # Source management
|   +-- index              # Source index
|   +-- citations          # All citations
|   +-- verified           # Verified sources
+-- findings/              # Research findings
|   +-- conflicts          # Conflicting findings
|   +-- patterns           # Discovered patterns
|   +-- themes             # Identified themes
|   +-- gaps               # Knowledge gaps
|   +-- opportunities      # Research opportunities
+-- theory/                # Theory-related
|   +-- definitions        # Theoretical definitions
|   +-- analysis           # Theory analysis
|   +-- construction       # Theory construction
|   +-- hypotheses         # Generated hypotheses
|   +-- models             # Theoretical models
+-- methodology/           # Methodology domain
|   +-- survey             # Methodology survey
|   +-- approach           # Methodological approach
|   +-- sampling           # Sampling methodology
|   +-- instruments        # Instrument methodology
|   +-- analysis           # Analysis methodology
+-- compliance/            # Compliance tracking
|   +-- ethics             # Ethics compliance
+-- review/                # Review outputs
    +-- adversarial        # Adversarial review
```

---

## Memory Commands

### Store Command

Per Constitution RULE-025, use positional arguments:

```bash
npx claude-flow memory store "<key>" '<json-value>' --namespace "<namespace>"
```

**Parameters**:
| Parameter | Description |
|-----------|-------------|
| `<key>` | Memory key (e.g., `research/foundation/questions`) |
| `<json-value>` | JSON-serializable value (single quotes for shell safety) |
| `--namespace` | Memory namespace (default: `project/research`) |

**Example**:

```bash
npx claude-flow memory store "research/meta/questions" '{"questions":["Q1","Q2"],"count":2}' --namespace "project/research"
```

### Retrieve Command

```bash
npx claude-flow memory retrieve "<key>" --namespace "<namespace>"
```

**Parameters**:
| Parameter | Description |
|-----------|-------------|
| `<key>` | Memory key to retrieve |
| `--namespace` | Memory namespace |

**Example**:

```bash
npx claude-flow memory retrieve "research/foundation/plan" --namespace "project/research"
```

### Query Command

Query memory with pattern matching:

```bash
npx claude-flow memory query --key "<pattern>" --namespace "<namespace>"
```

**Example**:

```bash
# Query all foundation keys
npx claude-flow memory query --key "research/foundation/*" --namespace "project/research"
```

---

## Memory Key Patterns by Agent

### Phase 1: Foundation

| Agent | Reads | Writes |
|-------|-------|--------|
| `self-ask-decomposer` | - | `research/meta/questions`, `research/foundation/decomposition` |
| `step-back-analyzer` | `research/meta/questions` | `research/foundation/framing`, `research/meta/perspective` |
| `ambiguity-clarifier` | `research/foundation/framing` | `research/foundation/definitions`, `research/meta/clarifications` |
| `construct-definer` | `research/foundation/definitions` | `research/foundation/constructs`, `research/theory/definitions` |
| `theoretical-framework-analyst` | `research/foundation/constructs` | `research/foundation/framework`, `research/theory/analysis` |
| `research-planner` | `research/foundation/framework` | `research/foundation/plan`, `research/meta/strategy` |

### Phase 2: Literature

| Agent | Reads | Writes |
|-------|-------|--------|
| `literature-mapper` | `research/foundation/plan` | `research/literature/map`, `research/sources/index` |
| `source-tier-classifier` | `research/literature/map` | `research/literature/tiers`, `research/quality/sources` |
| `methodology-scanner` | `research/literature/tiers` | `research/literature/methods`, `research/methodology/survey` |
| `context-tier-manager` | `research/literature/methods` | `research/literature/context`, `research/meta/tiers` |
| `systematic-reviewer` | `research/literature/context` | `research/literature/systematic`, `research/synthesis/systematic-review` |

### Phase 3: Analysis

| Agent | Reads | Writes |
|-------|-------|--------|
| `quality-assessor` | `research/synthesis/systematic-review` | `research/analysis/quality`, `research/meta/assessment` |
| `contradiction-analyzer` | `research/analysis/quality` | `research/analysis/contradictions`, `research/findings/conflicts` |
| `bias-detector` | `research/analysis/contradictions` | `research/analysis/bias`, `research/quality/bias` |
| `risk-analyst` | `research/analysis/bias` | `research/analysis/risks`, `research/meta/risks` |
| `evidence-synthesizer` | `research/analysis/risks` | `research/analysis/evidence`, `research/synthesis/evidence` |
| `gap-hunter` | `research/analysis/evidence` | `research/analysis/gaps`, `research/findings/gaps` |

### Phase 4: Synthesis

| Agent | Reads | Writes |
|-------|-------|--------|
| `pattern-analyst` | `research/analysis/gaps` | `research/synthesis/patterns`, `research/findings/patterns` |
| `thematic-synthesizer` | `research/synthesis/patterns` | `research/synthesis/themes`, `research/findings/themes` |
| `theory-builder` | `research/synthesis/themes` | `research/synthesis/theory`, `research/theory/construction` |
| `hypothesis-generator` | `research/synthesis/theory` | `research/synthesis/hypotheses`, `research/theory/hypotheses` |
| `model-architect` | `research/synthesis/hypotheses` | `research/synthesis/models`, `research/theory/models` |
| `opportunity-identifier` | `research/synthesis/models` | `research/synthesis/opportunities`, `research/findings/opportunities` |

### Phase 5: Methods

| Agent | Reads | Writes |
|-------|-------|--------|
| `method-designer` | `research/synthesis/opportunities` | `research/methods/design`, `research/methodology/approach` |
| `sampling-strategist` | `research/methods/design` | `research/methods/sampling`, `research/methodology/sampling` |
| `instrument-developer` | `research/methods/sampling` | `research/methods/instruments`, `research/methodology/instruments` |
| `analysis-planner` | `research/methods/instruments` | `research/methods/analysis`, `research/methodology/analysis` |
| `ethics-reviewer` | `research/methods/analysis` | `research/methods/ethics`, `research/compliance/ethics` |
| `validity-guardian` | `research/methods/ethics` | `research/methods/validity`, `research/quality/validity` |

### Phase 6: Writing

| Agent | Reads | Writes |
|-------|-------|--------|
| `dissertation-architect` | `research/methods/validity` | `research/writing/structure`, `research/document/architecture` |
| `abstract-writer` | `research/writing/structure` | `research/writing/abstract`, `research/document/abstract` |
| `introduction-writer` | `research/writing/abstract` | `research/writing/introduction`, `research/document/chapter1` |
| `literature-review-writer` | `research/writing/introduction` | `research/writing/literature`, `research/document/chapter2` |
| `methodology-writer` | `research/writing/literature` | `research/writing/methodology`, `research/document/chapter3` |
| `results-writer` | `research/writing/methodology` | `research/writing/results`, `research/document/chapter4` |
| `discussion-writer` | `research/writing/results` | `research/writing/discussion`, `research/document/chapter5` |
| `conclusion-writer` | `research/writing/discussion` | `research/writing/conclusion`, `research/document/chapter6` |

### Phase 7: Quality

| Agent | Reads | Writes |
|-------|-------|--------|
| `apa-citation-specialist` | `research/writing/conclusion` | `research/quality/citations`, `research/document/references` |
| `citation-extractor` | `research/quality/citations` | `research/quality/extraction`, `research/sources/citations` |
| `citation-validator` | `research/quality/extraction` | `research/quality/validation`, `research/sources/verified` |
| `adversarial-reviewer` | `research/quality/validation` | `research/quality/critique`, `research/review/adversarial` |
| `confidence-quantifier` | `research/quality/critique` | `research/quality/confidence`, `research/meta/certainty` |
| `reproducibility-checker` | `research/quality/confidence` | `research/quality/reproducibility`, `research/meta/replication` |
| `consistency-validator` | `research/quality/reproducibility` | `research/quality/consistency`, `research/document/coherence` |
| `file-length-manager` | `research/quality/consistency` | `research/quality/structure`, `research/document/formatting` |
| `chapter-synthesizer` | `research/quality/structure` | `research/quality/synthesis`, `research/document/final` |

---

## Cross-Agent Data Sharing

### Sequential Data Flow

The PhD Pipeline follows strict sequential execution (RULE-015). Each agent:

1. **Retrieves** data from previous agents via memory
2. **Processes** the data according to its role
3. **Stores** outputs for subsequent agents

```
Agent N-1                 Agent N                   Agent N+1
   |                         |                          |
   | store output            |                          |
   +------------------------>| retrieve input           |
                             | process                  |
                             | store output             |
                             +------------------------->|
                                                        | retrieve input
```

### Memory Retrieval in Agent Prompts

Each agent prompt includes memory retrieval commands in the **MEMORY RETRIEVAL** section:

```markdown
## MEMORY RETRIEVAL

Retrieve these keys from previous agents:
```bash
npx claude-flow memory retrieve "research/foundation/plan" --namespace "project/research"
npx claude-flow memory retrieve "research/meta/strategy" --namespace "project/research"
```
```

### Memory Storage in Agent Prompts

Each agent prompt includes memory storage instructions in the **MEMORY STORAGE** section:

```markdown
## MEMORY STORAGE

Store your outputs to:
```bash
npx claude-flow memory store "research/literature/map" '<your-json-output>' --namespace "project/research"
```

**Expected Outputs**: literature-map.md, source-catalog.md
```

---

## Data Format Standards

### JSON Schema for Memory Values

All memory values should be valid JSON with consistent structure:

```json
{
  "agentKey": "literature-mapper",
  "timestamp": "2026-01-01T12:00:00Z",
  "sessionId": "a1b2c3d4-...",
  "data": {
    // Agent-specific output data
  },
  "metadata": {
    "wordCount": 1234,
    "sourceCount": 45
  }
}
```

### Common Fields

| Field | Type | Description |
|-------|------|-------------|
| `agentKey` | string | Key of the agent that produced this data |
| `timestamp` | ISO 8601 | When the data was stored |
| `sessionId` | UUID | Session identifier |
| `data` | object | Agent-specific output data |
| `metadata` | object | Additional metadata (counts, statistics) |

---

## Memory Integration in Code

### Storing to Memory (TypeScript)

```typescript
import { storeToMemory } from './memory-helpers';

// Store agent output to memory
await storeToMemory(
  'research/foundation/questions',
  {
    agentKey: 'self-ask-decomposer',
    timestamp: new Date().toISOString(),
    data: {
      questions: [...],
      categories: {...}
    }
  },
  'project/research'
);
```

### Retrieving from Memory (TypeScript)

```typescript
import { retrieveFromMemory } from './memory-helpers';

// Retrieve previous agent's output
const previousOutput = await retrieveFromMemory(
  'research/foundation/plan',
  'project/research'
);

if (previousOutput) {
  // Use the data
  const plan = previousOutput.data;
}
```

---

## Best Practices

### 1. Always Check Memory Before Starting

Agents should verify required memory keys exist before processing:

```bash
# Check if required input exists
npx claude-flow memory retrieve "research/foundation/plan" --namespace "project/research"
```

### 2. Use Consistent Key Naming

Follow the established patterns:
- Phase domain prefix: `research/<phase-domain>/`
- Kebab-case for multi-word keys
- Descriptive but concise names

### 3. Include Metadata in Stored Values

Always include:
- `agentKey`: Which agent produced this
- `timestamp`: When it was stored
- `sessionId`: Which session this belongs to

### 4. Handle Missing Data Gracefully

If memory retrieval returns null:

```typescript
const data = await retrieveFromMemory(key, namespace);
if (!data) {
  // Log warning but continue with defaults
  console.warn(`[MEMORY] Key not found: ${key}`);
  return getDefaultValue();
}
```

### 5. Escape Special Characters

When storing JSON via command line, escape single quotes:

```bash
# Escape single quotes in JSON
JSON_VALUE='{"title": "Don'\''t stop"}'
npx claude-flow memory store "key" '$JSON_VALUE' --namespace "project/research"
```

---

## Troubleshooting

### Memory Retrieval Returns Null

**Cause**: Key doesn't exist or previous agent didn't store output

**Solution**:
1. Check previous agent completed successfully
2. Verify key spelling matches exactly
3. Check namespace is correct

### Memory Store Fails

**Cause**: Invalid JSON or command syntax

**Solution**:
1. Validate JSON with `jq` or JSON validator
2. Ensure single quotes around JSON value
3. Check no unescaped special characters

### Memory Conflict

**Cause**: Multiple agents writing to same key

**Solution**:
1. Each agent should write to unique keys
2. Use agent-key-prefixed keys if needed
3. Check memory key mapping in agent configuration

---

## Constitution Compliance

The memory integration follows these Constitution rules:

| Rule | Description | Implementation |
|------|-------------|----------------|
| RULE-014 | Memory Key Naming | Format: `project/research/{domain}/{artifact}` |
| RULE-025 | Memory Syntax | Positional arguments, not flag-based |
| RULE-021 | Session Persistence | Session state stored in `.phd-sessions/` |
| RULE-012 | Task Completion Summary | Includes memory storage locations |
| RULE-013 | Workflow Context | Shows previous/next agent memory keys |
