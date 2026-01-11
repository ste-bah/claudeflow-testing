/**
 * God Agent Coding Pipeline Type Definitions
 *
 * Defines the 40-agent, 7-phase coding pipeline structure.
 * Used by CommandTaskBridge and CodingPipelineOrchestrator.
 *
 * @module src/god-agent/core/pipeline/types
 * @see SPEC-001-architecture.md
 * @see TASK-WIRING-002-agent-mappings.md
 */

// ═══════════════════════════════════════════════════════════════════════════
// PHASE TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The 7 phases of the coding pipeline
 * Each phase contains specialized agents for that development stage
 */
export type CodingPipelinePhase =
  | 'understanding'    // Phase 1: Task analysis and requirements (5 agents)
  | 'exploration'      // Phase 2: Solution exploration (5 agents)
  | 'architecture'     // Phase 3: System design (6 agents)
  | 'implementation'   // Phase 4: Code generation (8 agents)
  | 'testing'          // Phase 5: Test creation and execution (8 agents)
  | 'optimization'     // Phase 6: Performance and quality (4 agents)
  | 'delivery';        // Phase 7: Documentation and release (4 agents)

// ═══════════════════════════════════════════════════════════════════════════
// AGENT TYPES BY PHASE
// ═══════════════════════════════════════════════════════════════════════════

/** Phase 1: Understanding - 5 agents */
export type Phase1Agent =
  | 'task-analyzer'          // #1 - CRITICAL: Halts pipeline if task cannot be parsed
  | 'requirement-extractor'  // #2
  | 'scope-definer'          // #3
  | 'context-gatherer'       // #4
  | 'constraint-analyzer';   // #5

/** Phase 2: Exploration - 5 agents */
export type Phase2Agent =
  | 'solution-explorer'      // #6
  | 'pattern-matcher'        // #7
  | 'analogy-finder'         // #8
  | 'prior-art-searcher'     // #9
  | 'feasibility-assessor';  // #10

/** Phase 3: Architecture - 6 agents */
export type Phase3Agent =
  | 'architecture-designer'  // #11
  | 'component-specifier'    // #12
  | 'interface-designer'     // #13
  | 'dependency-mapper'      // #14
  | 'consistency-checker'    // #15 - CRITICAL: Halts if design has unresolved conflicts
  | 'type-system-designer';  // #16

/** Phase 4: Implementation - 8 agents */
export type Phase4Agent =
  | 'type-generator'           // #17
  | 'algorithm-implementer'    // #18
  | 'data-structure-builder'   // #19
  | 'api-implementer'          // #20
  | 'integration-coder'        // #21
  | 'error-handler'            // #22
  | 'config-generator'         // #23
  | 'utility-generator';       // #24

/** Phase 5: Testing - 8 agents */
export type Phase5Agent =
  | 'test-planner'             // #25
  | 'unit-test-writer'         // #26
  | 'integration-test-writer'  // #27
  | 'edge-case-tester'         // #28
  | 'mock-generator'           // #29
  | 'test-runner'              // #30
  | 'bug-fixer'                // #31
  | 'coverage-analyzer';       // #32

/** Phase 6: Optimization - 4 agents */
export type Phase6Agent =
  | 'performance-optimizer'    // #33
  | 'refactoring-agent'        // #34
  | 'security-auditor'         // #35
  | 'code-quality-checker';    // #36

/** Phase 7: Delivery - 4 agents */
export type Phase7Agent =
  | 'documentation-writer'     // #37
  | 'code-reviewer'            // #38
  | 'release-preparer'         // #39
  | 'sign-off-approver';       // #40 - CRITICAL: Must pass for pipeline completion

// ═══════════════════════════════════════════════════════════════════════════
// SHERLOCK FORENSIC AGENTS (41-47)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sherlock Forensic Review Agents - 7 agents (one per phase + recovery)
 * These agents perform forensic review with verdicts:
 * - INNOCENT: Phase passed review
 * - GUILTY: Phase failed, requires remediation
 * - INSUFFICIENT_EVIDENCE: Needs more data
 *
 * All forensic reviewers are CRITICAL - they gate pipeline progression.
 */
export type SherlockForensicAgent =
  | 'phase-1-reviewer'    // #41 - CRITICAL: Phase 1 Understanding forensic review
  | 'phase-2-reviewer'    // #42 - CRITICAL: Phase 2 Exploration forensic review
  | 'phase-3-reviewer'    // #43 - CRITICAL: Phase 3 Architecture forensic review
  | 'phase-4-reviewer'    // #44 - CRITICAL: Phase 4 Implementation forensic review
  | 'phase-5-reviewer'    // #45 - CRITICAL: Phase 5 Testing forensic review
  | 'phase-6-reviewer'    // #46 - CRITICAL: Phase 6 Optimization forensic review
  | 'recovery-agent';     // #47 - CRITICAL: Phase 7 Forensic Review / Recovery orchestration

