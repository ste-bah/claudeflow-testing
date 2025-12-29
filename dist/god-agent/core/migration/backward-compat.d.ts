/**
 * Backward Compatibility Layer for Vector Dimension Migration
 *
 * Implements: TASK-VEC-001-009 (Data Migration Strategy)
 * Constitution: RULE-009 (zero data loss), RULE-046 (atomic operations)
 *
 * Provides runtime compatibility for mixed 768D/1536D vector environments:
 * - Automatic dimension detection on read
 * - Transparent conversion to 1536D
 * - Warning logs for unconverted data
 * - Statistics tracking
 */
/**
 * Legacy embedding dimension (text-embedding-ada-002)
 */
export declare const LEGACY_VECTOR_DIM = 768;
/**
 * Statistics for backward compatibility operations
 */
export interface BackwardCompatStats {
    /** Total vectors processed */
    totalVectorsProcessed: number;
    /** Vectors that needed conversion (768D -> 1536D) */
    legacyVectorsConverted: number;
    /** Vectors already in target dimension */
    nativeVectors: number;
    /** Conversion warnings emitted */
    warningsEmitted: number;
    /** Last warning timestamp */
    lastWarningTime: number | null;
    /** Files with unconverted data */
    unconvertedSources: Set<string>;
}
/**
 * Options for backward compatibility layer
 */
export interface BackwardCompatOptions {
    /** Log warnings when converting legacy vectors */
    warnOnConversion: boolean;
    /** Maximum warnings to emit (prevents log spam) */
    maxWarnings: number;
    /** Warn if conversions exceed this percentage */
    conversionThreshold: number;
    /** Source identifier for tracking */
    sourceId?: string;
}
/**
 * Backward Compatibility Layer
 *
 * Provides transparent conversion between 768D and 1536D vectors
 * during the migration transition period.
 */
export declare class BackwardCompatLayer {
    private options;
    private stats;
    constructor(options?: Partial<BackwardCompatOptions>);
    /**
     * Detect vector dimension
     */
    detectDimension(vector: Float32Array | number[]): number;
    /**
     * Check if vector needs conversion
     */
    needsConversion(vector: Float32Array | number[]): boolean;
    /**
     * Check if vector is already in target dimension
     */
    isNativeDimension(vector: Float32Array | number[]): boolean;
    /**
     * Convert a legacy 768D vector to 1536D
     *
     * Strategy: Zero-padding with L2 re-normalization
     * This preserves relative similarities between converted vectors
     * but may reduce similarity with native 1536D vectors.
     *
     * @param vector - Input vector (768D or 1536D)
     * @param sourceId - Optional source identifier for tracking
     * @returns Converted vector (always 1536D)
     */
    convert(vector: Float32Array | number[], sourceId?: string): Float32Array;
    /**
     * Zero-pad a 768D vector to 1536D and L2-normalize
     */
    private zeroPadAndNormalize;
    /**
     * Conditionally emit warning about legacy vector conversion
     */
    private maybeWarn;
    /**
     * Batch convert multiple vectors
     */
    convertBatch(vectors: Array<Float32Array | number[]>, sourceId?: string): Float32Array[];
    /**
     * Ensure a vector is in the target dimension
     * Returns the original vector if already correct, or converts if needed
     */
    ensure(vector: Float32Array | number[], sourceId?: string): Float32Array;
    /**
     * Get statistics
     */
    getStats(): Readonly<BackwardCompatStats>;
    /**
     * Get a summary report
     */
    getSummary(): string;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Check if migration is recommended based on stats
     */
    isMigrationRecommended(): boolean;
    /**
     * Get migration recommendation message
     */
    getMigrationRecommendation(): string | null;
}
/**
 * Get the global backward compatibility layer instance
 */
export declare function getBackwardCompatLayer(options?: Partial<BackwardCompatOptions>): BackwardCompatLayer;
/**
 * Reset the global instance (for testing)
 */
export declare function resetBackwardCompatLayer(): void;
/**
 * Detect if a vector is legacy dimension
 */
export declare function isLegacyVector(vector: Float32Array | number[]): boolean;
/**
 * Detect if a vector is current dimension
 */
export declare function isCurrentVector(vector: Float32Array | number[]): boolean;
/**
 * Quick conversion function (uses global instance)
 */
export declare function ensureVectorDimension(vector: Float32Array | number[], sourceId?: string): Float32Array;
/**
 * Check if any vectors need conversion (uses global instance)
 */
export declare function checkVectorsNeedMigration(vectors: Array<Float32Array | number[]>): {
    needsMigration: boolean;
    legacyCount: number;
    nativeCount: number;
};
/**
 * Type guard for legacy vectors
 */
export declare function assertLegacyDimension(vector: Float32Array | number[], context?: string): void;
/**
 * Type guard for current vectors
 */
export declare function assertCurrentDimension(vector: Float32Array | number[], context?: string): void;
/**
 * Type guard for either dimension (valid for migration period)
 */
export declare function assertValidDimension(vector: Float32Array | number[], context?: string): void;
//# sourceMappingURL=backward-compat.d.ts.map