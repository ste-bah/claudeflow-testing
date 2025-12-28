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
     * Anthropic LLM client for actual prose generation
     */
    private client;
    /**
     * Style profile ID for consistent academic writing style
     */
    private styleProfileId?;
    /**
     * Cached chapter-synthesizer agent prompt
     */
    private cachedAgentPrompt?;
    /**
     * Model to use for generation
     */
    private model;
    /**
     * Create ChapterWriterAgent with LLM support
     *
     * @param styleProfileId - Optional style profile ID for consistent style application
     * @param apiKey - Optional Anthropic API key (defaults to ANTHROPIC_API_KEY env var)
     */
    constructor(styleProfileId?: string, apiKey?: string);
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
     * Write a chapter from mapped source summaries
     *
     * CRITICAL: This method now uses LLM-based synthesis when available.
     * It calls synthesizeSectionAsync with the chapter-synthesizer agent prompt
     * and style profile to generate clean academic prose.
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
     * Synthesize section content from paragraphs using LLM
     *
     * CRITICAL: This method calls the LLM with the chapter-synthesizer agent prompt
     * to transform raw research findings into clean academic prose. It does NOT
     * simply concatenate paragraphs.
     */
    private synthesizeSection;
    /**
     * Synthesize section content using LLM (async version)
     *
     * CRITICAL: This is the core method that transforms research into prose.
     * It MUST use the style profile - this is non-negotiable.
     */
    private synthesizeSectionAsync;
    /**
     * Load the chapter-synthesizer agent prompt
     *
     * Loads from .claude/agents/phdresearch/chapter-synthesizer.md
     */
    private loadChapterSynthesizerPrompt;
    /**
     * Build style system prompt from style profile
     *
     * CRITICAL: This method MUST return style instructions.
     * The style profile is NON-NEGOTIABLE for the final paper.
     */
    private buildStyleSystemPrompt;
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