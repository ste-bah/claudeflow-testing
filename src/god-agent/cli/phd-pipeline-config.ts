/**
 * PhD Pipeline Configuration
 *
 * Complete TypeScript interfaces and configuration constants for the PhD Pipeline.
 * Implements Technical Spec Section 3 with 46 agents across 7 phases.
 *
 * @module phd-pipeline-config
 * @version 1.0.0
 *
 * Constitution Compliance:
 * - RULE-001: NO placeholder code - complete implementation only
 * - RULE-002: NO `as any` casts - explicit types only
 * - RULE-006: ALL functions must have explicit return types
 * - RULE-011: Backward compatible with existing session schema
 */

import type { DataSourceMode } from './cli-types.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * External tool types that agents may require.
 * Used for tool dependency classification and permission gating.
 */
export type ExternalToolType = 'webSearch' | 'webFetch' | 'perplexity';

/**
 * Tool dependency metadata for an agent.
 * Enables classification for local-only vs hybrid mode execution.
 *
 * GAP-A01: Agents classified by external tool dependency
 */
export interface ToolDependency {
  /** Whether this agent can run without any external tools */
  readonly canRunLocalOnly: boolean;

  /** Whether this agent requires external tools for full functionality */
  readonly requiresExternalTools: boolean;

  /** Specific external tools this agent may use (empty if none) */
  readonly externalToolsUsed: readonly ExternalToolType[];

  /** Brief explanation of tool usage (for documentation) */
  readonly toolUsageNotes?: string;
}

/**
 * Configuration for an individual agent in the PhD Pipeline.
 * Each agent has a unique key, belongs to a phase, and produces specific outputs.
 */
export interface AgentConfig {
  /** Unique identifier key for the agent (kebab-case, e.g., "self-ask-decomposer") */
  readonly key: string;

  /** Human-readable display name for the agent */
  readonly displayName: string;

  /** Phase number (1-7) this agent belongs to */
  readonly phase: number;

  /** Filename of the agent markdown file (without path, e.g., "self-ask-decomposer.md") */
  readonly file: string;

  /** Memory keys this agent reads from or writes to */
  readonly memoryKeys: readonly string[];

  /** Output artifacts this agent produces */
  readonly outputArtifacts: readonly string[];

  /**
   * Tool dependency classification for local/hybrid mode support.
   * GAP-A01: Enables selective agent execution based on tool requirements.
   */
  readonly toolDependency: ToolDependency;
}

/**
 * Definition of a pipeline phase containing multiple agents.
 * Phases are executed sequentially, with agents within each phase
 * potentially having dependencies on previous agents.
 */
export interface PhaseDefinition {
  /** Unique phase identifier (1-7) */
  readonly id: number;

  /** Human-readable phase name */
  readonly name: string;

  /** Array of agent keys belonging to this phase */
  readonly agentKeys: readonly string[];

  /** Description of the phase's purpose and objectives */
  readonly description: string;
}

/**
 * Complete pipeline configuration containing all agents, phases,
 * and operational settings.
 */
export interface PipelineConfig {
  readonly agents: readonly AgentConfig[];
  readonly phases: readonly PhaseDefinition[];
  readonly memoryNamespace: string;
  readonly agentsDirectory: string;

  /** Research mode policy for this pipeline execution */
  readonly dataSourceMode?: DataSourceMode;
}


/**
 * Session state for tracking pipeline execution progress.
 * Backward compatible with existing PipelineSession schema.
 */
export interface SessionState {
  /** Unique session identifier (UUID v4) */
  readonly sessionId: string;

  /** Research topic or query being investigated */
  readonly topic: string;

    /** Research mode policy persisted across steps */
  readonly dataSourceMode?: DataSourceMode;

  /** Current phase number (1-7) */
  readonly currentPhase: number;

  /** Index of current agent within the complete agent list */
  readonly currentAgentIndex: number;

  /** Array of completed agent keys */
  readonly completedAgents: readonly string[];

  /** ISO timestamp when session started */
  readonly startedAt: string;

  /** ISO timestamp of last activity */
  readonly lastActivityAt: string;

  /** Current session status
   * TASK-CLI-004: Added 'phase8' status for Phase 8 finalization tracking
   */
  readonly status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'phase8';
}

// ============================================================================
// AGENT DEFINITIONS - 46 AGENTS ACROSS 7 PHASES
// ============================================================================

/**
 * Complete array of all 46 PhD Pipeline agents.
 * Agents are ordered by phase and execution sequence.
 */
