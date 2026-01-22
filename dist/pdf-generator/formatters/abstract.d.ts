/**
 * APA 7th Edition Abstract Page Formatter
 *
 * Formats abstract pages per APA 7th Edition requirements.
 * The abstract appears on page 2, following the title page.
 *
 * Reference: American Psychological Association. (2020). Publication manual
 * of the American Psychological Association (7th ed.), Section 2.9.
 *
 * Key APA 7th Edition Abstract Requirements:
 * - "Abstract" label: centered, bold, not italicized
 * - Abstract text: single paragraph, flush left (no first-line indent), double-spaced
 * - Word limit: typically 150-250 words
 * - Keywords: Optional, placed below abstract
 * - "Keywords:" in italics, followed by lowercase keywords separated by commas
 *
 * @module pdf-generator/formatters/abstract
 */
import { FormattedAbstract } from '../types.js';
/**
 * Input for abstract formatting.
 */
export interface AbstractInput {
    /** Abstract text content */
    text: string;
    /** Optional keywords (will be formatted in lowercase, comma-separated) */
    keywords?: string[];
    /** Maximum word count (default: 250 per APA) */
    maxWords?: number;
    /** Minimum word count (default: 150 as typical recommendation) */
    minWords?: number;
}
/**
 * Result of abstract validation.
 */
export interface AbstractValidation {
    /** Whether the abstract passes validation (no errors) */
    valid: boolean;
    /** Word count of the abstract text */
    wordCount: number;
    /** Critical errors that must be fixed */
    errors: string[];
    /** Warnings about APA compliance (non-blocking) */
    warnings: string[];
}
/**
 * Extended formatted abstract with additional rendering metadata.
 */
export interface ExtendedFormattedAbstract extends FormattedAbstract {
    /** The formatted "Abstract" label */
    label: string;
    /** Formatted keywords string (if provided) */
    formattedKeywords?: string;
    /** Styling configuration */
    styles: AbstractStyles;
    /** Validation result */
    validation: AbstractValidation;
}
/**
 * Styles configuration for abstract rendering.
 */
export interface AbstractStyles {
    /** Whether the label should be bold */
    labelBold: boolean;
    /** Whether the label should be centered */
    labelCentered: boolean;
    /** Whether abstract text should have no first-line indent (APA: true) */
    noIndent: boolean;
    /** Whether content should be double-spaced */
    doubleSpaced: boolean;
    /** Whether keywords label should be italicized */
    keywordsItalicLabel: boolean;
    /** Whether keywords line should be indented */
    keywordsIndented: boolean;
    /** Font family */
    font: string;
    /** Font size in points */
    fontSize: number;
}
/**
 * Counts the number of words in a text string.
 * Words are defined as sequences of non-whitespace characters.
 *
 * @param text - The text to count words in
 * @returns Number of words in the text
 */
export declare function countWords(text: string): number;
/**
 * Validates abstract content against APA 7th Edition requirements.
 *
 * Checks:
 * - Abstract text is not empty (error)
 * - Word count is within recommended range (warning)
 * - Abstract is a single paragraph (warning)
 *
 * @param input - Abstract input to validate
 * @returns Validation result with errors and warnings
 */
export declare function validateAbstract(input: AbstractInput): AbstractValidation;
/**
 * Formats keywords per APA 7th Edition requirements.
 * Keywords should be lowercase and separated by commas.
 *
 * @param keywords - Array of keyword strings
 * @returns Formatted keywords string
 */
export declare function formatKeywords(keywords: string[]): string;
/**
 * Normalizes abstract text to a single paragraph.
 * Removes extra whitespace, collapses line breaks, and trims.
 *
 * @param text - Raw abstract text
 * @returns Normalized single-paragraph text
 */
export declare function normalizeAbstractText(text: string): string;
/**
 * Formats abstract content per APA 7th Edition requirements.
 *
 * APA 7th Edition Abstract Formatting:
 * - Starts on page 2 (after title page)
 * - "Abstract" label centered and bold (not italicized)
 * - Single paragraph with no first-line indentation
 * - Double-spaced throughout
 * - Keywords optional: "Keywords:" in italics, indented, followed by keywords
 *
 * @param input - Abstract input data
 * @returns Formatted abstract object
 */
export declare function formatAbstract(input: AbstractInput): ExtendedFormattedAbstract;
/**
 * Generates LaTeX/Markdown representation of the abstract page.
 * Uses LaTeX commands for proper APA formatting.
 *
 * @param abstract - Formatted abstract object
 * @returns Markdown/LaTeX string for abstract page
 */
export declare function generateAbstractMarkdown(abstract: ExtendedFormattedAbstract | FormattedAbstract): string;
/**
 * Generates HTML representation of the abstract page.
 * Uses semantic HTML with CSS classes for styling.
 *
 * @param abstract - Formatted abstract object
 * @returns HTML string for abstract page
 */
export declare function generateAbstractHtml(abstract: ExtendedFormattedAbstract | FormattedAbstract): string;
/**
 * Generates CSS styles for abstract page HTML output.
 * Follows APA 7th Edition formatting requirements.
 *
 * Key styles:
 * - Abstract starts on new page (page-break-before)
 * - "Abstract" heading centered and bold
 * - Abstract text has NO first-line indent (unlike body paragraphs)
 * - Keywords line is indented with italic label
 * - All content double-spaced
 *
 * @returns CSS string for abstract page styling
 */
export declare function getAbstractCss(): string;
/**
 * Validates abstract input for required fields and content.
 * More comprehensive than validateAbstract - checks input structure.
 *
 * @param input - Abstract input to validate
 * @returns Object with valid flag and error messages
 */
export declare function validateAbstractInput(input: AbstractInput): {
    valid: boolean;
    errors: string[];
    warnings: string[];
};
/**
 * Checks if the abstract word count is within APA recommended limits.
 *
 * @param text - Abstract text to check
 * @param min - Minimum words (default: 150)
 * @param max - Maximum words (default: 250)
 * @returns Object with in-range flag and actual count
 */
export declare function isWordCountInRange(text: string, min?: number, max?: number): {
    inRange: boolean;
    wordCount: number;
    min: number;
    max: number;
};
//# sourceMappingURL=abstract.d.ts.map