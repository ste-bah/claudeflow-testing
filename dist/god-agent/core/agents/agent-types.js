/**
 * Agent Types
 * TASK-AGT-001 - Type definitions for Universal Subagent System
 *
 * Defines types for loading and managing agent definitions from
 * .claude/agents/ markdown files with YAML frontmatter.
 */
// ==================== Type Guards ====================
/**
 * Type guard to check if frontmatter has hooks
 */
export function hasHooks(frontmatter) {
    return frontmatter.hooks !== undefined;
}
/**
 * Type guard to check if frontmatter has pre-hook
 */
export function hasPreHook(frontmatter) {
    return hasHooks(frontmatter) && typeof frontmatter.hooks.pre === 'string';
}
/**
 * Type guard to check if frontmatter has post-hook
 */
export function hasPostHook(frontmatter) {
    return hasHooks(frontmatter) && typeof frontmatter.hooks.post === 'string';
}
// ==================== Default Values ====================
/**
 * Default loader options
 */
export const DEFAULT_LOADER_OPTIONS = {
    validateHooks: true,
    requireFrontmatter: true,
    verbose: true,
};
/**
 * Default frontmatter for agents without YAML
 */
export function createDefaultFrontmatter(key) {
    return {
        name: key,
        description: `Agent: ${key}`,
        priority: 'medium',
    };
}
//# sourceMappingURL=agent-types.js.map