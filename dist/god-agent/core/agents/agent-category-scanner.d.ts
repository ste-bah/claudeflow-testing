/**
 * Agent Category Scanner
 * TASK-AGT-002 - Discover agent category directories
 *
 * Scans .claude/agents/ for all category subdirectories
 * and counts agent files in each.
 */
import type { ICategoryInfo } from './agent-types.js';
/**
 * AgentCategoryScanner
 *
 * Discovers all agent category directories under a base path.
 * Categories are subdirectories containing .md agent files.
 */
export declare class AgentCategoryScanner {
    private verbose;
    constructor(options?: {
        verbose?: boolean;
    });
    /**
     * Scan for all category directories
     *
     * @param basePath - Base path to scan (e.g., '.claude/agents')
     * @returns Array of category info, sorted by agent count (descending)
     */
    scanCategories(basePath: string): Promise<ICategoryInfo[]>;
    /**
     * Count .md files in a directory
     */
    private countAgentFiles;
    /**
     * Get category names only
     */
    getCategoryNames(basePath: string): Promise<string[]>;
    /**
     * Check if a category exists
     */
    hasCategory(basePath: string, categoryName: string): Promise<boolean>;
}
//# sourceMappingURL=agent-category-scanner.d.ts.map