/**
 * ChapterStructureLoader - Loads locked chapter structure for dynamic Phase 6
 * Implements REQ-PIPE-041, REQ-PIPE-042, REQ-PIPE-043
 */
/**
 * Chapter definition from locked structure
 */
export interface ChapterDefinition {
    number: number;
    title: string;
    writerAgent: string;
    targetWords: number;
    sections: string[];
    outputFile: string;
}
/**
 * Complete chapter structure from dissertation-architect
 */
export interface ChapterStructure {
    locked: boolean;
    generatedAt: string;
    totalChapters: number;
    estimatedTotalWords: number;
    chapters: ChapterDefinition[];
    writerMapping: Record<string, string>;
}
/**
 * Error when chapter structure file is not found
 */
export declare class ChapterStructureNotFoundError extends Error {
    readonly path: string;
    constructor(structurePath: string);
}
/**
 * Error when chapter structure is not locked
 */
export declare class ChapterStructureNotLockedError extends Error {
    constructor();
}
/**
 * ChapterStructureLoader class
 * [REQ-PIPE-041, REQ-PIPE-042]
 */
export declare class ChapterStructureLoader {
    private readonly agentsDir;
    constructor(basePath?: string);
    /**
     * Possible file patterns for chapter structure (in priority order)
     * - Primary: 05-dissertation-architect.md (current pipeline naming: {index}-{agent-key}.md)
     * - Legacy: 05-chapter-structure.md (backward compatibility)
     */
    private static readonly STRUCTURE_FILE_PATTERNS;
    /**
     * Load and parse the locked chapter structure for a research session
     * [REQ-PIPE-041, REQ-PIPE-042]
     *
     * @param slug - Research session slug (folder name)
     * @returns Parsed and validated chapter structure
     */
    loadChapterStructure(slug: string): Promise<ChapterStructure>;
    /**
     * Parse chapter structure from markdown file
     * Supports both JSON code blocks (preferred) and markdown-only format (fallback)
     */
    private parseStructure;
    /**
     * Normalize field names across different JSON schema versions
     * Handles: assignedAgent -> writerAgent, wordTarget -> targetWords, etc.
     */
    private normalizeStructure;
    /**
     * Parse chapter structure from markdown headings when no JSON is available
     * This is a fallback for legacy or manually-created structure files
     */
    private parseFromMarkdown;
    /**
     * Infer writer agent from chapter number and title
     */
    private inferWriterAgent;
    /**
     * Validate a chapter definition has required fields
     * [REQ-PIPE-043]
     */
    private validateChapter;
    /**
     * Check if a writer agent exists in the agents directory
     * [REQ-PIPE-044]
     */
    writerAgentExists(agentKey: string): Promise<boolean>;
    /**
     * Get the path to an agent definition file
     */
    getAgentPath(agentKey: string): string;
}
//# sourceMappingURL=chapter-structure-loader.d.ts.map