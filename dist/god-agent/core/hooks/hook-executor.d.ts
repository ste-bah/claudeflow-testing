/**
 * Hook Execution Engine
 * TASK-HOOK-002 - Hook Execution Engine
 *
 * Executes preToolUse and postToolUse hooks in priority order.
 * Implements error isolation - one hook failure does NOT stop other hooks.
 *
 * CONSTITUTION COMPLIANCE:
 * - RULE-032: All hooks MUST be registered at daemon startup (registry handles this)
 * - Logs execution metrics for observability
 *
 * Per TASKS-PHASE3.md specification:
 * - Execute hooks in priority order (already sorted by registry)
 * - Track timing for each hook execution
 * - Handle input modification chain for preToolUse hooks
 * - Stop chain only when hook returns continue: false
 * - Error isolation: hook failures don't stop chain
 */
import { IHookContext, IPostToolUseContext, IHookExecutor, IHookChainResult, IHookExecutionResult, AnyHook } from './types.js';
/**
 * HookExecutor
 *
 * Executes hook chains for preToolUse and postToolUse events.
 *
 * Key behaviors:
 * - Hooks execute in priority order (ascending)
 * - Error isolation: failed hooks don't stop chain
 * - Chain stops only when hook returns continue: false
 * - Input modification flows through preToolUse chain
 * - Metrics tracked for each execution
 *
 * Usage:
 * ```typescript
 * const executor = getHookExecutor();
 * const result = await executor.executePreToolUseHooks(context);
 * if (result.chainStopped) {
 *   // A hook prevented tool execution
 * }
 * ```
 */
export declare class HookExecutor implements IHookExecutor {
    /** Logger instance for observability */
    private readonly logger;
    constructor();
    /**
     * Execute pre-tool-use hooks for the given context
     *
     * Hooks execute in priority order. Each hook may:
     * - Modify the input (passed to subsequent hooks)
     * - Stop the chain (return continue: false)
     * - Fail (recorded but doesn't stop chain)
     *
     * @param context - Hook execution context
     * @returns Chain execution result including final modified input
     */
    executePreToolUseHooks(context: IHookContext): Promise<IHookChainResult>;
    /**
     * Execute post-tool-use hooks for the given context
     *
     * Hooks execute in priority order. Each hook may:
     * - Stop the chain (return continue: false)
     * - Fail (recorded but doesn't stop chain)
     *
     * Note: Post-tool-use hooks do NOT modify input (tool already executed)
     *
     * @param context - Post-tool-use hook context (includes toolOutput)
     * @returns Chain execution result
     */
    executePostToolUseHooks(context: IPostToolUseContext): Promise<IHookChainResult>;
    /**
     * Execute a single hook with error isolation
     *
     * CRITICAL: Errors are caught and recorded, NOT re-thrown.
     * This ensures one failing hook doesn't break the entire chain.
     *
     * @param hook - Hook to execute
     * @param context - Execution context
     * @returns Execution result (always succeeds at the executor level)
     */
    private executeHookWithIsolation;
    /**
     * Execute a single hook directly (for testing)
     * Bypasses registry lookup
     *
     * WARNING: Only for testing purposes
     */
    _executeHookDirectlyForTesting(hook: AnyHook, context: IHookContext | IPostToolUseContext): Promise<IHookExecutionResult>;
}
/**
 * Get the singleton HookExecutor instance
 *
 * @returns HookExecutor singleton
 */
export declare function getHookExecutor(): HookExecutor;
/**
 * Reset the singleton instance (for testing only)
 */
export declare function _resetHookExecutorForTesting(): void;
//# sourceMappingURL=hook-executor.d.ts.map