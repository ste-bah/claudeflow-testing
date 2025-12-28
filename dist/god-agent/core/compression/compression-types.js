/**
 * Compression Type Definitions
 * TASK-CMP-001 - 5-Tier Compression Lifecycle
 *
 * Provides types for adaptive vector compression:
 * - Hot: Float32 (1x, 3072 bytes)
 * - Warm: Float16 (2x, 1536 bytes)
 * - Cool: PQ8 (8x, 384 bytes)
 * - Cold: PQ4 (16x, 192 bytes)
 * - Frozen: Binary (32x, 96 bytes)
 *
 * Target: 90%+ memory reduction for 1M vectors (3GB → 297MB)
 */
/**
 * Compression tier enumeration
 * Ordered from least to most compressed
 */
export var CompressionTier;
(function (CompressionTier) {
    CompressionTier["HOT"] = "hot";
    CompressionTier["WARM"] = "warm";
    CompressionTier["COOL"] = "cool";
    CompressionTier["COLD"] = "cold";
    CompressionTier["FROZEN"] = "frozen";
})(CompressionTier || (CompressionTier = {}));
/**
 * Tier hierarchy for one-way transitions
 */
export const TIER_HIERARCHY = [
    CompressionTier.HOT,
    CompressionTier.WARM,
    CompressionTier.COOL,
    CompressionTier.COLD,
    CompressionTier.FROZEN,
];
/**
 * Default tier configurations
 */
export const TIER_CONFIGS = {
    [CompressionTier.HOT]: {
        tier: CompressionTier.HOT,
        minHeatScore: 0.8,
        maxHeatScore: 1.0,
        format: 'float32',
        compressionRatio: 1,
        bytesPerVector: 3072, // 768 * 4 bytes
        maxErrorRate: 0.0001,
    },
    [CompressionTier.WARM]: {
        tier: CompressionTier.WARM,
        minHeatScore: 0.4,
        maxHeatScore: 0.8,
        format: 'float16',
        compressionRatio: 2,
        bytesPerVector: 1536, // 768 * 2 bytes
        maxErrorRate: 0.0001,
    },
    [CompressionTier.COOL]: {
        tier: CompressionTier.COOL,
        minHeatScore: 0.1,
        maxHeatScore: 0.4,
        format: 'pq8',
        compressionRatio: 8,
        bytesPerVector: 384, // 768 / 8 * 4 bytes (96 subvectors)
        maxErrorRate: 0.02,
    },
    [CompressionTier.COLD]: {
        tier: CompressionTier.COLD,
        minHeatScore: 0.01,
        maxHeatScore: 0.1,
        format: 'pq4',
        compressionRatio: 16,
        bytesPerVector: 192, // 768 / 8 * 2 bytes (96 subvectors, 4-bit)
        maxErrorRate: 0.05,
    },
    [CompressionTier.FROZEN]: {
        tier: CompressionTier.FROZEN,
        minHeatScore: 0,
        maxHeatScore: 0.01,
        format: 'binary',
        compressionRatio: 32,
        bytesPerVector: 96, // 768 bits / 8 = 96 bytes
        maxErrorRate: 0.10,
    },
};
/**
 * Default configuration
 */
export const DEFAULT_COMPRESSION_CONFIG = {
    dimension: 768,
    heatDecayRate: 0.1,
    accessWindow: 86400000, // 24 hours
    autoTransition: true,
    transitionCheckInterval: 3600000, // 1 hour
    verbose: false,
};
// ==================== Error Types ====================
/**
 * Error thrown when compression fails
 */
export class CompressionError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'CompressionError';
    }
}
/**
 * Error thrown when tier transition is invalid
 */
export class TierTransitionError extends Error {
    fromTier;
    toTier;
    constructor(fromTier, toTier) {
        super(`Invalid tier transition: ${fromTier} → ${toTier}. Only forward transitions allowed.`);
        this.fromTier = fromTier;
        this.toTier = toTier;
        this.name = 'TierTransitionError';
    }
}
// ==================== Utility Functions ====================
/**
 * Get tier config for a heat score
 */
export function getTierForHeatScore(heatScore) {
    for (const tier of TIER_HIERARCHY) {
        const config = TIER_CONFIGS[tier];
        if (heatScore >= config.minHeatScore) {
            return tier;
        }
    }
    return CompressionTier.FROZEN;
}
/**
 * Check if tier transition is valid (forward only)
 */
export function isValidTransition(fromTier, toTier) {
    const fromIndex = TIER_HIERARCHY.indexOf(fromTier);
    const toIndex = TIER_HIERARCHY.indexOf(toTier);
    return toIndex > fromIndex;
}
/**
 * Get the next tier in the hierarchy
 */
export function getNextTier(tier) {
    const index = TIER_HIERARCHY.indexOf(tier);
    if (index < TIER_HIERARCHY.length - 1) {
        return TIER_HIERARCHY[index + 1];
    }
    return null;
}
/**
 * Calculate bytes for N vectors at a tier
 */
export function calculateBytesForTier(tier, count) {
    return TIER_CONFIGS[tier].bytesPerVector * count;
}
//# sourceMappingURL=compression-types.js.map