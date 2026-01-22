/**
 * Base PDF Generator Abstract Class
 *
 * Provides common functionality for all PDF generator implementations.
 * Concrete generators (Pandoc, PDFKit) extend this class.
 *
 * @module pdf-generator/generators/base-generator
 */
import type { IPdfGenerator, GeneratorType, GeneratorResult, FormattedPaper, PdfOptions, ProgressCallback, LogCallback } from '../types.js';
import { APA_CONFIG, GENERATOR_CONFIG } from '../constants.js';
/**
 * Abstract base class for PDF generators.
 * Provides common utilities and enforces the generator interface.
 */
export declare abstract class BaseGenerator implements IPdfGenerator {
    /**
     * Generator type identifier - must be implemented by subclasses.
     */
    abstract readonly type: GeneratorType;
    /**
     * Whether this generator is currently available.
     * Updated by checkAvailability().
     */
    protected _available: boolean;
    /**
     * Progress callback for reporting generation progress.
     */
    protected onProgress?: ProgressCallback;
    /**
     * Log callback for debug/info messages.
     */
    protected onLog?: LogCallback;
    /**
     * Whether this generator is currently available.
     */
    get available(): boolean;
    /**
     * Set the progress callback for generation updates.
     * @param callback - Progress callback function
     */
    setProgressCallback(callback: ProgressCallback): void;
    /**
     * Set the log callback for debug/info messages.
     * @param callback - Log callback function
     */
    setLogCallback(callback: LogCallback): void;
    /**
     * Report progress to the callback if set.
     * @param stage - Current stage name
     * @param percent - Completion percentage (0-100)
     */
    protected reportProgress(stage: string, percent: number): void;
    /**
     * Log a message to the callback if set.
     * @param level - Log level
     * @param message - Log message
     * @param data - Optional additional data
     */
    protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown): void;
    /**
     * Check if this generator is available on the current system.
     * @returns Promise resolving to availability status
     */
    abstract checkAvailability(): Promise<boolean>;
    /**
     * Generate a PDF from a formatted paper.
     * @param paper - The formatted paper to convert
     * @param options - Generation options
     * @returns Generation result
     */
    abstract generate(paper: FormattedPaper, options: PdfOptions): Promise<GeneratorResult>;
    /**
     * Clean up any temporary resources.
     * Override in subclasses if cleanup is needed.
     */
    cleanup(): Promise<void>;
    /**
     * Format a running head with page number.
     * Per APA 7th Edition: Running head (ALL CAPS) flush left, page number flush right.
     *
     * @param text - Running head text
     * @param pageNumber - Current page number
     * @returns Formatted running head string
     */
    protected formatRunningHead(text: string, pageNumber: number): string;
    /**
     * Get the complete APA configuration object.
     * @returns APA configuration
     */
    protected getApaConfig(): typeof APA_CONFIG;
    /**
     * Get generator-specific configuration.
     * @returns Generator configuration or undefined if not found
     */
    protected getGeneratorConfig(): (typeof GENERATOR_CONFIG)[keyof typeof GENERATOR_CONFIG] | undefined;
    /**
     * Create an error result.
     * @param error - The error that occurred
     * @param warnings - Any warnings collected before the error
     * @returns Generator result indicating failure
     */
    protected createErrorResult(error: Error, warnings?: string[]): GeneratorResult;
    /**
     * Create a success result.
     * @param outputPath - Path to the generated file
     * @param processingTime - Time taken in milliseconds
     * @param warnings - Any warnings during generation
     * @returns Generator result indicating success
     */
    protected createSuccessResult(outputPath: string, processingTime: number, warnings?: string[]): GeneratorResult;
    /**
     * Validate that required options are present.
     * @param options - PDF options to validate
     * @throws Error if required options are missing
     */
    protected validateOptions(options: PdfOptions): void;
    /**
     * Validate that a paper has required content.
     * @param paper - Formatted paper to validate
     * @throws Error if paper is invalid
     */
    protected validatePaper(paper: FormattedPaper): void;
    /**
     * Calculate estimated page count based on word count.
     * Assumes ~250 words per page (double-spaced, 12pt font).
     *
     * @param paper - Formatted paper
     * @returns Estimated page count
     */
    protected estimatePageCount(paper: FormattedPaper): number;
    /**
     * Format authors for display.
     * @param authors - Author information array
     * @returns Formatted author string
     */
    protected formatAuthors(authors: FormattedPaper['titlePage']['authors']): string;
    /**
     * Get unique affiliations from authors.
     * @param authors - Author information array
     * @returns Array of unique affiliations
     */
    protected getUniqueAffiliations(authors: FormattedPaper['titlePage']['authors']): string[];
    /**
     * Measure execution time of an async operation.
     * @param operation - Async operation to time
     * @returns Result and elapsed time in milliseconds
     */
    protected measureTime<T>(operation: () => Promise<T>): Promise<{
        result: T;
        elapsed: number;
    }>;
}
//# sourceMappingURL=base-generator.d.ts.map