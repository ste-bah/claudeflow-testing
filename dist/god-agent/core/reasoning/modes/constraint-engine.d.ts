/**
 * Constraint-Based Reasoning Engine
 * RSN-002 Implementation - Constraint Satisfaction Problem (CSP) Solving
 *
 * Purpose: Solve problems with hard and soft constraints
 * using backtracking, local search, and hybrid strategies
 *
 * Features:
 * - Backtracking with constraint propagation
 * - Local search optimization
 * - Hybrid solver combining both approaches
 * - Hard vs soft constraint handling
 * - Weighted constraint optimization
 *
 * Dependencies:
 * - GraphDB: Variable domain retrieval (optional)
 * - PatternMatcher: Constraint inference (optional)
 *
 * Performance Target: <200ms latency
 */
import type { IReasoningRequest } from '../reasoning-types.js';
import type { ConstraintConfig, IConstraintResult, Constraint } from '../advanced-reasoning-types.js';
/**
 * Dependencies for ConstraintEngine
 */
export interface ConstraintEngineDependencies {
    /** Graph database for domain queries (optional) */
    graphDB?: {
        getVariableDomain?(variable: string): Promise<unknown[]>;
    };
    /** Pattern matcher for constraint inference (optional) */
    patternMatcher?: {
        inferConstraints?(query: string): Promise<Constraint[]>;
    };
}
/**
 * Constraint-based reasoning engine
 *
 * Implements CSP solving with multiple strategies:
 * - Backtracking: Systematic search with constraint propagation
 * - Local Search: Hill climbing with random restarts
 * - Hybrid: Combines both for efficiency
 *
 * @example
 * ```typescript
 * const engine = new ConstraintEngine({});
 * const result = await engine.reason(
 *   { query: 'Schedule meetings without conflicts' },
 *   {
 *     hardConstraints: [
 *       { id: 'no-overlap', type: 'custom', variables: ['meeting1', 'meeting2'], ... }
 *     ],
 *     solverStrategy: 'hybrid'
 *   }
 * );
 * ```
 */
export declare class ConstraintEngine {
    private deps;
    constructor(deps: ConstraintEngineDependencies);
    /**
     * Perform constraint-based reasoning
     *
     * @param request - The reasoning request containing the query
     * @param config - Constraint configuration
     * @returns Constraint result with solution
     */
    reason(request: IReasoningRequest, config: ConstraintConfig): Promise<IConstraintResult>;
    /**
     * Extract unique variables from constraints
     */
    private extractVariables;
    /**
     * Initialize domains for variables
     */
    private initializeDomains;
    /**
     * Get default domain for a variable
     */
    private getDefaultDomain;
    /**
     * Solve using backtracking with constraint propagation
     */
    private solveBacktracking;
    /**
     * Check if current assignments are consistent
     */
    private isConsistent;
    /**
     * Solve using local search with random restarts
     */
    private solveLocalSearch;
    /**
     * Make random assignment to all variables
     */
    private randomAssignment;
    /**
     * Attempt a local move to improve score
     */
    private localMove;
    /**
     * Random perturbation of one variable
     */
    private randomPerturbation;
    /**
     * Solve using hybrid approach
     */
    private solveHybrid;
    /**
     * Clone variables map
     */
    private cloneVariables;
    /**
     * Evaluate current state against constraints
     */
    private evaluateState;
    /**
     * Get current variable assignments
     */
    private getAssignments;
    /**
     * Check if a constraint is satisfied
     */
    private checkConstraint;
    /**
     * Convert solver state to solution
     */
    private stateToSolution;
    /**
     * Create partial solution when no complete solution found
     */
    private createPartialSolution;
    /**
     * Calculate consistency score
     */
    private calculateConsistency;
    /**
     * Calculate overall confidence
     */
    private calculateConfidence;
    /**
     * Format answer from solution
     */
    private formatAnswer;
    /**
     * Generate reasoning explanation
     */
    private generateReasoning;
}
/**
 * Create a configured ConstraintEngine instance
 */
export declare function createConstraintEngine(deps: ConstraintEngineDependencies): ConstraintEngine;
//# sourceMappingURL=constraint-engine.d.ts.map