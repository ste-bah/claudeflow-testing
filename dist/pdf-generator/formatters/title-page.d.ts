/**
 * APA 7th Edition Title Page Formatter
 *
 * Formats title pages per APA 7th Edition professional paper requirements.
 * Supports both professional and student paper formats.
 *
 * Reference: American Psychological Association. (2020). Publication manual
 * of the American Psychological Association (7th ed.), Sections 2.3-2.8.
 *
 * @module pdf-generator/formatters/title-page
 */
import { FormattedTitlePage } from '../types.js';
import { AuthorInfo } from '../utils/validation.js';
/**
 * Extended author information for title page formatting.
 * Extends base AuthorInfo with additional name components for APA formatting.
 */
export interface TitlePageAuthorInfo extends AuthorInfo {
    /** First name (given name) */
    firstName?: string;
    /** Middle name or initial */
    middleName?: string;
    /** Last name (family name/surname) */
    lastName?: string;
    /** Department within institution */
    department?: string;
    /** Institution/University name */
    institution?: string;
}
/**
 * Input for title page formatting.
 */
export interface TitlePageInput {
    /** Paper title (will be converted to title case) */
    title: string;
    /** Author information array */
    authors: TitlePageAuthorInfo[];
    /** Institutional affiliations (overrides author affiliations if provided) */
    affiliations?: string[];
    /** Course number (e.g., "PSY 101") - for student papers */
    courseNumber?: string;
    /** Course name (e.g., "Introduction to Psychology") - for student papers */
    courseName?: string;
    /** Instructor name - for student papers */
    instructorName?: string;
    /** Assignment due date - for student papers */
    dueDate?: string;
    /** Whether this is a student paper (vs professional paper) */
    isStudentPaper?: boolean;
    /** Custom running head (auto-generated from title if not provided) */
    runningHead?: string;
    /** Author note content - for professional papers */
    authorNote?: string;
}
/**
 * Styles configuration for title page rendering.
 */
export interface TitlePageStyles {
    /** Whether title should be bold */
    titleBold: boolean;
    /** Whether content should be centered */
    centered: boolean;
    /** Whether content should be double-spaced */
    doubleSpaced: boolean;
    /** Font family */
    font: string;
    /** Font size in points */
    fontSize: number;
}
/**
 * Extended formatted title page with additional metadata.
 * Extends the base FormattedTitlePage for internal use.
 */
export interface ExtendedFormattedTitlePage extends FormattedTitlePage {
    /** Course information (combined course number and name) */
    courseInfo?: string;
    /** Instructor name */
    instructor?: string;
    /** Due date string */
    dueDate?: string;
    /** Pre-formatted lines for rendering */
    formatted: string[];
    /** Styling configuration */
    styles: TitlePageStyles;
    /** Whether this is a student paper */
    isStudentPaper: boolean;
}
/**
 * Formats a string in APA title case.
 *
 * Rules per APA 7th Edition:
 * - Capitalize the first word of the title
 * - Capitalize all major words (nouns, verbs, adjectives, adverbs, etc.)
 * - Lowercase articles (a, an, the), short prepositions (< 4 letters),
 *   and coordinating conjunctions (and, but, or, etc.)
 * - Always capitalize the first word after a colon or em dash
 * - Always capitalize the last word
 *
 * @param text - The text to format
 * @returns Title case formatted string
 */
export declare function formatTitleCase(text: string): string;
/**
 * Formats a single author name per APA 7th Edition requirements.
 * Uses first name, middle initial (with period), and last name.
 * No titles, degrees, or suffixes.
 *
 * @param author - Author information
 * @returns Formatted author name string
 */
export declare function formatAuthorName(author: TitlePageAuthorInfo): string;
/**
 * Formats a list of authors for title page display.
 * Handles single author, two authors (with "and"), and multiple authors
 * (with Oxford comma and "and" before last).
 *
 * @param authors - Array of author information
 * @returns Array of formatted author lines (typically one line)
 */
export declare function formatAuthorList(authors: TitlePageAuthorInfo[]): string[];
/**
 * Formats affiliations for title page display.
 * If explicit affiliations are provided, use those.
 * Otherwise, extract unique affiliations from authors.
 *
 * Per APA 7th Edition:
 * - Department and university on separate lines for each affiliation
 * - Multiple affiliations listed in order of authors
 *
 * @param authors - Array of author information
 * @param affiliations - Optional explicit affiliations array
 * @returns Array of affiliation lines
 */
export declare function formatAffiliations(authors: TitlePageAuthorInfo[], affiliations?: string[]): string[];
/**
 * Generates a running head from the paper title.
 * Per APA 7th Edition: Abbreviated title, ALL CAPS, max 50 characters.
 *
 * @param title - Paper title
 * @param maxLength - Maximum length (default 50)
 * @returns Running head string
 */
export declare function generateRunningHead(title: string, maxLength?: number): string;
/**
 * Formats a complete title page per APA 7th Edition requirements.
 *
 * For professional papers:
 * - Title (bold, centered, upper half of page)
 * - Author name(s)
 * - Affiliation(s)
 * - Author note (optional)
 * - Running head with page number
 *
 * For student papers:
 * - Title (bold, centered)
 * - Author name(s)
 * - Affiliation(s)
 * - Course number and name
 * - Instructor name
 * - Assignment due date
 *
 * @param input - Title page input data
 * @returns Formatted title page object
 */
export declare function formatTitlePage(input: TitlePageInput): ExtendedFormattedTitlePage;
/**
 * Generates LaTeX/Markdown representation of the title page.
 * Uses LaTeX commands for proper APA formatting.
 *
 * @param titlePage - Formatted title page object
 * @returns Markdown/LaTeX string for title page
 */
export declare function generateTitlePageMarkdown(titlePage: ExtendedFormattedTitlePage | FormattedTitlePage): string;
/**
 * Generates HTML representation of the title page.
 * Uses semantic HTML with CSS classes for styling.
 *
 * @param titlePage - Formatted title page object
 * @returns HTML string for title page
 */
export declare function generateTitlePageHtml(titlePage: ExtendedFormattedTitlePage | FormattedTitlePage): string;
/**
 * Generates CSS styles for title page HTML output.
 * Follows APA 7th Edition formatting requirements.
 *
 * @returns CSS string for title page styling
 */
export declare function getTitlePageCss(): string;
/**
 * Validates title page input for required fields.
 *
 * @param input - Title page input to validate
 * @returns Object with valid flag and error messages
 */
export declare function validateTitlePageInput(input: TitlePageInput): {
    valid: boolean;
    errors: string[];
};
//# sourceMappingURL=title-page.d.ts.map