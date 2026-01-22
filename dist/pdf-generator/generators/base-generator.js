/**
 * Base PDF Generator Abstract Class
 *
 * Provides common functionality for all PDF generator implementations.
 * Concrete generators (Pandoc, PDFKit) extend this class.
 *
 * @module pdf-generator/generators/base-generator
 */
import { APA_CONFIG, GENERATOR_CONFIG } from '../constants.js';
// =============================================================================
// ABSTRACT BASE CLASS
// =============================================================================
/**
 * Abstract base class for PDF generators.
 * Provides common utilities and enforces the generator interface.
 */
export class BaseGenerator {
    /**
     * Whether this generator is currently available.
     * Updated by checkAvailability().
     */
    _available = false;
    /**
     * Progress callback for reporting generation progress.
     */
    onProgress;
    /**
     * Log callback for debug/info messages.
     */
    onLog;
    /**
     * Whether this generator is currently available.
     */
    get available() {
        return this._available;
    }
    // ===========================================================================
    // CALLBACK MANAGEMENT
    // ===========================================================================
    /**
     * Set the progress callback for generation updates.
     * @param callback - Progress callback function
     */
    setProgressCallback(callback) {
        this.onProgress = callback;
    }
    /**
     * Set the log callback for debug/info messages.
     * @param callback - Log callback function
     */
    setLogCallback(callback) {
        this.onLog = callback;
    }
    /**
     * Report progress to the callback if set.
     * @param stage - Current stage name
     * @param percent - Completion percentage (0-100)
     */
    reportProgress(stage, percent) {
        this.onProgress?.(stage, Math.min(100, Math.max(0, percent)));
    }
    /**
     * Log a message to the callback if set.
     * @param level - Log level
     * @param message - Log message
     * @param data - Optional additional data
     */
    log(level, message, data) {
        this.onLog?.(level, `[${this.type}] ${message}`, data);
    }
    // ===========================================================================
    // OPTIONAL OVERRIDES
    // ===========================================================================
    /**
     * Clean up any temporary resources.
     * Override in subclasses if cleanup is needed.
     */
    async cleanup() {
        // Default: no cleanup needed
        this.log('debug', 'Cleanup called (no-op in base class)');
    }
    // ===========================================================================
    // SHARED UTILITIES
    // ===========================================================================
    /**
     * Format a running head with page number.
     * Per APA 7th Edition: Running head (ALL CAPS) flush left, page number flush right.
     *
     * @param text - Running head text
     * @param pageNumber - Current page number
     * @returns Formatted running head string
     */
    formatRunningHead(text, pageNumber) {
        const maxLength = APA_CONFIG.runningHead.maxLength;
        const head = text.substring(0, maxLength).toUpperCase();
        // Return structured format - actual spacing handled by generator
        return `${head}|${pageNumber}`;
    }
    /**
     * Get the complete APA configuration object.
     * @returns APA configuration
     */
    getApaConfig() {
        return APA_CONFIG;
    }
    /**
     * Get generator-specific configuration.
     * @returns Generator configuration or undefined if not found
     */
    getGeneratorConfig() {
        return GENERATOR_CONFIG[this.type];
    }
    /**
     * Create an error result.
     * @param error - The error that occurred
     * @param warnings - Any warnings collected before the error
     * @returns Generator result indicating failure
     */
    createErrorResult(error, warnings = []) {
        this.log('error', `Generation failed: ${error.message}`, error);
        return {
            success: false,
            error,
            generator: this.type,
            processingTime: 0,
            warnings,
        };
    }
    /**
     * Create a success result.
     * @param outputPath - Path to the generated file
     * @param processingTime - Time taken in milliseconds
     * @param warnings - Any warnings during generation
     * @returns Generator result indicating success
     */
    createSuccessResult(outputPath, processingTime, warnings = []) {
        this.log('info', `Generation succeeded: ${outputPath} (${processingTime}ms)`);
        return {
            success: true,
            outputPath,
            generator: this.type,
            processingTime,
            warnings,
        };
    }
    /**
     * Validate that required options are present.
     * @param options - PDF options to validate
     * @throws Error if required options are missing
     */
    validateOptions(options) {
        if (!options.outputPath) {
            throw new Error('Output path is required');
        }
        if (!options.outputPath.endsWith('.pdf') && options.format !== 'docx') {
            this.log('warn', 'Output path does not end with .pdf extension');
        }
    }
    /**
     * Validate that a paper has required content.
     * @param paper - Formatted paper to validate
     * @throws Error if paper is invalid
     */
    validatePaper(paper) {
        if (!paper) {
            throw new Error('Paper is required');
        }
        if (!paper.titlePage) {
            throw new Error('Paper title page is required');
        }
        if (!paper.titlePage.title) {
            throw new Error('Paper title is required');
        }
        if (!paper.body) {
            throw new Error('Paper body is required');
        }
    }
    /**
     * Calculate estimated page count based on word count.
     * Assumes ~250 words per page (double-spaced, 12pt font).
     *
     * @param paper - Formatted paper
     * @returns Estimated page count
     */
    estimatePageCount(paper) {
        const wordsPerPage = 250; // Standard estimate for APA format
        let totalWords = 0;
        // Title page always counts as 1
        let pages = 1;
        // Abstract page
        if (paper.abstract) {
            pages += 1;
            totalWords += paper.abstract.wordCount;
        }
        // Estimate body content words
        if (paper.body.content) {
            const bodyWords = paper.body.content
                .replace(/<[^>]*>/g, '') // Remove HTML tags
                .replace(/[#*_`]/g, '') // Remove markdown
                .split(/\s+/)
                .filter((w) => w.length > 0).length;
            totalWords += bodyWords;
        }
        // Add body pages
        pages += Math.ceil(totalWords / wordsPerPage);
        // References page(s)
        if (paper.references && paper.references.count > 0) {
            // Estimate ~5 references per page
            pages += Math.ceil(paper.references.count / 5);
        }
        // Appendix pages
        if (paper.appendices) {
            pages += paper.appendices.length;
        }
        return pages;
    }
    /**
     * Format authors for display.
     * @param authors - Author information array
     * @returns Formatted author string
     */
    formatAuthors(authors) {
        if (!authors || authors.length === 0) {
            return '';
        }
        if (authors.length === 1) {
            return authors[0].name;
        }
        if (authors.length === 2) {
            return `${authors[0].name} and ${authors[1].name}`;
        }
        // 3+ authors: First, Second, ... and Last
        const lastAuthor = authors[authors.length - 1];
        const otherAuthors = authors.slice(0, -1);
        return `${otherAuthors.map((a) => a.name).join(', ')}, and ${lastAuthor.name}`;
    }
    /**
     * Get unique affiliations from authors.
     * @param authors - Author information array
     * @returns Array of unique affiliations
     */
    getUniqueAffiliations(authors) {
        const affiliations = new Set();
        for (const author of authors) {
            if (author.affiliation) {
                affiliations.add(author.affiliation);
            }
        }
        return Array.from(affiliations);
    }
    /**
     * Measure execution time of an async operation.
     * @param operation - Async operation to time
     * @returns Result and elapsed time in milliseconds
     */
    async measureTime(operation) {
        const start = performance.now();
        const result = await operation();
        const elapsed = Math.round(performance.now() - start);
        return { result, elapsed };
    }
}
//# sourceMappingURL=base-generator.js.map