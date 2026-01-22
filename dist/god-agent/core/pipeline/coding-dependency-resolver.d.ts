/**
 * Coding Pipeline Dependency Resolver
 * Extracted from coding-pipeline-orchestrator.ts for constitution.xml compliance
 *
 * Handles:
 * - Topological sort for agent execution ordering
 * - Parallel batching with dependency awareness
 */
import type { IAgentMapping } from './types.js';
/**
 * Resolve execution order for agents within a phase
 * Uses topological sort based on dependencies
 *
 * @param agents - Array of agent mappings to order
 * @returns Ordered array with dependencies resolved
 */
export declare function resolveExecutionOrder(agents: IAgentMapping[]): IAgentMapping[];
/**
 * Batch agents for parallel execution where allowed
 * Groups agents whose dependencies are satisfied into batches
 *
 * @param agents - Ordered array of agent mappings
 * @param enableParallel - Whether parallel execution is enabled
 * @param maxParallelAgents - Maximum agents per batch
 * @returns Array of batches, each containing agents that can run in parallel
 */
export declare function batchAgentsForExecution(agents: IAgentMapping[], enableParallel: boolean, maxParallelAgents: number): IAgentMapping[][];
//# sourceMappingURL=coding-dependency-resolver.d.ts.map