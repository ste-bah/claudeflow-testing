# PhD Pipeline Fix - Technical Specification

**Document ID**: TECH-PHD-001
**Version**: 1.0
**Created**: 2026-01-01
**Status**: Draft
**Implements**: PRD-2026-001, FUNC-PHD-001

---

## 1. Overview

This Technical Specification defines HOW to implement the PhD Pipeline fix. It provides exact code structures, interfaces, and implementation details for the requirements defined in the PRD and Functional Specification.

### 1.1 Scope

| Component | Changes Required |
|-----------|-----------------|
| `phd-pipeline-config.ts` | Replace 43 incorrect keys, add prompt templates |
| `phd-cli.ts` | Enhance prompt injection, workflow context |
| Agent Files | Verification only (no changes) |
| `final-stage-orchestrator.ts` | No changes (preserve existing) |

### 1.2 Implementation Constraints

Per Constitution RULE-001 through RULE-006:
- No placeholder code
- No `as any` casts
- No `exec()` calls
- Complete error handling
- Explicit return types

---

## 2. File Locations

```
src/god-agent/cli/
├── phd-pipeline-config.ts   ← PRIMARY CHANGE
├── phd-cli.ts               ← ENHANCEMENT
└── final-stage-orchestrator.ts  ← NO CHANGE

.claude/agents/phdresearch/
├── [46 agent files]         ← VERIFY ONLY
```

---

## 3. TypeScript Interfaces

### 3.1 Core Data Structures

```typescript
// phd-pipeline-config.ts

/**
 * Configuration for a single PhD research agent
 */
export interface AgentConfig {
  /** Unique identifier matching phdresearch file (without .md) */
  key: string;

  /** Human-readable agent name */
  name: string;

  /** Pipeline phase (1-7) */
  phase: 1 | 2 | 3 | 4 | 5 | 6 | 7;

  /** Order within phase (1-based) */
  order: number;

  /** Agent's primary function description */
  description: string;

  /** Memory domains this agent reads from */
  memoryReads: string[];

  /** Memory domain this agent writes to */
  memoryWrites: string;

  /** Optional: Is this agent dynamic (Phase 6 writers) */
  isDynamic?: boolean;

  /** Optional: Is this a support agent (not in sequential pipeline) */
  isSupport?: boolean;
}

/**
 * Complete pipeline configuration
 */
export interface PipelineConfig {
  /** All agent configurations */
  agents: AgentConfig[];

  /** Total agent count (excluding dynamic) */
  totalAgents: number;

  /** Phase definitions */
  phases: PhaseDefinition[];
}

/**
 * Phase metadata
 */
export interface PhaseDefinition {
  /** Phase number (1-7) */
  number: 1 | 2 | 3 | 4 | 5 | 6 | 7;

  /** Phase name */
  name: string;

  /** Agent keys in execution order */
  agentKeys: string[];

  /** Is this phase dynamic (agents determined at runtime) */
  isDynamic: boolean;
}
```

### 3.2 Session State Interface

```typescript
// phd-cli.ts

/**
 * Persistent session state
 */
export interface SessionState {
  /** Unique session identifier */
  sessionId: string;

  /** Research topic/slug */
  slug: string;

  /** Current phase (1-8) */
  currentPhase: number;

  /** Current agent index within phase */
  currentAgentIndex: number;

  /** Completed agent keys */
  completedAgents: string[];

  /** Session creation timestamp */
  createdAt: string;

  /** Last update timestamp */
  updatedAt: string;

  /** Session status */
  status: 'active' | 'complete' | 'error';

  /** Chapter structure (for dynamic Phase 6) */
  chapterStructure?: ChapterDefinition[];
}

/**
 * Chapter definition for dynamic Phase 6
 */
export interface ChapterDefinition {
  /** Chapter number */
  number: number;

  /** Chapter title */
  title: string;

  /** Required writer key */
  writerKey: string;
}
```

### 3.3 Result Interfaces

```typescript
/**
 * Result from getNextAgent()
 */
export interface NextAgentResult {
  /** Agent key */
  key: string;

  /** Agent display name */
  name: string;

  /** Complete prompt with injections */
  prompt: string;

  /** Current phase */
  phase: number;

  /** Position in pipeline (1-45) */
  position: number;

  /** Previous agent key (null if first) */
  previousAgent: string | null;

  /** Next agent key (null if last in phase) */
  nextAgent: string | null;

  /** Memory retrieval commands */
  memoryCommands: string[];
}

/**
 * Pipeline initialization result
 */
export interface InitResult {
  /** Session ID */
  sessionId: string;

  /** First agent details */
  firstAgent: NextAgentResult;

  /** Total agents in pipeline */
  totalAgents: number;
}
```

---

## 4. Agent Configuration Data

### 4.1 Complete Agent Mapping

The following is the EXACT configuration to replace the current incorrect mapping:

