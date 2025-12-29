/**
 * ChapterWriterAgent - Synthesizes chapter content from mapped source summaries
 *
 * Implements SPEC-FUNC-001 Section 2.5 and GAP-C003 (Chapter Writer Synthesis Logic)
 *
 * Core Responsibilities:
 * - Build section structure from ChapterDefinition
 * - Synthesize content from mapped sources (not summarize)
 * - Preserve citations from sources
 * - Generate cross-references to other chapters
 * - Apply word count targets (70%-130% acceptable per QA-001)
 * - Detect and handle duplicate content (GAP-H001)
 *
 * Constitution Rules:
 * - DI-005: Word counts within 30% of target - enforce 70%-130% range
 * - DI-006: Source attribution - every paragraph must come from sources
 * - EX-003: Source isolation - only access mapped sources for this chapter
 * - QA-001: Deduplicate >50% similar content
 */
import type { ChapterDefinition, AgentOutputSummary, ChapterWriterInput, ChapterWriterOutput, CrossReference, CitationRef, QualityMetrics } from './types.js';
import type { StyleCharacteristics } from '../../universal/style-analyzer.js';
/**
 * Supported phdresearch agent types for chapter writing
 * Maps to agents in .claude/agents/phdresearch/
 */
export type ChapterAgentType = 'introduction-writer' | 'literature-review-writer' | 'theoretical-framework-analyst' | 'methodology-writer' | 'results-writer' | 'discussion-writer' | 'conclusion-writer' | 'apa-citation-specialist' | 'chapter-synthesizer';
/**
 * Dynamically select the appropriate phdresearch agent based on chapter title
 * Maps chapter content type to specialized writing agents
 *
 * @param chapterTitle - The title of the chapter being written
 * @returns The appropriate agent type for this chapter
 */
export declare function getAgentForChapter(chapterTitle: string): ChapterAgentType;
/**
 * Chapter synthesis prompt for Claude Code Task tool
 * Contains all data needed to spawn a specialized chapter writing agent
 */
export interface ChapterSynthesisPrompt {
    /** Chapter number */
    chapterNumber: number;
    /** Chapter title */
    chapterTitle: string;
    /** Section details */
    sections: Array<{
        id: string;
        title: string;
        wordTarget: number;
    }>;
    /** Research content organized by section */
    researchContent: Record<string, string>;
    /** Style profile ID to apply */
    styleProfileId: string | null;
    /** Output file path */
    outputPath: string;
    /** Total word target */
    wordTarget: number;
    /** Agent type to spawn - dynamically selected based on chapter title */
    agentType: ChapterAgentType;
    /** Full prompt for the agent */
    prompt: string;
}
/**
 * ChapterWriterAgent - Synthesizes chapter content from mapped sources
 *
 * @example
 * ```typescript
 * // Create with style profile for LLM-based synthesis (RECOMMENDED)
 * const writer = new ChapterWriterAgent('academic-papers-uk');
 * const output = await writer.writeChapter({
 *   chapter: chapterDefinition,
 *   sources: mappedSummaries,
 *   style: styleProfile,
 *   allChapters: allChapterDefinitions,
 *   tokenBudget: 15000
 * });
 *
 * // The writer now uses the chapter-synthesizer agent prompt
 * // to transform raw research into clean academic prose.
 * // Style profile ensures consistent UK English and academic register.
 * ```
 */
