/**
 * IDESC-001 Sprint 5 - Reasoning Trace Summarizer
 * TASK-IDESC-RB-003: Create Reasoning Trace Summarizer
 *
 * Implements reasoning trace summarization for DESC injection.
 * Summarizes full reasoning traces to fit injection token budgets while preserving
 * key decision points and insights.
 *
 * Features:
 * - Token-budget aware summarization
 * - Key insight extraction from decision markers
 * - Formatted injection templates
 * - Graceful degradation (no errors thrown)
 */
/**
 * Trace summarizer configuration
 */
export interface ITraceSummarizerConfig {
    /** Default maximum tokens for summarized trace (default: 500) */
    defaultMaxTokens: number;
    /** Maximum number of insights to extract (default: 5) */
    maxInsights: number;
    /** Decision markers to look for in traces */
    decisionMarkers: string[];
}
/**
 * Default configuration following TASK-IDESC-RB-003 requirements
 */
export declare const DEFAULT_TRACE_CONFIG: ITraceSummarizerConfig;
/**
 * Trace summarizer interface
 * Implements: TASK-IDESC-RB-003
 */
export interface ITraceSummarizer {
    /**
     * Summarize reasoning trace to fit token budget
     * @param fullTrace - Full reasoning trace from ReasoningBank
     * @param maxTokens - Maximum tokens (default: 500)
     * @returns Summarized trace string (empty string if trace is empty/null)
     */
    summarize(fullTrace: string, maxTokens?: number): Promise<string>;
    /**
     * Extract key insights from reasoning trace
     * @param trace - Reasoning trace to analyze
     * @returns Array of key insight strings (max 5)
     */
    extractKeyInsights(trace: string): Promise<string[]>;
    /**
     * Format trace for DESC injection prompt
     * @param trace - Reasoning trace
     * @param episodeContext - Episode context summary
     * @returns Formatted injection string
     */
    formatForInjection(trace: string, episodeContext: string): Promise<string>;
}
/**
 * Reasoning trace summarizer
 * Implements: ITraceSummarizer
 */
export declare class TraceSummarizer implements ITraceSummarizer {
    private readonly config;
    constructor(config?: Partial<ITraceSummarizerConfig>);
    /**
     * Summarize reasoning trace to fit token budget
     * Implements: TASK-IDESC-RB-003 requirement
     */
    summarize(fullTrace: string, maxTokens?: number): Promise<string>;
    /**
     * Extract key insights from reasoning trace
     * Implements: TASK-IDESC-RB-003 requirement
     */
    extractKeyInsights(trace: string): Promise<string[]>;
    /**
     * Format trace for DESC injection prompt
     * Implements: TASK-IDESC-RB-003 template requirement
     */
    formatForInjection(trace: string, episodeContext: string): Promise<string>;
}
/**
 * Create a TraceSummarizer instance
 * @param config - Optional configuration overrides
 * @returns TraceSummarizer instance
 */
export declare function createTraceSummarizer(config?: Partial<ITraceSummarizerConfig>): ITraceSummarizer;
//# sourceMappingURL=trace-summarizer.d.ts.map