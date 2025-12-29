/**
 * Temporal Reasoning Engine
 * SPEC-RSN-002 Section 2.6 - Temporal Reasoning Mode
 *
 * Implements time-ordered causal chain reasoning with sequence-aware inference:
 * 1. Extract temporal references from query
 * 2. Query temporal hyperedges from GraphDB within time range
 * 3. Build Chain-of-History (CoH) for time-ordered events
 * 4. Apply temporal causal reasoning (forward/backward)
 * 5. If evolution tracking enabled, identify concept drift
 * 6. Return temporal chains with confidence decay
 *
 * Performance target: <150ms for 30-day time range queries
 */
import type { GraphDB } from '../../graph-db/graph-db.js';
import type { CausalMemory } from '../causal-memory.js';
import type { IReasoningRequest } from '../reasoning-types.js';
import type { TemporalConfig, ITemporalResult } from '../advanced-reasoning-types.js';
/**
 * Dependencies for TemporalEngine
 */
export interface TemporalEngineDependencies {
    graphDB: GraphDB;
    causalMemory: CausalMemory;
}
/**
 * Temporal Reasoning Engine
 *
 * Performs time-ordered causal reasoning with Chain-of-History (CoH) and
 * confidence decay based on temporal distance.
 *
 * Memory Storage:
 * - Historical embeddings stored in-memory for concept drift tracking
 * - Frequency snapshots tracked for trend analysis
 * - Evolution snapshots preserved for pattern learning
 */
