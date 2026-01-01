# PhD Pipeline Agent Reference

**Version**: 1.0.0
**Total Agents**: 46
**Agent Files Location**: `.claude/agents/phdresearch/`

---

## Agent Summary Table

| # | Agent Key | Display Name | Phase | Description |
|---|-----------|--------------|-------|-------------|
| 1 | `self-ask-decomposer` | Self-Ask Decomposer | 1 | Decomposes research topic into 15-20 essential questions |
| 2 | `step-back-analyzer` | Step-Back Analyzer | 1 | Establishes high-level framing and abstraction analysis |
| 3 | `ambiguity-clarifier` | Ambiguity Clarifier | 1 | Resolves terminology ambiguities and clarifies scope |
| 4 | `construct-definer` | Construct Definer | 1 | Defines key constructs, variables, and operationalizations |
| 5 | `theoretical-framework-analyst` | Theoretical Framework Analyst | 1 | Identifies and analyzes theoretical frameworks |
| 6 | `research-planner` | Research Planner | 1 | Creates comprehensive research plan using ReWOO methodology |
| 7 | `literature-mapper` | Literature Mapper | 2 | Maps the literature landscape and creates source catalog |
| 8 | `source-tier-classifier` | Source Tier Classifier | 2 | Classifies sources into Tier 1/2/3 based on credibility |
| 9 | `methodology-scanner` | Methodology Scanner | 2 | Scans and categorizes research methodologies |
| 10 | `context-tier-manager` | Context Tier Manager | 2 | Organizes context into hot/warm/cold tiers |
| 11 | `systematic-reviewer` | Systematic Reviewer | 2 | Conducts PRISMA-compliant systematic review |
| 12 | `quality-assessor` | Quality Assessor | 3 | Assesses study quality using CASP, JBI tools |
| 13 | `contradiction-analyzer` | Contradiction Analyzer | 3 | Identifies contradictions and conflicting findings |
| 14 | `bias-detector` | Bias Detector | 3 | Detects publication, selection, and systematic biases |
| 15 | `risk-analyst` | Risk Analyst | 3 | Identifies research risks using FMEA methodology |
| 16 | `evidence-synthesizer` | Evidence Synthesizer | 3 | Synthesizes evidence using meta-analysis or thematic methods |
| 17 | `gap-hunter` | Gap Hunter | 3 | Discovers 15+ high-value research gaps |
| 18 | `pattern-analyst` | Pattern Analyst | 4 | Identifies patterns and performs thematic analysis |
| 19 | `thematic-synthesizer` | Thematic Synthesizer | 4 | Synthesizes recurring themes across literature |
| 20 | `theory-builder` | Theory Builder | 4 | Constructs theoretical frameworks from themes |
| 21 | `hypothesis-generator` | Hypothesis Generator | 4 | Generates testable hypotheses from theory |
| 22 | `model-architect` | Model Architect | 4 | Builds testable structural models |
| 23 | `opportunity-identifier` | Opportunity Identifier | 4 | Identifies research opportunities and gaps |
| 24 | `method-designer` | Method Designer | 5 | Designs comprehensive research methodologies |
| 25 | `sampling-strategist` | Sampling Strategist | 5 | Creates detailed sampling strategies |
| 26 | `instrument-developer` | Instrument Developer | 5 | Develops or adapts measurement instruments |
| 27 | `analysis-planner` | Analysis Planner | 5 | Designs statistical/qualitative analysis strategies |
| 28 | `ethics-reviewer` | Ethics Reviewer | 5 | Ensures IRB compliance and ethical conduct |
| 29 | `validity-guardian` | Validity Guardian | 5 | Protects internal, external, construct validity |
| 30 | `dissertation-architect` | Dissertation Architect | 6 | Designs chapter structure (MUST run before writing) |
| 31 | `abstract-writer` | Abstract Writer | 6 | Generates publication-quality abstracts |
| 32 | `introduction-writer` | Introduction Writer | 6 | Writes PhD-level introduction sections |
| 33 | `literature-review-writer` | Literature Review Writer | 6 | Writes comprehensive literature review |
| 34 | `methodology-writer` | Methodology Writer | 6 | Writes methodology chapters |
| 35 | `results-writer` | Results Writer | 6 | Presents findings with statistical rigor |
| 36 | `discussion-writer` | Discussion Writer | 6 | Interprets findings and addresses limitations |
| 37 | `conclusion-writer` | Conclusion Writer | 6 | Synthesizes contributions and future directions |
| 38 | `apa-citation-specialist` | APA Citation Specialist | 7 | Full APA 7th edition formatting specialist |
| 39 | `citation-extractor` | Citation Extractor | 7 | Extracts and formats citations |
| 40 | `citation-validator` | Citation Validator | 7 | Validates all citations (Author, Year, URL) |
| 41 | `adversarial-reviewer` | Adversarial Reviewer | 7 | Red team critique - challenges assumptions |
| 42 | `confidence-quantifier` | Confidence Quantifier | 7 | Assigns probability estimates to claims |
| 43 | `reproducibility-checker` | Reproducibility Checker | 7 | Ensures methods fully documented for replication |
| 44 | `consistency-validator` | Consistency Validator | 7 | Validates cross-references match structure |
| 45 | `file-length-manager` | File Length Manager | 7 | Monitors file length and splits at 1500 lines |
| 46 | `chapter-synthesizer` | Chapter Synthesizer | 7 | Transforms outputs into publication-ready prose |

