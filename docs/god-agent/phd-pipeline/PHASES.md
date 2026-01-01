# PhD Pipeline Phase Documentation

**Version**: 1.0.0
**Total Phases**: 7 + Phase 8 (Final Assembly)

---

## Phase Overview

| Phase | Name | Agents | Purpose |
|-------|------|--------|---------|
| 1 | Foundation | 6 | Problem decomposition, theoretical framing, research planning |
| 2 | Literature | 5 | Literature review, source classification, systematic review |
| 3 | Analysis | 6 | Quality assessment, contradiction detection, gap identification |
| 4 | Synthesis | 6 | Pattern analysis, theory building, hypothesis generation |
| 5 | Methods | 6 | Research design, sampling, instrumentation, ethics |
| 6 | Writing | 8 | Dissertation chapter writing and document architecture |
| 7 | Quality | 9 | Citation management, validation, adversarial review |
| 8 | Final | 1 | FinalStageOrchestrator - final assembly and synthesis |

**Total**: 46 agents across 7 main phases, plus Phase 8 orchestration

---

## Phase 1: Foundation

**Purpose**: Initial problem analysis, question decomposition, theoretical framing, and research planning. Establishes the conceptual groundwork for the entire research endeavor.

**Agent Count**: 6

### Agents in Phase 1

| Order | Agent | Purpose |
|-------|-------|---------|
| 1 | `self-ask-decomposer` | Decompose research topic into 15-20 essential questions |
| 2 | `step-back-analyzer` | Establish high-level framing and abstraction analysis |
| 3 | `ambiguity-clarifier` | Resolve terminology ambiguities and clarify scope |
| 4 | `construct-definer` | Define key constructs and operationalizations |
| 5 | `theoretical-framework-analyst` | Identify and analyze theoretical frameworks |
| 6 | `research-planner` | Create comprehensive research plan with timeline |

### Phase 1 Outputs

- Essential research questions (15-20)
- High-level framing document
- Term definitions and clarified scope
- Construct operationalizations
- Theoretical framework analysis
- Research plan with timeline

### Phase 1 Memory Keys

| Agent | Reads | Writes |
|-------|-------|--------|
| `self-ask-decomposer` | - | `research/meta/questions` |
| `step-back-analyzer` | `research/meta/questions` | `research/foundation/framing` |
| `ambiguity-clarifier` | `research/foundation/framing` | `research/foundation/definitions` |
| `construct-definer` | `research/foundation/definitions` | `research/foundation/constructs` |
| `theoretical-framework-analyst` | `research/foundation/constructs` | `research/foundation/framework` |
| `research-planner` | `research/foundation/framework` | `research/foundation/plan` |

---

## Phase 2: Literature

**Purpose**: Comprehensive literature review, source classification by credibility tiers, methodology scanning, context management, and PRISMA-compliant systematic review. Maps the existing knowledge landscape.

**Agent Count**: 5

### Agents in Phase 2

| Order | Agent | Purpose |
|-------|-------|---------|
| 1 | `literature-mapper` | Map literature landscape and create source catalog |
| 2 | `source-tier-classifier` | Classify sources into Tier 1/2/3 by credibility |
| 3 | `methodology-scanner` | Scan and categorize research methodologies |
| 4 | `context-tier-manager` | Organize context into hot/warm/cold tiers |
| 5 | `systematic-reviewer` | Conduct PRISMA-compliant systematic review |

### Phase 2 Outputs

- Literature map and source catalog
- Source tier classifications
- Methodology survey and comparison
- Context hierarchy with tier mappings
- Systematic review with PRISMA flowchart

### Phase 2 Memory Keys

| Agent | Reads | Writes |
|-------|-------|--------|
| `literature-mapper` | `research/foundation/plan` | `research/literature/map` |
| `source-tier-classifier` | `research/literature/map` | `research/literature/tiers` |
| `methodology-scanner` | `research/literature/tiers` | `research/literature/methods` |
| `context-tier-manager` | `research/literature/methods` | `research/literature/context` |
| `systematic-reviewer` | `research/literature/context` | `research/synthesis/systematic-review` |

---

## Phase 3: Analysis

**Purpose**: Critical analysis of evidence quality, contradiction detection, bias identification, risk assessment, evidence synthesis, and research gap identification.

**Agent Count**: 6

### Agents in Phase 3

