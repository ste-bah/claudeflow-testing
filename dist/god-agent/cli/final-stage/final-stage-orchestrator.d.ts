/**
 * FinalStageOrchestrator - Coordinates Phase 8 Final Assembly
 *
 * Implements SPEC-TECH-001 Section 2.1
 * Addresses gaps: GAP-H012 (CLI), GAP-C007 (Output Structure)
 *
 * State Machine:
 * IDLE -> INITIALIZING -> SCANNING -> SUMMARIZING -> MAPPING ->
 * WRITING -> COMBINING -> VALIDATING -> COMPLETED | FAILED
 */
import type { FinalStageState, FinalStageOptions, FinalStageResult, ProgressCallback, TokenBudget, SemanticMapperOutput, AgentOutputSummary, ChapterDefinition, StyleCharacteristics, FinalStageErrorCode, Phase8PrepareResult } from './types.js';
import { FinalStageError } from './types.js';
import { ProgressLogger } from './progress-logger.js';
/**
 * Chapter structure from 05-chapter-structure.md
 * Per SPEC-FUNC-001 Section 2.2
 */
interface ChapterStructure {
    /** MUST be true per DI-001 */
    locked: boolean;
    /** ISO date when locked */
    generatedAt: string;
    /** Dynamic: 5-12 chapters based on research scope */
    totalChapters: number;
    /** Estimated total words */
    estimatedTotalWords: number;
    /** Chapter definitions */
    chapters: ChapterDefinition[];
    /** Writer agent mapping */
    writerMapping: Record<string, string>;
    /** Research title (optional) */
    researchTitle?: string;
}
/**
 * FinalStageOrchestrator - Coordinates Phase 8 final assembly
 *
 * Responsibilities:
 * - Load chapter structure from 05-chapter-structure.md
 * - Scan and summarize 45 agent output files
 * - Map outputs to chapters using semantic similarity
 * - Generate N chapter files using ChapterWriterAgent (N from structure, 5-12)
 * - Combine into final paper with ToC
 * - Track token usage and progress
 *
 * Constitution Rules:
 * - FS-001: Outputs to final/ directories only
 * - FS-002: Never write to root folder
 * - FS-005: Archive before overwrite
 * - EX-001: Valid state machine transitions
 * - EX-004: Progress reporting hooks
 */