---

## Detailed Agent Specifications

### Phase 1: Foundation (6 Agents)

#### 1. self-ask-decomposer

**File**: `self-ask-decomposer.md`
**Type**: Meta-Analyst
**Priority**: Critical

**Description**: Universal essential question generator. Decomposes ANY subject into 15-20 critical questions before analysis. Works across all domains.

**Memory Keys**:
- `research/meta/questions`
- `research/foundation/decomposition`

**Output Artifacts**:
- `essential-questions.md`
- `knowledge-gaps.md`

**Capabilities**:
- Question generation
- Knowledge gap identification
- Research planning
- Confidence assessment

---

#### 2. step-back-analyzer

**File**: `step-back-analyzer.md`
**Type**: Meta-Analyst

**Description**: Establishes guiding principles and high-level framing before diving into details. Creates abstraction analysis.

**Memory Keys**:
- `research/foundation/framing`
- `research/meta/perspective`

**Output Artifacts**:
- `high-level-framing.md`
- `abstraction-analysis.md`

---

#### 3. ambiguity-clarifier

**File**: `ambiguity-clarifier.md`
**Type**: Analyst

**Description**: Identifies and resolves terminology and requirement ambiguities. Clarifies scope boundaries.

**Memory Keys**:
- `research/foundation/definitions`
- `research/meta/clarifications`

**Output Artifacts**:
- `term-definitions.md`
- `clarified-scope.md`

---

#### 4. construct-definer

**File**: `construct-definer.md`
**Type**: Analyst

**Description**: Defines all key constructs, variables, and theoretical concepts with operationalizations.

**Memory Keys**:
- `research/foundation/constructs`
- `research/theory/definitions`

**Output Artifacts**:
- `construct-definitions.md`
- `operationalizations.md`

---

#### 5. theoretical-framework-analyst

**File**: `theoretical-framework-analyst.md`
**Type**: Analyst

**Description**: Identifies and analyzes theoretical frameworks relevant to the research domain.

**Memory Keys**:
- `research/foundation/framework`
- `research/theory/analysis`

**Output Artifacts**:
- `theoretical-framework.md`
- `framework-map.md`

---

#### 6. research-planner

**File**: `research-planner.md`
**Type**: Planner

**Description**: Creates comprehensive research plan using ReWOO methodology. Establishes timeline and strategy.

**Memory Keys**:
- `research/foundation/plan`
- `research/meta/strategy`

**Output Artifacts**:
- `research-plan.md`
- `timeline.md`

---

### Phase 2: Literature (5 Agents)

#### 7. literature-mapper

**File**: `literature-mapper.md`
**Type**: Researcher

**Description**: Conducts systematic literature search and creates knowledge maps. Builds source catalog.

**Memory Keys**:
- `research/literature/map`
- `research/sources/index`

**Output Artifacts**:
- `literature-map.md`
- `source-catalog.md`

---

#### 8. source-tier-classifier

**File**: `source-tier-classifier.md`
**Type**: Classifier

**Description**: Classifies sources into Tier 1 (primary), Tier 2 (secondary), Tier 3 (tertiary) based on quality and credibility.

**Memory Keys**:
- `research/literature/tiers`
- `research/quality/sources`

**Output Artifacts**:
- `source-tiers.md`
- `credibility-assessment.md`

---

#### 9. methodology-scanner

**File**: `methodology-scanner.md`
**Type**: Scanner

**Description**: Scans and categorizes research methodologies across the corpus. Creates method comparison.

**Memory Keys**:
- `research/literature/methods`
- `research/methodology/survey`

**Output Artifacts**:
- `methodology-survey.md`
- `method-comparison.md`

---

#### 10. context-tier-manager

**File**: `context-tier-manager.md`
**Type**: Manager

**Description**: Organizes research context into hot/warm/cold tiers for efficient retrieval.