| Order | Agent | Purpose |
|-------|-------|---------|
| 1 | `quality-assessor` | Assess study quality using CASP, JBI tools |
| 2 | `contradiction-analyzer` | Identify contradictions and conflicting findings |
| 3 | `bias-detector` | Detect publication, selection, systematic biases |
| 4 | `risk-analyst` | Identify research risks using FMEA methodology |
| 5 | `evidence-synthesizer` | Synthesize evidence using meta-analysis methods |
| 6 | `gap-hunter` | Discover 15+ high-value research gaps |

### Phase 3 Outputs

- Quality assessment scores
- Contradictions report with resolution proposals
- Bias analysis and mitigation strategies
- Risk assessment and mitigation plan
- Evidence synthesis and evidence matrix
- Research gaps with priorities

### Phase 3 Memory Keys

| Agent | Reads | Writes |
|-------|-------|--------|
| `quality-assessor` | `research/synthesis/systematic-review` | `research/analysis/quality` |
| `contradiction-analyzer` | `research/analysis/quality` | `research/analysis/contradictions` |
| `bias-detector` | `research/analysis/contradictions` | `research/analysis/bias` |
| `risk-analyst` | `research/analysis/bias` | `research/analysis/risks` |
| `evidence-synthesizer` | `research/analysis/risks` | `research/analysis/evidence` |
| `gap-hunter` | `research/analysis/evidence` | `research/analysis/gaps` |

---

## Phase 4: Synthesis

**Purpose**: Pattern recognition, thematic synthesis, theory building, hypothesis generation, conceptual model architecture, and opportunity identification.

**Agent Count**: 6

### Agents in Phase 4

| Order | Agent | Purpose |
|-------|-------|---------|
| 1 | `pattern-analyst` | Identify patterns and perform thematic analysis |
| 2 | `thematic-synthesizer` | Synthesize recurring themes across literature |
| 3 | `theory-builder` | Construct theoretical frameworks from themes |
| 4 | `hypothesis-generator` | Generate testable hypotheses from theory |
| 5 | `model-architect` | Build testable structural models |
| 6 | `opportunity-identifier` | Identify research opportunities |

### Phase 4 Outputs

- Pattern analysis and catalog
- Thematic synthesis and theme hierarchy
- Theory development and theoretical model
- Testable hypotheses and predictions
- Conceptual model with specifications
- Research opportunities and opportunity matrix

### Phase 4 Memory Keys

| Agent | Reads | Writes |
|-------|-------|--------|
| `pattern-analyst` | `research/analysis/gaps` | `research/synthesis/patterns` |
| `thematic-synthesizer` | `research/synthesis/patterns` | `research/synthesis/themes` |
| `theory-builder` | `research/synthesis/themes` | `research/synthesis/theory` |
| `hypothesis-generator` | `research/synthesis/theory` | `research/synthesis/hypotheses` |
| `model-architect` | `research/synthesis/hypotheses` | `research/synthesis/models` |
| `opportunity-identifier` | `research/synthesis/models` | `research/synthesis/opportunities` |

---

## Phase 5: Methods

**Purpose**: Research methodology design, sampling strategy, instrument development, analysis planning, ethics review, and validity assurance.

**Agent Count**: 6

### Agents in Phase 5

| Order | Agent | Purpose |
|-------|-------|---------|
| 1 | `method-designer` | Design comprehensive research methodologies |
| 2 | `sampling-strategist` | Create detailed sampling strategies |
| 3 | `instrument-developer` | Develop or adapt measurement instruments |
| 4 | `analysis-planner` | Design statistical/qualitative analysis strategies |
| 5 | `ethics-reviewer` | Ensure IRB compliance and ethical conduct |
| 6 | `validity-guardian` | Protect validity and identify threats |

### Phase 5 Outputs

- Research design and method rationale
- Sampling strategy and specifications
- Research instruments and validation protocols
- Analysis plan and statistical approach
- Ethics review and IRB protocol
- Validity assessment and threat mitigation

### Phase 5 Memory Keys

| Agent | Reads | Writes |
|-------|-------|--------|
| `method-designer` | `research/synthesis/opportunities` | `research/methods/design` |
| `sampling-strategist` | `research/methods/design` | `research/methods/sampling` |
| `instrument-developer` | `research/methods/sampling` | `research/methods/instruments` |
| `analysis-planner` | `research/methods/instruments` | `research/methods/analysis` |
| `ethics-reviewer` | `research/methods/analysis` | `research/methods/ethics` |
| `validity-guardian` | `research/methods/ethics` | `research/methods/validity` |

---

