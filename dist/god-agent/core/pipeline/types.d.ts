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
/**
 * The 7 phases of the coding pipeline
 * Each phase contains specialized agents for that development stage
 */
export type CodingPipelinePhase = 'understanding' | 'exploration' | 'architecture' | 'implementation' | 'testing' | 'optimization' | 'delivery';
/** Phase 1: Understanding - 5 agents */
export type Phase1Agent = 'task-analyzer' | 'requirement-extractor' | 'scope-definer' | 'context-gatherer' | 'constraint-analyzer';
/** Phase 2: Exploration - 5 agents */
export type Phase2Agent = 'solution-explorer' | 'pattern-matcher' | 'analogy-finder' | 'prior-art-searcher' | 'feasibility-assessor';
/** Phase 3: Architecture - 6 agents */
export type Phase3Agent = 'architecture-designer' | 'component-specifier' | 'interface-designer' | 'dependency-mapper' | 'consistency-checker' | 'type-system-designer';
/** Phase 4: Implementation - 8 agents */
export type Phase4Agent = 'type-generator' | 'algorithm-implementer' | 'data-structure-builder' | 'api-implementer' | 'integration-coder' | 'error-handler' | 'config-generator' | 'utility-generator';
/** Phase 5: Testing - 8 agents */
export type Phase5Agent = 'test-planner' | 'unit-test-writer' | 'integration-test-writer' | 'edge-case-tester' | 'mock-generator' | 'test-runner' | 'bug-fixer' | 'coverage-analyzer';
/** Phase 6: Optimization - 4 agents */
export type Phase6Agent = 'performance-optimizer' | 'refactoring-agent' | 'security-auditor' | 'code-quality-checker';
/** Phase 7: Delivery - 4 agents */
export type Phase7Agent = 'documentation-writer' | 'code-reviewer' | 'release-preparer' | 'sign-off-approver';
/**
 * Sherlock Forensic Review Agents - 7 agents (one per phase + recovery)
 * These agents perform forensic review with verdicts:
 * - INNOCENT: Phase passed review
 * - GUILTY: Phase failed, requires remediation
 * - INSUFFICIENT_EVIDENCE: Needs more data
 *
 * All forensic reviewers are CRITICAL - they gate pipeline progression.
 */
export type SherlockForensicAgent = 'phase-1-reviewer' | 'phase-2-reviewer' | 'phase-3-reviewer' | 'phase-4-reviewer' | 'phase-5-reviewer' | 'phase-6-reviewer' | 'recovery-agent';
/**
 * Union type of all 47 coding pipeline agents
 * 40 core pipeline agents + 7 Sherlock forensic reviewers
 */
export type CodingPipelineAgent = Phase1Agent | Phase2Agent | Phase3Agent | Phase4Agent | Phase5Agent | Phase6Agent | Phase7Agent | SherlockForensicAgent;
/**
 * USACF Algorithm types used by agents
 * From SPEC-003-algorithms.md
 */
export type AlgorithmType = 'LATS' | 'ReAct' | 'Self-Debug' | 'Reflexion' | 'PoT' | 'ToT';
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
/**
 * Phases in execution order
 */
export declare const PHASE_ORDER: CodingPipelinePhase[];
/**
 * Phases where checkpoints are created for rollback
 */
export declare const CHECKPOINT_PHASES: CodingPipelinePhase[];
/**
 * Number of agents per phase
 */
export declare const PHASE_AGENT_COUNTS: Record<CodingPipelinePhase, number>;
/**
 * Total number of core pipeline agents
 * 5 + 5 + 6 + 8 + 8 + 4 + 4 = 40
 */
export declare const CORE_AGENTS = 40;
/**
 * Number of Sherlock forensic review agents
 */
export declare const SHERLOCK_AGENT_COUNT = 7;
/**
 * Total number of agents in the pipeline
 * 40 core + 7 Sherlock = 47
 */
export declare const TOTAL_AGENTS = 47;
/**
 * Sherlock Forensic Review agents (41-47)
 * All are CRITICAL - they gate pipeline phase progression
 */
export declare const SHERLOCK_AGENTS: SherlockForensicAgent[];
/**
 * Critical agents that halt pipeline on failure
 * Includes core critical agents AND all Sherlock forensic reviewers
 */
export declare const CRITICAL_AGENTS: CodingPipelineAgent[];
/**
 * Mapping of Sherlock forensic reviewers to their phases
 */
export declare const SHERLOCK_PHASE_MAP: Record<SherlockForensicAgent, CodingPipelinePhase>;
/**
 * Memory namespace for coding pipeline
 */
export declare const CODING_MEMORY_NAMESPACE = "coding";
/**
 * Memory key prefixes by phase
 */
export declare const MEMORY_PREFIXES: Record<CodingPipelinePhase, string>;
//# sourceMappingURL=types.d.ts.map