**Memory Keys**:
- `research/literature/context`
- `research/meta/tiers`

**Output Artifacts**:
- `context-hierarchy.md`
- `tier-mappings.md`

---

#### 11. systematic-reviewer

**File**: `systematic-reviewer.md`
**Type**: Reviewer

**Description**: Conducts PRISMA-compliant systematic literature review with flowchart documentation.

**Memory Keys**:
- `research/literature/systematic`
- `research/synthesis/systematic-review`

**Output Artifacts**:
- `systematic-review.md`
- `prisma-flowchart.md`

---

### Phase 3: Analysis (6 Agents)

#### 12. quality-assessor

**File**: `quality-assessor.md`
**Type**: Assessor

**Description**: Assesses study quality using CASP, JBI, and other validated assessment tools.

**Memory Keys**:
- `research/analysis/quality`
- `research/meta/assessment`

**Output Artifacts**:
- `quality-assessment.md`
- `quality-scores.md`

---

#### 13. contradiction-analyzer

**File**: `contradiction-analyzer.md`
**Type**: Analyzer

**Description**: Identifies contradictions, inconsistencies, and conflicting findings across sources.

**Memory Keys**:
- `research/analysis/contradictions`
- `research/findings/conflicts`

**Output Artifacts**:
- `contradictions-report.md`
- `resolution-proposals.md`

---

#### 14. bias-detector

**File**: `bias-detector.md`
**Type**: Detector

**Description**: Identifies publication bias, selection bias, and systematic biases in the literature.

**Memory Keys**:
- `research/analysis/bias`
- `research/quality/bias`

**Output Artifacts**:
- `bias-analysis.md`
- `bias-mitigation.md`

---

#### 15. risk-analyst

**File**: `risk-analyst.md`
**Type**: Analyst

**Description**: Identifies research risks using FMEA (Failure Mode and Effects Analysis) methodology.

**Memory Keys**:
- `research/analysis/risks`
- `research/meta/risks`

**Output Artifacts**:
- `risk-assessment.md`
- `risk-mitigation.md`

---

#### 16. evidence-synthesizer

**File**: `evidence-synthesizer.md`
**Type**: Synthesizer

**Description**: Synthesizes evidence using meta-analysis, narrative synthesis, or thematic synthesis methods.

**Memory Keys**:
- `research/analysis/evidence`
- `research/synthesis/evidence`

**Output Artifacts**:
- `evidence-synthesis.md`
- `evidence-matrix.md`

---

#### 17. gap-hunter

**File**: `gap-hunter.md`
**Type**: Hunter

**Description**: Discovers 15+ high-value research gaps systematically. Prioritizes gaps by impact.

**Memory Keys**:
- `research/analysis/gaps`
- `research/findings/gaps`

**Output Artifacts**:
- `research-gaps.md`
- `gap-priorities.md`

---

### Phase 4: Synthesis (6 Agents)

#### 18. pattern-analyst

**File**: `pattern-analyst.md`
**Type**: Analyst

**Description**: Pattern identification, thematic analysis, and contradiction resolution.

**Memory Keys**:
- `research/synthesis/patterns`
- `research/findings/patterns`

**Output Artifacts**:
- `pattern-analysis.md`
- `pattern-catalog.md`

---

#### 19. thematic-synthesizer

**File**: `thematic-synthesizer.md`
**Type**: Synthesizer

**Description**: Synthesizes recurring themes across literature into coherent thematic framework.

**Memory Keys**:
- `research/synthesis/themes`
- `research/findings/themes`

**Output Artifacts**:
- `thematic-synthesis.md`
- `theme-hierarchy.md`

---

#### 20. theory-builder

**File**: `theory-builder.md`
**Type**: Builder

**Description**: Constructs theoretical frameworks from synthesized themes and patterns.

**Memory Keys**:
- `research/synthesis/theory`
- `research/theory/construction`

**Output Artifacts**:
- `theory-development.md`
- `theoretical-model.md`

---

#### 21. hypothesis-generator

**File**: `hypothesis-generator.md`
**Type**: Generator

**Description**: Generates testable hypotheses from theoretical framework.

**Memory Keys**:
- `research/synthesis/hypotheses`
- `research/theory/hypotheses`

**Output Artifacts**:
- `hypotheses.md`
- `testable-predictions.md`

---

#### 22. model-architect

**File**: `model-architect.md`
**Type**: Architect

**Description**: Builds testable structural models from hypotheses with specifications.

**Memory Keys**:
- `research/synthesis/models`
- `research/theory/models`

**Output Artifacts**:
- `conceptual-model.md`
- `model-specifications.md`

