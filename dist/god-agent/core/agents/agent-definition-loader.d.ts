/**
 * Agent Definition Loader
 * TASK-AGT-001 - Parse YAML frontmatter and markdown from agent files
 *
 * Loads agent definitions from .claude/agents/ markdown files.
 * Extracts YAML frontmatter and full prompt content.
 */
import type { IAgentFrontmatter, ILoadedAgentDefinition, IAgentLoaderOptions } from './agent-types.js';
/**
 * Parse YAML frontmatter using js-yaml library
 * Falls back to regex extraction for files with TypeScript-style syntax
 */
declare function parseYaml(yamlContent: string): IAgentFrontmatter;
/**
 * Parse result from frontmatter extraction
 */
interface IFrontmatterResult {
    frontmatter: IAgentFrontmatter | null;
    body: string;
}
/**
 * Extract YAML frontmatter from markdown content
 *
 * Frontmatter is delimited by --- at start and end:
 * ```
 * ---
 * name: agent-name
 * description: Agent description
 * ---
 *
 * # Agent Content
 * ...
 * ```
 */
declare function parseFrontmatter(content: string): IFrontmatterResult;
/**
 * AgentDefinitionLoader
 *
 * Loads agent definitions from markdown files with YAML frontmatter.
 * Extracts:
 * - name, type, description, capabilities from frontmatter
 * - hooks.pre and hooks.post for execution
 * - Full markdown body as prompt content
 */
export declare class AgentDefinitionLoader {
    private options;
    constructor(options: IAgentLoaderOptions);
    /**
     * Load all agent definitions from a category directory
     *
     * @param categoryPath - Absolute path to category directory
     * @param category - Category name (directory name)
     * @returns Array of loaded agent definitions
     */
    loadAll(categoryPath: string, category: string): Promise<ILoadedAgentDefinition[]>;
    /**
     * Load a single agent definition from a markdown file
     *
     * @param filePath - Absolute path to .md file
     * @param category - Category name
     * @returns Loaded definition or null if parsing failed
     */
    loadOne(filePath: string, category: string): Promise<ILoadedAgentDefinition | null>;
    /**
     * Validate hook syntax for common issues
     */
    private validateHooks;
    /**
     * Get loader options
     */
    getOptions(): Required<IAgentLoaderOptions>;
}
export { parseFrontmatter, parseYaml };
//# sourceMappingURL=agent-definition-loader.d.ts.map