```typescript
export const PHD_AGENTS: AgentConfig[] = [
  // ============================================
  // PHASE 1: FOUNDATION (6 agents)
  // ============================================
  {
    key: 'step-back-analyzer',
    name: 'Step-Back Analyzer',
    phase: 1,
    order: 1,
    description: 'Establishes guiding principles before diving into details',
    memoryReads: [],
    memoryWrites: 'project/research/step-back-analyzer/principles'
  },
  {
    key: 'self-ask-decomposer',
    name: 'Self-Ask Decomposer',
    phase: 1,
    order: 2,
    description: 'Decomposes subject into 15-20 critical questions',
    memoryReads: ['project/research/step-back-analyzer/principles'],
    memoryWrites: 'project/research/self-ask-decomposer/questions'
  },
  {
    key: 'construct-definer',
    name: 'Construct Definer',
    phase: 1,
    order: 3,
    description: 'Defines all key constructs, variables, and theoretical concepts',
    memoryReads: ['project/research/self-ask-decomposer/questions'],
    memoryWrites: 'project/research/construct-definer/constructs'
  },
  {
    key: 'ambiguity-clarifier',
    name: 'Ambiguity Clarifier',
    phase: 1,
    order: 4,
    description: 'Identifies and resolves terminology and requirement ambiguities',
    memoryReads: ['project/research/construct-definer/constructs'],
    memoryWrites: 'project/research/ambiguity-clarifier/clarifications'
  },
  {
    key: 'research-planner',
    name: 'Research Planner',
    phase: 1,
    order: 5,
    description: 'Creates comprehensive research plan using ReWOO methodology',
    memoryReads: ['project/research/ambiguity-clarifier/clarifications'],
    memoryWrites: 'project/research/research-planner/plan'
  },
  {
    key: 'dissertation-architect',
    name: 'Dissertation Architect',
    phase: 1,
    order: 6,
    description: 'Designs dissertation/document chapter structure',
    memoryReads: ['project/research/research-planner/plan'],
    memoryWrites: 'project/research/dissertation-architect/structure'
  },

  // ============================================
  // PHASE 2: DISCOVERY (7 agents)
  // ============================================
  {
    key: 'literature-mapper',
    name: 'Literature Mapper',
    phase: 2,
    order: 1,
    description: 'Conducts systematic literature search and creates knowledge maps',
    memoryReads: ['project/research/dissertation-architect/structure'],
    memoryWrites: 'project/research/literature-mapper/map'
  },
  {
    key: 'citation-extractor',
    name: 'Citation Extractor',
    phase: 2,
    order: 2,
    description: 'Extracts and formats complete APA citations with full explainability',
    memoryReads: ['project/research/literature-mapper/map'],
    memoryWrites: 'project/research/citation-extractor/citations'
  },
  {
    key: 'methodology-scanner',
    name: 'Methodology Scanner',
    phase: 2,
    order: 3,
    description: 'Scans and categorizes research methodologies across corpus',
    memoryReads: ['project/research/citation-extractor/citations'],
    memoryWrites: 'project/research/methodology-scanner/methods'
  },
  {
    key: 'systematic-reviewer',
    name: 'Systematic Reviewer',
    phase: 2,
    order: 4,
    description: 'Conducts PRISMA-compliant systematic literature review',
    memoryReads: ['project/research/methodology-scanner/methods'],
    memoryWrites: 'project/research/systematic-reviewer/review'
  },
  {
    key: 'source-tier-classifier',
    name: 'Source Tier Classifier',
    phase: 2,
    order: 5,
    description: 'Classifies sources into Tier 1/2/3 based on quality',
    memoryReads: ['project/research/systematic-reviewer/review'],
    memoryWrites: 'project/research/source-tier-classifier/tiers'
  },
  {
    key: 'quality-assessor',
    name: 'Quality Assessor',
    phase: 2,
    order: 6,
    description: 'Assesses study quality using CASP, JBI, and other validated tools',
    memoryReads: ['project/research/source-tier-classifier/tiers'],
    memoryWrites: 'project/research/quality-assessor/assessments'
  },
  {
    key: 'context-tier-manager',
    name: 'Context Tier Manager',
    phase: 2,
    order: 7,
    description: 'Organizes research context into hot/warm/cold tiers',
    memoryReads: ['project/research/quality-assessor/assessments'],
    memoryWrites: 'project/research/context-tier-manager/tiers'
  },

  // ============================================
  // PHASE 3: ANALYSIS (7 agents)
  // ============================================
  {
    key: 'theoretical-framework-analyst',
    name: 'Theoretical Framework Analyst',
    phase: 3,
    order: 1,
    description: 'Identifies and analyzes theoretical frameworks',
    memoryReads: ['project/research/context-tier-manager/tiers'],
    memoryWrites: 'project/research/theoretical-framework-analyst/frameworks'
  },
  {
    key: 'gap-hunter',
    name: 'Gap Hunter',
    phase: 3,
    order: 2,
    description: 'Discovers 15+ high-value research gaps systematically',
    memoryReads: ['project/research/theoretical-framework-analyst/frameworks'],
    memoryWrites: 'project/research/gap-hunter/gaps'
  },
  {
    key: 'contradiction-analyzer',
    name: 'Contradiction Analyzer',
    phase: 3,
    order: 3,
    description: 'Identifies contradictions, inconsistencies, and conflicting findings',
    memoryReads: ['project/research/gap-hunter/gaps'],
    memoryWrites: 'project/research/contradiction-analyzer/contradictions'
  },
  {
    key: 'bias-detector',
    name: 'Bias Detector',
    phase: 3,
    order: 4,
    description: 'Identifies publication bias, selection bias, and systematic biases',
    memoryReads: ['project/research/contradiction-analyzer/contradictions'],
    memoryWrites: 'project/research/bias-detector/biases'
  },
  {
    key: 'risk-analyst',
    name: 'Risk Analyst',
    phase: 3,
    order: 5,
    description: 'Identifies research risks using FMEA methodology',
    memoryReads: ['project/research/bias-detector/biases'],
    memoryWrites: 'project/research/risk-analyst/risks'
  },
  {
    key: 'ethics-reviewer',
    name: 'Ethics Reviewer',
    phase: 3,
    order: 6,
    description: 'Ensures IRB compliance, ethical research conduct',
    memoryReads: ['project/research/risk-analyst/risks'],
    memoryWrites: 'project/research/ethics-reviewer/ethics'
  },
  {
    key: 'validity-guardian',
    name: 'Validity Guardian',
    phase: 3,
    order: 7,
    description: 'Protects internal, external, construct, and statistical validity',
    memoryReads: ['project/research/ethics-reviewer/ethics'],
    memoryWrites: 'project/research/validity-guardian/validity'
  },

  // ============================================
  // PHASE 4: SYNTHESIS (7 agents)
  // ============================================
  {
    key: 'evidence-synthesizer',
    name: 'Evidence Synthesizer',
    phase: 4,
    order: 1,
    description: 'Synthesizes evidence using meta-analysis, narrative, or thematic',
    memoryReads: ['project/research/validity-guardian/validity'],
    memoryWrites: 'project/research/evidence-synthesizer/synthesis'
  },
  {
    key: 'pattern-analyst',
    name: 'Pattern Analyst',
    phase: 4,
    order: 2,
    description: 'Pattern identification, thematic analysis, contradiction resolution',
    memoryReads: ['project/research/evidence-synthesizer/synthesis'],
    memoryWrites: 'project/research/pattern-analyst/patterns'
  },
  {
    key: 'thematic-synthesizer',
    name: 'Thematic Synthesizer',
    phase: 4,
    order: 3,
    description: 'Synthesizes recurring themes across literature',
    memoryReads: ['project/research/pattern-analyst/patterns'],
    memoryWrites: 'project/research/thematic-synthesizer/themes'
  },
  {
    key: 'theory-builder',
    name: 'Theory Builder',
    phase: 4,
    order: 4,
    description: 'Constructs theoretical frameworks from themes',
    memoryReads: ['project/research/thematic-synthesizer/themes'],
    memoryWrites: 'project/research/theory-builder/theory'
  },
  {
    key: 'hypothesis-generator',
    name: 'Hypothesis Generator',
    phase: 4,
    order: 5,
    description: 'Generates testable hypotheses from theory',
    memoryReads: ['project/research/theory-builder/theory'],
    memoryWrites: 'project/research/hypothesis-generator/hypotheses'
  },
  {
    key: 'model-architect',
    name: 'Model Architect',
    phase: 4,
    order: 6,
    description: 'Builds testable structural models from hypotheses',
    memoryReads: ['project/research/hypothesis-generator/hypotheses'],
    memoryWrites: 'project/research/model-architect/models'
  },
  {
    key: 'opportunity-identifier',
    name: 'Opportunity Identifier',
    phase: 4,
    order: 7,
    description: 'Identifies research opportunities and gaps',
    memoryReads: ['project/research/model-architect/models'],
    memoryWrites: 'project/research/opportunity-identifier/opportunities'
  },

  // ============================================
  // PHASE 5: DESIGN (4 agents)
  // ============================================
  {
    key: 'method-designer',
    name: 'Method Designer',
    phase: 5,
    order: 1,
    description: 'Designs comprehensive research methodologies',
    memoryReads: ['project/research/opportunity-identifier/opportunities'],
    memoryWrites: 'project/research/method-designer/methodology'
  },
  {
    key: 'analysis-planner',
    name: 'Analysis Planner',
    phase: 5,
    order: 2,
    description: 'Designs rigorous statistical/qualitative analysis strategies',
    memoryReads: ['project/research/method-designer/methodology'],
    memoryWrites: 'project/research/analysis-planner/analysis-plan'
  },
  {
    key: 'sampling-strategist',
    name: 'Sampling Strategist',
    phase: 5,
    order: 3,
    description: 'Creates detailed sampling strategies',
    memoryReads: ['project/research/analysis-planner/analysis-plan'],
    memoryWrites: 'project/research/sampling-strategist/sampling'
  },
  {
    key: 'instrument-developer',
    name: 'Instrument Developer',
    phase: 5,
    order: 4,
    description: 'Develops/adapts measurement instruments',
    memoryReads: ['project/research/sampling-strategist/sampling'],
    memoryWrites: 'project/research/instrument-developer/instruments'
  },

  // ============================================
  // PHASE 6: WRITING (8 agents - DYNAMIC)
  // ============================================
  {
    key: 'introduction-writer',
    name: 'Introduction Writer',
    phase: 6,
    order: 1,
    description: 'Generates PhD-level Introduction sections',
    memoryReads: ['project/research/instrument-developer/instruments'],
    memoryWrites: 'project/research/introduction-writer/introduction',
    isDynamic: true
  },
  {
    key: 'literature-review-writer',
    name: 'Literature Review Writer',
    phase: 6,
    order: 2,
    description: 'Generates comprehensive Literature Review sections',
    memoryReads: ['project/research/introduction-writer/introduction'],
    memoryWrites: 'project/research/literature-review-writer/lit-review',
    isDynamic: true
  },
  {
    key: 'methodology-writer',
    name: 'Methodology Writer',
    phase: 6,
    order: 3,
    description: 'Generates comprehensive Methodology sections',
    memoryReads: ['project/research/literature-review-writer/lit-review'],
    memoryWrites: 'project/research/methodology-writer/methodology',
    isDynamic: true
  },
  {
    key: 'results-writer',
    name: 'Results Writer',
    phase: 6,
    order: 4,
    description: 'Presents findings with statistical rigor',
    memoryReads: ['project/research/methodology-writer/methodology'],
    memoryWrites: 'project/research/results-writer/results',
    isDynamic: true
  },
  {
    key: 'discussion-writer',
    name: 'Discussion Writer',
    phase: 6,
    order: 5,
    description: 'Interprets findings, links to literature, addresses limitations',
    memoryReads: ['project/research/results-writer/results'],
    memoryWrites: 'project/research/discussion-writer/discussion',
    isDynamic: true
  },
  {
    key: 'conclusion-writer',
    name: 'Conclusion Writer',
    phase: 6,
    order: 6,
    description: 'Synthesizes study contributions and forward-looking vision',
    memoryReads: ['project/research/discussion-writer/discussion'],
    memoryWrites: 'project/research/conclusion-writer/conclusion',
    isDynamic: true
  },
  {
    key: 'abstract-writer',
    name: 'Abstract Writer',
    phase: 6,
    order: 7,
    description: 'Generates publication-quality abstracts',
    memoryReads: ['project/research/conclusion-writer/conclusion'],
    memoryWrites: 'project/research/abstract-writer/abstract',
    isDynamic: true
  },
  {
    key: 'apa-citation-specialist',
    name: 'APA Citation Specialist',
    phase: 6,
    order: 0, // Support agent - not in sequential pipeline
    description: 'Full APA 7th edition formatting specialist (SUPPORT - called on-demand)',
    memoryReads: [], // Called by other agents as needed
    memoryWrites: 'project/research/apa-citation-specialist/formatted',
    isDynamic: true,
    isSupport: true // Not part of sequential 45-agent flow
  },

  // ============================================
  // PHASE 7: QA/VALIDATION (7 agents)
  // ============================================
  {
    key: 'adversarial-reviewer',
    name: 'Adversarial Reviewer',
    phase: 7,
    order: 1,
    description: 'Red team critique - challenges assumptions, identifies weaknesses',
    memoryReads: ['project/research/apa-citation-specialist/formatted'],
    memoryWrites: 'project/research/adversarial-reviewer/critique'
  },
  {
    key: 'confidence-quantifier',
    name: 'Confidence Quantifier',
    phase: 7,
    order: 2,
    description: 'Assigns probability estimates to claims, calibrates confidence',
    memoryReads: ['project/research/adversarial-reviewer/critique'],
    memoryWrites: 'project/research/confidence-quantifier/confidence'
  },
  {
    key: 'citation-validator',
    name: 'Citation Validator',
    phase: 7,
    order: 3,
    description: 'Ensures every citation complete with Author, Year, URL',
    memoryReads: ['project/research/confidence-quantifier/confidence'],
    memoryWrites: 'project/research/citation-validator/validated'
  },
  {
    key: 'reproducibility-checker',
    name: 'Reproducibility Checker',
    phase: 7,
    order: 4,
    description: 'Ensures methods, data, analyses fully documented for replication',
    memoryReads: ['project/research/citation-validator/validated'],
    memoryWrites: 'project/research/reproducibility-checker/reproducibility'
  },
  {
    key: 'consistency-validator',
    name: 'Consistency Validator',
    phase: 7,
    order: 5,
    description: 'Validates all chapter cross-references match document structure',
    memoryReads: ['project/research/reproducibility-checker/reproducibility'],
    memoryWrites: 'project/research/consistency-validator/consistency'
  },
  {
    key: 'chapter-synthesizer',
    name: 'Chapter Synthesizer',
    phase: 7,
    order: 6,
    description: 'Transforms research outputs into publication-ready prose',
    memoryReads: ['project/research/consistency-validator/consistency'],
    memoryWrites: 'project/research/chapter-synthesizer/chapters'
  },
  {
    key: 'file-length-manager',
    name: 'File Length Manager',
    phase: 7,
    order: 7,
    description: 'Monitors file length and splits at 1500 lines with context',
    memoryReads: ['project/research/chapter-synthesizer/chapters'],
    memoryWrites: 'project/research/file-length-manager/final'
  }
];
```

