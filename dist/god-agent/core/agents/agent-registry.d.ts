/**
 * Agent Registry
 * TASK-AGT-002 - Multi-category agent registration and lookup
 *
 * Central registry for all loaded agent definitions.
 * Supports lookup by key, category, and pipeline validation.
 */
import type { ILoadedAgentDefinition, ICategoryInfo, IRegistryValidationResult, IRegistryStats } from './agent-types.js';
/**
 * AgentRegistry
 *
 * Centralized registry for loaded agent definitions.
 * Provides lookup by key, category, and validation for pipelines.
 */
export declare class AgentRegistry {
    private agents;
    private categories;
    private categoryInfo;
    private scanner;
    private loader;
    private initialized;
    private initializedAt;
    private verbose;
    constructor(options: {
        basePath: string;
        verbose?: boolean;
    });
    /**
     * Initialize the registry by loading all agents from all categories
     *
     * @param basePath - Base path to agents directory (e.g., '.claude/agents')
     */
    initialize(basePath: string): Promise<void>;
    /**
     * Get agent definition by key
     */
    getByKey(key: string): ILoadedAgentDefinition | undefined;
    /**
     * Get all agents in a category
     */
    getByCategory(category: string): ILoadedAgentDefinition[];
    /**
     * Get all loaded agents
     */
    getAll(): ILoadedAgentDefinition[];
    /**
     * Get all category names
     */
    getCategoryNames(): string[];
    /**
     * Get category info
     */
    getCategoryInfo(): ICategoryInfo[];
    /**
     * Check if an agent is registered
     */
    has(key: string): boolean;
    /**
     * Get total agent count
     */
    get size(): number;
    /**
     * Check if registry is initialized
     */
    get isInitialized(): boolean;
    /**
     * Validate that all required pipeline agents are loaded
     *
     * @param requiredKeys - Array of agent keys required for pipeline
     * @returns Validation result with missing keys
     */
    validatePipelineAgents(requiredKeys: string[]): IRegistryValidationResult;
    /**
     * Get registry statistics
     */
    getStats(): IRegistryStats;
    /**
     * Search agents by name pattern (case-insensitive substring match)
     */
    searchByName(pattern: string): ILoadedAgentDefinition[];
    /**
     * Get agents with specific capability
     */
    getByCapability(capability: string): ILoadedAgentDefinition[];
    /**
     * Get agents by priority level
     */
    getByPriority(priority: 'low' | 'medium' | 'high' | 'critical'): ILoadedAgentDefinition[];
    /**
     * Clear all loaded agents (for testing)
     */
    clear(): void;
}
/**
 * Create and initialize an agent registry
 *
 * @param basePath - Base path to agents directory
 * @param options - Registry options
 */
export declare function createAgentRegistry(basePath: string, options?: {
    verbose?: boolean;
}): Promise<AgentRegistry>;
//# sourceMappingURL=agent-registry.d.ts.map