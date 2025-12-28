/**
 * Adversarial Reasoning Engine
 * SPEC-RSN-002 Section 2.5 - Adversarial Reasoning Mode
 *
 * Implements failure mode and security vulnerability detection using:
 * - Shadow Vector Search for contradiction/vulnerability detection
 * - Causal inference for attack scenario generation
 * - Pattern matching for failure patterns and countermeasures
 *
 * Performance target: <180ms including shadow search
 */
import type { VectorDB } from '../../vector-db/vector-db.js';
import type { CausalMemory } from '../causal-memory.js';
import type { PatternMatcher } from '../pattern-matcher.js';
import type { IReasoningRequest } from '../reasoning-types.js';
import type { AdversarialConfig, IAdversarialResult } from '../advanced-reasoning-types.js';
export interface AdversarialEngineDependencies {
    vectorDB: VectorDB;
    causalMemory: CausalMemory;
    patternMatcher: PatternMatcher;
}
/**
 * Adversarial Reasoning Engine
 *
 * Identifies security vulnerabilities, failure modes, and edge cases using
 * shadow vector search and causal inference.
 */
export declare class AdversarialEngine {
    private vectorDB;
    private causalMemory;
    private patternMatcher;
    private shadowSearch;
    constructor(deps: AdversarialEngineDependencies);
    /**
     * Perform adversarial reasoning to identify vulnerabilities and failure modes
     *
     * Algorithm:
     * 1. Parse target system/code from query
     * 2. Retrieve failure patterns and security anti-patterns
     * 3. Use Shadow Vector Search for contradiction/vulnerability detection
     * 4. Generate attack scenarios using causal inference
     * 5. Rank by severity and exploitability
     * 6. Optionally add countermeasures
     *
     * @param request Reasoning request
     * @param config Adversarial configuration
     * @returns Adversarial result with ranked contradictions/vulnerabilities
     */
    reason(request: IReasoningRequest, config: AdversarialConfig): Promise<IAdversarialResult>;
    /**
     * Generate reasoning steps for adversarial analysis
     */
    private generateReasoningSteps;
    /**
     * Parse target system/code from query
     */
    private parseTarget;
    /**
     * Infer task types based on threat model
     */
    private inferTaskTypes;
    /**
     * Search for failure patterns and security anti-patterns
     */
    private findFailurePatterns;
    /**
     * Perform shadow vector search for contradictions
     * Shadow vector = original vector × -1 (semantic opposite)
     */
    private shadowVectorSearch;
    /**
     * Generate attack scenarios using causal inference
     */
    private generateAttackScenarios;
    /**
     * Combine failure patterns, contradictions, and attack scenarios into threats
     */
    private combineThreats;
    /**
     * Rank threats by severity and exploitability
     */
    private rankThreats;
    /**
     * Generate countermeasures for identified threats
     */
    private generateCountermeasures;
    /**
     * Convert ranked threats to Contradiction format
     */
    private toContradictions;
    /**
     * Format adversarial analysis report
     */
    private formatAdversarialReport;
    /**
     * Calculate overall confidence
     */
    private calculateConfidence;
    /**
     * Infer severity from task type and confidence
     */
    private inferSeverity;
    /**
     * Extract causes from pattern description
     */
    private extractCauses;
    /**
     * Infer impact from causal path
     */
    private inferImpact;
    /**
     * Calculate exploitability
     */
    private calculateExploitability;
    /**
     * Infer complexity from description
     */
    private inferComplexity;
    /**
     * Infer resolution strategy
     */
    private inferResolution;
    /**
     * Create VectorDB adapter for ShadowVectorSearch
     */
    private createVectorStoreAdapter;
}
//# sourceMappingURL=adversarial-engine.d.ts.map