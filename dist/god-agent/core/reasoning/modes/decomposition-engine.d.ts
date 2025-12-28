/**
 * Decomposition Reasoning Engine
 * RSN-002 Implementation - Problem Breakdown Mode
 *
 * Purpose: Break complex problems into manageable subproblems by TaskType
 *
 * Features:
 * - Hierarchical decomposition (top-down by abstraction)
 * - Sequential decomposition (by execution order)
 * - Parallel decomposition (independent subproblems)
 * - Adaptive strategy selection based on query complexity
 * - Topological sort for dependency resolution
 * - Solution aggregation from sub-results
 *
 * Dependencies:
 * - PatternMatcher: TaskType classification
 * - GraphDB: Optional dependency analysis
 *
 * Performance Target: <120ms latency
 */
import type { IReasoningRequest } from '../reasoning-types.js';
import type { DecompositionConfig, IDecompositionResult } from '../advanced-reasoning-types.js';
import { TaskType } from '../pattern-types.js';
/**
 * Dependencies for DecompositionEngine
 */
export interface DecompositionEngineDependencies {
    /** Pattern matcher for TaskType classification */
    patternMatcher?: {
        classifyTaskType?(query: string): Promise<TaskType>;
        getPatternsByTaskType?(taskType: TaskType): Promise<unknown[]>;
    };
    /** Graph database for dependency analysis (optional) */
    graphDB?: {
        findRelatedNodes?(nodeId: string): Promise<unknown[]>;
    };
}
/**
 * Decomposition reasoning engine
 *
 * Breaks down complex problems into manageable subproblems with:
 * - Strategy-based decomposition (hierarchical, sequential, parallel, adaptive)
 * - Dependency analysis and topological sorting
 * - Parallelization opportunities identification
 * - Solution aggregation
 *
 * @example
 * ```typescript
 * const engine = new DecompositionEngine({ patternMatcher });
 * const result = await engine.reason(
 *   { query: 'Build a REST API with auth, database, and tests' },
 *   { decompositionStrategy: 'adaptive', maxSubproblems: 10 }
 * );
 * // result.plan contains subproblems, executionOrder, parallelizationGroups
 * ```
 */
export declare class DecompositionEngine {
    constructor(_deps: DecompositionEngineDependencies);
    /**
     * Perform decomposition reasoning on a query
     *
     * @param request - The reasoning request containing the query
     * @param config - Decomposition configuration
     * @returns Decomposition result with execution plan
     */
    reason(request: IReasoningRequest, config: DecompositionConfig): Promise<IDecompositionResult>;
    /**
     * Analyze the complexity of a query
     *
     * Factors:
     * - Query length
     * - Number of distinct concepts (nouns/verbs)
     * - Presence of conjunctions (and, or, then)
     * - Nested clauses
     *
     * @param query - Query to analyze
     * @returns Normalized complexity score [0, 1]
     */
    private analyzeComplexity;
    /**
     * Count conjunctions in query
     */
    private countConjunctions;
    /**
     * Identify task types present in query
     */
    private identifyTaskTypes;
    /**
     * Select best decomposition strategy based on query characteristics
     *
     * @param query - The query to analyze
     * @param complexity - Pre-calculated complexity score
     * @returns Selected strategy
     */
    private selectBestStrategy;
    /**
     * Identify subproblems from query using specified strategy
     *
     * @param query - Query to decompose
     * @param strategy - Decomposition strategy
     * @param maxSubproblems - Maximum number of subproblems
     * @param minComplexity - Minimum complexity to be a subproblem
     * @returns Array of identified subproblems
     */
    private identifySubproblems;
    /**
     * Parse query into segments for decomposition
     */
    private parseQuerySegments;
    /**
     * Classify task type for a text segment
     */
    private classifyTaskType;
    /**
     * Analyze complexity of a single segment
     */
    private analyzeSegmentComplexity;
    /**
     * Extract keywords from text
     */
    private extractKeywords;
    /**
     * Hierarchical decomposition: top-down by abstraction levels
     */
    private decomposeHierarchical;
    /**
     * Sequential decomposition: by execution order
     */
    private decomposeSequential;
    /**
     * Parallel decomposition: independent subproblems
     */
    private decomposeParallel;
    /**
     * Format subproblem description
     */
    private formatSubproblemDescription;
    /**
     * Analyze dependencies between subproblems
     */
    private analyzeDependencies;
    /**
     * Determine execution order using topological sort
     */
    private determineExecutionOrder;
    /**
     * Identify groups of subproblems that can run in parallel
     */
    private identifyParallelGroups;
    /**
     * Format plan summary for answer field
     */
    private formatPlanSummary;
    /**
     * Calculate confidence in the decomposition plan
     */
    private calculatePlanConfidence;
    /**
     * Generate reasoning explanation
     */
    private generateReasoning;
}
/**
 * Create a configured DecompositionEngine instance
 */
export declare function createDecompositionEngine(deps: DecompositionEngineDependencies): DecompositionEngine;
//# sourceMappingURL=decomposition-engine.d.ts.map