/**
 * Union type of all 47 coding pipeline agents
 * 40 core pipeline agents + 7 Sherlock forensic reviewers
 */
export type CodingPipelineAgent =
  | Phase1Agent
  | Phase2Agent
  | Phase3Agent
  | Phase4Agent
  | Phase5Agent
  | Phase6Agent
  | Phase7Agent
  | SherlockForensicAgent;

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITHM TYPES (USACF)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * USACF Algorithm types used by agents
 * From SPEC-003-algorithms.md
 */
export type AlgorithmType =
  | 'LATS'       // Language Agent Tree Search - Complex algorithmic tasks
  | 'ReAct'      // Reasoning + Acting - Tool-heavy tasks
  | 'Self-Debug' // Self-debugging - Test-driven tasks
  | 'Reflexion'  // Pattern learning - Error recovery
  | 'PoT'        // Program of Thought - Mathematical tasks
  | 'ToT';       // Tree of Thought - Design decisions

// ═══════════════════════════════════════════════════════════════════════════
// AGENT MAPPING INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Complete mapping for a single agent in the pipeline
 */
export interface IAgentMapping {
  /** Which phase this agent belongs to */
  phase: CodingPipelinePhase;

  /** Unique agent identifier */
  agentKey: CodingPipelineAgent;

  /** Execution priority within phase (lower = higher priority) */
  priority: number;

  /** Agent category for grouping */
  category: string;

  /** Primary algorithm for this agent */
  algorithm: AlgorithmType;

  /** Fallback algorithm if primary fails */
  fallbackAlgorithm?: AlgorithmType;

  /** Agents that must complete before this one */
  dependsOn?: CodingPipelineAgent[];

  /** Memory keys this agent reads from */
  memoryReads: string[];

  /** Memory keys this agent writes to */
  memoryWrites: string[];

  /** XP reward for successful completion */
  xpReward: number;

  /** Can run in parallel with other agents in same phase */
  parallelizable: boolean;

  /** If true, pipeline halts on failure */
  critical?: boolean;

  /** Human-readable description */
  description?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// DAG STRUCTURES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A node in the pipeline DAG
 */
export interface IPipelineDAGNode {
  /** Agent this node represents */
  agentKey: CodingPipelineAgent;

  /** Phase this agent belongs to */
  phase: CodingPipelinePhase;

  /** Agents that must complete before this one */
  dependsOn: CodingPipelineAgent[];

  /** Agents that depend on this one */
  dependents: CodingPipelineAgent[];
}

/**
 * Complete Directed Acyclic Graph for pipeline execution
 */
export interface IPipelineDAG {
  /** All nodes in the DAG, indexed by agent key */
  nodes: Map<CodingPipelineAgent, IPipelineDAGNode>;

  /** Agents grouped by phase */
  phases: Map<CodingPipelinePhase, CodingPipelineAgent[]>;

  /** Agents in topologically sorted order for execution */
  topologicalOrder: CodingPipelineAgent[];

  /** Phases where checkpoints are created for rollback */
  checkpointPhases: CodingPipelinePhase[];
}

// ═══════════════════════════════════════════════════════════════════════════
// PIPELINE EXECUTION CONFIG
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuration for pipeline execution
 * Used by prepareCodeTask() and CodingPipelineOrchestrator
 */
export interface IPipelineExecutionConfig {
  /** Phase execution order */
  phases: CodingPipelinePhase[];

  /** Agents organized by phase */
  agentsByPhase: Map<CodingPipelinePhase, IAgentMapping[]>;

  /** Full DAG for dependency resolution */
  dag: IPipelineDAG;

  /** Memory namespace for coordination */
  memoryNamespace: string;

  /** Checkpoints for rollback support */
  checkpoints: CodingPipelinePhase[];

  /** Start phase (for partial execution) */
  startPhase?: number;