## Phase 6: Writing

**Purpose**: Dissertation document creation including structural architecture, abstract, introduction, literature review, methodology, results, discussion, and conclusion chapters.

**Agent Count**: 8

### Agents in Phase 6

| Order | Agent | Purpose |
|-------|-------|---------|
| 1 | `dissertation-architect` | Design chapter structure (MUST run first) |
| 2 | `abstract-writer` | Generate publication-quality abstracts |
| 3 | `introduction-writer` | Write PhD-level introduction sections |
| 4 | `literature-review-writer` | Write comprehensive literature review |
| 5 | `methodology-writer` | Write methodology chapters |
| 6 | `results-writer` | Present findings with statistical rigor |
| 7 | `discussion-writer` | Interpret findings and address limitations |
| 8 | `conclusion-writer` | Synthesize contributions and future directions |

### Phase 6 Outputs

- Dissertation outline and chapter structure (locked)
- Abstract and executive summary
- Introduction chapter
- Literature review chapter
- Methodology chapter
- Results chapter
- Discussion chapter
- Conclusion chapter

### Phase 6 Memory Keys

| Agent | Reads | Writes |
|-------|-------|--------|
| `dissertation-architect` | `research/methods/validity` | `research/writing/structure` |
| `abstract-writer` | `research/writing/structure` | `research/writing/abstract` |
| `introduction-writer` | `research/writing/abstract` | `research/writing/introduction` |
| `literature-review-writer` | `research/writing/introduction` | `research/writing/literature` |
| `methodology-writer` | `research/writing/literature` | `research/writing/methodology` |
| `results-writer` | `research/writing/methodology` | `research/writing/results` |
| `discussion-writer` | `research/writing/results` | `research/writing/discussion` |
| `conclusion-writer` | `research/writing/discussion` | `research/writing/conclusion` |

### Critical Note: dissertation-architect

The `dissertation-architect` agent MUST run before any other writing agents. It:

1. Analyzes research scope
2. Determines appropriate chapter count (5-12)
3. Locks the chapter structure to memory
4. Creates `05-chapter-structure.md` with JSON for Phase 8

**All writing agents MUST retrieve the structure before writing.**

---

## Phase 7: Quality

**Purpose**: Final quality assurance including citation management (APA), validation, adversarial review, confidence quantification, reproducibility checking, consistency validation, and final synthesis.

**Agent Count**: 9

### Agents in Phase 7

| Order | Agent | Purpose |
|-------|-------|---------|
| 1 | `apa-citation-specialist` | Full APA 7th edition formatting |
| 2 | `citation-extractor` | Extract and format citations |
| 3 | `citation-validator` | Validate all citations (Author, Year, URL) |
| 4 | `adversarial-reviewer` | Red team critique - challenge assumptions |
| 5 | `confidence-quantifier` | Assign probability estimates to claims |
| 6 | `reproducibility-checker` | Ensure methods documented for replication |
| 7 | `consistency-validator` | Validate cross-references match structure |
| 8 | `file-length-manager` | Monitor and split files at 1500 lines |
| 9 | `chapter-synthesizer` | Transform outputs into publication-ready prose |

### Phase 7 Outputs

- Citation audit and APA compliance report
- Extracted citations and reference list
- Citation validation and source verification
- Adversarial critique and weakness report
- Confidence scores and uncertainty analysis
- Reproducibility report and replication guide
- Consistency report and coherence audit
- Structure audit and length compliance
- Final synthesis and dissertation-complete

### Phase 7 Memory Keys

| Agent | Reads | Writes |
|-------|-------|--------|
| `apa-citation-specialist` | `research/writing/conclusion` | `research/quality/citations` |
| `citation-extractor` | `research/quality/citations` | `research/quality/extraction` |
| `citation-validator` | `research/quality/extraction` | `research/quality/validation` |
| `adversarial-reviewer` | `research/quality/validation` | `research/quality/critique` |
| `confidence-quantifier` | `research/quality/critique` | `research/quality/confidence` |
| `reproducibility-checker` | `research/quality/confidence` | `research/quality/reproducibility` |
| `consistency-validator` | `research/quality/reproducibility` | `research/quality/consistency` |
| `file-length-manager` | `research/quality/consistency` | `research/quality/structure` |
| `chapter-synthesizer` | `research/quality/structure` | `research/quality/synthesis` |

---

## Phase 8: Final Assembly (FinalStageOrchestrator)