---

#### 23. opportunity-identifier

**File**: `opportunity-identifier.md`
**Type**: Identifier

**Description**: Identifies research opportunities and gaps with opportunity matrix.

**Memory Keys**:
- `research/synthesis/opportunities`
- `research/findings/opportunities`

**Output Artifacts**:
- `research-opportunities.md`
- `opportunity-matrix.md`

---

### Phase 5: Methods (6 Agents)

#### 24. method-designer

**File**: `method-designer.md`
**Type**: Designer

**Description**: Designs comprehensive research methodologies with rationale.

**Memory Keys**:
- `research/methods/design`
- `research/methodology/approach`

**Output Artifacts**:
- `research-design.md`
- `method-rationale.md`

---

#### 25. sampling-strategist

**File**: `sampling-strategist.md`
**Type**: Strategist

**Description**: Creates detailed sampling strategies with sample specifications.

**Memory Keys**:
- `research/methods/sampling`
- `research/methodology/sampling`

**Output Artifacts**:
- `sampling-strategy.md`
- `sample-specifications.md`

---

#### 26. instrument-developer

**File**: `instrument-developer.md`
**Type**: Developer

**Description**: Develops or adapts measurement instruments with validation protocols.

**Memory Keys**:
- `research/methods/instruments`
- `research/methodology/instruments`

**Output Artifacts**:
- `research-instruments.md`
- `instrument-validation.md`

---

#### 27. analysis-planner

**File**: `analysis-planner.md`
**Type**: Planner

**Description**: Designs rigorous statistical or qualitative analysis strategies.

**Memory Keys**:
- `research/methods/analysis`
- `research/methodology/analysis`

**Output Artifacts**:
- `analysis-plan.md`
- `statistical-approach.md`

---

#### 28. ethics-reviewer

**File**: `ethics-reviewer.md`
**Type**: Reviewer

**Description**: Ensures IRB compliance and ethical research conduct. Produces protocol documentation.

**Memory Keys**:
- `research/methods/ethics`
- `research/compliance/ethics`

**Output Artifacts**:
- `ethics-review.md`
- `irb-protocol.md`

---

#### 29. validity-guardian

**File**: `validity-guardian.md`
**Type**: Guardian

**Description**: Protects internal, external, construct, and statistical validity. Identifies threats.

**Memory Keys**:
- `research/methods/validity`
- `research/quality/validity`

**Output Artifacts**:
- `validity-assessment.md`
- `threat-mitigation.md`

---

### Phase 6: Writing (8 Agents)

#### 30. dissertation-architect

**File**: `dissertation-architect.md`
**Type**: Structure-Planner
**Priority**: Critical

**Description**: Designs dissertation chapter structure based on research scope. MUST run before any writing agents. Locks structure to memory.

**Memory Keys**:
- `research/writing/structure`
- `research/document/architecture`

**Output Artifacts**:
- `dissertation-outline.md`
- `chapter-structure.md`

**Special Notes**: Creates the `05-chapter-structure.md` file with locked JSON structure required by Phase 8.

---

#### 31. abstract-writer

**File**: `abstract-writer.md`
**Type**: Writer

**Description**: Generates publication-quality abstracts and executive summaries.

**Memory Keys**:
- `research/writing/abstract`
- `research/document/abstract`

**Output Artifacts**:
- `abstract.md`
- `executive-summary.md`

---

#### 32. introduction-writer

**File**: `introduction-writer.md`
**Type**: Writer

**Description**: Generates PhD-level introduction sections with problem statement.

**Memory Keys**:
- `research/writing/introduction`
- `research/document/chapter1`

**Output Artifacts**:
- `introduction.md`
- `problem-statement.md`

---

#### 33. literature-review-writer

**File**: `literature-review-writer.md`
**Type**: Writer

**Description**: Generates comprehensive literature review sections with synthesis narrative.

**Memory Keys**:
- `research/writing/literature`
- `research/document/chapter2`

**Output Artifacts**:
- `literature-review.md`
- `synthesis-narrative.md`

---

#### 34. methodology-writer

**File**: `methodology-writer.md`
**Type**: Writer

**Description**: Generates comprehensive methodology sections with method details.

**Memory Keys**:
- `research/writing/methodology`
- `research/document/chapter3`

**Output Artifacts**:
- `methodology-chapter.md`
- `method-details.md`

---

#### 35. results-writer

**File**: `results-writer.md`
**Type**: Writer

**Description**: Presents findings with statistical rigor and findings narrative.

**Memory Keys**:
- `research/writing/results`
- `research/document/chapter4`

**Output Artifacts**:
- `results-chapter.md`
- `findings-narrative.md`

