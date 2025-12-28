/**
 * Provenance Utilities
 * TASK-PRV-001 - ID Generation and Validation
 *
 * Provides utility functions for source and provenance management.
 */
import type { SourceID, ProvenanceID, ISourceInput, IProvenanceInput, IDerivationStep, ILScoreResult, ILScoreThreshold } from './provenance-types.js';
/** Default L-Score threshold */
export declare const DEFAULT_LSCORE_THRESHOLD = 0.3;
/** Domain-specific L-Score thresholds */
export declare const DOMAIN_THRESHOLDS: ILScoreThreshold[];
/**
 * Generate a unique SourceID
 * Format: "src_{timestamp}_{random8hex}"
 */
export declare function generateSourceID(): SourceID;
/**
 * Generate a unique ProvenanceID
 * Format: "prov_{timestamp}_{random8hex}"
 */
export declare function generateProvenanceID(): ProvenanceID;
/**
 * Validate SourceID format
 */
export declare function isValidSourceID(id: string): boolean;
/**
 * Validate ProvenanceID format
 */
export declare function isValidProvenanceID(id: string): boolean;
/**
 * Validate source input
 * @throws ProvenanceValidationError if validation fails
 */
export declare function validateSourceInput(input: ISourceInput): void;
/**
 * Validate provenance input
 * @throws ProvenanceValidationError if validation fails
 */
export declare function validateProvenanceInput(input: IProvenanceInput): void;
/**
 * Validate a derivation step
 * @throws ProvenanceValidationError if validation fails
 */
export declare function validateDerivationStep(step: IDerivationStep): void;
/**
 * Calculate geometric mean of an array of numbers
 * GM = (∏ xᵢ)^(1/n)
 */
export declare function geometricMean(values: number[]): number;
/**
 * Calculate arithmetic mean of an array of numbers
 * AR = (Σ xᵢ) / n
 */
export declare function arithmeticMean(values: number[]): number;
/**
 * Calculate depth factor (penalty for long chains)
 * DF = 1 + log₂(1 + depth)
 */
export declare function depthFactor(depth: number): number;
/**
 * Calculate L-Score for a provenance chain
 *
 * Formula: L-Score = GM(confidences) × AR(relevances) / DF(depth)
 *
 * @param confidences - Array of derivation step confidences
 * @param relevances - Array of source relevance scores
 * @param depth - Number of derivation steps
 * @param domain - Optional domain for threshold lookup
 * @returns L-Score calculation result
 */
export declare function calculateLScore(confidences: number[], relevances: number[], depth: number, domain?: string): ILScoreResult;
/**
 * Get L-Score threshold for a domain
 */
export declare function getThresholdForDomain(domain?: string): number;
/**
 * Validate if an L-Score meets the threshold for a domain
 */
export declare function validateLScore(lScore: number, domain?: string): boolean;
/**
 * Validate 1536-dim L2-normalized embedding
 * @throws ProvenanceValidationError if validation fails
 */
export declare function validateEmbedding(embedding: Float32Array, context: string): void;
//# sourceMappingURL=provenance-utils.d.ts.map