  /** End phase (for partial execution) */
  endPhase?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE RESULT INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Result from a single agent execution
 */
export interface IAgentExecutionResult {
  agentKey: CodingPipelineAgent;
  success: boolean;
  output: unknown;
  xpEarned: number;
  memoryWrites: string[];
  executionTimeMs: number;
  error?: string;
}

/**
 * Result from a complete phase execution
 */
export interface IPhaseExecutionResult {
  phase: CodingPipelinePhase;
  success: boolean;
  agentResults: IAgentExecutionResult[];
  totalXP: number;
  checkpointCreated: boolean;
  executionTimeMs: number;
}

/**
 * Final result from complete pipeline execution
 */
export interface IPipelineExecutionResult {
  success: boolean;
  phaseResults: IPhaseExecutionResult[];
  totalXP: number;
  executionTimeMs: number;
  completedPhases: CodingPipelinePhase[];
  failedPhase?: CodingPipelinePhase;
  rollbackApplied: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Phases in execution order
 */
export const PHASE_ORDER: CodingPipelinePhase[] = [
  'understanding',
  'exploration',
  'architecture',
  'implementation',
  'testing',
  'optimization',
  'delivery',
];

/**
 * Phases where checkpoints are created for rollback
 */
export const CHECKPOINT_PHASES: CodingPipelinePhase[] = [
  'understanding',
  'exploration',
  'architecture',
  'implementation',
  'testing',
];

/**
 * Number of agents per phase (core + Sherlock forensic reviewer)
 * Each phase includes its Sherlock reviewer for forensic analysis
 */
export const PHASE_AGENT_COUNTS: Record<CodingPipelinePhase, number> = {
  understanding: 6,    // 5 core + phase-1-reviewer
  exploration: 6,      // 5 core + phase-2-reviewer
  architecture: 7,     // 6 core + phase-3-reviewer
  implementation: 9,   // 8 core + phase-4-reviewer
  testing: 9,          // 8 core + phase-5-reviewer
  optimization: 5,     // 4 core + phase-6-reviewer
  delivery: 5,         // 4 core + recovery-agent
};

/**
 * Total number of core pipeline agents
 * 5 + 5 + 6 + 8 + 8 + 4 + 4 = 40
 */
export const CORE_AGENTS = 40;

/**
 * Number of Sherlock forensic review agents
 */
export const SHERLOCK_AGENT_COUNT = 7;

/**
 * Total number of agents in the pipeline
 * 40 core + 7 Sherlock = 47
 */
export const TOTAL_AGENTS = 47;

/**
 * Sherlock Forensic Review agents (41-47)
 * All are CRITICAL - they gate pipeline phase progression
 */
export const SHERLOCK_AGENTS: SherlockForensicAgent[] = [
  'phase-1-reviewer',    // #41 - Understanding review
  'phase-2-reviewer',    // #42 - Exploration review
  'phase-3-reviewer',    // #43 - Architecture review
  'phase-4-reviewer',    // #44 - Implementation review
  'phase-5-reviewer',    // #45 - Testing review
  'phase-6-reviewer',    // #46 - Optimization review
  'recovery-agent',      // #47 - Phase 7 / Recovery
];

/**
 * Critical agents that halt pipeline on failure
 * Includes core critical agents AND all Sherlock forensic reviewers
 */
export const CRITICAL_AGENTS: CodingPipelineAgent[] = [
  // Core critical agents
  'task-analyzer',       // #1 - Phase 1: Pipeline entry point
  'consistency-checker', // #15 - Phase 3: Design validation
  'sign-off-approver',   // #40 - Phase 7: Final approval
  // Sherlock forensic reviewers (all critical - gate phase progression)
  'phase-1-reviewer',    // #41 - Understanding forensic review
  'phase-2-reviewer',    // #42 - Exploration forensic review
  'phase-3-reviewer',    // #43 - Architecture forensic review
  'phase-4-reviewer',    // #44 - Implementation forensic review
  'phase-5-reviewer',    // #45 - Testing forensic review
  'phase-6-reviewer',    // #46 - Optimization forensic review
  'recovery-agent',      // #47 - Phase 7 forensic review / Recovery
];

/**
 * Mapping of Sherlock forensic reviewers to their phases
 */
export const SHERLOCK_PHASE_MAP: Record<SherlockForensicAgent, CodingPipelinePhase> = {
  'phase-1-reviewer': 'understanding',
  'phase-2-reviewer': 'exploration',
  'phase-3-reviewer': 'architecture',
  'phase-4-reviewer': 'implementation',
  'phase-5-reviewer': 'testing',
  'phase-6-reviewer': 'optimization',
  'recovery-agent': 'delivery',
};

/**
 * Memory namespace for coding pipeline
 */
export const CODING_MEMORY_NAMESPACE = 'coding';

/**
 * Memory key prefixes by phase
 */
export const MEMORY_PREFIXES: Record<CodingPipelinePhase, string> = {
  understanding: 'coding/understanding',
  exploration: 'coding/exploration',
  architecture: 'coding/architecture',
  implementation: 'coding/implementation',
  testing: 'coding/testing',
  optimization: 'coding/optimization',
  delivery: 'coding/delivery',
};
