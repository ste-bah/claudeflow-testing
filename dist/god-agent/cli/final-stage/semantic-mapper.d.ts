/**
 * SemanticMapper - Maps agent outputs to chapters using weighted semantic similarity
 *
 * Implements SPEC-FUNC-001 Section 2.4 and GAP-C001 (Semantic Matching Algorithm)
 *
 * Algorithm Weights:
 * - 35% keyword overlap (Jaccard similarity on keywords)
 * - 30% topic similarity (chapter.title vs summary.primaryTopics)
 * - 20% question alignment (chapter.questionsAddressed vs summary.researchQuestions)
 * - 15% phase weighting (chapter.number vs summary.phase proximity)
 *
 * Thresholds:
 * - Primary sources: score >= threshold + 0.20 (default: 0.50)
 * - Secondary sources: score >= threshold (default: 0.30)
 *
 * Constitution Rules:
 * - EX-001: Zero-source halt condition - report error if any chapter has 0 sources
 * - EX-002: Unassigned output logging - all orphaned sources must be logged
 * - QA-005: Minimum 3 sources per chapter - warn if fewer than 3
 */
import type { ChapterDefinition, AgentOutputSummary, SemanticMapperInput, SemanticMapperOutput } from './types.js';
/**
 * SemanticMapper - Maps outputs to chapters using semantic similarity
 *
 * @example
 * ```typescript
 * const mapper = new SemanticMapper();
 * const output = await mapper.mapOutputsToChapters(
 *   chapters,
 *   summaries,
 *   { threshold: 0.30, fallbackHeuristics: true }
 * );
 * ```
 */
export declare class SemanticMapper {
    /**
     * Hardcoded heuristic fallback table from SPEC-FUNC-001 Section 2.4.5
     * Used when semantic matching fails for a chapter
     */
    private static readonly HEURISTIC_FALLBACKS;
    /**
     * Stopwords to filter during tokenization
     * Common English words that don't contribute to semantic similarity
     */
    private static readonly STOPWORDS;
    /**
     * Algorithm weights per SPEC-FUNC-001 Section 2.4.4
     */
    private static readonly WEIGHTS;
    /**
     * Map agent output summaries to chapters using weighted semantic similarity
     *
     * @param chapters - Chapter definitions from the locked structure
     * @param summaries - Agent output summaries from SummaryExtractor
     * @param input - Configuration options (threshold, fallbackHeuristics)
     * @returns Complete mapping output with quality metrics
     */
    mapOutputsToChapters(chapters: ChapterDefinition[], summaries: AgentOutputSummary[], input: SemanticMapperInput): Promise<SemanticMapperOutput>;
    /**
     * Calculate weighted similarity score between a chapter and summary
     *
     * @param chapter - Chapter definition
     * @param summary - Agent output summary
     * @param chapterKeywords - Pre-computed chapter keyword set
     * @param summaryKeywords - Pre-computed summary keyword set
     * @returns Weighted similarity score between 0 and 1
     */
    calculateSimilarity(chapter: ChapterDefinition, summary: AgentOutputSummary, chapterKeywords?: Set<string>, summaryKeywords?: Set<string>): number;
    /**
     * Get heuristic fallback mapping for a chapter
     *
     * @param chapterNumber - Chapter number (1-12)
     * @returns Fallback source indices or undefined if no fallback defined
     */
    applyHeuristicFallback(chapterNumber: number): {
        primary: number[];
        secondary: number[];
    } | undefined;
    /**
     * Build keyword vectors for all chapters
     */
    private buildChapterKeywordVectors;
    /**
     * Build keyword vectors for all summaries
     */
    private buildSummaryKeywordVectors;
    /**
     * Tokenize text into normalized words
     * Filters stopwords and short words
     */
    private tokenize;
    /**
     * Compute full similarity matrix between chapters and summaries
     */
    private computeSimilarityMatrix;
    /**
     * Jaccard similarity between two sets
     * |A intersect B| / |A union B|
     */
    private jaccardSimilarity;
    /**
     * Topic match between chapter purpose/title and summary topics
     */
    private topicMatch;
    /**
     * Research question alignment between chapter and summary
     * Handles formats: Q1, Q2, RQ1, RQ2, etc.
     */
    private questionMatch;
    /**
     * Phase proximity heuristic
     * Gives bonus to Phase 6 writers and sources close to chapter position
     */
    private phaseHeuristic;
    /**
     * Map pipeline phase to expected chapter number
     */
    private phaseToExpectedChapter;
    /**
     * Assign sources to chapters based on similarity thresholds
     */
    private assignSourcesToChapters;
    /**
     * Apply heuristic fallbacks for chapters with no semantic matches
     */
    private applyFallbackHeuristics;
    /**
     * Find sources not assigned to any chapter
     */
    private findOrphanedSources;
    /**
     * Reassign orphaned sources to best-matching chapters
     */
    private reassignOrphanedSources;
    /**
     * Compute mapping quality metrics
     */
    private computeQualityMetrics;
}
//# sourceMappingURL=semantic-mapper.d.ts.map