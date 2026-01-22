/**
 * DAI-002: Coding Pipeline DAG Builder
 *
 * Functions for building and validating the coding pipeline DAG.
 * Extracted for constitution compliance (< 500 lines per file).
 *
 * @see command-task-bridge.ts
 * @see SPEC-001-architecture.md
 */
import type { IAgentMapping as ICodingAgentMapping, CodingPipelinePhase, CodingPipelineAgent, IPipelineDAG } from './types.js';
/**
 * Combined mapping of all 47 agents across all phases.
 * Re-exported for backward compatibility.
 */
export declare const CODING_PIPELINE_MAPPINGS: ICodingAgentMapping[];
/**
 * Get all agents for a specific phase.
 *
 * @param phase - The pipeline phase to get agents for
 * @returns Array of agent mappings for the phase, sorted by priority
 */
export declare function getAgentsForPhase(phase: CodingPipelinePhase): ICodingAgentMapping[];
/**
 * Build the complete pipeline DAG from agent mappings.
 *
 * @returns Complete DAG structure for pipeline execution
 */
export declare function buildPipelineDAG(): IPipelineDAG;
/**
 * Get all critical agents that halt the pipeline on failure.
 *
 * @returns Array of critical agent mappings
 */
export declare function getCriticalAgents(): ICodingAgentMapping[];
/**
 * Get a specific agent mapping by key.
 *
 * @param key - The agent key to find
 * @returns The agent mapping or undefined if not found
 */
export declare function getAgentByKey(key: CodingPipelineAgent): ICodingAgentMapping | undefined;
/**
 * Get the total XP available in the pipeline.
 *
 * @returns Total XP reward sum across all agents
 */
export declare function getTotalPipelineXP(): number;
/**
 * Get XP totals grouped by phase.
 *
 * @returns Map of phase to total XP for that phase
 */
export declare function getPhaseXPTotals(): Map<CodingPipelinePhase, number>;
/**
 * Validate that all dependencies are valid.
 *
 * @returns Array of validation errors (empty if valid)
 */
export declare function validatePipelineDependencies(): string[];
/**
 * Get agents by category.
 *
 * @param category - The category to filter by
 * @returns Array of agent mappings in that category
 */
export declare function getAgentsByCategory(category: string): ICodingAgentMapping[];
/**
 * Get all forensic review agents (Sherlock agents).
 *
 * @returns Array of forensic review agent mappings
 */
export declare function getForensicReviewAgents(): ICodingAgentMapping[];
/**
 * Get agents that can run in parallel for a given phase.
 *
 * @param phase - The pipeline phase
 * @returns Array of parallelizable agents for the phase
 */
export declare function getParallelizableAgents(phase: CodingPipelinePhase): ICodingAgentMapping[];
/**
 * Get the execution order for a phase considering dependencies.
 *
 * @param phase - The pipeline phase
 * @returns Ordered array of agent keys for execution
 */
export declare function getPhaseExecutionOrder(phase: CodingPipelinePhase): CodingPipelineAgent[];
//# sourceMappingURL=coding-pipeline-dag-builder.d.ts.map