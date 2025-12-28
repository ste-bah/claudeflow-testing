/**
 * ProgressLogger - Comprehensive progress reporting and logging for Phase 8
 *
 * Implements SPEC-FUNC-001 Section 4.3 (GAP-H004)
 * Constitution: EX-004 (Progress Reporting Requirement)
 *
 * Features:
 * - Multiple callback support
 * - Structured logging with levels (DEBUG, INFO, WARN, ERROR)
 * - Phase timing tracking
 * - Elapsed/remaining time estimation
 * - File-based logging (optional)
 */
import type { ProgressReport, FinalStageState } from './types.js';
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export interface LogEntry {
    timestamp: string;
    elapsed: string;
    level: LogLevel;
    phase: FinalStageState;
    message: string;
    data?: Record<string, unknown>;
}
export type ProgressCallback = (report: ProgressReport) => void;
/**
 * Progress milestones for overall progress calculation
 * Per SPEC-FUNC-001 Section 4.3
 */
export declare const PROGRESS_MILESTONES: Record<FinalStageState, {
    start: number;
    end: number;
}>;
/**
 * ProgressLogger manages progress reporting and structured logging
 *
 * Usage:
 *   const logger = new ProgressLogger({ verbose: true, outputDir: _outputDir: './final' });
 *   logger.onProgress((report) => console.log(report));
 *   logger.log('INFO', 'SCANNING', 'Found 45 files');
 *   logger.emitProgress({ phase: 'SCANNING', message: 'Found 45 files', ... });
 */
export declare class ProgressLogger {
    private readonly verbose;
    private readonly _outputDir;
    private readonly startTime;
    private readonly progressCallbacks;
    private readonly phaseTimings;
    private logFileHandle;
    private currentPhase;
    private lastPhaseProgress;
    /**
     * Create a new ProgressLogger
     *
     * @param options - Configuration options
     * @param options.verbose - Enable verbose console output
     * @param options.outputDir - Directory for log file (null to disable file logging)
     */
    constructor(options?: {
        verbose?: boolean;
        outputDir?: string | null;
    });
    /**
     * Register a progress callback
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
    clearCallbacks(): void;
    /**
     * Emit progress to all registered callbacks
     * Per EX-004: Progress reporting hooks
     *
     * @param report - Progress report to emit
     */
    emitProgress(report: ProgressReport): void;
    /**
     * Create and emit a progress report with calculated values
     *
     * @param phase - Current phase
     * @param message - Human-readable message
     * @param current - Current item index (-1 if not applicable)
     * @param total - Total items (-1 if not applicable)
     */
    report(phase: FinalStageState, message: string, current?: number, total?: number): void;
    /**
     * Log a structured message
     * Per EX-003: Log all state transitions
     *
     * @param level - Log level
     * @param phase - Current phase
     * @param message - Log message
     * @param data - Additional structured data
     */
    log(level: LogLevel, phase: FinalStageState, message: string, data?: Record<string, unknown>): void;
    /**
     * Convenience method for DEBUG level
     */
    debug(phase: FinalStageState, message: string, data?: Record<string, unknown>): void;
    /**
     * Convenience method for INFO level
     */
    info(phase: FinalStageState, message: string, data?: Record<string, unknown>): void;
    /**
     * Convenience method for WARN level
     */
    warn(phase: FinalStageState, message: string, data?: Record<string, unknown>): void;
    /**
     * Convenience method for ERROR level
     */
    error(phase: FinalStageState, message: string, data?: Record<string, unknown>): void;
    /**
     * Start timing a phase
     *
     * @param phase - Phase name
     */
    startPhase(phase: FinalStageState): void;
    /**
     * End timing for a phase
     *
     * @param phase - Phase name
     */
    endPhase(phase: FinalStageState): void;
    /**
     * Get timing for a specific phase
     *
     * @param phase - Phase name
     * @returns Duration in milliseconds, or -1 if not available
     */
    getPhaseDuration(phase: FinalStageState): number;
    /**
     * Get all phase timings
     *
     * @returns Record of phase names to duration in milliseconds
     */
    getPhaseTimings(): Record<string, number>;
    /**
     * Get elapsed time in milliseconds since logger creation
     */
    getElapsedMs(): number;
    /**
     * Get elapsed time formatted as human-readable string
     */
    getElapsedFormatted(): string;
    /**
     * Estimate remaining time based on current progress
     *
     * @param phaseProgress - Progress within current phase (0-100)
     * @returns Estimated remaining milliseconds, or -1 if unknown
     */
    estimateRemaining(phaseProgress?: number): number;
    /**
     * Calculate overall progress percentage
     *
     * @param phaseProgress - Progress within current phase (0-100)
     * @returns Overall progress (0-100)
     */
    calculateOverallProgress(phaseProgress?: number): number;
    /**
     * Initialize file logging
     *
     * @param outputDir - Directory for log file
     */
    initFileLogging(outputDir: string): Promise<void>;
    /**
     * Close file logging handle
     */
    close(): Promise<void>;
    /**
     * Generate execution summary
     *
     * @returns Formatted summary string
     */
    generateSummary(): string;
    /**
     * Create a structured log entry
     */
    private createLogEntry;
    /**
     * Write log entry to console
     */
    private writeToConsole;
    /**
     * Write to log file (async)
     */
    private writeToLogFile;
    /**
     * Format duration as human-readable string
     */
    private formatDuration;
}
export default ProgressLogger;
//# sourceMappingURL=progress-logger.d.ts.map