/**
 * APA 7th Edition References Formatter
 *
 * Formats reference lists per APA 7th Edition requirements.
 * Handles alphabetical sorting, hanging indents, and DOI hyperlinking.
 *
 * Reference: American Psychological Association. (2020). Publication manual
 * of the American Psychological Association (7th ed.), Sections 2.12, 9.43.
 *
 * Key APA 7th Edition References Requirements:
 * - "References" heading: centered, bold (same as Level 1 heading)
 * - New page (page break before references section)
 * - Hanging indent: first line flush left, subsequent lines indented 0.5"
 * - Double-spaced within and between entries
 * - Alphabetical order by first author surname (then by year for same author)
 * - DOI format: https://doi.org/xxxxx (as hyperlink when possible)
 *
 * @module pdf-generator/formatters/references
 */
import { FormattedReferences } from '../types.js';
/**
 * Parsed reference with extracted metadata for sorting and formatting.
 */
export interface Reference {
    /** Original raw reference text */
    raw: string;
    /** First author's surname for sorting */
    authors?: string;
    /** Publication year for secondary sorting */
    year?: string;
    /** Work title (if extractable) */
    title?: string;
    /** Source/journal (if extractable) */
    source?: string;
    /** DOI (normalized to https://doi.org/... format) */
    doi?: string;
    /** URL (if not a DOI) */
    url?: string;
    /** Whether parsing was successful */
    parsed: boolean;
}
/**
 * Input for references formatting.
 */
export interface ReferencesInput {
    /** Array of raw reference strings */
    references: string[];
    /** Whether to sort alphabetically by author (default: true per APA) */
    sortAlphabetically?: boolean;
}
/**
 * Extended formatted references with additional rendering metadata.
 */
export interface ExtendedFormattedReferences extends FormattedReferences {
    /** Section label ("References") */
    label: string;
    /** Styling configuration */
    styles: ReferencesStyles;
}
/**
 * Styles configuration for references rendering.
 */
export interface ReferencesStyles {
    /** Whether the label should be bold */
    labelBold: boolean;
    /** Whether the label should be centered */
    labelCentered: boolean;
    /** Hanging indent value (e.g., "0.5in") */
    hangingIndent: string;
    /** Whether content should be double-spaced */
    doubleSpaced: boolean;
    /** Font family */
    font: string;
    /** Font size in points */
    fontSize: number;
}
/**
 * Parses a raw reference string to extract metadata for sorting.
 *
 * Extracts:
 * - First author surname (for primary sort)
 * - Publication year (for secondary sort)
 * - DOI (for hyperlinking)
 * - URL (if not a DOI)
 *
 * @param rawRef - Raw reference string
 * @returns Parsed reference with extracted metadata
 *
 * @example
 * const ref = parseReference('Smith, J. A. (2020). Title. Journal. https://doi.org/10.1234/abc');
 * // ref.authors = 'Smith'
 * // ref.year = '2020'
 * // ref.doi = 'https://doi.org/10.1234/abc'
 */
export declare function parseReference(rawRef: string): Reference;
/**
 * Sorts references alphabetically per APA 7th Edition requirements.
 *
 * Sorting rules:
 * 1. Primary: First author surname (case-insensitive)
 * 2. Secondary: Same author sorted by year (oldest first)
 * 3. Tertiary: Same author, same year sorted by suffix (2020a before 2020b)
 *
 * @param references - Array of parsed references
 * @returns New array sorted per APA requirements
 *
 * @example
 * const refs = [parseReference('Zebra, A. (2020)...'), parseReference('Adams, B. (2019)...')];
 * const sorted = sortReferences(refs);
 * // sorted[0].authors = 'Adams', sorted[1].authors = 'Zebra'
 */
export declare function sortReferences(references: Reference[]): Reference[];
/**
 * Formats a DOI to the standard https://doi.org/ URL format.
 *
 * @param doi - DOI in any common format
 * @returns DOI as full HTTPS URL
 *
 * @example
 * formatDoi('10.1234/abc')           // 'https://doi.org/10.1234/abc'
 * formatDoi('doi: 10.1234/abc')      // 'https://doi.org/10.1234/abc'
 * formatDoi('https://doi.org/10.1234/abc') // unchanged
 */
export declare function formatDoi(doi: string): string;
/**
 * Formats references per APA 7th Edition requirements.
 *
 * APA 7th Edition References Formatting:
 * - "References" heading centered and bold
 * - Start on new page
 * - Hanging indent: 0.5 inches
 * - Double-spaced throughout
 * - Alphabetical by first author surname
 * - DOIs formatted as https://doi.org/ URLs
 *
 * @param input - References input data
 * @returns Formatted references object
 *
 * @example
 * const result = formatReferences({
 *   references: [
 *     'Zebra, A. (2020). Title. Journal. https://doi.org/10.1234',
 *     'Adams, B. (2019). Another title. Publisher.'
 *   ]
 * });
 * // result.entries[0] starts with Adams, result.entries[1] starts with Zebra
 */
export declare function formatReferences(input: ReferencesInput): ExtendedFormattedReferences;
/**
 * Generates LaTeX/Markdown representation of the references page.
 * Uses LaTeX commands for proper APA formatting with hanging indents.
 *
 * @param refs - Formatted references object
 * @returns Markdown/LaTeX string for references page
 */
export declare function generateReferencesMarkdown(refs: ExtendedFormattedReferences | FormattedReferences): string;
/**
 * Generates HTML representation of the references page.
 * Uses semantic HTML with CSS classes for styling.
 *
 * @param refs - Formatted references object
 * @returns HTML string for references page
 */
export declare function generateReferencesHtml(refs: ExtendedFormattedReferences | FormattedReferences): string;
/**
 * Generates CSS styles for references page HTML output.
 * Follows APA 7th Edition formatting requirements.
 *
 * Key styles:
 * - References start on new page (page-break-before)
 * - "References" heading centered and bold
 * - Hanging indent: first line flush left, subsequent indented 0.5"
 * - Double-spaced throughout
 * - DOI links styled without underline (per typical academic formatting)
 *
 * @returns CSS string for references page styling
 */
export declare function getReferencesCss(): string;
/**
 * Validates reference entries for common formatting issues.
 *
 * @param references - Array of reference strings
 * @returns Validation result with warnings
 */
export declare function validateReferences(references: string[]): {
    valid: boolean;
    count: number;
    warnings: string[];
};
/**
 * Extracts all DOIs from a list of references.
 * Useful for DOI validation or link checking.
 *
 * @param references - Array of reference strings
 * @returns Array of extracted DOI URLs
 */
export declare function extractDois(references: string[]): string[];
/**
 * Counts unique authors in reference list.
 * Useful for statistics and validation.
 *
 * @param references - Array of reference strings
 * @returns Count of unique first authors
 */
export declare function countUniqueAuthors(references: string[]): number;
//# sourceMappingURL=references.d.ts.map