/**
 * Unified Anomaly Detector
 * Provides interface for multiple anomaly detection algorithms
 * - LOF (Local Outlier Factor) for vector embeddings
 * - Graph-based for structural anomalies
 *
 * Alert generation for confidence >= 0.8 (HYPER-10)
 */
import { LOFDetector } from './lof-detector.js';
import { GraphAnomalyDetector } from './graph-anomaly-detector.js';
/**
 * Unified anomaly detector with multiple algorithms
 */
export class AnomalyDetector {
    config;
    lofDetector;
    graphDetector;
    alertCounter;
    constructor(config) {
        this.config = {
            minConfidence: 0.8, // Default from HYPER-10
            kNeighbors: 10,
            contamination: 0.1,
            ...config
        };
        this.lofDetector = null;
        this.graphDetector = null;
        this.alertCounter = 0;
        this.initializeDetectors();
    }
    /**
     * Initialize detectors based on algorithm selection
     */
    initializeDetectors() {
        const { algorithm, kNeighbors, minConfidence } = this.config;
        if (algorithm === 'lof') {
            this.lofDetector = new LOFDetector({ kNeighbors, minConfidence });
        }
        else if (algorithm === 'isolation-forest') {
            this.graphDetector = new GraphAnomalyDetector({ minConfidence });
        }
        else if (algorithm === 'statistical') {
            // Future: statistical anomaly detection
            throw new Error('Statistical algorithm not yet implemented');
        }
    }
    /**
     * Calculate alert severity based on confidence
     * - critical: confidence >= 0.95
     * - high: confidence >= 0.9
     * - medium: confidence >= 0.85
     * - low: confidence >= 0.8
     */
    calculateSeverity(confidence) {
        if (confidence >= 0.95)
            return 'critical';
        if (confidence >= 0.9)
            return 'high';
        if (confidence >= 0.85)
            return 'medium';
        return 'low';
    }
    /**
     * Create alert from anomaly result
     */
    createAlert(anomaly) {
        const severity = this.calculateSeverity(anomaly.confidence);
        return {
            id: `alert-${this.alertCounter++}-${Date.now()}`,
            anomaly,
            severity,
            triggered: Date.now(),
            acknowledged: false
        };
    }
    /**
     * Detect anomaly in a single entity (LOF algorithm)
     */
    detectLOF(entityId) {
        if (!this.lofDetector) {
            throw new Error('LOF detector not initialized');
        }
        return this.lofDetector.detect(entityId);
    }
    /**
     * Detect anomaly in a single entity (Graph algorithm)
     */
    detectGraph(entityId) {
        if (!this.graphDetector) {
            throw new Error('Graph detector not initialized');
        }
        return this.graphDetector.detect(entityId);
    }
    /**
     * Detect anomaly using configured algorithm
     */
    detect(entityId) {
        const { algorithm } = this.config;
        if (algorithm === 'lof') {
            return this.detectLOF(entityId);
        }
        else if (algorithm === 'isolation-forest') {
            return this.detectGraph(entityId);
        }
        throw new Error(`Algorithm ${algorithm} not supported`);
    }
    /**
     * Batch detection with performance tracking
     * Returns anomalies and auto-generated alerts
     */
    detectBatch(entityIds) {
        const startTime = performance.now();
        const anomalies = [];
        const alerts = [];
        for (const entityId of entityIds) {
            try {
                const result = this.detect(entityId);
                if (result) {
                    anomalies.push(result);
                    // Auto-generate alert for anomalies meeting threshold
                    if (result.confidence >= this.config.minConfidence) {
                        alerts.push(this.createAlert(result));
                    }
                }
            }
            catch (error) {
                // Skip entities that fail detection
                console.warn(`Failed to detect anomaly for ${entityId}:`, error);
            }
        }
        const executionTimeMs = performance.now() - startTime;
        // Calculate average confidence
        const averageConfidence = anomalies.length > 0
            ? anomalies.reduce((sum, a) => sum + a.confidence, 0) / anomalies.length
            : 0;
        return {
            anomalies,
            alerts,
            stats: {
                totalEntities: entityIds.length,
                anomaliesFound: anomalies.length,
                averageConfidence,
                executionTimeMs
            }
        };
    }
    /**
     * Add data points for LOF detection
     */
    addPoints(points) {
        if (!this.lofDetector) {
            throw new Error('LOF detector not initialized');
        }
        this.lofDetector.addPoints(points);
    }
    /**
     * Set graph structure for graph-based detection
     */
    setGraph(graph) {
        if (!this.graphDetector) {
            throw new Error('Graph detector not initialized');
        }
        this.graphDetector.setGraph(graph);
    }
    /**
     * Set community detector for enhanced graph analysis
     */
    setCommunityDetector(detector) {
        if (!this.graphDetector) {
            throw new Error('Graph detector not initialized');
        }
        // Type assertion - we know this matches CommunityDetector interface
        this.graphDetector.setCommunityDetector(detector);
    }
    /**
     * Clear all data
     */
    clear() {
        if (this.lofDetector) {
            this.lofDetector.clear();
        }
        if (this.graphDetector) {
            this.graphDetector.setGraph({ nodes: [], edges: new Map() });
        }
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Get detector statistics
     */
    getStats() {
        if (this.lofDetector) {
            return this.lofDetector.getStats();
        }
        if (this.graphDetector) {
            return this.graphDetector.getStats();
        }
        return {};
    }
}
/**
 * Helper function to create anomaly detector
 */
export function createAnomalyDetector(config) {
    return new AnomalyDetector(config);
}
//# sourceMappingURL=anomaly-detector.js.map