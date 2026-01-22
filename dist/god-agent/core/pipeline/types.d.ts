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
/** Phase 1: Understanding - 6 agents */
export type Phase1Agent = 'task-analyzer' | 'requirement-extractor' | 'requirement-prioritizer' | 'scope-definer' | 'context-gatherer' | 'feasibility-analyzer';
/** Phase 2: Exploration - 4 agents */
export type Phase2Agent = 'pattern-explorer' | 'technology-scout' | 'research-planner' | 'codebase-analyzer';
/** Phase 3: Architecture - 5 agents */
export type Phase3Agent = 'system-designer' | 'component-designer' | 'interface-designer' | 'data-architect' | 'integration-architect';
/** Phase 4: Implementation - 12 agents */
export type Phase4Agent = 'code-generator' | 'type-implementer' | 'unit-implementer' | 'service-implementer' | 'data-layer-implementer' | 'api-implementer' | 'frontend-implementer' | 'error-handler-implementer' | 'config-implementer' | 'logger-implementer' | 'dependency-manager' | 'implementation-coordinator';
/** Phase 5: Testing - 7 agents */
export type Phase5Agent = 'test-generator' | 'test-runner' | 'integration-tester' | 'regression-tester' | 'security-tester' | 'coverage-analyzer' | 'quality-gate';
/** Phase 6: Optimization - 5 agents */
export type Phase6Agent = 'performance-optimizer' | 'performance-architect' | 'code-quality-improver' | 'security-architect' | 'final-refactorer';
/** Phase 7: Delivery - 1 core agent */
export type Phase7Agent = 'sign-off-approver';
/** Sherlock Forensic Review Agents - 7 agents (one per phase + recovery)
 * Verdicts: INNOCENT (passed), GUILTY (failed), INSUFFICIENT_EVIDENCE (needs more data)
 * All forensic reviewers are CRITICAL - they gate pipeline progression. */
export type SherlockForensicAgent = 'phase-1-reviewer' | 'phase-2-reviewer' | 'phase-3-reviewer' | 'phase-4-reviewer' | 'phase-5-reviewer' | 'phase-6-reviewer' | 'recovery-agent';
/** Union type of all 47 coding pipeline agents (40 core + 7 Sherlock) */
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
 * Number of agents per phase (core only, excludes Sherlock forensic reviewers)
 * Sherlock reviewers are separate (7 total: phase-1-reviewer through phase-6-reviewer + recovery-agent)
 * REQ-PIPE-047: Matches actual .claude/agents/coding-pipeline/*.md files
 */
export declare const PHASE_AGENT_COUNTS: Record<CodingPipelinePhase, number>;
/**
 * Total number of core pipeline agents
 * 6 + 4 + 5 + 12 + 7 + 5 + 1 = 40
 * REQ-PIPE-047: Verified against actual .claude/agents/coding-pipeline/*.md files
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
 * REQ-PIPE-047: Matches actual .claude/agents/coding-pipeline/*.md files
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
/**
 * Sherlock forensic verification verdict values.
 * Used by agents 41-47 in Phase 6 for code review.
 */
export declare enum SherlockVerdict {
    /** Code passes all forensic checks */
    INNOCENT = "INNOCENT",
    /** Code has critical issues requiring remediation */
    GUILTY = "GUILTY",
    /** Not enough information to make determination */
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
}
/**
 * Confidence level for Sherlock verdicts.
 */
export type SherlockConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
/**
 * Evidence collected during forensic review.
 */
export interface ISherlockEvidence {
    /** Type of evidence (code_pattern, test_result, static_analysis, etc.) */
    type: string;
    /** File path where evidence was found */
    filePath?: string;
    /** Line numbers if applicable */
    lineRange?: {
        start: number;
        end: number;
    };
    /** Description of the evidence */
    description: string;
    /** Raw data or code snippet */
    data?: unknown;
}
/**
 * Issue found during forensic review.
 */
export interface ISherlockIssue {
    /** Severity: critical, high, medium, low */
    severity: 'critical' | 'high' | 'medium' | 'low';
    /** Category of issue */
    category: string;
    /** Description of the issue */
    description: string;
    /** File path where issue was found */
    filePath?: string;
    /** Suggested remediation */
    remediation?: string;
}
/**
 * Complete result from Sherlock forensic verification.
 */
export interface ISherlockResult {
    /** Overall verdict */
    verdict: SherlockVerdict;
    /** Confidence in the verdict */
    confidence: SherlockConfidence;
    /** Evidence supporting the verdict */
    evidence: ISherlockEvidence[];
    /** Issues found during review */
    issues: ISherlockIssue[];
    /** Agent that produced this result */
    agentKey: string;
    /** Timestamp of review */
    timestamp: string;
    /** Optional reasoning */
    reasoning?: string;
}
/**
 * Phase-level review result from Sherlock pipeline.
 */
export interface IPhaseReviewResult {
    /** Phase number reviewed */
    phase: number;
    /** Verdict for this phase */
    verdict: SherlockVerdict;
    /** Confidence level */
    confidence: SherlockConfidence;
    /** Remediation steps if GUILTY */
    remediations: string[];
    /** Number of retry attempts */
    retryCount: number;
    /** Individual agent results */
    agentResults?: ISherlockResult[];
}
//# sourceMappingURL=types.d.ts.map