export declare class FinalStageOrchestrator {
    private readonly basePath;
    private readonly slug;
    private readonly researchDir;
    private readonly outputDir;
    private state;
    private tokenBudget;
    private startTime;
    private verbose;
    private progressCallbacks;
    private logger;
    private phaseTimings;
    private warnings;
    private options;
    private summaryExtractor;
    private semanticMapper;
    private chapterWriter;
    private paperCombiner;
    private styleApplier;
    private _styleProfileId;
    private _styleProfile;
    private _researchQuery;
    private _chapterStructure;
    private _summaries;
    private _mapping;
    /**
     * Create a new FinalStageOrchestrator
     *
     * @param basePath - Base path for the project (typically process.cwd())
     * @param slug - Research session slug (folder name under docs/research/)
     * @throws FinalStageError if slug is invalid (security violation)
     */
    constructor(basePath: string, slug: string);
    /**
     * Get ChapterWriterAgent, creating it lazily with style profile ID
     *
     * CRITICAL: This ensures the style profile is always passed to the writer
     * for proper LLM-based academic prose synthesis.
     */
    private getChapterWriter;
    /**
     * Get the current style profile
     */
    getStyleProfile(): StyleCharacteristics | null;
    /**
     * Get the research query/title
     */
    getResearchQuery(): string;
    /**
     * Get the cached chapter structure (available after INITIALIZING phase)
     * Used by CLI for --generate-prompts
     */
    getChapterStructure(): ChapterStructure | null;
    /**
     * Get the cached summaries (available after SUMMARIZING phase)
     * Used by CLI for --generate-prompts
     */
    getSummaries(): AgentOutputSummary[] | null;
    /**
     * Get the cached semantic mapping (available after MAPPING phase)
     * Used by CLI for --generate-prompts
     */
    getMapping(): SemanticMapperOutput | null;
    /**
     * Execute the complete Phase 8 pipeline
     *
     * State Machine: IDLE -> INITIALIZING -> SCANNING -> SUMMARIZING ->
     *                MAPPING -> WRITING -> COMBINING -> VALIDATING -> COMPLETED
     *
     * @param options - Execution options (force, dryRun, threshold, etc.)
     * @returns FinalStageResult with output paths and metadata
     * @throws FinalStageError on non-recoverable failures
     */
    execute(options?: FinalStageOptions): Promise<FinalStageResult>;
    /**
     * Register progress callback for real-time updates
     * Per EX-004: Progress reporting hooks must exist
     * Multiple callbacks can be registered
     *
     * @param callback - Function to receive progress reports
     */
    onProgress(callback: ProgressCallback): void;
    /**
     * Remove a progress callback
     *
     * @param callback - Callback to remove
     */
    offProgress(callback: ProgressCallback): void;
    /**
     * Clear all progress callbacks
     */
    clearProgressCallbacks(): void;
    /**
     * Get current execution state
     * @returns Current FinalStageState
     */
    getState(): FinalStageState;
    /**
     * Get current token budget status
     * @returns Copy of current TokenBudget
     */
    getTokenBudget(): TokenBudget;
    /**
     * Get phase timing metrics
     * Per TASK-010: Track and report timing per phase
     *
     * @returns Record of phase timing data in milliseconds
     */
    getPhaseTimings(): Record<string, number>;
    /**
     * Get the progress logger instance (for advanced usage)
     *
     * @returns ProgressLogger or null if not initialized
     */
    getLogger(): ProgressLogger | null;
    /**
     * Transition to a new state with validation
     * Per EX-001: State machine transitions must be valid
     *
     * @param newState - Target state
     * @throws FinalStageError if transition is invalid
     */
    private setState;
    /**
     * Emit progress to all registered callbacks
     * Per EX-004: Progress reporting hooks
     *
     * @param report - Progress report to emit
     */
    private emitProgress;
    /**
     * Report progress to all callbacks
     * Per EX-004: Progress reporting hooks
     *
     * @param message - Human-readable progress message
     * @param current - Current progress value (-1 if not applicable)
     * @param total - Total progress value (-1 if not applicable)
     */
    private reportProgress;
    /**
     * Structured logging with levels
     * Per EX-003: Log all state transitions
     *
     * @param level - Log level (debug, info, warn, error)
     * @param message - Log message
     * @param data - Optional additional data
     */
    private log;
    /**
     * Start timing a phase
     *
     * @param phase - Phase name
     */
    private startPhaseTimer;
    /**
     * End timing for a phase
     *
     * @param phase - Phase name
     */
    private endPhaseTimer;
    /**
     * Get recovery strategy for a given error code
     * Per SPEC-FUNC-001 Section 4 Error Handling
     *
     * @param code - Error code to look up
     * @returns Recovery strategy or default abort strategy
     */
    private getRecoveryStrategy;
    /**
     * Execute a phase with error handling and recovery
     * Per CONSTITUTION EX-002 and SPEC-FUNC-001 Section 4
     *
     * Implements try-catch wrappers with:
     * - Retry logic for recoverable errors
     * - Fallback actions where applicable
     * - Skip strategy for non-critical errors
     * - Abort for non-recoverable errors
     *
     * @param phase - Phase to execute
     * @param operation - Async operation to execute
     * @param errorCode - Error code to use if operation fails
     * @param fallbackAction - Optional fallback action for recoverable errors
     * @returns Result of operation or null if skipped
     *
     * @remarks This method is available for use by subclasses or future refactoring
     * to wrap individual phase executions with standardized error handling.
     */
    protected safeExecutePhase<T>(phase: FinalStageState, operation: () => Promise<T>, errorCode: FinalStageErrorCode, fallbackAction?: () => Promise<T>): Promise<T | null>;
    /**
     * Cleanup partial outputs on failure
     * Per CONSTITUTION FS-003: Cleanup partial outputs on failure
     *
     * Only removes partial outputs if:
     * - Current state is FAILED
     * - Not in dry-run mode
     * - Output directory exists
     */
    private cleanup;
    /**
     * Build error result with comprehensive error info
     * Per TASK-011: Result builder with error info
     *
     * @param error - The error that caused failure
     * @returns FinalStageResult with error details
     *
     * @remarks This method provides an alternative way to build error results
     * and is available for use by subclasses or alternative error handling paths.
     */
    protected buildErrorResult(error: FinalStageError): FinalStageResult;
    /**
     * Initialize the orchestrator for execution
     * Per FS-005: Archive before overwrite
     *
     * @param options - Execution options
     * @throws FinalStageError if research directory doesn't exist or output exists without --force
     */
    private initialize;
    /**
     * Check if a directory exists
     *
     * @param dir - Directory path to check
     * @returns true if directory exists
     */
    private directoryExists;
    /**
     * Archive existing output directory
     * Per FS-005: Archive before overwrite
     * Retains only the last 5 archived versions
     */
    private archiveExistingOutput;
    /**
     * Prune archive directories, keeping only the most recent
     *
     * @param archiveDir - Base archive directory
     * @param keepCount - Number of archives to retain
     */
    private pruneArchives;
    /**
     * Initialize token budget with default allocations
     * @returns Initialized TokenBudget
     */
    private initializeTokenBudget;
    /**
     * Update token budget for a specific phase
     *
     * @param phase - Phase name
     * @param tokens - Tokens used
     */
    private updateTokenBudget;
    /**
     * Validate research slug for security (S002)
     * Prevents path traversal and injection attacks
     *
     * @param slug - Slug to validate
     * @returns Validation result with error message if invalid
     */
    private validateSlug;
    /**
     * Slugify a title for file naming (CC004 - FS-003 compliance)
     *
     * @param title - Title to slugify
     * @returns Slugified string safe for filenames
     */
    protected slugify(title: string): string;
    /**
     * Load chapter structure from 05-chapter-structure.md
     * WIRED: Parses locked structure from markdown file (TASK-009)
     *
     * @returns Parsed chapter structure
     */
    private loadChapterStructure;
    /**
     * Load synthesis guidance from 06-chapter-synthesizer.md
     * This provides detailed writing guidance for each chapter including:
     * - Research question mappings
     * - Construct definitions
     * - Anti-pattern highlighting
     * - Synthesis approach and narrative arc
     *
     * @returns Synthesis guidance content or null if not available
     */
    private loadSynthesisGuidance;
    /**
     * Extract chapter-specific synthesis guidance from the full guidance document
     *
     * @param fullGuidance - Full synthesis guidance content
     * @param chapterNumber - Chapter number to extract guidance for
     * @returns Chapter-specific guidance or null
     */
    private extractChapterGuidance;
    /**
     * Extract keywords from chapter definition
     */
    private extractKeywordsFromChapter;
    /**
     * Parse chapter structure from markdown headings when JSON not available
     */
    private parseChapterStructureFromMarkdown;
    /**
     * Load style profile if available
     * WIRED: Loads JSON style profile from multiple locations (TASK-009)
     *
     * CRITICAL: Also stores the style profile ID for ChapterWriterAgent
     * to use during LLM-based synthesis.
     *
     * Search order:
     * 1. options.styleProfileId (explicit override)
     * 2. .god-agent/style-profiles/<slug>.json
     * 3. <researchDir>/style-profile.json
     * 4. .agentdb/universal/style-profiles.json (academic-papers profile)
     *
     * @returns Style characteristics or null if not found
     */
    private loadStyleProfile;
    /**
     * Scan output files in research directory
     * WIRED: Uses SummaryExtractor component (TASK-009)
     *
     * @returns Scanner output with found files
     */
    private scanOutputFiles;
    /**
     * Extract summaries from scanned files
     * WIRED: Uses SummaryExtractor component (TASK-009)
     *
     * @param scanResult - Scan result with file info
     * @returns Array of agent output summaries
     */
    private extractSummaries;
    /**
     * Calculate total tokens used for summaries
     *
     * @param summaries - Array of summaries
     * @returns Total token count
     */
    private calculateSummaryTokens;
    /**
     * Map outputs to chapters using semantic similarity
     * WIRED: Uses SemanticMapper component (TASK-009)
     *
     * @param chapters - Chapter definitions
     * @param summaries - Agent output summaries
     * @param threshold - Similarity threshold
     * @returns Semantic mapper output
     */
    private mapOutputsToChapters;
    /**
     * Write chapters using ChapterWriterAgent
     * WIRED: Uses ChapterWriterAgent and StyleApplier components (TASK-009)
     *
     * @param structure - Chapter structure
     * @param mapping - Semantic mapping
     * @param summaries - Agent output summaries
     * @param style - Style characteristics
     * @param sequential - Execute sequentially if true
     * @returns Array of chapter writer outputs
     */
    private writeChapters;
    /**
     * Generate synthesis prompts for Claude Code to spawn chapter-synthesizer agents
     *
     * This is the PREFERRED method for high-quality output. Instead of writing
     * chapters directly (which uses basic concatenation), this generates prompts
     * that Claude Code can use to spawn the chapter-synthesizer agent for each
     * chapter.
     *
     * @param structure - Chapter structure from dissertation-architect
     * @param summaries - Output summaries from scanner
     * @param mapping - Chapter-to-source mapping
     * @returns Array of synthesis prompts for Claude Code Task tool
     */
    generateSynthesisPrompts(structure: ChapterStructure, summaries: AgentOutputSummary[], mapping: SemanticMapperOutput): Promise<import('./chapter-writer-agent.js').ChapterSynthesisPrompt[]>;
    /**
     * Combine chapters into final paper
     * WIRED: Uses PaperCombiner component (TASK-009)
     *
     * @param chapters - Written chapters
     * @param structure - Chapter structure
     * @returns Path to final paper
     */
    private combineChapters;
    /**
     * Estimate tokens used for combination phase
     *
     * @param chapters - Written chapters
     * @returns Estimated token count
     */
    private estimateCombinationTokens;
    /**
     * Validate generated outputs
     * WIRED: Validates chapters per Constitution QA-001 (TASK-009)
     *
     * @param chapters - Written chapters
     * @returns Array of warning messages
     */
    private validateOutputs;
    /**
     * Create result for dry-run mode
     *
     * @param _structure - Chapter structure (unused in stub)
     * @param scanResult - Scan result
     * @param mapping - Semantic mapping
     * @param warnings - Warning messages
     * @returns Dry-run result
     */
    private createDryRunResult;
    /**
     * Create success result
     *
     * @param outputPath - Path to final paper
     * @param chapters - Written chapters
     * @param mapping - Semantic mapping
     * @param scanResult - Scan result
     * @param warnings - Warning messages
     * @returns Success result
     */
    private createSuccessResult;
    /**
     * Create failure result
     *
     * @param error - The error that caused failure
     * @param errors - Error messages
     * @param warnings - Warning messages
     * @returns Failure result
     */
    private createFailureResult;
    /**
     * Prepare Phase 8 for Claude Code execution
     *
     * This method runs phases 8.0-8.5 (Initialize, Scan, Summarize, Map)
     * and generates synthesis prompts, but does NOT execute chapter writing.
     *
     * The returned data should be stored in memory and used by Claude Code
     * to spawn chapter-writer agents via the Task tool.
     *
     * [PHASE-8-CLAUDECODE] Integration with ClaudeFlow methodology
     *
     * @param options - Execution options
     * @returns Preparation result with synthesis prompts
     */
    prepareForClaudeCode(options?: FinalStageOptions): Promise<Phase8PrepareResult>;
    /**
     * Build a ClaudeFlow-compatible 4-part prompt for a chapter
     *
     * This transforms a ChapterSynthesisPrompt into a format suitable for
     * Claude Code's Task tool with proper WORKFLOW CONTEXT, MEMORY RETRIEVAL,
     * and MEMORY STORAGE sections per ClaudeFlow methodology.
     *
     * @param prompt - Original synthesis prompt
     * @param chapterIndex - 0-based index (for workflow context)
     * @param totalChapters - Total number of chapters
     * @param slug - Session slug for memory namespace
     * @returns ClaudeFlow-formatted prompt string
     */
    buildClaudeFlowPrompt(prompt: import('./chapter-writer-agent.js').ChapterSynthesisPrompt, chapterIndex: number, totalChapters: number, slug: string): string;
}
export {};
//# sourceMappingURL=final-stage-orchestrator.d.ts.map