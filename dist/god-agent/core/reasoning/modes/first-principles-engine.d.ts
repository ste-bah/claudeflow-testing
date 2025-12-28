/**
 * First Principles Reasoning Engine
 * RSN-002 Implementation - Axiomatic Derivation
 *
 * Purpose: Derive conclusions from fundamental axioms
 * using logical inference rules
 *
 * Features:
 * - Axiom discovery and validation
 * - Derivation chain building
 * - Multiple inference rules (modus ponens, modus tollens, etc.)
 * - Soundness and completeness scoring
 * - Assumption tracking
 *
 * Dependencies:
 * - CausalMemory: Logical relationships (optional)
 * - GraphDB: Knowledge graph queries (optional)
 * - PatternMatcher: Domain axiom retrieval (optional)
 *
 * Performance Target: <200ms latency
 */
import type { IReasoningRequest } from '../reasoning-types.js';
import type { FirstPrinciplesConfig, IFirstPrinciplesResult, Axiom } from '../advanced-reasoning-types.js';
/**
 * Dependencies for FirstPrinciplesEngine
 */
export interface FirstPrinciplesEngineDependencies {
    /** Causal memory for logical relationships (optional) */
    causalMemory?: {
        getAxioms?(domain: string): Promise<Axiom[]>;
        getRelatedConcepts?(concept: string): Promise<string[]>;
    };
    /** Graph database for knowledge queries (optional) */
    graphDB?: {
        queryStatements?(domain: string): Promise<string[]>;
        findPath?(from: string, to: string): Promise<string[]>;
    };
    /** Pattern matcher for domain axioms (optional) */
    patternMatcher?: {
        getAxiomsForDomain?(domain: string): Promise<Axiom[]>;
    };
}
/**
 * First principles reasoning engine
 *
 * Derives conclusions from fundamental axioms using logical
 * inference rules. Builds proof chains from premises to conclusions
 * with soundness and completeness metrics.
 *
 * @example
 * ```typescript
 * const engine = new FirstPrinciplesEngine({ causalMemory });
 * const result = await engine.reason(
 *   { query: 'Why do pure functions make code easier to test?' },
 *   { fundamentalDomain: 'software', derivationDepth: 3 }
 * );
 * // result.proof contains axioms and derivation steps
 * ```
 */
export declare class FirstPrinciplesEngine {
    private deps;
    constructor(deps: FirstPrinciplesEngineDependencies);
    /**
     * Perform first principles reasoning
     *
     * @param request - The reasoning request containing the query
     * @param config - First principles configuration
     * @returns First principles result with proof
     */
    reason(request: IReasoningRequest, config: FirstPrinciplesConfig): Promise<IFirstPrinciplesResult>;
    /**
     * Get axioms for domain
     */
    private getAxioms;
    /**
     * Generate synthetic axioms for unknown domain
     */
    private generateSyntheticAxioms;
    /**
     * Extract reasoning goal from query
     */
    private extractGoal;
    /**
     * Build derivation chain from axioms to goal
     */
    private buildDerivation;
    /**
     * Apply inference rules to derive new statements
     */
    private applyInferenceRules;
    /**
     * Parse statement into structured form
     */
    private parseStatement;
    /**
     * Check if two statements match (approximate)
     */
    private statementsMatch;
    /**
     * Extract keywords from statement
     */
    private extractKeywords;
    /**
     * Calculate keyword overlap
     */
    private keywordOverlap;
    /**
     * Check if conclusion is relevant to goal
     */
    private isRelevantToGoal;
    /**
     * Create final step connecting to goal
     */
    private createFinalStep;
    /**
     * Check if axiom is used in derivation
     */
    private axiomUsedInDerivation;
    /**
     * Extract final conclusion from derivation
     */
    private extractConclusion;
    /**
     * Calculate soundness of proof
     */
    private calculateSoundness;
    /**
     * Calculate completeness of proof
     */
    private calculateCompleteness;
    /**
     * Calculate overall confidence
     */
    private calculateConfidence;
    /**
     * Format answer from proof
     */
    private formatAnswer;
    /**
     * Generate reasoning explanation
     */
    private generateReasoning;
}
/**
 * Create a configured FirstPrinciplesEngine instance
 */
export declare function createFirstPrinciplesEngine(deps: FirstPrinciplesEngineDependencies): FirstPrinciplesEngine;
//# sourceMappingURL=first-principles-engine.d.ts.map