export const PHD_AGENTS: readonly AgentConfig[] = [
  // =========================================================================
  // PHASE 1: FOUNDATION (6 agents)
  // Initial problem analysis, decomposition, and research planning
  // All Phase 1 agents can run locally - pure reasoning, no external tools
  // =========================================================================
  {
    key: 'self-ask-decomposer',
    displayName: 'Self-Ask Decomposer',
    phase: 1,
    file: 'self-ask-decomposer.md',
    memoryKeys: ['research/meta/questions', 'research/foundation/decomposition'],
    outputArtifacts: ['essential-questions.md', 'knowledge-gaps.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Pure query decomposition - works entirely from research topic',
    },
  },
  {
    key: 'step-back-analyzer',
    displayName: 'Step-Back Analyzer',
    phase: 1,
    file: 'step-back-analyzer.md',
    memoryKeys: ['research/foundation/framing', 'research/meta/perspective'],
    outputArtifacts: ['high-level-framing.md', 'abstraction-analysis.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Abstract reasoning about research framing - no external data needed',
    },
  },
  {
    key: 'ambiguity-clarifier',
    displayName: 'Ambiguity Clarifier',
    phase: 1,
    file: 'ambiguity-clarifier.md',
    memoryKeys: ['research/foundation/definitions', 'research/meta/clarifications'],
    outputArtifacts: ['term-definitions.md', 'clarified-scope.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Term clarification from corpus context - no external lookup',
    },
  },
  {
    key: 'construct-definer',
    displayName: 'Construct Definer',
    phase: 1,
    file: 'construct-definer.md',
    memoryKeys: ['research/foundation/constructs', 'research/theory/definitions'],
    outputArtifacts: ['construct-definitions.md', 'operationalizations.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Theoretical construct definition - uses local corpus definitions',
    },
  },
  {
    key: 'theoretical-framework-analyst',
    displayName: 'Theoretical Framework Analyst',
    phase: 1,
    file: 'theoretical-framework-analyst.md',
    memoryKeys: ['research/foundation/framework', 'research/theory/analysis'],
    outputArtifacts: ['theoretical-framework.md', 'framework-map.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Framework analysis from local corpus - no external sources',
    },
  },
  {
    key: 'research-planner',
    displayName: 'Research Planner',
    phase: 1,
    file: 'research-planner.md',
    memoryKeys: ['research/foundation/plan', 'research/meta/strategy'],
    outputArtifacts: ['research-plan.md', 'timeline.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Research planning based on local findings - no external tools',
    },
  },

  // =========================================================================
  // PHASE 2: LITERATURE (5 agents)
  // Literature review, source classification, methodology scanning, and systematic review
  // Some agents benefit from external tools but can work locally with corpus
  // =========================================================================
  {
    key: 'literature-mapper',
    displayName: 'Literature Mapper',
    phase: 2,
    file: 'literature-mapper.md',
    memoryKeys: ['research/literature/map', 'research/sources/index'],
    outputArtifacts: ['literature-map.md', 'source-catalog.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: ['webSearch'],
      toolUsageNotes: 'Can map local corpus; webSearch optional for discovering additional literature',
    },
  },
  {
    key: 'source-tier-classifier',
    displayName: 'Source Tier Classifier',
    phase: 2,
    file: 'source-tier-classifier.md',
    memoryKeys: ['research/literature/tiers', 'research/quality/sources'],
    outputArtifacts: ['source-tiers.md', 'credibility-assessment.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Classifies sources already in corpus - no external lookup needed',
    },
  },
  {
    key: 'methodology-scanner',
    displayName: 'Methodology Scanner',
    phase: 2,
    file: 'methodology-scanner.md',
    memoryKeys: ['research/literature/methods', 'research/methodology/survey'],
    outputArtifacts: ['methodology-survey.md', 'method-comparison.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Scans methodologies in local corpus - no external tools',
    },
  },
  {
    key: 'context-tier-manager',
    displayName: 'Context Tier Manager',
    phase: 2,
    file: 'context-tier-manager.md',
    memoryKeys: ['research/literature/context', 'research/meta/tiers'],
    outputArtifacts: ['context-hierarchy.md', 'tier-mappings.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: ['webFetch'],
      toolUsageNotes: 'Manages context tiers locally; webFetch optional for source verification',
    },
  },
  {
    key: 'systematic-reviewer',
    displayName: 'Systematic Reviewer',
    phase: 2,
    file: 'systematic-reviewer.md',
    memoryKeys: ['research/literature/systematic', 'research/synthesis/systematic-review'],
    outputArtifacts: ['systematic-review.md', 'prisma-flowchart.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: ['webSearch'],
      toolUsageNotes: 'PRISMA review of local corpus; webSearch optional for completeness check',
    },
  },

  // =========================================================================
  // PHASE 3: ANALYSIS (6 agents)
  // Quality assessment, contradiction detection, evidence synthesis
  // All Phase 3 agents work on local corpus data - pure analysis
  // =========================================================================
  {
    key: 'quality-assessor',
    displayName: 'Quality Assessor',
    phase: 3,
    file: 'quality-assessor.md',
    memoryKeys: ['research/analysis/quality', 'research/meta/assessment'],
    outputArtifacts: ['quality-assessment.md', 'quality-scores.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Assesses quality of local corpus sources - no external tools',
    },
  },
  {
    key: 'contradiction-analyzer',
    displayName: 'Contradiction Analyzer',
    phase: 3,
    file: 'contradiction-analyzer.md',
    memoryKeys: ['research/analysis/contradictions', 'research/findings/conflicts'],
    outputArtifacts: ['contradictions-report.md', 'resolution-proposals.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Detects contradictions within local corpus - pure analysis',
    },
  },
  {
    key: 'bias-detector',
    displayName: 'Bias Detector',
    phase: 3,
    file: 'bias-detector.md',
    memoryKeys: ['research/analysis/bias', 'research/quality/bias'],
    outputArtifacts: ['bias-analysis.md', 'bias-mitigation.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Identifies bias in local corpus - no external data needed',
    },
  },
  {
    key: 'risk-analyst',
    displayName: 'Risk Analyst',
    phase: 3,
    file: 'risk-analyst.md',
    memoryKeys: ['research/analysis/risks', 'research/meta/risks'],
    outputArtifacts: ['risk-assessment.md', 'risk-mitigation.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Assesses research risks from local findings - pure reasoning',
    },
  },
  {
    key: 'evidence-synthesizer',
    displayName: 'Evidence Synthesizer',
    phase: 3,
    file: 'evidence-synthesizer.md',
    memoryKeys: ['research/analysis/evidence', 'research/synthesis/evidence'],
    outputArtifacts: ['evidence-synthesis.md', 'evidence-matrix.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Synthesizes evidence from local corpus - core local-mode agent',
    },
  },
  {
    key: 'gap-hunter',
    displayName: 'Gap Hunter',
    phase: 3,
    file: 'gap-hunter.md',
    memoryKeys: ['research/analysis/gaps', 'research/findings/gaps'],
    outputArtifacts: ['research-gaps.md', 'gap-priorities.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: ['webSearch'],
      toolUsageNotes: 'Identifies gaps in local corpus; webSearch optional to verify gap existence',
    },
  },

  // =========================================================================
  // PHASE 4: SYNTHESIS (6 agents)
  // Pattern analysis, theory building, hypothesis generation
  // All Phase 4 agents work on synthesized local findings - pure reasoning
  // =========================================================================
  {
    key: 'pattern-analyst',
    displayName: 'Pattern Analyst',
    phase: 4,
    file: 'pattern-analyst.md',
    memoryKeys: ['research/synthesis/patterns', 'research/findings/patterns'],
    outputArtifacts: ['pattern-analysis.md', 'pattern-catalog.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Analyzes patterns in local findings - pure synthesis',
    },
  },
  {
    key: 'thematic-synthesizer',
    displayName: 'Thematic Synthesizer',
    phase: 4,
    file: 'thematic-synthesizer.md',
    memoryKeys: ['research/synthesis/themes', 'research/findings/themes'],
    outputArtifacts: ['thematic-synthesis.md', 'theme-hierarchy.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Synthesizes themes from local corpus - core local-mode agent',
    },
  },
  {
    key: 'theory-builder',
    displayName: 'Theory Builder',
    phase: 4,
    file: 'theory-builder.md',
    memoryKeys: ['research/synthesis/theory', 'research/theory/construction'],
    outputArtifacts: ['theory-development.md', 'theoretical-model.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Builds theory from local evidence - pure reasoning',
    },
  },
  {
    key: 'hypothesis-generator',
    displayName: 'Hypothesis Generator',
    phase: 4,
    file: 'hypothesis-generator.md',
    memoryKeys: ['research/synthesis/hypotheses', 'research/theory/hypotheses'],
    outputArtifacts: ['hypotheses.md', 'testable-predictions.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Generates hypotheses from local synthesis - no external data',
    },
  },
  {
    key: 'model-architect',
    displayName: 'Model Architect',
    phase: 4,
    file: 'model-architect.md',
    memoryKeys: ['research/synthesis/models', 'research/theory/models'],
    outputArtifacts: ['conceptual-model.md', 'model-specifications.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Designs conceptual models from local findings - pure architecture',
    },
  },
  {
    key: 'opportunity-identifier',
    displayName: 'Opportunity Identifier',
    phase: 4,
    file: 'opportunity-identifier.md',
    memoryKeys: ['research/synthesis/opportunities', 'research/findings/opportunities'],
    outputArtifacts: ['research-opportunities.md', 'opportunity-matrix.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Identifies opportunities from local gaps - pure analysis',
    },
  },

  // =========================================================================
  // PHASE 5: METHODS (6 agents)
  // Research design, sampling, instrumentation, ethics
  // All Phase 5 agents work on methodology design - mostly local reasoning
  // =========================================================================
  {
    key: 'method-designer',
    displayName: 'Method Designer',
    phase: 5,
    file: 'method-designer.md',
    memoryKeys: ['research/methods/design', 'research/methodology/approach'],
    outputArtifacts: ['research-design.md', 'method-rationale.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Designs methodology based on local synthesis - pure design',
    },
  },
  {
    key: 'sampling-strategist',
    displayName: 'Sampling Strategist',
    phase: 5,
    file: 'sampling-strategist.md',
    memoryKeys: ['research/methods/sampling', 'research/methodology/sampling'],
    outputArtifacts: ['sampling-strategy.md', 'sample-specifications.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Develops sampling strategy from local context - no external tools',
    },
  },
  {
    key: 'instrument-developer',
    displayName: 'Instrument Developer',
    phase: 5,
    file: 'instrument-developer.md',
    memoryKeys: ['research/methods/instruments', 'research/methodology/instruments'],
    outputArtifacts: ['research-instruments.md', 'instrument-validation.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Develops instruments from local requirements - pure design',
    },
  },
  {
    key: 'analysis-planner',
    displayName: 'Analysis Planner',
    phase: 5,
    file: 'analysis-planner.md',
    memoryKeys: ['research/methods/analysis', 'research/methodology/analysis'],
    outputArtifacts: ['analysis-plan.md', 'statistical-approach.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Plans analysis approach from local hypotheses - pure planning',
    },
  },
  {
    key: 'ethics-reviewer',
    displayName: 'Ethics Reviewer',
    phase: 5,
    file: 'ethics-reviewer.md',
    memoryKeys: ['research/methods/ethics', 'research/compliance/ethics'],
    outputArtifacts: ['ethics-review.md', 'irb-protocol.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Reviews ethics from local methodology - pure analysis',
    },
  },
  {
    key: 'validity-guardian',
    displayName: 'Validity Guardian',
    phase: 5,
    file: 'validity-guardian.md',
    memoryKeys: ['research/methods/validity', 'research/quality/validity'],
    outputArtifacts: ['validity-assessment.md', 'threat-mitigation.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Assesses validity threats from local design - pure analysis',
    },
  },

  // =========================================================================
  // PHASE 6: WRITING (8 agents)
  // Dissertation chapter writing and document architecture
  // All Phase 6 agents produce prose from local synthesis - core local-mode agents
  // =========================================================================
  {
    key: 'dissertation-architect',
    displayName: 'Dissertation Architect',
    phase: 6,
    file: 'dissertation-architect.md',
    memoryKeys: ['research/writing/structure', 'research/document/architecture'],
    outputArtifacts: ['dissertation-outline.md', 'chapter-structure.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Designs document structure from local findings - core local-mode agent',
    },
  },
  {
    key: 'abstract-writer',
    displayName: 'Abstract Writer',
    phase: 6,
    file: 'abstract-writer.md',
    memoryKeys: ['research/writing/abstract', 'research/document/abstract'],
    outputArtifacts: ['abstract.md', 'executive-summary.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Writes abstract from local synthesis - pure writing',
    },
  },
  {
    key: 'introduction-writer',
    displayName: 'Introduction Writer',
    phase: 6,
    file: 'introduction-writer.md',
    memoryKeys: ['research/writing/introduction', 'research/document/chapter1'],
    outputArtifacts: ['introduction.md', 'problem-statement.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Writes introduction from local framing - core local-mode agent',
    },
  },
  {
    key: 'literature-review-writer',
    displayName: 'Literature Review Writer',
    phase: 6,
    file: 'literature-review-writer.md',
    memoryKeys: ['research/writing/literature', 'research/document/chapter2'],
    outputArtifacts: ['literature-review.md', 'synthesis-narrative.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Writes literature review from local corpus synthesis - pure writing',
    },
  },
  {
    key: 'methodology-writer',
    displayName: 'Methodology Writer',
    phase: 6,
    file: 'methodology-writer.md',
    memoryKeys: ['research/writing/methodology', 'research/document/chapter3'],
    outputArtifacts: ['methodology-chapter.md', 'method-details.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Writes methodology from local design - core local-mode agent',
    },
  },
  {
    key: 'results-writer',
    displayName: 'Results Writer',
    phase: 6,
    file: 'results-writer.md',
    memoryKeys: ['research/writing/results', 'research/document/chapter4'],
    outputArtifacts: ['results-chapter.md', 'findings-narrative.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Writes results from local findings - pure writing',
    },
  },
  {
    key: 'discussion-writer',
    displayName: 'Discussion Writer',
    phase: 6,
    file: 'discussion-writer.md',
    memoryKeys: ['research/writing/discussion', 'research/document/chapter5'],
    outputArtifacts: ['discussion-chapter.md', 'implications.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Writes discussion from local analysis - pure writing',
    },
  },
  {
    key: 'conclusion-writer',
    displayName: 'Conclusion Writer',
    phase: 6,
    file: 'conclusion-writer.md',
    memoryKeys: ['research/writing/conclusion', 'research/document/chapter6'],
    outputArtifacts: ['conclusion-chapter.md', 'future-directions.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Writes conclusion from local synthesis - pure writing',
    },
  },

  // =========================================================================
  // PHASE 7: QUALITY (9 agents)
  // Citation management, validation, review, and final quality assurance
  // Most Phase 7 agents work locally on document quality - core local-mode agents
  // =========================================================================
  {
    key: 'apa-citation-specialist',
    displayName: 'APA Citation Specialist',
    phase: 7,
    file: 'apa-citation-specialist.md',
    memoryKeys: ['research/quality/citations', 'research/document/references'],
    outputArtifacts: ['citation-audit.md', 'apa-compliance.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Validates APA formatting from local citations - pure analysis',
    },
  },
  {
    key: 'citation-extractor',
    displayName: 'Citation Extractor',
    phase: 7,
    file: 'citation-extractor.md',
    memoryKeys: ['research/quality/extraction', 'research/sources/citations'],
    outputArtifacts: ['extracted-citations.md', 'reference-list.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Extracts citations from local document - pure extraction',
    },
  },
  {
    key: 'citation-validator',
    displayName: 'Citation Validator',
    phase: 7,
    file: 'citation-validator.md',
    memoryKeys: ['research/quality/validation', 'research/sources/verified'],
    outputArtifacts: ['citation-validation.md', 'source-verification.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: ['webFetch'],
      toolUsageNotes: 'Validates local citations; webFetch optional for DOI/URL verification',
    },
  },
  {
    key: 'adversarial-reviewer',
    displayName: 'Adversarial Reviewer',
    phase: 7,
    file: 'adversarial-reviewer.md',
    memoryKeys: ['research/quality/critique', 'research/review/adversarial'],
    outputArtifacts: ['adversarial-critique.md', 'weakness-report.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Adversarial review of local document - core local-mode agent',
    },
  },
  {
    key: 'confidence-quantifier',
    displayName: 'Confidence Quantifier',
    phase: 7,
    file: 'confidence-quantifier.md',
    memoryKeys: ['research/quality/confidence', 'research/meta/certainty'],
    outputArtifacts: ['confidence-scores.md', 'uncertainty-analysis.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Quantifies confidence from local evidence - pure analysis',
    },
  },
  {
    key: 'reproducibility-checker',
    displayName: 'Reproducibility Checker',
    phase: 7,
    file: 'reproducibility-checker.md',
    memoryKeys: ['research/quality/reproducibility', 'research/meta/replication'],
    outputArtifacts: ['reproducibility-report.md', 'replication-guide.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Checks reproducibility of local methodology - pure analysis',
    },
  },
  {
    key: 'consistency-validator',
    displayName: 'Consistency Validator',
    phase: 7,
    file: 'consistency-validator.md',
    memoryKeys: ['research/quality/consistency', 'research/document/coherence'],
    outputArtifacts: ['consistency-report.md', 'coherence-audit.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Validates internal consistency - core local-mode agent',
    },
  },
  {
    key: 'file-length-manager',
    displayName: 'File Length Manager',
    phase: 7,
    file: 'file-length-manager.md',
    memoryKeys: ['research/quality/structure', 'research/document/formatting'],
    outputArtifacts: ['structure-audit.md', 'length-compliance.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Manages document structure - pure formatting',
    },
  },
  {
    key: 'chapter-synthesizer',
    displayName: 'Chapter Synthesizer',
    phase: 7,
    file: 'chapter-synthesizer.md',
    memoryKeys: ['research/quality/synthesis', 'research/document/final'],
    outputArtifacts: ['final-synthesis.md', 'dissertation-complete.md'],
    toolDependency: {
      canRunLocalOnly: true,
      requiresExternalTools: false,
      externalToolsUsed: [],
      toolUsageNotes: 'Final chapter synthesis - core local-mode agent',
    },
  },
] as const;