### 4.2 Phase Definitions

```typescript
export const PHD_PHASES: PhaseDefinition[] = [
  {
    number: 1,
    name: 'Foundation',
    agentKeys: [
      'step-back-analyzer',
      'self-ask-decomposer',
      'construct-definer',
      'ambiguity-clarifier',
      'research-planner',
      'dissertation-architect'
    ],
    isDynamic: false
  },
  {
    number: 2,
    name: 'Discovery',
    agentKeys: [
      'literature-mapper',
      'citation-extractor',
      'methodology-scanner',
      'systematic-reviewer',
      'source-tier-classifier',
      'quality-assessor',
      'context-tier-manager'
    ],
    isDynamic: false
  },
  {
    number: 3,
    name: 'Analysis',
    agentKeys: [
      'theoretical-framework-analyst',
      'gap-hunter',
      'contradiction-analyzer',
      'bias-detector',
      'risk-analyst',
      'ethics-reviewer',
      'validity-guardian'
    ],
    isDynamic: false
  },
  {
    number: 4,
    name: 'Synthesis',
    agentKeys: [
      'evidence-synthesizer',
      'pattern-analyst',
      'thematic-synthesizer',
      'theory-builder',
      'hypothesis-generator',
      'model-architect',
      'opportunity-identifier'
    ],
    isDynamic: false
  },
  {
    number: 5,
    name: 'Design',
    agentKeys: [
      'method-designer',
      'analysis-planner',
      'sampling-strategist',
      'instrument-developer'
    ],
    isDynamic: false
  },
  {
    number: 6,
    name: 'Writing',
    agentKeys: [
      'introduction-writer',
      'literature-review-writer',
      'methodology-writer',
      'results-writer',
      'discussion-writer',
      'conclusion-writer',
      'abstract-writer',
      'apa-citation-specialist'
    ],
    isDynamic: true
  },
  {
    number: 7,
    name: 'QA/Validation',
    agentKeys: [
      'adversarial-reviewer',
      'confidence-quantifier',
      'citation-validator',
      'reproducibility-checker',
      'consistency-validator',
      'chapter-synthesizer',
      'file-length-manager'
    ],
    isDynamic: false
  }
];
```

