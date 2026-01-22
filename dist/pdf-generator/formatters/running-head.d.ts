/**
 * APA 7th Edition Running Head Formatter
 *
 * Formats running heads per APA 7th Edition requirements.
 * Supports both professional and student paper formats.
 *
 * Reference: American Psychological Association. (2020). Publication manual
 * of the American Psychological Association (7th ed.), Section 2.18.
 *
 * Key requirements:
 * - Professional papers: Running head required on all pages
 * - Student papers: Running head optional (varies by instructor)
 * - Maximum 50 characters including spaces
 * - ALL CAPS (uppercase)
 * - Positioned in header: running head flush left, page number flush right
 * - 0.5" from top of page
 * - Same font as body text
 *
 * @module pdf-generator/formatters/running-head
 */
/**
 * Input parameters for running head generation.
 */
export interface RunningHeadInput {
    /** Custom running head text (if not provided, auto-generated from title) */
    runningHead?: string;
    /** Paper title used to auto-generate running head if not explicitly provided */
    title?: string;
    /** Maximum character length (default: 50 per APA 7th) */
    maxLength?: number;
    /** Whether to include running head on title page (default: true for professional) */
    includeOnTitlePage?: boolean;
    /** Whether this is a student paper (running head optional) */
    isStudentPaper?: boolean;
}
/**
 * Formatted running head output with styling and rendering information.
 */
export interface FormattedRunningHead {
    /** The formatted running head text (ALL CAPS, truncated if necessary) */
    text: string;
    /** Original length before truncation */
    originalLength: number;
    /** Whether the text was truncated to meet max length */
    truncated: boolean;
    /** Styling information for rendering */
    styles: {
        /** Whether text is in all caps */
        allCaps: boolean;
        /** Font family */
        font: string;
        /** Font size in points */
        fontSize: number;
        /** Whether flush left aligned */
        flushLeft: boolean;
    };
    /** LaTeX header configuration */
    latex: string;
    /** HTML header markup */
    html: string;
    /** CSS for running head styling */
    css: string;
}
/**
 * Validation result for running head text.
 */
export interface RunningHeadValidation {
    /** Whether the running head is valid */
    valid: boolean;
    /** Error messages (issues that must be fixed) */
    errors: string[];
    /** Warning messages (recommendations) */
    warnings: string[];
}
/**
 * Truncates text to maximum length, preferring word boundaries.
 *
 * This function attempts to truncate at a word boundary to avoid
 * cutting words in the middle. If no suitable word boundary is found
 * within 60% of the max length, it truncates at the exact position.
 *
 * @param text - The text to truncate
 * @param maxLength - Maximum character length
 * @returns Object with truncated text and whether truncation occurred
 *
 * @example
 * ```typescript
 * truncateToMax("THE EFFECTS OF CLIMATE CHANGE ON BIODIVERSITY", 30);
 * // Returns: { text: "THE EFFECTS OF CLIMATE CHANGE", truncated: true }
 * ```
 */
export declare function truncateToMax(text: string, maxLength: number): {
    text: string;
    truncated: boolean;
};
/**
 * Generates a running head string from input parameters.
 *
 * This function either uses a provided running head or generates one
 * from the paper title. For student papers without an explicit running
 * head, returns null (as running heads are optional for student papers).
 *
 * Per APA 7th Edition:
 * - Running head should be an abbreviated title
 * - Maximum 50 characters including spaces
 * - ALL CAPS
 *
 * @param input - Running head input parameters
 * @returns The generated running head text (ALL CAPS) or null if not applicable
 *
 * @example
 * ```typescript
 * // Using explicit running head
 * generateRunningHead({ runningHead: "Climate Change Effects" });
 * // Returns: "CLIMATE CHANGE EFFECTS"
 *
 * // Auto-generating from title
 * generateRunningHead({ title: "The Long-Term Effects of Climate Change" });
 * // Returns: "THE LONG-TERM EFFECTS OF CLIMATE CHANGE"
 *
 * // Student paper without running head
 * generateRunningHead({ isStudentPaper: true });
 * // Returns: null
 * ```
 */
export declare function generateRunningHead(input: RunningHeadInput): string | null;
/**
 * Formats a running head with complete styling and rendering information.
 *
 * This is the main entry point for running head formatting. It generates
 * the running head text and provides all necessary information for
 * rendering in various output formats (LaTeX, HTML, PDF).
 *
 * @param input - Running head input parameters
 * @returns Complete formatted running head or null if not applicable
 *
 * @example
 * ```typescript
 * const result = formatRunningHead({
 *   title: "Effects of Meditation on Stress Reduction",
 *   isStudentPaper: false
 * });
 *
 * console.log(result.text);  // "EFFECTS OF MEDITATION ON STRESS REDUCTION"
 * console.log(result.truncated);  // false
 * console.log(result.latex);  // LaTeX fancyhdr configuration
 * ```
 */
export declare function formatRunningHead(input: RunningHeadInput): FormattedRunningHead | null;
/**
 * Generates CSS styles for running head formatting.
 *
 * Provides both:
 * - @page rules for print/PDF media
 * - .running-head-container styles for screen display
 *
 * Per APA 7th Edition:
 * - Header is 0.5" from top of page
 * - Running head flush left
 * - Page number flush right
 * - Same font as body text (Times New Roman 12pt)
 *
 * @returns CSS string for running head styling
 */
export declare function getRunningHeadCss(): string;
/**
 * Validates a running head against APA 7th Edition requirements.
 *
 * Checks:
 * - Running head is not empty (required for professional papers)
 * - Running head does not exceed maximum length (50 characters)
 * - Running head is in ALL CAPS (warning if not)
 *
 * @param text - The running head text to validate
 * @param maxLength - Maximum allowed length (default: 50)
 * @returns Validation result with errors and warnings
 *
 * @example
 * ```typescript
 * validateRunningHead("CLIMATE CHANGE EFFECTS");
 * // Returns: { valid: true, errors: [], warnings: [] }
 *
 * validateRunningHead("This is way too long and will exceed the fifty character limit");
 * // Returns: { valid: false, errors: ["Running head exceeds 50 characters..."], warnings: [...] }
 * ```
 */
export declare function validateRunningHead(text: string, maxLength?: number): RunningHeadValidation;
/**
 * Creates a running head from a title by abbreviating intelligently.
 *
 * This function attempts to create a meaningful abbreviation when
 * the title exceeds the maximum length by:
 * 1. Removing subtitle (after colon)
 * 2. Removing articles at the beginning
 * 3. Truncating at word boundary
 *
 * @param title - The full paper title
 * @param maxLength - Maximum character length (default: 50)
 * @returns Abbreviated running head in ALL CAPS
 *
 * @example
 * ```typescript
 * abbreviateTitle("The Effects of Climate Change on Global Biodiversity: A Meta-Analysis");
 * // Returns: "EFFECTS OF CLIMATE CHANGE ON GLOBAL BIODIVERSITY"
 * ```
 */
export declare function abbreviateTitle(title: string, maxLength?: number): string;
/**
 * Checks if a running head needs to be displayed based on paper type and page.
 *
 * @param isStudentPaper - Whether this is a student paper
 * @param hasExplicitRunningHead - Whether an explicit running head was provided
 * @param pageNumber - Current page number (1-indexed)
 * @param includeOnTitlePage - Whether to include on title page
 * @returns Whether the running head should be displayed
 */
export declare function shouldDisplayRunningHead(isStudentPaper: boolean, hasExplicitRunningHead: boolean, pageNumber: number, includeOnTitlePage?: boolean): boolean;
//# sourceMappingURL=running-head.d.ts.map