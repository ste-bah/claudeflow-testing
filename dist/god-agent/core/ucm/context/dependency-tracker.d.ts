/**
 * Dependency Tracker
 * TASK-UCM-CTX-002
 *
 * Tracks agent dependencies for proper ordering and composition.
 * Uses directed graph to represent dependencies.
 * Provides topological ordering and circular dependency detection.
 */
/**
 * Dependency edge in graph
 */
interface IDependencyEdge {
    from: string;
    to: string;
    weight: number;
    reason?: string;
}
/**
 * Dependency Tracker
 * Manages agent dependency graph for context composition ordering
 */
export declare class DependencyTracker {
    private nodes;
    private edges;
    /**
     * Add or update agent node
     * @param agentId - Agent to add
     */
    private ensureNode;
    /**
     * Add dependency relationship
     * Creates edge: dependent -> dependency
     *
     * @param dependent - Agent that depends on another
     * @param dependency - Agent being depended on
     * @param weight - Dependency strength (default 1)
     * @param reason - Optional reason for dependency
     */
    addDependency(dependent: string, dependency: string, weight?: number, reason?: string): void;
    /**
     * Remove dependency relationship
     * @param dependent - Dependent agent
     * @param dependency - Dependency agent
     */
    removeDependency(dependent: string, dependency: string): void;
    /**
     * Get direct dependencies for agent
     * @param agentId - Agent to query
     * @returns Set of agent IDs this agent depends on
     */
    getDependencies(agentId: string): Set<string>;
    /**
     * Get direct dependents for agent
     * @param agentId - Agent to query
     * @returns Set of agent IDs that depend on this agent
     */
    getDependents(agentId: string): Set<string>;
    /**
     * Get all transitive dependencies (recursive)
     * @param agentId - Agent to query
     * @param visited - Track visited nodes to prevent cycles
     * @returns Set of all agents this agent transitively depends on
     */
    getTransitiveDependencies(agentId: string, visited?: Set<string>): Set<string>;
    /**
     * Get topological ordering of agents
     * Dependencies come before dependents
     *
     * @param agents - Optional subset of agents to order
     * @returns Ordered array (dependencies first)
     */
    getTopologicalOrder(agents?: string[]): string[];
    /**
     * Detect if graph has cycles
     * @returns True if circular dependencies exist
     */
    hasCycle(): boolean;
    /**
     * Update depth levels for all nodes
     * Depth = longest path from root nodes
     */
    private updateDepths;
    /**
     * Get dependency depth for agent
     * @param agentId - Agent to query
     * @returns Depth level (0 = no dependencies)
     */
    getDepth(agentId: string): number;
    /**
     * Get all edges in dependency graph
     * @returns Array of dependency edges
     */
    getEdges(): readonly IDependencyEdge[];
    /**
     * Get dependency graph statistics
     * @returns Graph metrics
     */
    getStats(): {
        nodeCount: number;
        edgeCount: number;
        maxDepth: number;
        avgDependencies: number;
        hasCycle: boolean;
        rootNodes: string[];
        leafNodes: string[];
    };
    /**
     * Clear all dependencies
     */
    clear(): void;
    /**
     * Remove agent and all its dependencies
     * @param agentId - Agent to remove
     */
    removeAgent(agentId: string): void;
}
export {};
//# sourceMappingURL=dependency-tracker.d.ts.map