---

## 5. Prompt Template System

### 5.1 Base Prompt Template

Every agent prompt MUST include these sections per Constitution RULE-020, RULE-012, RULE-013:

```typescript
/**
 * Generates complete prompt for an agent
 */
function buildAgentPrompt(
  agent: AgentConfig,
  session: SessionState,
  agentFileContent: string,
  descEpisodes: string[]
): string {
  const position = calculatePosition(agent, session);
  const prevAgent = getPreviousAgent(agent);
  const nextAgent = getNextAgent(agent);

  return `
## YOUR TASK

You are the ${agent.name} (Agent #${position}/45).

${agentFileContent}

---

## WORKFLOW CONTEXT

Agent #${position}/45 | Phase ${agent.phase}: ${getPhaseNameByNumber(agent.phase)}
Previous: ${prevAgent ? `${prevAgent.key} (stored at: ${prevAgent.memoryWrites})` : 'None (you are first)'}
Next: ${nextAgent ? `${nextAgent.key} (needs: ${nextAgent.memoryReads.join(', ')})` : 'Phase transition'}

---

## MEMORY RETRIEVAL

Before starting, retrieve relevant context:

${agent.memoryReads.map(key =>
  `npx claude-flow memory retrieve "${key}" --namespace "research"`
).join('\n')}

${descEpisodes.length > 0 ? `
### Relevant Prior Solutions (DESC Episodes)

${descEpisodes.join('\n\n')}
` : ''}

---

## MEMORY STORAGE

Store your outputs at:

\`\`\`bash
npx claude-flow memory store "${agent.memoryWrites}" '<your-output-json>' --namespace "research"
\`\`\`

---

## TASK COMPLETION SUMMARY

When complete, provide this EXACT format:

\`\`\`markdown
## TASK COMPLETION SUMMARY

**What I Did**: [1-2 sentence summary of your work]

**Files Created/Modified**:
- \`docs/research/${session.slug}/[filename].md\` - [Description]

**Memory Locations**:
- \`${agent.memoryWrites}\` - [What it contains]

**Next Agent Guidance**: [What ${nextAgent?.name || 'the next phase'} should retrieve/know]
\`\`\`

---

## IMPORTANT RULES

1. Complete ALL work - no placeholders, no TODOs
2. Store output in memory before completing
3. Follow the TASK COMPLETION SUMMARY format exactly
4. If blocked, report: BLOCKED | ${agent.key} | [REASON] | [NEED]
`;
}
```

### 5.2 Prompt Injection Points

```typescript
// In phd-cli.ts, the getNextAgent function should:

