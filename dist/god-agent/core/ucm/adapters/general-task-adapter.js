/**
 * General Task Adapter
 *
 * Default fallback adapter for general workflows that don't match
 * any specialized adapter. Provides sensible defaults for token
 * management and context handling.
 *
 * @module ucm/adapters/general-task-adapter
 */
/**
 * Default adapter for general workflows
 * Always returns true for detect() to serve as fallback
 */
export class GeneralTaskAdapter {
    name = 'general';
    /**
     * Detect if task context matches general workflow
     *
     * Always returns true as this is the fallback adapter
     *
     * @param _context - Task context (unused)
     * @returns Always true (fallback adapter)
     */
    detect(_context) {
        return true; // Always matches as fallback
    }
    /**
     * Get rolling window size for general tasks
     *
     * Uses moderate default of 3 messages
     *
     * @param _context - Task context (unused)
     * @returns Rolling window size
     */
    getWindowSize(_context) {
        return 3; // Standard default
    }
    /**
     * Get token configuration for general tasks
     *
     * Uses standard token estimation parameters
     *
     * @param _context - Task context (unused)
     * @returns Token configuration
     */
    getTokenConfig(_context) {
        return {
            tokensPerWord: 1.3, // Standard ratio for mixed content
            averageWordLength: 5, // Standard English average
            safetyMargin: 0.1 // 10% safety margin
        };
    }
    /**
     * Get pinning strategy for general tasks
     *
     * Uses simple priority-based pinning without auto-pin
     *
     * @param _context - Task context (unused)
     * @returns Pinning strategy configuration
     */
    getPinningStrategy(_context) {
        return {
            type: 'priority-based',
            autoPin: false, // Manual pinning only
            threshold: 5, // Higher threshold for auto-pinning
            maxPinnedItems: 20 // Conservative limit
        };
    }
    /**
     * Get phase-specific settings for general tasks
     *
     * Provides standard settings suitable for most workflows
     *
     * @param _context - Task context (unused)
     * @returns Phase-specific settings
     */
    getPhaseSettings(_context) {
        return {
            name: 'General',
            windowSize: 3,
            focusAreas: ['task-completion', 'quality', 'efficiency'],
            compressionEnabled: true,
            compressionRatio: 0.7, // Moderate compression
            priorityBoost: 1.0 // No priority adjustment
        };
    }
}
//# sourceMappingURL=general-task-adapter.js.map