export declare class TemporalEngine {
    private graphDB;
    private causalMemory;
    private embeddingProvider?;
    private historicalEmbeddings;
    private frequencySnapshots;
    private evolutionHistory;
    constructor(deps: TemporalEngineDependencies);
    /**
     * Perform temporal reasoning with time-ordered causal chains
     *
     * Algorithm:
     * 1. Extract temporal references from query
     * 2. Query temporal hyperedges from GraphDB within time range
     * 3. Build Chain-of-History (CoH) for time-ordered events
     * 4. Apply temporal causal reasoning (forward/backward)
     * 5. If evolution tracking, identify concept drift
     * 6. Return temporal chains with confidence decay
     *
     * @param request Reasoning request
     * @param config Temporal configuration
     * @returns Temporal result with event chains and constraints
     */
    reason(request: IReasoningRequest, config: TemporalConfig): Promise<ITemporalResult>;
    /**
     * Query temporal hyperedges from GraphDB within time range
     *
     * @param timeRange Time range filter
     * @param granularity Temporal granularity filter
     * @returns Filtered temporal hyperedges
     */
    private queryTemporalHyperedges;
    /**
     * Extract temporal context from query embedding
     *
     * Analyzes the query to identify temporal references and markers.
     *
     * @param embedding Query embedding
     * @param timeRange Time range for analysis
     * @returns Temporal context
     */
    private extractTemporalContext;
    /**
     * Build Chain-of-History (CoH) from temporal hyperedges
     *
     * Creates time-ordered event sequences from temporal hyperedges.
     *
     * @param hyperedges Temporal hyperedges
     * @param maxLength Maximum chain length
     * @returns Temporal chains
     */
    private buildChainOfHistory;
    /**
     * Build a single temporal chain from a starting hyperedge
     */
    private buildSingleChain;
    /**
     * Apply temporal causal reasoning with confidence decay
     *
     * Performs causal inference over temporal chains with confidence
     * decreasing based on time distance between events.
     *
     * @param chains Temporal chains
     * @param direction Traversal direction
     * @param confidenceDecay Decay factor per time unit
     * @returns Temporal inference
     */
    private applyTemporalCausalReasoning;
    /**
     * Apply confidence decay based on time distance
     *
     * Confidence decreases exponentially with time gaps between events.
     *
     * @param chain Temporal chain
     * @param decayFactor Decay factor per time unit (0-1)
     * @returns Chain with decayed confidence
     */
    private applyConfidenceDecay;
    /**
     * Track concept evolution over time
     *
     * Identifies concept drift and pattern changes across temporal chains.
     *
     * Real implementation:
     * 1. Extract concepts from temporal chains
     * 2. Calculate embedding drift using cosine similarity
     * 3. Analyze frequency trends with linear regression
     * 4. Detect emerging/declining patterns (>50% change)
     * 5. Store evolution snapshot for learning
     *
     * @param chains Temporal chains
     * @param inference Temporal inference
     * @returns Concept evolution with real metrics
     */
    private trackConceptEvolution;
    /**
     * Infer temporal constraints between events
     *
     * Determines temporal relationships (before, after, during, concurrent).
     *
     * @param events Temporal events
     * @returns Temporal constraints
     */
    private inferTemporalConstraints;
    /**
     * Calculate temporal consistency of a chain
     *
     * Checks if events follow a consistent temporal order.
     */
    private calculateTemporalConsistency;
    /**
     * Validate a temporal constraint
     */
    private validateConstraint;
    /**
     * Calculate chain confidence
     */
    private calculateChainConfidence;
    /**
     * Determine temporal relationship between two timestamps
     */
    private determineTemporalRelationship;
    /**
     * Calculate time units from milliseconds based on granularity
     */
    private calculateTimeUnits;
    /**
     * Infer temporal direction from context
     */
    private inferTemporalDirection;
    /**
     * Parse time range from config
     */
    private parseTimeRange;
    /**
     * Parse relative time string (e.g., "30d", "1h", "now")
     */
    private parseRelativeTime;
    /**
     * Map GraphDB Granularity to TemporalConfig granularity
     */
    private mapGranularity;
    /**
     * Extract concepts from temporal chains
     *
     * Extracts unique node IDs as concept identifiers from chains.
     *
     * @param chains Temporal chains
     * @returns Array of unique concept identifiers
     */
    private extractConceptsFromChains;
    /**
     * Calculate cosine similarity between two vectors
     *
     * Formula: cos(θ) = (A·B) / (||A|| * ||B||)
     *
     * @param a First vector
     * @param b Second vector
     * @returns Similarity score [0, 1]
     */
    private cosineSimilarity;
    /**
     * Average multiple embeddings
     *
     * @param embeddings Array of embedding vectors
     * @returns Averaged embedding vector
     */
    private averageEmbeddings;
    /**
     * Linear regression for trend analysis
     *
     * Calculates slope, R² confidence, and percent change.
     *
     * @param data Array of {count, timestamp} data points
     * @returns Regression results with slope, confidence, and percentChange
     */
    private linearRegression;
    /**
     * Calculate embedding drift for concepts
     *
     * Compares current embeddings with historical embeddings using cosine similarity.
     * Drift = 1 - similarity (higher drift = more change)
     *
     * @param concepts Array of concept identifiers
     * @returns Array of drift results with confidence scores
     */
    private calculateEmbeddingDrift;
    /**
     * Analyze frequency trends using linear regression
     *
     * @param concepts Array of concept identifiers
     * @returns Frequency changes with trend classification
     */
    private analyzeFrequencyTrends;
    /**
     * Detect emerging patterns (>50% increase)
     *
     * @param frequencyChanges Frequency change results
     * @returns Array of emerging pattern identifiers
     */
    private detectEmergingPatterns;
    /**
     * Detect declining patterns (>50% decrease)
     *
     * @param frequencyChanges Frequency change results
     * @returns Array of declining pattern identifiers
     */
    private detectDecliningPatterns;
    /**
     * Store historical embedding
     *
     * @param concept Concept identifier
     * @param embedding Embedding vector
     */
    private storeHistoricalEmbedding;
    /**
     * Retrieve historical embeddings for a concept
     *
     * @param concept Concept identifier
     * @param daysBack Number of days to look back
     * @returns Historical embeddings within time range
     */
    private getHistoricalEmbeddings;
    /**
     * Store evolution snapshot
     *
     * @param snapshot Evolution snapshot to store
     */
    private storeEvolutionSnapshot;
    /**
     * Generate semantic embedding for a concept using real embedding provider (SPEC-EMB-002)
     *
     * @param concept Concept identifier
     * @returns Semantic embedding vector (1536 dimensions)
     */
    private generatePlaceholderEmbedding;
    /**
     * Generate hash-based deterministic embedding as ultimate fallback
     */
    private generateHashBasedEmbedding;
    /**
     * Generate trajectory ID for tracking
     */
    private generateTrajectoryId;
    /**
     * Format answer from temporal chains
     */
    private formatAnswer;
    /**
     * Generate reasoning steps for temporal analysis
     */
    private generateReasoningSteps;
}
//# sourceMappingURL=temporal-engine.d.ts.map