export async function getNextAgent(session: SessionState): Promise<NextAgentResult> {
  // 1. Get current agent config
  const agent = getCurrentAgent(session);

  // 2. Load agent file content
  const agentFilePath = path.join(
    AGENTS_DIR,
    'phdresearch',
    `${agent.key}.md`
  );
  const agentFileContent = await fs.readFile(agentFilePath, 'utf-8');

  // 3. Get DESC episodes with phase-aware rolling window (Section 7.1)
  const descEpisodes = await getRelevantEpisodes(agent.key, session.slug, agent.phase);

  // 4. Build complete prompt
  const prompt = buildAgentPrompt(agent, session, agentFileContent, descEpisodes);

  // 5. Return result
  return {
    key: agent.key,
    name: agent.name,
    prompt,
    phase: agent.phase,
    position: calculatePosition(agent, session),
    previousAgent: getPreviousAgentKey(agent),
    nextAgent: getNextAgentKey(agent),
    memoryCommands: agent.memoryReads.map(k =>
      `npx claude-flow memory retrieve "${k}" --namespace "research"`
    )
  };
}
```

---

## 6. Function Specifications

### 6.1 Pipeline Initialization

```typescript
/**
 * Initialize a new PhD research pipeline session
 *
 * @param slug - Research topic identifier (kebab-case)
 * @returns InitResult with session ID and first agent
 * @throws Error if validation fails
 *
 * Constitution Compliance:
 * - RULE-005: Complete error handling
 * - RULE-006: Explicit return type
 * - RULE-021: Session persistence
 */