// ============================================================================
// PHASE DEFINITIONS - 7 PHASES
// ============================================================================

/**
 * Complete array of all 7 PhD Pipeline phases.
 * Phases are executed sequentially with agents within each phase
 * following dependency ordering.
 */
export const PHD_PHASES: readonly PhaseDefinition[] = [
  {
    id: 1,
    name: 'Foundation',
    description: 'Initial problem analysis, question decomposition, theoretical framing, and research planning. Establishes the conceptual groundwork for the entire research endeavor.',
    agentKeys: [
      'self-ask-decomposer',
      'step-back-analyzer',
      'ambiguity-clarifier',
      'construct-definer',
      'theoretical-framework-analyst',
      'research-planner',
    ],
  },
  {
    id: 2,
    name: 'Literature',
    description: 'Comprehensive literature review, source classification by credibility tiers, methodology scanning, context management, and PRISMA-compliant systematic review. Maps the existing knowledge landscape.',
    agentKeys: [
      'literature-mapper',
      'source-tier-classifier',
      'methodology-scanner',
      'context-tier-manager',
      'systematic-reviewer',
    ],
  },
  {
    id: 3,
    name: 'Analysis',
    description: 'Critical analysis of evidence quality, contradiction detection, bias identification, risk assessment, evidence synthesis, and research gap identification.',
    agentKeys: [
      'quality-assessor',
      'contradiction-analyzer',
      'bias-detector',
      'risk-analyst',
      'evidence-synthesizer',
      'gap-hunter',
    ],
  },
  {
    id: 4,
    name: 'Synthesis',
    description: 'Pattern recognition, thematic synthesis, theory building, hypothesis generation, conceptual model architecture, and opportunity identification.',
    agentKeys: [
      'pattern-analyst',
      'thematic-synthesizer',
      'theory-builder',
      'hypothesis-generator',
      'model-architect',
      'opportunity-identifier',
    ],
  },
  {
    id: 5,
    name: 'Methods',
    description: 'Research methodology design, sampling strategy, instrument development, analysis planning, ethics review, and validity assurance.',
    agentKeys: [
      'method-designer',
      'sampling-strategist',
      'instrument-developer',
      'analysis-planner',
      'ethics-reviewer',
      'validity-guardian',
    ],
  },
  {
    id: 6,
    name: 'Writing',
    description: 'Dissertation document creation including structural architecture, abstract, introduction, literature review, methodology, results, discussion, and conclusion chapters.',
    agentKeys: [
      'dissertation-architect',
      'abstract-writer',
      'introduction-writer',
      'literature-review-writer',
      'methodology-writer',
      'results-writer',
      'discussion-writer',
      'conclusion-writer',
    ],
  },
  {
    id: 7,
    name: 'Quality',
    description: 'Final quality assurance including citation management (APA), validation, adversarial review, confidence quantification, reproducibility checking, consistency validation, and final synthesis.',
    agentKeys: [
      'apa-citation-specialist',
      'citation-extractor',
      'citation-validator',
      'adversarial-reviewer',
      'confidence-quantifier',
      'reproducibility-checker',
      'consistency-validator',
      'file-length-manager',
      'chapter-synthesizer',
    ],
  },
] as const;

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default PhD Pipeline configuration with all 46 agents and 7 phases.
 * Memory namespace follows project/research convention for integration
 * with claude-flow memory system.
 */
