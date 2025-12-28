/**
 * ChapterStructureLoader - Loads locked chapter structure for dynamic Phase 6
 * Implements REQ-PIPE-041, REQ-PIPE-042, REQ-PIPE-043
 */
import { promises as fs } from 'fs';
import * as path from 'path';
/**
 * Error when chapter structure file is not found
 */
export class ChapterStructureNotFoundError extends Error {
    path;
    constructor(structurePath) {
        super(`Chapter structure not found at ${structurePath}; dissertation-architect (Agent #6) must complete first`);
        this.name = 'ChapterStructureNotFoundError';
        this.path = structurePath;
    }
}
/**
 * Error when chapter structure is not locked
 */
export class ChapterStructureNotLockedError extends Error {
    constructor() {
        super('Chapter structure not locked; dissertation-architect must finalize the structure before Phase 6 can begin');
        this.name = 'ChapterStructureNotLockedError';
    }
}
/**
 * ChapterStructureLoader class
 * [REQ-PIPE-041, REQ-PIPE-042]
 */
export class ChapterStructureLoader {
    agentsDir;
    constructor(basePath = process.cwd()) {
        this.agentsDir = path.join(basePath, '.claude/agents/phdresearch');
    }
    /**
     * Load and parse the locked chapter structure for a research session
     * [REQ-PIPE-041, REQ-PIPE-042]
     *
     * @param slug - Research session slug (folder name)
     * @returns Parsed and validated chapter structure
     */
    async loadChapterStructure(slug) {
        const structurePath = path.join(process.cwd(), 'docs/research', slug, '05-chapter-structure.md');
        // Check file exists
        try {
            await fs.access(structurePath);
        }
        catch {
            throw new ChapterStructureNotFoundError(structurePath);
        }
        // Read and parse
        const content = await fs.readFile(structurePath, 'utf-8');
        const structure = this.parseStructure(content);
        // Validate locked
        if (!structure.locked) {
            throw new ChapterStructureNotLockedError();
        }
        // Validate has chapters
        if (!structure.chapters || structure.chapters.length === 0) {
            throw new Error('No chapters defined in structure; dissertation-architect must define at least one chapter');
        }
        // Validate each chapter
        for (let i = 0; i < structure.chapters.length; i++) {
            this.validateChapter(structure.chapters[i], i);
        }
        return structure;
    }
    /**
     * Parse chapter structure from markdown file
     */
    parseStructure(content) {
        // Look for JSON code block
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
        if (!jsonMatch) {
            // Try to find just JSON object
            const objectMatch = content.match(/\{[\s\S]*"locked"[\s\S]*\}/);
            if (!objectMatch) {
                throw new Error('No JSON code block or structure found in chapter structure file');
            }
            return JSON.parse(objectMatch[0]);
        }
        return JSON.parse(jsonMatch[1]);
    }
    /**
     * Validate a chapter definition has required fields
     * [REQ-PIPE-043]
     */
    validateChapter(chapter, index) {
        const required = ['number', 'title', 'writerAgent', 'outputFile'];
        for (const field of required) {
            if (!(field in chapter) || !chapter[field]) {
                throw new Error(`Invalid chapter definition at index ${index}: missing required field '${field}'`);
            }
        }
        // Set defaults
        if (!chapter.targetWords) {
            chapter.targetWords = 5000;
        }
        if (!chapter.sections) {
            chapter.sections = [];
        }
    }
    /**
     * Check if a writer agent exists in the agents directory
     * [REQ-PIPE-044]
     */
    async writerAgentExists(agentKey) {
        const agentPath = path.join(this.agentsDir, `${agentKey}.md`);
        try {
            await fs.access(agentPath);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Get the path to an agent definition file
     */
    getAgentPath(agentKey) {
        return path.join(this.agentsDir, `${agentKey}.md`);
    }
}
//# sourceMappingURL=chapter-structure-loader.js.map