export async function initPipeline(slug: string): Promise<InitResult> {
  // 1. Validate slug format
  if (!isValidSlug(slug)) {
    throw new Error(
      `Invalid slug format: "${slug}". ` +
      `Expected kebab-case (e.g., "ai-ethics-research"). ` +
      `Fix: Use lowercase letters, numbers, and hyphens only.`
    );
  }

  // 2. Validate all agent files exist
  const validationErrors = await validateAgentFiles();
  if (validationErrors.length > 0) {
    throw new Error(
      `Agent file validation failed:\n` +
      validationErrors.map(e => `  - ${e}`).join('\n') +
      `\nFix: Ensure all .md files exist in .claude/agents/phdresearch/`
    );
  }

  // 3. Create session
  const sessionId = generateSessionId();
  const session: SessionState = {
    sessionId,
    slug,
    currentPhase: 1,
    currentAgentIndex: 0,
    completedAgents: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'active'
  };

  // 4. Persist session
  await saveSession(session);

  // 5. Get first agent
  const firstAgent = await getNextAgent(session);

  return {
    sessionId,
    firstAgent,
    totalAgents: PHD_AGENTS.length
  };
}
```

### 6.2 Agent Completion

```typescript
/**
 * Mark current agent as complete and advance pipeline
 *
 * @param sessionId - Session to update
 * @returns Next agent or completion status
 *
 * Constitution Compliance:
 * - RULE-022: Phase transitions
 * - RULE-021: Session persistence
 */
export async function completeAgent(
  sessionId: string
): Promise<NextAgentResult | { status: 'phase_complete' | 'pipeline_complete' }> {
  // 1. Load session
  const session = await loadSession(sessionId);
  if (!session) {
    throw new Error(
      `Session not found: "${sessionId}". ` +
      `Fix: Use 'phd-cli resume' to list available sessions.`
    );
  }

  // 2. Mark current agent complete
  const currentAgent = getCurrentAgent(session);
  session.completedAgents.push(currentAgent.key);
  session.updatedAt = new Date().toISOString();

  // 3. Advance to next agent
  const nextAgent = getNextAgentInPhase(session);

  if (nextAgent) {
    // Same phase, next agent
    session.currentAgentIndex++;
    await saveSession(session);
    return await getNextAgent(session);
  }

  // 4. Phase complete - check for next phase
  const nextPhase = session.currentPhase + 1;

  if (nextPhase <= 7) {
    // Advance to next phase
    session.currentPhase = nextPhase;
    session.currentAgentIndex = 0;
    await saveSession(session);
    return await getNextAgent(session);
  }

  // 5. All phases complete - transition to Phase 8
  session.currentPhase = 8;
  session.status = 'complete';
  await saveSession(session);

  return { status: 'pipeline_complete' };
}
```

### 6.3 Agent File Validation

```typescript
/**
 * Validate all agent files exist
 *
 * @returns Array of validation errors (empty if all valid)
 *
 * Constitution Compliance:
 * - RULE-018: Agent key validity
 */
export async function validateAgentFiles(): Promise<string[]> {
  const errors: string[] = [];
  const agentsDir = path.join(process.cwd(), '.claude', 'agents', 'phdresearch');

  for (const agent of PHD_AGENTS) {
    const filePath = path.join(agentsDir, `${agent.key}.md`);

    try {
      await fs.access(filePath);
    } catch {
      errors.push(
        `Missing agent file for key "${agent.key}": ` +
        `Expected at ${filePath}`
      );
    }
  }

  return errors;
}
```

### 6.4 Session Resume

```typescript
/**
 * Resume an interrupted session
 *
 * @param sessionId - Session to resume
 * @returns Current agent to continue from
 *
 * Constitution Compliance:
 * - RULE-021: Session persistence
 * - EC-02: Session interrupted mid-phase
 */
export async function resumeSession(sessionId: string): Promise<NextAgentResult> {
  const session = await loadSession(sessionId);

  if (!session) {
    throw new Error(
      `Session not found: "${sessionId}". ` +
      `Available sessions:\n` +
      (await listSessions()).map(s => `  - ${s.sessionId} (${s.slug})`).join('\n')
    );
  }

  if (session.status === 'complete') {
    throw new Error(
      `Session "${sessionId}" is already complete. ` +
      `Use 'phd-cli init' to start a new research project.`
    );
  }

  return await getNextAgent(session);
}
```

---

## 7. Error Codes

Per Constitution RULE-005 and RULE-023:

| Code | Name | Description | Recovery |
|------|------|-------------|----------|
| E001 | INVALID_SLUG | Slug format validation failed | Use kebab-case format |
| E002 | AGENT_FILE_MISSING | Agent .md file not found | Check phdresearch folder |
| E003 | SESSION_NOT_FOUND | Session ID doesn't exist | Use resume to list sessions |
| E004 | SESSION_COMPLETE | Session already finished | Start new session with init |
| E005 | PHASE8_SOURCES_MISSING | Final assembly sources missing | Complete all Phase 7 agents |
| E006 | MEMORY_OPERATION_FAILED | claude-flow memory failed | Check memory server status |

---

## 7.1 DESC/UCM Integration (Rolling Context Window)

The `getRelevantEpisodes()` function MUST preserve existing UCM/DESC integration with phase-aware rolling window sizes:

```typescript
/**
 * Get relevant DESC episodes for context injection
 * Uses PhdPipelineAdapter for phase-aware window sizes
 *
 * IMPORTANT: Preserves existing rolling window behavior from phd-cli.ts
 * - Uses 1536D embeddings (NOT 768D - per RULE-004)
 * - Uses UCM client for episode retrieval
 * - Phase-aware window sizes via PhdPipelineAdapter
 */