export const DEFAULT_CONFIG: PipelineConfig = {
  agents: PHD_AGENTS,
  phases: PHD_PHASES,
  memoryNamespace: 'project/research',
  agentsDirectory: '.claude/agents/phdresearch',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get an agent configuration by its key.
 * @param key - The agent key to look up
 * @returns The agent configuration or undefined if not found
 */
export function getAgentByKey(key: string): AgentConfig | undefined {
  return PHD_AGENTS.find((agent) => agent.key === key);
}

/**
 * Get all agents for a specific phase.
 * @param phaseId - The phase number (1-7)
 * @returns Array of agent configurations for the phase
 */
export function getAgentsByPhase(phaseId: number): readonly AgentConfig[] {
  return PHD_AGENTS.filter((agent) => agent.phase === phaseId);
}

/**
 * Get a phase definition by its ID.
 * @param phaseId - The phase number (1-7)
 * @returns The phase definition or undefined if not found
 */
export function getPhaseById(phaseId: number): PhaseDefinition | undefined {
  return PHD_PHASES.find((phase) => phase.id === phaseId);
}

/**
 * Get the phase name for a given phase ID.
 * @param phaseId - The phase number (1-7)
 * @returns The phase name or 'Unknown' if not found
 */
export function getPhaseName(phaseId: number): string {
  const phase = getPhaseById(phaseId);
  return phase ? phase.name : 'Unknown';
}

/**
 * Get the total number of agents in the pipeline.
 * @returns The total agent count (46)
 */
export function getTotalAgentCount(): number {
  return PHD_AGENTS.length;
}

/**
 * Get the total number of phases in the pipeline.
 * @returns The total phase count (7)
 */
export function getTotalPhaseCount(): number {
  return PHD_PHASES.length;
}

/**
 * Get the index of an agent by its key.
 * @param key - The agent key to look up
 * @returns The agent index (0-based) or -1 if not found
 */
export function getAgentIndex(key: string): number {
  return PHD_AGENTS.findIndex((agent) => agent.key === key);
}

/**
 * Get the agent at a specific index.
 * @param index - The agent index (0-based)
 * @returns The agent configuration or undefined if out of bounds
 */
export function getAgentByIndex(index: number): AgentConfig | undefined {
  if (index < 0 || index >= PHD_AGENTS.length) {
    return undefined;
  }
  return PHD_AGENTS[index];
}

/**
 * Validate that all phase agent keys match actual agent definitions.
 * @returns True if configuration is valid, throws Error otherwise
 */
export function validateConfiguration(): boolean {
  const agentKeys = new Set(PHD_AGENTS.map((agent) => agent.key));

  for (const phase of PHD_PHASES) {
    for (const agentKey of phase.agentKeys) {
      if (!agentKeys.has(agentKey)) {
        throw new Error(
          `Invalid configuration: Phase ${phase.id} (${phase.name}) references unknown agent "${agentKey}"`
        );
      }
    }
  }

  // Verify agent count matches phase agent counts
  const phaseAgentCount = PHD_PHASES.reduce(
    (sum, phase) => sum + phase.agentKeys.length,
    0
  );

  if (phaseAgentCount !== PHD_AGENTS.length) {
    throw new Error(
      `Invalid configuration: Phase agent count (${phaseAgentCount}) does not match total agents (${PHD_AGENTS.length})`
    );
  }

  return true;
}

/**
 * Create a new session state with initial values.
 * @param sessionId - UUID v4 session identifier
 * @param topic - Research topic or query
 * @returns Initial session state
 */
export function createInitialSessionState(
  sessionId: string,
  topic: string
): SessionState {
  const now = new Date().toISOString();

  return {
    sessionId,
    topic,
    currentPhase: 1,
    currentAgentIndex: 0,
    completedAgents: [],
    startedAt: now,
    lastActivityAt: now,
    status: 'pending',
  };
}

// ============================================================================
// LOCAL MODE AGENT SELECTION (GAP-A01, GAP-A02)
// ============================================================================

/**
 * Curated list of agent keys for local-only mode execution.
 * These agents form a focused research workflow without external tools.
 *
 * GAP-A02: Local agent chain for meaningful local-mode research
 *
 * Selection criteria:
 * - canRunLocalOnly: true
 * - Core to scholarly research workflow
 * - Produces meaningful output from corpus alone
 */
export const LOCAL_MODE_AGENT_CHAIN: readonly string[] = [
  // Phase 1: Foundation
  'step-back-analyzer',           // High-level reasoning
  'self-ask-decomposer',          // Query decomposition
  'construct-definer',            // Define key constructs
  'theoretical-framework-analyst', // Framework analysis

  // Phase 3: Analysis
  'evidence-synthesizer',         // Core evidence synthesis
  'contradiction-analyzer',       // Find contradictions

  // Phase 4: Synthesis
  'thematic-synthesizer',         // Theme synthesis
  'theory-builder',               // Build theory from evidence

  // Phase 6: Writing
  'dissertation-architect',       // Structure the document
  'methodology-writer',           // Write methodology

  // Phase 7: Quality
  'adversarial-reviewer',         // Adversarial review
  'consistency-validator',        // Consistency check
] as const;

/**
 * Get all agents that can run in local-only mode.
 * Returns agents where toolDependency.canRunLocalOnly is true.
 *
 * GAP-A01: Filter by tool dependency classification
 *
 * @returns Array of agents that can run without external tools
 */
export function getLocalCapableAgents(): readonly AgentConfig[] {
  return PHD_AGENTS.filter((agent) => agent.toolDependency.canRunLocalOnly);
}

/**
 * Get the curated local-only agent chain for focused research.
 * Returns a subset of local-capable agents optimized for local mode.
 *
 * GAP-A02: Local agent chain function
 *
 * @returns Array of agent configs for local-only research workflow
 */
export function getLocalModeAgentChain(): readonly AgentConfig[] {
  return LOCAL_MODE_AGENT_CHAIN.map((key) => {
    const agent = getAgentByKey(key);
    if (!agent) {
      throw new Error(`Local mode agent not found: ${key}`);
    }
    return agent;
  });
}

/**
 * Get agents that require external tools for full functionality.
 *
 * @returns Array of agents that benefit from external tools
 */
export function getExternalToolAgents(): readonly AgentConfig[] {
  return PHD_AGENTS.filter(
    (agent) => agent.toolDependency.externalToolsUsed.length > 0
  );
}

/**
 * Check if an agent can run in local-only mode.
 *
 * @param agentKey - The agent key to check
 * @returns True if the agent can run locally
 */
export function canAgentRunLocally(agentKey: string): boolean {
  const agent = getAgentByKey(agentKey);
  return agent?.toolDependency.canRunLocalOnly ?? false;
}

/**
 * Get the external tools an agent may use.
 *
 * @param agentKey - The agent key to check
 * @returns Array of external tool types the agent may use
 */
export function getAgentExternalTools(agentKey: string): readonly ExternalToolType[] {
  const agent = getAgentByKey(agentKey);
  return agent?.toolDependency.externalToolsUsed ?? [];
}

/**
 * Get the file path for an agent's markdown definition.
 * @param agentKey - The agent key
 * @param baseDir - Optional base directory (defaults to DEFAULT_CONFIG.agentsDirectory)
 * @returns The relative file path or undefined if agent not found
 */
export function getAgentFilePath(
  agentKey: string,
  baseDir: string = DEFAULT_CONFIG.agentsDirectory
): string | undefined {
  const agent = getAgentByKey(agentKey);
  if (!agent) {
    return undefined;
  }
  return `${baseDir}/${agent.file}`;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if a value is a valid SessionState.
 * @param value - The value to check
 * @returns True if the value is a valid SessionState
 */
export function isSessionState(value: unknown): value is SessionState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const session = value as Record<string, unknown>;

  return (
    typeof session.sessionId === 'string' &&
    typeof session.topic === 'string' &&
    typeof session.currentPhase === 'number' &&
    typeof session.currentAgentIndex === 'number' &&
    Array.isArray(session.completedAgents) &&
    typeof session.startedAt === 'string' &&
    typeof session.lastActivityAt === 'string' &&
    typeof session.status === 'string' &&
    // TASK-CLI-004: Added 'phase8' to valid status values
    ['pending', 'running', 'paused', 'completed', 'failed', 'phase8'].includes(
      session.status as string
    )
  );
}

/**
 * Type guard to check if a value is a valid AgentConfig.
 * @param value - The value to check
 * @returns True if the value is a valid AgentConfig
 */
export function isAgentConfig(value: unknown): value is AgentConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const agent = value as Record<string, unknown>;

  return (
    typeof agent.key === 'string' &&
    typeof agent.displayName === 'string' &&
    typeof agent.phase === 'number' &&
    typeof agent.file === 'string' &&
    Array.isArray(agent.memoryKeys) &&
    Array.isArray(agent.outputArtifacts)
  );
}
