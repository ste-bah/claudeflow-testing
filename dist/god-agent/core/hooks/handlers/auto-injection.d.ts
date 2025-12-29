/**
 * Auto-Injection Hook
 * TASK-HOOK-004 - Auto-Injection into Task() Spawns
 *
 * A preToolUse hook that injects relevant god-agent context
 * (DESC episodes and SonaEngine patterns) into Task() prompts.
 *
 * CONSTITUTION COMPLIANCE:
 * - REQ-CONST-003: Auto-injection into ALL Task() spawns
 * - RULE-032: Hooks registered at daemon startup
 */
/**
 * DESC Service interface for episode retrieval
 * Uses late binding to avoid circular dependencies
 */
export interface IDescServiceLike {
    retrieveRelevant(query: string, options?: {
        limit?: number;
    }): Promise<Array<{
        id: string;
        summary?: string;
        content?: string;
    }>>;
}
/**
 * SonaEngine interface for pattern retrieval
 * Uses late binding to avoid circular dependencies
 */
export interface ISonaEngineLike {
    findPatterns(taskType: string, options?: {
        limit?: number;
    }): Promise<Array<{
        name: string;
        action: string;
    }>>;
}
/**
 * Set the DESC service getter
 * Called during daemon initialization to enable late binding
 *
 * @param getter - Function that returns the DESC service instance
 *
 * @example
 * ```typescript
 * import { setDescServiceGetter } from './hooks/handlers/auto-injection.js';
 * import { getDescService } from './desc/desc-service.js';
 *
 * // During daemon startup
 * setDescServiceGetter(() => getDescService());
 * ```
 */
export declare function setDescServiceGetter(getter: () => IDescServiceLike | null): void;
/**
 * Set the SonaEngine getter
 * Called during daemon initialization to enable late binding
 *
 * @param getter - Function that returns the SonaEngine instance
 *
 * @example
 * ```typescript
 * import { setSonaEngineGetter } from './hooks/handlers/auto-injection.js';
 * import { getSonaEngine } from './sona/sona-engine.js';
 *
 * // During daemon startup
 * setSonaEngineGetter(() => getSonaEngine());
 * ```
 */
export declare function setSonaEngineGetter(getter: () => ISonaEngineLike | null): void;
/**
 * Register the auto-injection hook
 *
 * This hook injects relevant DESC episodes and SonaEngine patterns
 * into Task() prompts to provide context for spawned agents.
 *
 * Call during daemon startup BEFORE HookRegistry.initialize()
 *
 * Hook Details:
 * - id: 'auto-injection'
 * - type: 'preToolUse'
 * - toolName: 'Task' (only triggers for Task tool)
 * - priority: DEFAULT_PRIORITIES.INJECTION (20)
 *
 * @example
 * ```typescript
 * import { registerAutoInjectionHook, registerRequiredHooks } from './hooks';
 *
 * // During daemon startup
 * registerRequiredHooks();
 * registerAutoInjectionHook();
 * getHookRegistry().initialize();
 * ```
 */
export declare function registerAutoInjectionHook(): void;
/**
 * Reset auto-injection state for testing
 * Clears service getters to allow fresh test configuration
 *
 * @internal Should only be used in test files
 */
export declare function _resetAutoInjectionForTesting(): void;
//# sourceMappingURL=auto-injection.d.ts.map