async function getRelevantEpisodes(
  agentKey: string,
  slug: string,
  phase: number
): Promise<string[]> {
  const ucmClient = getUCMClient();
  if (!(await ucmClient.isHealthy())) {
    return []; // Graceful degradation if UCM unavailable
  }

  const pipelineAdapter = new PhdPipelineAdapter();
  const phaseContext = {
    pipelineName: 'phd-pipeline',
    agentId: agentKey,
    phase: getPhaseName(phase).toLowerCase(),
    task: slug
  };

  const windowSize = pipelineAdapter.getWindowSize(phaseContext);

  const injection = await ucmClient.injectSolutions('', {
    threshold: 0.80,
    maxEpisodes: windowSize,
    agentType: agentKey,
    metadata: { phase, agentKey }
  });

  return injection.episodes || [];
}
```

**Phase-Aware Rolling Window Sizes** (from PhdPipelineAdapter):

| Phase | Name | Window Size | Rationale |
|-------|------|-------------|-----------|
| 1 | Foundation | 2 | Planning context - minimal history |
| 2 | Discovery | 3 | Research context - moderate history |
| 3-5 | Architecture/Synthesis/Design | 3 | Default context |
| 6 | Writing | 5 | Writing context - more history for coherence |
| 7 | Validation | 10 | QA context - comprehensive history |

**Critical**: This implementation uses 1536D embeddings via the existing embedding provider. The 768D dimension was deprecated in Sprint 8 migration.

---

## 8. File Change Summary

### 8.1 phd-pipeline-config.ts

| Section | Change Type | Description |
|---------|-------------|-------------|
| Imports | Modify | Add interface imports |
| Interfaces | Add | AgentConfig, PipelineConfig, PhaseDefinition |
| PHD_AGENTS | Replace | Remove 43 wrong keys, add 46 correct |
| PHD_PHASES | Add | Phase definitions with agent assignments |
| Exports | Modify | Export new constants |

### 8.2 phd-cli.ts

| Section | Change Type | Description |
|---------|-------------|-------------|
| Imports | Modify | Import from updated config |
| buildAgentPrompt | Add | New function for prompt generation |
| getNextAgent | Modify | Use new prompt builder |
| completeAgent | Modify | Use new config structure |
| validateAgentFiles | Add | New validation function |

---

## 9. Testing Strategy

### 9.1 Unit Tests

```typescript
// tests/phd-pipeline-config.test.ts

