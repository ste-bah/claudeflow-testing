/**
 * Analogical Reasoning Engine
 * RSN-002 Implementation - Cross-Domain Pattern Transfer
 *
 * Purpose: Transfer knowledge from source domain to target domain
 * by identifying structural similarities between patterns
 *
 * Features:
 * - Cross-domain pattern search
 * - Structure Mapping Engine (SME) algorithm
 * - GNN-based analogy validation
 * - Transferability scoring
 * - Abstract vs concrete mapping control
 *
 * Dependencies:
 * - PatternMatcher: Source pattern retrieval
 * - VectorDB: Semantic similarity search
 * - GNNEnhancer: Optional structural validation
 *
 * Performance Target: <150ms latency
 */
import type { IReasoningRequest } from '../reasoning-types.js';
import type { AnalogicalConfig, IAnalogicalResult, AnalogicalMapping, Pattern } from '../advanced-reasoning-types.js';
import type { IEmbeddingProvider } from '../../memory/types.js';
/**
 * Dependencies for AnalogicalEngine
 */
export interface AnalogicalEngineDependencies {
    /** Pattern matcher for retrieving source patterns */
    patternMatcher?: {
        findPatterns?(query: string, options?: {
            domain?: string;
            topK?: number;
        }): Promise<Pattern[]>;
        getPatternsByDomain?(domain: string): Promise<Pattern[]>;
    };
    /** Vector database for semantic search */
    vectorDB?: {
        search?(embedding: Float32Array, options?: {
            topK?: number;
            filter?: Record<string, unknown>;
        }): Promise<Array<{
            id: string;
            score: number;
            metadata?: Record<string, unknown>;
        }>>;
        getEmbedding?(text: string): Promise<Float32Array>;
    };
    /** GNN enhancer for structural validation (optional) */
    gnnEnhancer?: {
        computeStructuralSimilarity?(pattern1: Pattern, pattern2: Pattern): Promise<number>;
        validateAnalogy?(mapping: AnalogicalMapping): Promise<number>;
    };
    /** Embedding provider for synthetic pattern embeddings (SPEC-ANA-001) */
    embeddingProvider?: IEmbeddingProvider;
}
/**
 * Analogical reasoning engine
 *
 * Implements Structure Mapping Engine (SME) principles for
 * cross-domain knowledge transfer. Identifies structural similarities
 * between domains and generates transferable mappings.
 *
 * @example
 * ```typescript
 * const engine = new AnalogicalEngine({ patternMatcher, vectorDB });
 * const result = await engine.reason(
 *   { query: 'How is software architecture like building architecture?' },
 *   { sourceDomain: 'architecture', targetDomain: 'software' }
 * );
 * // result.analogicalMappings contains structural mappings
 * ```
 */
export declare class AnalogicalEngine {
    private deps;
    private embeddingProvider?;
    private syntheticPatternCache;
    constructor(deps: AnalogicalEngineDependencies);
    /**
     * Perform analogical reasoning on a query
     *
     * @param request - The reasoning request containing the query
     * @param config - Analogical configuration
     * @returns Analogical result with mappings
     */
    reason(request: IReasoningRequest, config: AnalogicalConfig): Promise<IAnalogicalResult>;
    /**
     * Get domain knowledge base
     */
    private getDomainKnowledge;
    /**
     * Extract concepts from domain name (fallback)
     */
    private extractConceptsFromDomain;
    /**
     * Find source patterns relevant to domain
     */
    private findSourcePatterns;
    /**
     * Generate synthetic patterns from domain knowledge
     */
    private generateSyntheticPatterns;
    /**
     * Generate semantic embedding using real embedding provider (SPEC-EMB-002)
     */
    private generateMockEmbedding;
    /**
     * Generate hash-based deterministic embedding as ultimate fallback
     */
    private generateHashBasedEmbedding;
    /**
     * Clear the synthetic pattern embedding cache
     */
    clearSyntheticPatternCache(): void;
    /**
     * Get cache statistics
     */
    getSyntheticPatternCacheStats(): {
        size: number;
    };
    /**
     * Generate analogical mappings between domains
     */
    private generateMappings;
    /**
     * Find predefined cross-domain mappings
     */
    private findPredefinedMappings;
    /**
     * Create mapping for a source pattern
     */
    private createMapping;
    /**
     * Extract concepts from pattern
     */
    private extractPatternConcepts;
    /**
     * Find best target mapping for a source concept
     */
    private findBestTargetMapping;
    /**
     * Compute similarity between two concepts
     */
    private computeConceptSimilarity;
    /**
     * Get character bigrams from string
     */
    private getBigrams;
    /**
     * Generate structural mappings based on relation patterns
     */
    private generateStructuralMappings;
    /**
     * Calculate structural similarity of mapping
     */
    private calculateStructuralSimilarity;
    /**
     * Calculate transferability of mapping
     */
    private calculateTransferability;
    /**
     * Calculate overall confidence
     */
    private calculateConfidence;
    /**
     * Format answer from mappings
     */
    private formatAnswer;
    /**
     * Generate reasoning explanation
     */
    private generateReasoning;
}
/**
 * Create a configured AnalogicalEngine instance
 */
export declare function createAnalogicalEngine(deps: AnalogicalEngineDependencies): AnalogicalEngine;
//# sourceMappingURL=analogical-engine.d.ts.map