---

#### 36. discussion-writer

**File**: `discussion-writer.md`
**Type**: Writer

**Description**: Interprets findings, links to literature, addresses limitations, and implications.

**Memory Keys**:
- `research/writing/discussion`
- `research/document/chapter5`

**Output Artifacts**:
- `discussion-chapter.md`
- `implications.md`

---

#### 37. conclusion-writer

**File**: `conclusion-writer.md`
**Type**: Writer

**Description**: Synthesizes study contributions and forward-looking vision with future directions.

**Memory Keys**:
- `research/writing/conclusion`
- `research/document/chapter6`

**Output Artifacts**:
- `conclusion-chapter.md`
- `future-directions.md`

---

### Phase 7: Quality (9 Agents)

#### 38. apa-citation-specialist

**File**: `apa-citation-specialist.md`
**Type**: Specialist

**Description**: Full APA 7th edition formatting specialist. Audits and corrects citations.

**Memory Keys**:
- `research/quality/citations`
- `research/document/references`

**Output Artifacts**:
- `citation-audit.md`
- `apa-compliance.md`

---

#### 39. citation-extractor

**File**: `citation-extractor.md`
**Type**: Extractor

**Description**: Extracts and formats complete citations with full explainability.

**Memory Keys**:
- `research/quality/extraction`
- `research/sources/citations`

**Output Artifacts**:
- `extracted-citations.md`
- `reference-list.md`

---

#### 40. citation-validator

**File**: `citation-validator.md`
**Type**: Validator

**Description**: Ensures every citation is complete with Author, Year, URL verification.

**Memory Keys**:
- `research/quality/validation`
- `research/sources/verified`

**Output Artifacts**:
- `citation-validation.md`
- `source-verification.md`

---

#### 41. adversarial-reviewer

**File**: `adversarial-reviewer.md`
**Type**: Reviewer

**Description**: Red team critique - challenges assumptions, identifies weaknesses, stress tests arguments.

**Memory Keys**:
- `research/quality/critique`
- `research/review/adversarial`

**Output Artifacts**:
- `adversarial-critique.md`
- `weakness-report.md`

---

#### 42. confidence-quantifier

**File**: `confidence-quantifier.md`
**Type**: Quantifier

**Description**: Assigns probability estimates to claims, calibrates confidence levels.

**Memory Keys**:
- `research/quality/confidence`
- `research/meta/certainty`

**Output Artifacts**:
- `confidence-scores.md`
- `uncertainty-analysis.md`

---

#### 43. reproducibility-checker

**File**: `reproducibility-checker.md`
**Type**: Checker

**Description**: Ensures methods, data, and analyses are fully documented for replication.

**Memory Keys**:
- `research/quality/reproducibility`
- `research/meta/replication`

**Output Artifacts**:
- `reproducibility-report.md`
- `replication-guide.md`

---

#### 44. consistency-validator

**File**: `consistency-validator.md`
**Type**: Validator

**Description**: Validates all chapter cross-references match document structure.

**Memory Keys**:
- `research/quality/consistency`
- `research/document/coherence`

**Output Artifacts**:
- `consistency-report.md`
- `coherence-audit.md`

---

#### 45. file-length-manager

**File**: `file-length-manager.md`
**Type**: Manager

**Description**: Monitors file length and splits at 1500 lines with proper context preservation.

**Memory Keys**:
- `research/quality/structure`
- `research/document/formatting`

**Output Artifacts**:
- `structure-audit.md`
- `length-compliance.md`

---

#### 46. chapter-synthesizer

**File**: `chapter-synthesizer.md`
**Type**: Synthesizer

**Description**: Transforms research outputs into publication-ready prose for final dissertation.

**Memory Keys**:
- `research/quality/synthesis`
- `research/document/final`

**Output Artifacts**:
- `final-synthesis.md`
- `dissertation-complete.md`

---

## Agent File Format

Each agent is defined in a markdown file with YAML frontmatter:

```yaml
---
tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch
name: agent-key-name
type: agent-type
color: "#hexcolor"
description: Brief description of agent purpose
capabilities:
  allowed_tools:
    - Read
    - Write
    - ... (list of tools)
  skills:
    - skill_1
    - skill_2
priority: critical | high | normal
hooks:
  pre: |
    # Commands to run before agent execution
  post: |
    # Commands to run after agent execution
---

# Agent Title

## Content sections...
```

---

## Validating Agent Files

```bash
# Validate all 46 agent files exist and are valid
npx phd-cli validate-agents --verbose

# Expected output:
# Agent validation: 46/46 agents valid
# All agent files found in .claude/agents/phdresearch/
```
