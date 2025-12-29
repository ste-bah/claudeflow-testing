/**
 * Hook Registry
 * TASK-HOOK-001 - Hook Registration Service
 *
 * Central registry for preToolUse and postToolUse hooks.
 * Implements singleton pattern for global access.
 *
 * CONSTITUTION COMPLIANCE:
 * - RULE-032: All hooks MUST be registered at daemon startup
 *
 * Per TASKS-PHASE3.md specification:
 * - HookRegistry class with registration methods
 * - IHook interface definition (see types.ts)
 * - preToolUse and postToolUse hook types
 * - Startup validation for required hooks
 * - Priority-based sorting
 */
import { IHook, IHookContext, IPostToolUseContext, IHookRegistry, AnyHook } from './types.js';
/**
 * HookRegistry
 *
 * Central registry for all hooks in the system.
 * Enforces RULE-032: hooks must be registered before initialization.
 *
 * Usage:
 * 1. Get singleton instance via getHookRegistry()
 * 2. Register hooks BEFORE calling initialize()
 * 3. Call initialize() during daemon startup
 * 4. Retrieve hooks via getPreToolUseHooks() / getPostToolUseHooks()
 */
export declare class HookRegistry implements IHookRegistry {
    /** Map of preToolUse hooks by ID */
    private readonly preToolUseHooks;
    /** Map of postToolUse hooks by ID */
    private readonly postToolUseHooks;
    /**
     * List of required hook IDs that MUST be registered before initialization
     * Per CONSTITUTION RULE-032
     */
    private readonly requiredHooks;
    /** Whether the registry has been initialized */
    private initialized;
    /** Logger instance */
    private readonly logger;
    constructor();
    /**
     * Register a hook with the registry
     *
     * @param hook - Hook definition to register
     * @throws HookError if called after initialization (RULE-032)
     * @throws HookError if hook ID is already registered
     */
    register(hook: AnyHook): void;
    /**
     * Unregister a hook (only allowed before initialization)
     *
     * @param hookId - ID of the hook to remove
     * @throws HookError if called after initialization
     */
    unregister(hookId: string): boolean;
    /**
     * Initialize the registry
     *
     * Validates that all required hooks are registered.
     * Must be called during daemon startup after all hooks are registered.
     *
     * CONSTITUTION RULE-032: All required hooks must be registered at startup.
     *
     * @throws HookError if required hooks are missing
     */
    initialize(): void;
    /**
     * Check if the registry has been initialized
     */
    isInitialized(): boolean;
    /**
     * Get all pre-tool-use hooks for a specific tool
     *
     * @param toolName - Optional tool name to filter by
     * @returns Array of hooks sorted by priority (ascending)
     */
    getPreToolUseHooks(toolName?: string): AnyHook[];
    /**
     * Get all post-tool-use hooks for a specific tool
     *
     * @param toolName - Optional tool name to filter by
     * @returns Array of hooks sorted by priority (ascending)
     */
    getPostToolUseHooks(toolName?: string): AnyHook[];
    /**
     * Get a specific hook by ID
     *
     * @param id - Hook ID to find
     * @returns Hook if found, undefined otherwise
     */
    getHook(id: string): AnyHook | undefined;
    /**
     * Get count of registered hooks
     */
    getHookCount(): {
        preToolUse: number;
        postToolUse: number;
        total: number;
    };
    /**
     * Get all registered hook IDs
     */
    getAllHookIds(): string[];
    /**
     * Get required hooks configuration
     */
    getRequiredHooks(): readonly string[];
    /**
     * Enable or disable a hook
     *
     * @param id - Hook ID
     * @param enabled - Whether to enable or disable
     * @returns true if hook was found and updated, false otherwise
     */
    setHookEnabled(id: string, enabled: boolean): boolean;
    /**
     * Get hooks for a specific tool, filtered and sorted by priority
     */
    private getHooksForTool;
    /**
     * Get the other hook map (opposite of the given type)
     */
    private getOtherMap;
    /**
     * Reset the registry to initial state
     * WARNING: Only for testing purposes
     */
    _resetForTesting(): void;
}
/**
 * Get the singleton HookRegistry instance
 *
 * @returns HookRegistry singleton
 */
export declare function getHookRegistry(): HookRegistry;
/**
 * Reset the singleton instance (for testing only)
 */
export declare function _resetHookRegistryForTesting(): void;
/**
 * Helper to create and register a preToolUse hook
 */
export declare function registerPreToolUseHook(config: {
    id: string;
    handler: IHook<IHookContext>['handler'];
    toolName?: string;
    priority?: number;
    enabled?: boolean;
    description?: string;
}): void;
/**
 * Helper to create and register a postToolUse hook
 */
export declare function registerPostToolUseHook(config: {
    id: string;
    handler: IHook<IPostToolUseContext>['handler'];
    toolName?: string;
    priority?: number;
    enabled?: boolean;
    description?: string;
}): void;
//# sourceMappingURL=hook-registry.d.ts.map