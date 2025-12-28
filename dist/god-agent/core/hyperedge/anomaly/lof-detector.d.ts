/**
 * LOF (Local Outlier Factor) Detector
 * Implements k-nearest neighbors anomaly detection with local reachability density
 * Performance: <100ms per detection (HYPER-09)
 */
import type { AnomalyResult, AnomalyDetectionConfig } from '../hyperedge-types.js';
/**
 * Represents a data point with embedding and metadata
 */
interface DataPoint {
    id: string;
    embedding: Float32Array;
    metadata?: Record<string, unknown>;
}
/**
 * LOF Detector for anomaly detection in vector embeddings
 */
export declare class LOFDetector {
    private readonly k;
    private readonly minConfidence;
    private points;
    constructor(config?: Pick<AnomalyDetectionConfig, 'kNeighbors' | 'minConfidence'>);
    /**
     * Add data points for anomaly detection
     */
    addPoints(points: DataPoint[]): void;
    /**
     * Clear all data points
     */
    clear(): void;
    /**
     * Find k nearest neighbors for a point
     * Optimized for performance with early termination
     */
    private findKNearestNeighbors;
    /**
     * Calculate k-distance (distance to k-th nearest neighbor)
     */
    private getKDistance;
    /**
     * Calculate reachability distance
     * reach-dist(p, o) = max(k-distance(o), dist(p, o))
     */
    private reachabilityDistance;
    /**
     * Calculate local reachability density (LRD)
     * lrd(p) = 1 / (avg reach-dist to neighbors)
     */
    private calculateLRD;
    /**
     * Calculate Local Outlier Factor (LOF)
     * LOF(p) = avg(lrd(neighbor) / lrd(p)) for all neighbors
     * LOF ≈ 1: similar density to neighbors (normal)
     * LOF > 1: lower density than neighbors (potential outlier)
     * LOF >> 1: much lower density (strong anomaly)
     */
    private calculateLOF;
    /**
     * Calculate LOF scores for all points
     * Performance target: <100ms per detection
     */
    private calculateAllLOFScores;
    /**
     * Convert LOF score to confidence value [0.0-1.0]
     * Higher LOF = higher confidence of being an anomaly
     */
    private lofToConfidence;
    /**
     * Detect anomalies in a single point
     * Returns null if confidence below threshold
     */
    detect(id: string): AnomalyResult | null;
    /**
     * Detect anomalies in all points
     * Returns only points with confidence >= threshold
     */
    detectAll(): AnomalyResult[];
    /**
     * Get statistics about current dataset
     */
    getStats(): {
        pointCount: number;
        k: number;
        minConfidence: number;
    };
}
export {};
//# sourceMappingURL=lof-detector.d.ts.map