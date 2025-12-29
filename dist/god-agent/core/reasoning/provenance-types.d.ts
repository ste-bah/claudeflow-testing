/**
 * Provenance Types
 * TASK-PRV-001 - ProvenanceStore Type Definitions
 *
 * Defines types for source tracking, provenance chains, L-Score calculation,
 * and citation graph traversal.
 */
/** Source identifier (format: "src_{timestamp}_{uuid}") */
export type SourceID = string;
/** Provenance identifier (format: "prov_{timestamp}_{uuid}") */
export type ProvenanceID = string;
/** Derivation operation types */
export type OperationType = 'extraction' | 'synthesis' | 'inference' | 'transformation';
/** Source types */
export type SourceType = 'document' | 'conversation' | 'experiment' | 'simulation' | 'external-api';
/**
 * Location metadata for precise source referencing
 */
export interface ISourceLocation {
    /** Page number (for documents) */
    page?: number;
    /** Section name or ID */
    section?: string;
    /** Line range [start, end] */
    lineRange?: [number, number];
    /** Timestamp in seconds (for video/audio) */
    timestamp?: number;
}
/**
 * Input for storing a new source
 */
export interface ISourceInput {
    /** Type of source */
    type: SourceType;
    /** Source title (required, non-empty) */
    title: string;
    /** Authors of the source */
    authors?: string[];
    /** URL of the source */
    url?: string;
    /** Publication date */
    publishedDate?: Date;
    /** Location within the source */
    location?: ISourceLocation;
    /** Relevance score [0, 1] (required) */
    relevanceScore: number;
    /** VECTOR_DIM (1536) L2-normalized embedding (optional) */
    embedding?: Float32Array;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
}
/**
 * Stored source with generated ID
 */
export interface ISource extends ISourceInput {
    /** Unique source identifier */
    id: SourceID;
    /** Vector DB ID if embedding stored */
    vectorId?: string;
    /** Creation timestamp */
    createdAt: Date;
}
/**
 * Single derivation step in a provenance chain
 */
export interface IDerivationStep {
    /** Human-readable description of the step */
    description: string;
    /** Sources used in this step */
    sourceIds: SourceID[];
    /** Type of derivation operation */
    operation: OperationType;
    /** Confidence in this step [0, 1] (required) */
    confidence: number;
    /** Additional step metadata */
    metadata?: {
        /** Reasoning explanation */
        reasoning?: string;
        /** Assumptions made */
        assumptions?: string[];
    };
}
/**
 * Input for creating a new provenance chain
 */
export interface IProvenanceInput {
    /** Sources to store (at least 1 required) */
    sources: ISourceInput[];
    /** Derivation steps (at least 1 required) */
    derivationPath: IDerivationStep[];
    /** Parent provenance for nested chains */
    parentProvenanceId?: ProvenanceID;
    /** Domain for threshold selection */
    domain?: string;
}
/**
 * Stored provenance chain with generated ID
 */
export interface IProvenance {
    /** Unique provenance identifier */
    id: ProvenanceID;
    /** IDs of sources in this chain */
    sourceIds: SourceID[];
    /** Derivation steps */
    derivationPath: IDerivationStep[];
    /** Parent provenance for nested chains */
    parentProvenanceId?: ProvenanceID;
    /** Domain for threshold selection */
    domain?: string;
    /** Number of derivation steps */
    depth: number;
    /** Creation timestamp */
    createdAt: Date;
}
/**
 * Source reference in a citation path
 */
export interface ISourceReference {
    /** Source ID */
    id: SourceID;
    /** Source type */
    type: SourceType;
    /** Source title */
    title: string;
    /** Relevance score [0, 1] */
    relevanceScore: number;
    /** Location within source */
    location?: ISourceLocation;
    /** Contribution to L-Score */
    contribution: number;
}
/**
 * Result of citation graph traversal
 */
export interface ICitationPath {
    /** Provenance ID this path starts from */
    insightId: ProvenanceID;
    /** All sources in the path */
    sources: ISourceReference[];
    /** All derivation steps */
    derivationPath: IDerivationStep[];
    /** Calculated L-Score (0 until TASK-PRV-002) */
    lScore: number;
    /** Total depth of derivation */
    depth: number;
    /** Ancestor provenance IDs */
    ancestors: ProvenanceID[];
    /** Creation timestamp */
    createdAt: Date;
}
/**
 * Options for citation graph traversal
 */
export interface ITraversalOptions {
    /** Maximum depth to traverse (default: 10) */
    maxDepth?: number;
    /** Follow parent provenance chains */
    includeAncestors?: boolean;
    /** Include full step metadata */
    includeMetadata?: boolean;
}
/**
 * Domain-specific L-Score threshold configuration
 */
export interface ILScoreThreshold {
    /** Domain name */
    domain: string;
    /** Minimum L-Score required */
    threshold: number;
    /** False positive rate at this threshold */
    falsePositiveRate?: number;
    /** False negative rate at this threshold */
    falseNegativeRate?: number;
}
/**
 * L-Score calculation result
 */
export interface ILScoreResult {
    /** Calculated L-Score */
    score: number;
    /** Geometric mean of confidences */
    geometricMean: number;
    /** Arithmetic mean of relevances */
    arithmeticMean: number;
    /** Depth factor (penalty) */
    depthFactor: number;
    /** Whether score meets threshold */
    meetsThreshold: boolean;
    /** Applied threshold */
    threshold: number;
    /** Domain used for threshold */
    domain?: string;
}
/**
 * Error thrown when L-Score is below threshold
 */
export declare class LScoreRejectionError extends Error {
    readonly lScore: number;
    readonly threshold: number;
    readonly domain?: string | undefined;
    constructor(lScore: number, threshold: number, domain?: string | undefined);
}
/**
 * Error thrown when provenance validation fails
 */
export declare class ProvenanceValidationError extends Error {
    constructor(message: string);
}
/**
 * Serialized source for persistence
 */
export interface ISerializedSource {
    id: SourceID;
    type: SourceType;
    title: string;
    authors?: string[];
    url?: string;
    publishedDate?: string;
    location?: ISourceLocation;
    relevanceScore: number;
    vectorId?: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
}
/**
 * Serialized provenance for persistence
 */
export interface ISerializedProvenance {
    id: ProvenanceID;
    sourceIds: SourceID[];
    derivationPath: IDerivationStep[];
    parentProvenanceId?: ProvenanceID;
    domain?: string;
    depth: number;
    createdAt: string;
}
//# sourceMappingURL=provenance-types.d.ts.map