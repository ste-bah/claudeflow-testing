/**
 * Unified Community Detection Interface
 *
 * Provides algorithm selection, result filtering, and statistics.
 * Enforces constitutional constraints (HYPER-06, HYPER-07, HYPER-08).
 */
import { LouvainDetector } from './louvain.js';
import { LabelPropagationDetector } from './label-propagation.js';
export class CommunityDetector {
    options;
    constructor(options = {}) {
        this.options = {
            algorithm: options.algorithm || 'auto',
            minCommunitySize: options.minCommunitySize || 3, // HYPER-08
            maxIterations: options.maxIterations || 100,
        };
    }
    /**
     * Detect communities in graph
     * @param nodes Array of node IDs
     * @param edges Array of [source, target] or [source, target, weight] tuples
     * @returns Community detection result
     */
    detect(nodes, edges) {
        const algorithm = this.selectAlgorithm(nodes.length, edges.length);
        let result;
        if (algorithm === 'louvain') {
            const detector = new LouvainDetector(this.options.minCommunitySize);
            result = detector.detect(nodes, edges);
        }
        else {
            const detector = new LabelPropagationDetector(this.options.minCommunitySize, this.options.maxIterations);
            result = detector.detect(nodes, edges);
        }
        // Validate performance constraints
        this.validatePerformance(result, algorithm, nodes.length);
        return result;
    }
    /**
     * Select algorithm based on graph size and user preference
     */
    selectAlgorithm(nodeCount, edgeCount) {
        if (this.options.algorithm !== 'auto') {
            return this.options.algorithm;
        }
        // Auto-select based on graph characteristics
        // Label propagation is faster but Louvain often finds better communities
        // Use label propagation for very large graphs
        const isLargeGraph = nodeCount > 5000 || edgeCount > 50000;
        return isLargeGraph ? 'label-propagation' : 'louvain';
    }
    /**
     * Validate performance constraints (HYPER-06, HYPER-07)
     */
    validatePerformance(result, algorithm, nodeCount) {
        // Only validate for 10k+ node graphs
        if (nodeCount < 10000)
            return;
        if (algorithm === 'louvain' && result.executionTime > 2000) {
            console.warn(`[HYPER-06 WARNING] Louvain took ${result.executionTime.toFixed(0)}ms ` +
                `for ${nodeCount} nodes (should be <2000ms)`);
        }
        if (algorithm === 'label-propagation' && result.executionTime > 500) {
            console.warn(`[HYPER-07 WARNING] Label Propagation took ${result.executionTime.toFixed(0)}ms ` +
                `for ${nodeCount} nodes (should be <500ms)`);
        }
    }
    /**
     * Get statistics about community structure
     */
    getStatistics(result) {
        const communities = result.communities;
        if (communities.length === 0) {
            return {
                communityCount: 0,
                avgCommunitySize: 0,
                minCommunitySize: 0,
                maxCommunitySize: 0,
                avgCohesion: 0,
                modularity: result.modularity,
            };
        }
        const sizes = communities.map((c) => c.members.length);
        const cohesions = communities.map((c) => c.cohesion);
        return {
            communityCount: communities.length,
            avgCommunitySize: this.average(sizes),
            minCommunitySize: Math.min(...sizes),
            maxCommunitySize: Math.max(...sizes),
            avgCohesion: this.average(cohesions),
            modularity: result.modularity,
        };
    }
    /**
     * Find community for a given node
     */
    findNodeCommunity(nodeId, result) {
        for (const community of result.communities) {
            if (community.members.includes(nodeId)) {
                return community;
            }
        }
        return null;
    }
    /**
     * Find overlapping members between two communities
     */
    findOverlap(community1, community2) {
        const set1 = new Set(community1.members);
        return community2.members.filter((member) => set1.has(member));
    }
    /**
     * Calculate average of array
     */
    average(values) {
        if (values.length === 0)
            return 0;
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }
}
//# sourceMappingURL=community-detector.js.map