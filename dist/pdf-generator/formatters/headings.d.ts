/**
 * APA 7th Edition Headings Formatter
 *
 * Implements all 5 APA heading levels with correct formatting per APA 7th Edition.
 * Auto-detects heading levels from Markdown (# through #####) and applies
 * appropriate formatting.
 *
 * Reference: American Psychological Association. (2020). Publication manual
 * of the American Psychological Association (7th ed.), Section 2.27.
 *
 * APA 7th Heading Levels:
 * - Level 1: Centered, Bold, Title Case
 * - Level 2: Flush Left, Bold, Title Case
 * - Level 3: Flush Left, Bold Italic, Title Case
 * - Level 4: Indented 0.5", Bold, Title Case, Ends with Period. Text continues.
 * - Level 5: Indented 0.5", Bold Italic, Title Case, Ends with Period. Text continues.
 *
 * @module pdf-generator/formatters/headings
 */
import { APA_HEADING_STYLES } from '../constants.js';
/**
 * Valid heading levels (1-5) per APA 7th Edition.
 */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5;
/**
 * Heading style configuration for a specific level.
 */
export interface HeadingStyle {
    /** Heading level (1-5) */
    level: HeadingLevel;
    /** Text alignment: 'center' for Level 1, 'left' for others */
    alignment: 'center' | 'left';
    /** Whether heading text is bold */
    bold: boolean;
    /** Whether heading text is italic */
    italic: boolean;
    /** Whether heading is indented 0.5" (Levels 4-5) */
    indent: boolean;
    /** Whether heading ends with a period (Levels 4-5) */
    periodAfter: boolean;
    /** Whether paragraph text continues on same line (Levels 4-5) */
    textContinues: boolean;
}
/**
 * Heading style definitions for all 5 APA levels.
 * Derived from APA 7th Edition Section 2.27.
 */
export declare const HEADING_STYLES: Record<HeadingLevel, HeadingStyle>;
/**
 * Formatted heading with all output representations.
 */
export interface FormattedHeading {
    /** Original heading level */
    level: HeadingLevel;
    /** Original text before formatting */
    text: string;
    /** Formatted text with title case and period (if applicable) */
    formattedText: string;
    /** Style configuration for this level */
    style: HeadingStyle;
    /** Markdown/LaTeX representation */
    markdown: string;
    /** HTML representation */
    html: string;
    /** Pure LaTeX representation */
    latex: string;
}
/**
 * Detects heading level from a Markdown line.
 * Matches # through ##### at the start of line.
 *
 * @param markdownLine - A line of Markdown text
 * @returns Heading level (1-5) or null if not a heading
 *
 * @example
 * detectHeadingLevel('# Introduction')      // returns 1
 * detectHeadingLevel('### Methods')         // returns 3
 * detectHeadingLevel('Regular paragraph')   // returns null
 * detectHeadingLevel('###### Too deep')     // returns null (only 5 levels)
 */
export declare function detectHeadingLevel(markdownLine: string): HeadingLevel | null;
/**
 * Extracts the heading text from a Markdown heading line.
 * Removes the leading hash symbols and whitespace.
 *
 * @param markdownLine - A Markdown heading line
 * @returns The heading text without Markdown syntax
 *
 * @example
 * extractHeadingText('# Introduction')  // returns 'Introduction'
 * extractHeadingText('### Methods')     // returns 'Methods'
 * extractHeadingText('Plain text')      // returns 'Plain text' (passthrough)
 */
export declare function extractHeadingText(markdownLine: string): string;
/**
 * Formats a heading according to APA 7th Edition requirements.
 * Applies title case, adds period for levels 4-5, and generates
 * multiple output formats (Markdown, HTML, LaTeX).
 *
 * @param text - The heading text (without Markdown syntax)
 * @param level - The heading level (1-5)
 * @returns FormattedHeading object with all representations
 *
 * @example
 * const heading = formatHeading('research methods', 1);
 * // heading.formattedText = 'Research Methods'
 * // heading.style.alignment = 'center'
 *
 * const subheading = formatHeading('data collection', 4);
 * // subheading.formattedText = 'Data Collection.'
 * // subheading.style.indent = true
 */
export declare function formatHeading(text: string, level: HeadingLevel): FormattedHeading;
/**
 * Formats a Markdown heading line directly.
 * Combines detection, extraction, and formatting.
 *
 * @param markdownLine - A Markdown heading line (e.g., '# Introduction')
 * @returns FormattedHeading or null if not a valid heading
 */
export declare function formatMarkdownHeading(markdownLine: string): FormattedHeading | null;
/**
 * Processes all headings in a Markdown document.
 * Converts Markdown headings to APA-formatted headings.
 *
 * @param markdown - Full Markdown document content
 * @returns Processed document with APA-formatted headings
 *
 * @example
 * const input = '# Introduction\nSome text\n## Background';
 * const output = processHeadings(input);
 * // Headings are now formatted per APA 7th Edition
 */
export declare function processHeadings(markdown: string): string;
/**
 * Extracts all headings from a Markdown document.
 * Useful for generating a table of contents.
 *
 * @param markdown - Full Markdown document content
 * @returns Array of FormattedHeading objects in document order
 */
export declare function extractAllHeadings(markdown: string): FormattedHeading[];
/**
 * FormattedSection type matching the types.ts definition.
 * Represents a hierarchical section with content and subsections.
 */
export interface FormattedSectionOutput {
    level: 1 | 2 | 3 | 4 | 5;
    title: string;
    content: string;
    subsections?: FormattedSectionOutput[];
}
/**
 * Parses a Markdown document into hierarchical sections.
 * Extracts headings, their content, and builds nested structure.
 *
 * @param markdown - Full Markdown document content
 * @returns Array of FormattedSection objects with content and subsections
 *
 * @example
 * const markdown = `
 * # Chapter 1
 * Introduction text here.
 *
 * ## Section 1.1
 * Section content.
 *
 * # Chapter 2
 * Another chapter.
 * `;
 * const sections = parseMarkdownToSections(markdown);
 * // Returns:
 * // [
 * //   { level: 1, title: 'Chapter 1', content: 'Introduction text here.\n\n',
 * //     subsections: [{ level: 2, title: 'Section 1.1', content: 'Section content.\n\n' }] },
 * //   { level: 1, title: 'Chapter 2', content: 'Another chapter.\n' }
 * // ]
 */
export declare function parseMarkdownToSections(markdown: string): FormattedSectionOutput[];
/**
 * Validates heading hierarchy in a document.
 * Checks that headings follow proper nesting (no skipping levels).
 *
 * @param headings - Array of formatted headings
 * @returns Validation result with any hierarchy issues
 */
export declare function validateHeadingHierarchy(headings: FormattedHeading[]): {
    valid: boolean;
    issues: string[];
};
/**
 * Generates CSS styles for APA 7th Edition headings.
 * Use with HTML output for proper formatting.
 *
 * @returns CSS string for heading styling
 */
export declare function getHeadingsCss(): string;
/**
 * Gets the APA heading style configuration from constants.
 *
 * @param level - Heading level (1-5)
 * @returns Heading style from APA_HEADING_STYLES constant
 */
export declare function getApaHeadingStyle(level: HeadingLevel): (typeof APA_HEADING_STYLES)[keyof typeof APA_HEADING_STYLES];
/**
 * Converts a heading level number to its APA description.
 *
 * @param level - Heading level (1-5)
 * @returns Human-readable description of the heading format
 */
export declare function describeHeadingLevel(level: HeadingLevel): string;
//# sourceMappingURL=headings.d.ts.map