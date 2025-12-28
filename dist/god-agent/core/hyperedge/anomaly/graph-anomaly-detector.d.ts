/**
 * Graph-based Anomaly Detector
 * Detects structural anomalies using community structure
 * - Isolated nodes
 * - Cross-community bridges
 * - Unusual connectivity patterns
 */
import type { AnomalyResult, AnomalyDetectionConfig, Community } from '../hyperedge-types.js';
import type { CommunityDetector } from '../community/index.js';
/**
 * Graph structure for anomaly detection
 */
export interface GraphStructure {
    nodes: string[];
    edges: Map<string, string[]>;
    weights?: Map<string, Map<string, number>>;
}
/**
 * Graph-based anomaly detector using community structure
 */
export declare class GraphAnomalyDetector {
    private readonly minConfidence;
    private graph;
    private nodesCommunityMap;
    constructor(config?: Pick<AnomalyDetectionConfig, 'minConfidence'>);
    /**
     * Set the graph structure for analysis
     */
    setGraph(graph: GraphStructure): void;
    /**
     * Set community detector for enhanced analysis
     * Stores the community assignments from detection result
     */
    setCommunityDetector(detector: CommunityDetector | {
        communities: Community[];
    }): void;
    /**
     * Set communities from detection result directly
     */
    setCommunities(communities: Community[]): void;
    /**
     * Calculate node degree
     */
    private getNodeDegree;
    /**
     * Calculate average degree in graph
     */
    private getAverageDegree;
    /**
     * Calculate isolation score
     * Higher score = more isolated from graph
     */
    private calculateIsolationScore;
    /**
     * Count cross-community edges for a node
     */
    private countCrossCommunityEdges;
    /**
     * Calculate community cohesion for a node
     * Ratio of internal community edges to total edges
     */
    private calculateCommunityCohesion;
    /**
     * Extract structural features for a node
     */
    private extractNodeFeatures;
    /**
     * Calculate anomaly score from features
     * Combines multiple structural signals
     */
    private calculateAnomalyScore;
    /**
     * Detect structural anomaly in a single node
     */
    detect(nodeId: string): AnomalyResult | null;
    /**
     * Detect anomalies in all nodes
     */
    detectAll(): AnomalyResult[];
    /**
     * Get statistics about current graph
     */
    getStats(): {
        nodeCount: number;
        edgeCount: number;
        avgDegree: number;
        hasCommunities: boolean;
    };
}
//# sourceMappingURL=graph-anomaly-detector.d.ts.map