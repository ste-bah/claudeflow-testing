/**
 * SummaryExtractor - Extracts summaries from agent output files
 *
 * Implements SPEC-TECH-001 Section 2.2 and GAP-C002 from SPEC-FUNC-001 Section 2.3
 *
 * File Size Handling:
 * - Files < 1KB: Copy verbatim (no LLM summarization)
 * - Files 1KB-100KB: Full content for summarization
 * - Files > 100KB: Extract first 10KB + last 10KB, then summarize
 * - Target: 400-600 tokens per summary
 *
 * Constitution Rules:
 * - SE-001: Read-only source access - NEVER modify source files, only read
 * - DI-002: Agent output preservation - original files MUST NOT be modified
 * - EX-002: Unassigned output logging - track all files, log missing ones
 */
import type { OutputScannerInput, OutputScannerOutput, AgentOutputSummary } from './types.js';
/**
 * SummaryExtractor - Scans research directory and extracts structured summaries
 *
 * Expects files named: NN-agent-name.md where NN is 00-44
 * Total expected files: 45
 */
export declare class SummaryExtractor {
    private readonly researchDir;
    /**
     * Citation extraction patterns
     * Per SPEC-FUNC-001 Section 2.3.4
     */
    private static readonly CITATION_PATTERNS;
    /**
     * Size thresholds in bytes
     */
    private static readonly SIZE_THRESHOLDS;
    /**
     * Total expected agent output files
     */
    private static readonly EXPECTED_FILE_COUNT;
    constructor(researchDir: string);
    /**
     * Scan all output files in the research directory
     *
     * @returns List of all markdown files matching the NN-*.md pattern
     */
    scanFiles(): Promise<string[]>;
    /**
     * Extract summary from a single file
     *
     * @param filePath - Absolute or relative path to the file
     * @param index - File index (0-44)
     * @returns Structured summary per AgentOutputSummary interface
     */
    extractSummary(filePath: string, index: number): Promise<AgentOutputSummary>;
    /**
     * Extract summaries from all agent output files
     *
     * @returns Array of summaries sorted by file index
     */
    extractAllSummaries(): Promise<AgentOutputSummary[]>;
    /**
     * Scan all output files and extract summaries with full reporting
     *
     * @param input - Scanner configuration
     * @returns Complete scan result with status
     */
    scanOutputFiles(input: OutputScannerInput): Promise<OutputScannerOutput>;
    /**
     * Extract summary with specific token limit
     */
    private extractSummaryWithTokenLimit;
    /**
     * Extract agent name from content
     * Looks for "Agent:" line or first heading
     */
    private extractAgentName;
    /**
     * Determine pipeline phase from file index
     * Per SPEC-FUNC-001 Section 2.3.4
     */
    private determinePhase;
    /**
     * Extract content type from first heading
     */
    private extractContentType;
    /**
     * Extract citations from content
     * Supports APA, MLA, and numbered formats
     */
    private extractCitations;
    /**
     * Validate bracketed citation to avoid false positives
     * Per SPEC-FUNC-001 Section 2.3.4
     */
    private isValidBracketedCitation;
    /**
     * Extract primary topics from headings
     * Returns top 5 topics
     */
    private extractTopics;
    /**
     * Extract research questions from content
     * Looks for Q1, Q2, RQ1, RQ2 patterns
     */
    private extractResearchQuestions;
    /**
     * Extract key findings from content
     * Returns top 3 findings
     */
    private extractKeyFindings;
    /**
     * Extract key terms from content
     * Returns up to 15 terms
     */
    private extractKeyTerms;
    /**
     * Strip agent metadata headers from content
     * Removes blocks like "Status:", "Agent:", "Date:", etc.
     */
    private stripMetadataHeaders;
    /**
     * Generate summary text from content
     * Target: 400-600 tokens
     */
    private generateSummaryText;
    /**
     * Count words in text
     */
    private countWords;
    /**
     * Estimate token count
     * Rough approximation: 1 token = 4 characters for English
     */
    private estimateTokens;
    /**
     * Generate list of expected file patterns
     */
    private generateExpectedFiles;
    /**
     * Create a failed summary for files that couldn't be read
     */
    private createFailedSummary;
}
//# sourceMappingURL=summary-extractor.d.ts.map