**Purpose**: Coordinate final assembly of all agent outputs into a coherent dissertation.

**Agent Count**: 1 (FinalStageOrchestrator - not a traditional agent)

### Phase 8 Process

```
State Machine:
IDLE -> INITIALIZING -> SCANNING -> SUMMARIZING -> MAPPING ->
       WRITING -> COMBINING -> VALIDATING -> COMPLETED | FAILED
```

### Phase 8 Steps

1. **INITIALIZING**: Load chapter structure from `05-chapter-structure.md`
2. **SCANNING**: Scan all 46 agent output files
3. **SUMMARIZING**: Extract summaries from each agent output
4. **MAPPING**: Semantically map outputs to chapters
5. **WRITING**: Generate chapter content using ChapterWriterAgent
6. **COMBINING**: Combine chapters into final paper with ToC
7. **VALIDATING**: Run quality checks on final output
8. **COMPLETED**: Write final dissertation to `final/` directory

### Phase 8 Outputs

```
docs/research/<topic-slug>/final/
+-- chapters/
|   +-- chapter-01.md
|   +-- chapter-02.md
|   +-- ...
+-- final-paper.md
+-- metadata.json
```

### Phase 8 Constitution Rules

| Rule | Description |
|------|-------------|
| FS-001 | Outputs to `final/` directories only |
| FS-002 | Never write to root folder |
| FS-003 | Cleanup partial outputs on failure |
| FS-005 | Archive before overwrite |
| EX-001 | Valid state machine transitions |
| EX-004 | Progress reporting hooks |

---

## Phase Transition Rules (RULE-022)

Per Constitution RULE-022, phase transitions follow these rules:

### Transition Requirements

1. **Sequential Execution**: Phase N must complete before Phase N+1 begins
2. **All Agents Complete**: All agents in a phase must complete before transition
3. **Memory Persistence**: All outputs stored to memory before proceeding
4. **No Backward Transitions**: Cannot return to previous phases
5. **No Phase Skipping**: Cannot skip from Phase 2 to Phase 4

### Valid Transitions

```
Phase 1 -> Phase 2  (Foundation -> Literature)
Phase 2 -> Phase 3  (Literature -> Analysis)
Phase 3 -> Phase 4  (Analysis -> Synthesis)
Phase 4 -> Phase 5  (Synthesis -> Methods)
Phase 5 -> Phase 6  (Methods -> Writing)
Phase 6 -> Phase 7  (Writing -> Quality)
Phase 7 -> Phase 8  (Quality -> Final Assembly) [AUTOMATIC]
```

### Phase 7 to Phase 8 Transition

The transition from Phase 7 to Phase 8 is **automatic**:

- When `chapter-synthesizer` (agent 46) completes
- CLI detects `currentAgentIndex >= 46`
- Returns `pipeline_complete` status
- User then runs final stage orchestration:

```bash
# After Phase 7 completes
npx phd-cli finalize <session-id>
```

### Transition Validation

```typescript
function validatePhaseTransition(
  currentPhase: number,
  nextPhase: number
): boolean {
  // Same phase: always valid
  if (currentPhase === nextPhase) return true;

  // Forward by exactly one: valid
  if (nextPhase === currentPhase + 1) return true;

  // All other cases: invalid
  return false;
}
```

---

## Phase Progress Tracking

### Session State Structure

```typescript
interface SessionState {
  sessionId: string;
  topic: string;
  currentPhase: number;        // 1-7 (or 8 for finalization)
  currentAgentIndex: number;   // 0-45
  completedAgents: string[];   // Array of completed agent keys
  startedAt: string;
  lastActivityAt: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'phase8';
}
```

### Checking Phase Progress

```bash
# Get current session status
npx phd-cli status <session-id> --json

# Output includes:
# - currentPhase
# - currentAgentIndex
# - completedAgents count
# - Progress percentage
```

---

## Phase-Aware Rolling Window (DESC Integration)

The PhD Pipeline uses phase-aware context windows for DESC (Decomposed Episode Solution Cache) integration:

| Phase | Window Size | Rationale |
|-------|-------------|-----------|
| 1 (Foundation) | 2 | Planning context - minimal history |
| 2 (Literature) | 3 | Research context - moderate history |
| 3-5 (Analysis/Synthesis/Methods) | 3 | Default context |
| 6 (Writing) | 5 | Writing context - more history for coherence |
| 7 (Quality) | 10 | QA context - comprehensive history |

This ensures agents receive appropriate context based on their phase requirements.
