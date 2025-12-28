/**
 * General Task Adapter
 *
 * Default fallback adapter for general workflows that don't match
 * any specialized adapter. Provides sensible defaults for token
 * management and context handling.
 *
 * @module ucm/adapters/general-task-adapter
 */
import type { IWorkflowAdapter, ITaskContext, ITokenConfig, IPinningStrategy, IPhaseSettings } from '../types.js';
/**
 * Default adapter for general workflows
 * Always returns true for detect() to serve as fallback
 */
export declare class GeneralTaskAdapter implements IWorkflowAdapter {
    readonly name = "general";
    /**
     * Detect if task context matches general workflow
     *
     * Always returns true as this is the fallback adapter
     *
     * @param _context - Task context (unused)
     * @returns Always true (fallback adapter)
     */
    detect(_context: ITaskContext): boolean;
    /**
     * Get rolling window size for general tasks
     *
     * Uses moderate default of 3 messages
     *
     * @param _context - Task context (unused)
     * @returns Rolling window size
     */
    getWindowSize(_context: ITaskContext): number;
    /**
     * Get token configuration for general tasks
     *
     * Uses standard token estimation parameters
     *
     * @param _context - Task context (unused)
     * @returns Token configuration
     */
    getTokenConfig(_context: ITaskContext): ITokenConfig;
    /**
     * Get pinning strategy for general tasks
     *
     * Uses simple priority-based pinning without auto-pin
     *
     * @param _context - Task context (unused)
     * @returns Pinning strategy configuration
     */
    getPinningStrategy(_context: ITaskContext): IPinningStrategy;
    /**
     * Get phase-specific settings for general tasks
     *
     * Provides standard settings suitable for most workflows
     *
     * @param _context - Task context (unused)
     * @returns Phase-specific settings
     */
    getPhaseSettings(_context: ITaskContext): IPhaseSettings;
}
//# sourceMappingURL=general-task-adapter.d.ts.map