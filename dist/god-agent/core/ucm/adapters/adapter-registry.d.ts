/**
 * UCM Adapter Registry
 *
 * Central registry for workflow adapters that manages adapter registration,
 * retrieval, and auto-detection based on task context.
 *
 * @module ucm/adapters/adapter-registry
 */
import type { IWorkflowAdapter, ITaskContext } from '../types.js';
/**
 * Registry for managing workflow adapters
 */
export declare class AdapterRegistry {
    private adapters;
    private detectionOrder;
    constructor();
    /**
     * Register default adapters in detection order (most specific first)
     */
    private registerDefaultAdapters;
    /**
     * Register a workflow adapter
     *
     * @param name - Unique name for the adapter
     * @param adapter - The adapter instance
     */
    register(name: string, adapter: IWorkflowAdapter): void;
    /**
     * Get adapter by name
     *
     * @param name - Adapter name
     * @returns The adapter instance or undefined
     */
    get(name: string): IWorkflowAdapter | undefined;
    /**
     * Auto-detect the appropriate adapter for a task context
     * Falls back to 'general' adapter if no specific match found
     *
     * @param context - Task context to analyze
     * @returns The detected adapter
     */
    detectAdapter(context: ITaskContext): IWorkflowAdapter;
    /**
     * Get all registered adapter names
     *
     * @returns Array of adapter names
     */
    getAdapterNames(): string[];
    /**
     * Clear all adapters (useful for testing)
     */
    clear(): void;
}
/**
 * Singleton instance of the adapter registry
 */
export declare const adapterRegistry: AdapterRegistry;
//# sourceMappingURL=adapter-registry.d.ts.map