export declare class ChapterWriterAgent {
    /**
     * Style profile ID for consistent academic writing style
     */
    private styleProfileId?;
    /**
     * Research directory for output paths
     */
    private researchDir?;
    /**
     * Create ChapterWriterAgent
     *
     * @param styleProfileId - Optional style profile ID for consistent style application
     * @param researchDir - Optional research directory for output paths
     */
    constructor(styleProfileId?: string, researchDir?: string);
    /**
     * Stopwords to filter during tokenization
     */
    private static readonly STOPWORDS;
    /**
     * Duplicate detection thresholds per Constitution QA-001
     */
    private static readonly THRESHOLDS;
    /**
     * Word count tolerance per DI-005
     */
    private static readonly WORD_COUNT_TOLERANCE;
    /**
     * Generate synthesis prompts for Claude Code to spawn chapter-synthesizer agents
     *
     * This is the PREFERRED method - outputs prompts that Claude Code can use
     * to spawn the chapter-synthesizer agent for each chapter.
     *
     * @param input - Chapter writer input with chapter definition, sources, style
     * @returns Synthesis prompt for Claude Code Task tool
     */
    generateSynthesisPrompt(input: ChapterWriterInput): Promise<ChapterSynthesisPrompt>;
    /**
     * Format style requirements for the agent prompt
     *
     * CRITICAL: This method uses StyleAnalyzer to generate comprehensive
     * style requirements. The style profile is NON-NEGOTIABLE.
     */
    private formatStyleRequirements;
    /**
     * Load and format complete style profile from AgentDB
     *
     * This loads the full style profile by ID and formats it
     * for inclusion in the synthesis prompt.
     */
    private loadStyleProfile;
    /**
     * Get default UK English academic style requirements
     */
    private getDefaultStyleRequirements;
    /**
     * Build the full prompt for the chapter-synthesizer agent
     */
    private buildAgentPrompt;
    /**
     * Write a chapter from mapped source summaries (basic concatenation)
     *
     * NOTE: This is a FALLBACK method that does basic concatenation.
     * For proper academic prose, use generateSynthesisPrompt() and have
     * Claude Code spawn the chapter-synthesizer agent.
     *
     * @param input - Chapter writer input with chapter definition, sources, style
     * @returns Complete chapter output with content, citations, metrics
     */
    writeChapter(input: ChapterWriterInput): Promise<ChapterWriterOutput>;
    /**
     * Build the LLM prompt for chapter synthesis
     *
     * @param input - Chapter writer input
     * @returns Formatted prompt string
     */
    buildPrompt(input: ChapterWriterInput): string;
    /**
     * Generate cross-references to other chapters
     *
     * @param content - Section content to scan
     * @param chapterNumber - Current chapter number
     * @param sectionId - Current section identifier
     * @param allChapters - All chapter definitions
     * @returns Array of cross-references found
     */
    generateCrossReferences(content: string, chapterNumber: number, sectionId: string, allChapters: ChapterDefinition[]): CrossReference[];
    /**
     * Extract citations from content using source information
     *
     * @param content - Content to extract citations from
     * @param sources - Source summaries for validation
     * @returns Array of citation references
     */
    extractCitations(content: string, sources: AgentOutputSummary[]): CitationRef[];
    /**
     * Calculate quality metrics for the chapter
     *
     * @param wordCount - Actual word count
     * @param targetWordCount - Target word count
     * @param citations - Extracted citations
     * @param sources - Used sources
     * @param style - Style characteristics (for violation counting)
     * @returns Quality metrics object
     */
    calculateQualityMetrics(wordCount: number, targetWordCount: number, citations: CitationRef[], sources: AgentOutputSummary[], _style: StyleCharacteristics | null): QualityMetrics;
    /**
     * Find relevant content from sources for a specific section
     */
    private findRelevantContent;
    /**
     * Deduplicate content using TF-IDF vectorization and cosine similarity
     * Per GAP-H001 and Constitution QA-001
     */
    private deduplicateContent;
    /**
     * Synthesize section content from paragraphs (basic concatenation fallback)
     *
     * NOTE: This is a FALLBACK method. For proper LLM-based synthesis,
     * use generateSynthesisPrompt() and have Claude Code spawn the
     * chapter-synthesizer agent.
     */
    private synthesizeSection;
    /**
     * Enforce word count limits per DI-005
     */
    private enforceWordCount;
    /**
     * Format complete chapter from sections
     */
    private formatChapter;
    /**
     * Tokenize text into normalized words
     */
    private tokenize;
    /**
     * Build IDF scores from paragraphs
     */
    private buildIdfScores;
    /**
     * Vectorize paragraph using TF-IDF
     */
    private vectorizeParagraph;
    /**
     * L2 normalize a vector
     */
    private normalizeVector;
    /**
     * Calculate cosine similarity between two vectors
     */
    private cosineSimilarity;
    /**
     * Jaccard similarity between two sets
     */
    private jaccardSimilarity;
    /**
     * Count words in text
     */
    private countWords;
    /**
     * Estimate token count (rough: 1 token ~ 4 characters)
     */
    private estimateTokens;
    /**
     * Slugify a title for URL/filename use
     */
    private slugify;
    /**
     * Parse author string into array
     */
    private parseAuthors;
    /**
     * Deduplicate citations by raw text
     */
    private deduplicateCitations;
    /**
     * Apply basic British spelling transformations
     */
    private applyBritishSpelling;
    /**
     * Build style rules section for prompt
     */
    private buildStyleRules;
}
//# sourceMappingURL=chapter-writer-agent.d.ts.map