describe('PHD_AGENTS', () => {
  it('should have 46 agents', () => {
    expect(PHD_AGENTS.length).toBe(46);
  });

  it('should have unique keys', () => {
    const keys = PHD_AGENTS.map(a => a.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it('should have valid phase assignments', () => {
    PHD_AGENTS.forEach(agent => {
      expect(agent.phase).toBeGreaterThanOrEqual(1);
      expect(agent.phase).toBeLessThanOrEqual(7);
    });
  });

  it('should have corresponding agent files', async () => {
    const errors = await validateAgentFiles();
    expect(errors).toHaveLength(0);
  });
});

describe('buildAgentPrompt', () => {
  it('should include TASK COMPLETION SUMMARY format', () => {
    const prompt = buildAgentPrompt(
      PHD_AGENTS[0],
      mockSession,
      'agent content',
      []
    );
    expect(prompt).toContain('## TASK COMPLETION SUMMARY');
  });

  it('should include workflow context', () => {
    const prompt = buildAgentPrompt(
      PHD_AGENTS[0],
      mockSession,
      'agent content',
      []
    );
    expect(prompt).toContain('## WORKFLOW CONTEXT');
    expect(prompt).toContain('Agent #1/45');
  });

  it('should include memory retrieval commands', () => {
    const prompt = buildAgentPrompt(
      PHD_AGENTS[1], // self-ask-decomposer has memoryReads
      mockSession,
      'agent content',
      []
    );
    expect(prompt).toContain('npx claude-flow memory retrieve');
  });
});
```

### 9.2 Integration Tests

```typescript
// tests/phd-cli.integration.test.ts

describe('phd-cli integration', () => {
  it('should initialize pipeline successfully', async () => {
    const result = await initPipeline('test-research');
    expect(result.sessionId).toBeDefined();
    expect(result.firstAgent.key).toBe('step-back-analyzer');
  });

  it('should complete full pipeline cycle', async () => {
    const init = await initPipeline('integration-test');
    let current: NextAgentResult | { status: string } = init.firstAgent;

    while ('key' in current) {
      // Verify agent has complete prompt
      expect(current.prompt).toContain('## TASK COMPLETION SUMMARY');
      expect(current.prompt).toContain('## WORKFLOW CONTEXT');

      // Complete agent
      current = await completeAgent(init.sessionId);
    }

    expect(current.status).toBe('pipeline_complete');
  });
});
```

---

## 10. Verification Commands

Per Constitution RULE-007:

```bash
# 1. Prohibited patterns (must return 0 results)
grep -rn "TODO\|FIXME\|PLACEHOLDER\|stub\|not implemented" --include="*.ts" src/god-agent/cli/

# 2. Type bypass (must return 0 results)
grep -rn "as any" --include="*.ts" src/god-agent/cli/

# 3. Unsafe exec (must return 0 results)
grep -rn "exec(" --include="*.ts" src/god-agent/cli/ | grep -v execFile

# 4. Linting
npm run lint

# 5. Type checking
npx tsc --noEmit

# 6. Agent file validation
npx tsx src/god-agent/cli/phd-cli.ts validate

# 7. Hardcoded dimensions - per Constitution RULE-004 (must return 0 results)
grep -rn "768" --include="*.ts" src/god-agent/cli/ | grep -i dimension
```

---

## 11. Model Selection

Per Constitution RULE-024, model assignment MUST match task type:

| Task Type | Model | Rationale |
|-----------|-------|-----------|
| Architecture/Planning | Opus 4.5 | Complex reasoning, system design |
| Code Implementation | Sonnet 4.5 | Balance of speed/quality for code |
| File Updates/Simple | Haiku 4.5 | Efficiency for simple operations |

### 11.1 PhD Pipeline Agent Model Recommendations

| Phase | Agents | Recommended Model | Rationale |
|-------|--------|-------------------|-----------|
| Phase 1: Foundation | All 6 agents | Opus 4.5 | Complex research planning |
| Phase 2: Discovery | All 7 agents | Sonnet 4.5 | Literature processing |
| Phase 3: Analysis | All 7 agents | Opus 4.5 | Deep analytical reasoning |
| Phase 4: Synthesis | All 7 agents | Opus 4.5 | Complex synthesis tasks |
| Phase 5: Design | All 4 agents | Sonnet 4.5 | Methodology development |
| Phase 6: Writing | All 8 agents | Sonnet 4.5 | Content generation |
| Phase 7: QA/Validation | All 7 agents | Sonnet 4.5 | Quality checks |
| Phase 8: Final Assembly | FinalStageOrchestrator | Opus 4.5 | Complex orchestration |

### 11.2 Model Configuration in Task() Calls

```typescript
// Example: Spawning an analysis agent with appropriate model
Task("research-planner", `
  ## YOUR TASK
  ...
`, { model: "opus" });

// Example: Spawning a writing agent with appropriate model
Task("introduction-writer", `
  ## YOUR TASK
  ...
`, { model: "sonnet" });
```

---

## 12. Function Refactoring Guidance

Per Constitution RULE-010 (Single Responsibility: functions < 50 lines), the `buildAgentPrompt()` function should be refactored into smaller helper functions during implementation:

### 12.1 Recommended Refactoring

```typescript
// Instead of one ~80 line function, split into:

function buildYourTaskSection(
  agent: AgentConfig,
  agentFileContent: string
): string {
  // ~10 lines - YOUR TASK section
}

function buildWorkflowContextSection(
  agent: AgentConfig,
  session: SessionState,
  position: number
): string {
  // ~10 lines - WORKFLOW CONTEXT section
}

function buildMemorySection(
  agent: AgentConfig,
  descEpisodes: string[]
): string {
  // ~15 lines - MEMORY RETRIEVAL and STORAGE sections
}

function buildCompletionSummarySection(
  agent: AgentConfig,
  session: SessionState,
  nextAgent: AgentConfig | null
): string {
  // ~20 lines - TASK COMPLETION SUMMARY and IMPORTANT RULES
}

// Main function composes the parts (~10 lines)
function buildAgentPrompt(
  agent: AgentConfig,
  session: SessionState,
  agentFileContent: string,
  descEpisodes: string[]
): string {
  const position = calculatePosition(agent, session);
  const nextAgent = getNextAgent(agent);

  return [
    buildYourTaskSection(agent, agentFileContent),
    buildWorkflowContextSection(agent, session, position),
    buildMemorySection(agent, descEpisodes),
    buildCompletionSummarySection(agent, session, nextAgent)
  ].join('\n\n---\n\n');
}
```

This refactoring ensures each function has a single responsibility and stays under 50 lines per RULE-010.

---

## Appendix A: Migration Notes

### A.1 From Current State

Current incorrect keys to remove:
```
algorithm-designer, assumption-identifier, boundary-conditions-checker,
code-generator, complexity-analyzer, concurrency-handler, constraint-identifier,
data-structure-architect, dependency-mapper, edge-case-handler, etc.
```

### A.2 Backward Compatibility

- Session schema unchanged
- CLI commands unchanged
- Phase 8 orchestrator unchanged
- Only internal configuration changes

---

**Document Status**: Ready for Task Specification Development
