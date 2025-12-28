/**
 * DynamicAgentGenerator - Generates Phase 6 agents dynamically from chapter structure
 * Implements REQ-PIPE-040, REQ-PIPE-041, REQ-PIPE-043, REQ-PIPE-044, REQ-PIPE-045
 */
import { ChapterDefinition, ChapterStructure } from './chapter-structure-loader.js';
import { StyleCharacteristics } from '../universal/style-analyzer.js';
import type { AgentDetails } from './cli-types.js';
/**
 * Extended agent details with chapter context
 */
export interface DynamicAgentDetails extends AgentDetails {
    chapterContext?: ChapterDefinition;
}
/**
 * DynamicAgentGenerator class
 */
export declare class DynamicAgentGenerator {
    private readonly loader;
    private readonly analyzer;
    private readonly agentsDir;
    constructor(basePath?: string);
    /**
     * Generate all Phase 6 agents dynamically from chapter structure
     * [REQ-PIPE-040, REQ-PIPE-041, REQ-PIPE-043, REQ-PIPE-045]
     *
     * @param structure - Locked chapter structure from dissertation-architect
     * @param styleCharacteristics - Style characteristics for prompt injection (optional)
     * @param slug - Research session slug
     * @returns Array of dynamically generated Phase 6 agents
     */
    generatePhase6Agents(structure: ChapterStructure, styleCharacteristics: StyleCharacteristics | null, slug: string): Promise<DynamicAgentDetails[]>;
    /**
     * Build writer prompt with chapter context and style injection
     * [REQ-PIPE-010, REQ-PIPE-043]
     */
    private buildWriterPrompt;
    /**
     * Build abstract writer prompt
     */
    private buildAbstractPrompt;
    /**
     * Check if current agent index is entering Phase 6
     * [REQ-PIPE-042]
     */
    isEnteringPhase6(currentIndex: number, previousIndex: number): boolean;
    /**
     * Check if current agent index is in Phase 6
     */
    isInPhase6(currentIndex: number, totalChapters: number): boolean;
    /**
     * Check if current agent index is in Phase 7 (QA)
     */
    isInPhase7(currentIndex: number, totalChapters: number): boolean;
    /**
     * Get Phase 6 agent index range
     */
    getPhase6Range(totalChapters: number): {
        start: number;
        end: number;
    };
    /**
     * Calculate total pipeline agent count
     * Formula: 31 (Phases 1-5) + N (chapters) + 1 (abstract) + 9 (Phase 7)
     * [REQ-PIPE-041]
     */
    getTotalAgentCount(totalChapters: number): number;
    /**
     * Get Phase 5 end index constant
     */
    getPhase5EndIndex(): number;
    /**
     * Get QA agents count constant
     */
    getQAAgentsCount(): number;
}
//# sourceMappingURL=dynamic-agent-generator.d.ts.map