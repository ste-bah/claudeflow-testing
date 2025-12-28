/**
 * Unified Anomaly Detector
 * Provides interface for multiple anomaly detection algorithms
 * - LOF (Local Outlier Factor) for vector embeddings
 * - Graph-based for structural anomalies
 *
 * Alert generation for confidence >= 0.8 (HYPER-10)
 */
import type { AnomalyResult, AnomalyDetectionConfig } from '../hyperedge-types.js';
import type { GraphStructure } from './graph-anomaly-detector.js';
/**
 * Alert severity levels based on confidence
 */
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
/**
 * Anomaly alert with severity classification
 */
export interface AnomalyAlert {
    id: string;
    anomaly: AnomalyResult;
    severity: AlertSeverity;
    triggered: number;
    acknowledged: boolean;
}
/**
 * Batch detection result
 */
export interface BatchDetectionResult {
    anomalies: AnomalyResult[];
    alerts: AnomalyAlert[];
    stats: {
        totalEntities: number;
        anomaliesFound: number;
        averageConfidence: number;
        executionTimeMs: number;
    };
}
/**
 * Unified anomaly detector with multiple algorithms
 */
export declare class AnomalyDetector {
    private readonly config;
    private lofDetector;
    private graphDetector;
    private alertCounter;
    constructor(config: AnomalyDetectionConfig);
    /**
     * Initialize detectors based on algorithm selection
     */
    private initializeDetectors;
    /**
     * Calculate alert severity based on confidence
     * - critical: confidence >= 0.95
     * - high: confidence >= 0.9
     * - medium: confidence >= 0.85
     * - low: confidence >= 0.8
     */
    private calculateSeverity;
    /**
     * Create alert from anomaly result
     */
    private createAlert;
    /**
     * Detect anomaly in a single entity (LOF algorithm)
     */
    detectLOF(entityId: string): AnomalyResult | null;
    /**
     * Detect anomaly in a single entity (Graph algorithm)
     */
    detectGraph(entityId: string): AnomalyResult | null;
    /**
     * Detect anomaly using configured algorithm
     */
    detect(entityId: string): AnomalyResult | null;
    /**
     * Batch detection with performance tracking
     * Returns anomalies and auto-generated alerts
     */
    detectBatch(entityIds: string[]): BatchDetectionResult;
    /**
     * Add data points for LOF detection
     */
    addPoints(points: Array<{
        id: string;
        embedding: Float32Array;
    }>): void;
    /**
     * Set graph structure for graph-based detection
     */
    setGraph(graph: GraphStructure): void;
    /**
     * Set community detector for enhanced graph analysis
     */
    setCommunityDetector(detector: unknown): void;
    /**
     * Clear all data
     */
    clear(): void;
    /**
     * Get current configuration
     */
    getConfig(): AnomalyDetectionConfig;
    /**
     * Get detector statistics
     */
    getStats(): Record<string, unknown>;
}
/**
 * Helper function to create anomaly detector
 */
export declare function createAnomalyDetector(config: AnomalyDetectionConfig): AnomalyDetector;
//# sourceMappingURL=anomaly-detector.d.ts.map