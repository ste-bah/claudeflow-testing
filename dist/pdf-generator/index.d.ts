/**
 * PDF Generator Module - Public API Entry Point
 *
 * APA 7th Edition compliant PDF generation with automatic
 * capability detection and fallback support.
 *
 * This module provides:
 * - Unified `generatePdf()` function for simple usage
 * - `APAPdfGenerator` class for object-oriented usage
 * - Re-exports of all types, constants, and formatters
 *
 * @module pdf-generator
 */
export type { GeneratorType, GeneratorResult, IPdfGenerator, PdfOptions, FormattedPaper, FormattedTitlePage, FormattedAbstract, FormattedBody, FormattedSection, FormattedReferences, FormattedAppendix, PaperMetadata, FormatterOptions, FormatterResult, PipelineOptions, PipelineResult, ProgressCallback, LogCallback, } from './types.js';
export type { AuthorInfo, PaperInput, ValidationResult, ValidationError, ValidationWarning, } from './types.js';
export { APA_MARGINS, APA_FONTS, APA_SPACING, APA_RUNNING_HEAD, APA_TITLE_PAGE, APA_ABSTRACT, APA_HEADING_STYLES, APA_REFERENCES, APA_SECTION_ORDER, APA_TABLES, APA_FIGURES, APA_APPENDICES, APA_VALIDATION_LIMITS, GENERATOR_PRIORITY, GENERATOR_CONFIG, APA_CONFIG, } from './constants.js';
export type { ApaMargins, ApaFonts, ApaSpacing, ApaSectionName, ApaHeadingStyles, ApaConfig, } from './constants.js';
export { detectCapabilities, createGenerator, createGeneratorSync, getRecommendedGeneratorType, PandocGenerator, PdfKitGenerator, } from './factory.js';
export type { GeneratorCapabilities } from './factory.js';
export { formatTitlePage, generateTitlePageMarkdown, generateTitlePageHtml, getTitlePageCss, formatTitleCase, } from './formatters/title-page.js';
export type { TitlePageInput, ExtendedFormattedTitlePage, } from './formatters/title-page.js';
export { formatAbstract, generateAbstractMarkdown, generateAbstractHtml, getAbstractCss, validateAbstract as validateAbstractFormat, countWords, formatKeywords, normalizeAbstractText, } from './formatters/abstract.js';
export type { AbstractInput, AbstractValidation, ExtendedFormattedAbstract, } from './formatters/abstract.js';
export { formatHeading, formatMarkdownHeading, processHeadings, extractAllHeadings, validateHeadingHierarchy, getHeadingsCss, detectHeadingLevel, extractHeadingText, getApaHeadingStyle, describeHeadingLevel, HEADING_STYLES, } from './formatters/headings.js';
export type { HeadingLevel, HeadingStyle, FormattedHeading, } from './formatters/headings.js';
export { formatReferences, generateReferencesMarkdown, generateReferencesHtml, getReferencesCss, parseReference, sortReferences, formatDoi, validateReferences, extractDois, countUniqueAuthors, } from './formatters/references.js';
export type { ReferencesInput, Reference, ExtendedFormattedReferences, ReferencesStyles, } from './formatters/references.js';
export { formatRunningHead, generateRunningHead, getRunningHeadCss, validateRunningHead as validateRunningHeadFormat, truncateToMax, abbreviateTitle, shouldDisplayRunningHead, } from './formatters/running-head.js';
export type { RunningHeadInput, FormattedRunningHead, RunningHeadValidation, } from './formatters/running-head.js';
export { validatePaper, validateAuthor, validateTitle, validateAbstract as validateAbstractContent, validateRunningHead as validateRunningHeadContent, validateReference, validateHeadingLevel, mergeValidationResults, isValidRunningHead, isValidAbstract, isValidTitle, isValidPaper, isValidOrcid, isUppercase, countWords as countWordsValidation, getErrorsOnly, getWarningsOnly, formatValidationResult, ValidationErrorCodes, ValidationWarningCodes, } from './utils/validation.js';
export { BaseGenerator } from './generators/base-generator.js';
export type { PdfGeneratorConfig, ConfigValidationResult, PreferredGenerator, LogLevel, MarginConfig, FontConfig, } from './config.js';
export { ConfigManager, loadConfig, getConfig, configure, validateConfig, resetConfig, DEFAULT_CONFIG, } from './config.js';
/**
 * Options for PDF generation.
 */
export interface GeneratePdfOptions {
    /** Paper content and metadata */
    paper: PaperInputForGeneration;
    /** Output file path (without extension) */
    outputPath: string;
    /** Preferred generator type (auto-detected if not specified) */
    preferredGenerator?: import('./types.js').GeneratorType;
    /** Additional PDF options */
    pdfOptions?: Partial<import('./types.js').PdfOptions>;
    /** Progress callback */
    onProgress?: (percent: number, message: string) => void;
    /** Log callback */
    onLog?: (level: 'info' | 'warn' | 'error', message: string) => void;
}
/**
 * Paper input structure for generation.
 * Combines title page, abstract, body, and references.
 */
export interface PaperInputForGeneration {
    /** Paper title */
    title: string;
    /** Running head (max 50 chars, will be auto-shortened if needed) */
    runningHead?: string;
    /** Authors (at least one required) */
    authors: Array<{
        name: string;
        affiliationIds?: number[];
        orcid?: string;
        correspondingAuthor?: boolean;
        email?: string;
    }>;
    /** Affiliations */
    affiliations?: Array<{
        id: number;
        name: string;
        department?: string;
        city?: string;
        state?: string;
        country?: string;
    }>;
    /** Author note (optional) */
    authorNote?: string;
    /** Abstract text */
    abstract: string;
    /** Keywords (optional) */
    keywords?: string[];
    /** Body content (markdown) */
    body: string;
    /** References (formatted strings) */
    references?: string[];
    /** Course information (for student papers) */
    course?: string;
    /** Instructor name (for student papers) */
    instructor?: string;
    /** Due date (for student papers) */
    dueDate?: string;
}
/**
 * Result of PDF generation.
 */
export interface GeneratePdfResult {
    /** Whether generation succeeded */
    success: boolean;
    /** Path to generated PDF (if successful) */
    outputPath?: string;
    /** Generator type that was used */
    generatorUsed: import('./types.js').GeneratorType;
    /** Any warnings during generation */
    warnings: string[];
    /** Error message (if failed) */
    error?: string;
    /** Generation duration in milliseconds */
    durationMs?: number;
}
import { type GeneratorCapabilities } from './factory.js';
import type { GeneratorType } from './types.js';
/**
 * Generates an APA 7th Edition formatted PDF from paper content.
 *
 * Orchestrates the full workflow:
 * 1. Detect capabilities and create appropriate generator
 * 2. Format title page
 * 3. Format abstract
 * 4. Process headings in body
 * 5. Format references
 * 6. Generate running head
 * 7. Assemble full document
 * 8. Generate PDF
 *
 * @param options - Generation options
 * @returns Generation result with success status and warnings
 *
 * @example
 * ```typescript
 * const result = await generatePdf({
 *   paper: {
 *     title: 'Effects of Sleep on Memory',
 *     authors: [{ name: 'Jane Smith', affiliationIds: [1] }],
 *     affiliations: [{ id: 1, name: 'University of Example' }],
 *     abstract: 'This study examines...',
 *     body: '# Introduction\n\nSleep plays a crucial role...',
 *     references: ['Smith, J. (2023). Sleep research. *Journal*, 1(1), 1-10.'],
 *   },
 *   outputPath: './output/paper',
 * });
 *
 * if (result.success) {
 *   console.log(`PDF generated: ${result.outputPath}`);
 * }
 * ```
 */
export declare function generatePdf(options: GeneratePdfOptions): Promise<GeneratePdfResult>;
/**
 * Object-oriented interface for APA PDF generation.
 *
 * Provides more control over the generation process with
 * separate initialization and generation phases.
 *
 * @example
 * ```typescript
 * const generator = new APAPdfGenerator();
 * await generator.initialize();
 *
 * console.log('Capabilities:', generator.getCapabilities());
 *
 * const result = await generator.generate({
 *   title: 'My Paper',
 *   authors: [{ name: 'Jane Smith' }],
 *   abstract: 'This paper...',
 *   body: '# Introduction\n...',
 * }, './output/paper');
 * ```
 */
export declare class APAPdfGenerator {
    private capabilities;
    private initialized;
    private preferredGenerator?;
    private pdfOptions?;
    /**
     * Creates a new APAPdfGenerator instance.
     *
     * @param options - Optional configuration
     */
    constructor(options?: {
        preferredGenerator?: GeneratorType;
        pdfOptions?: Partial<import('./types.js').PdfOptions>;
    });
    /**
     * Initializes the generator by detecting system capabilities.
     * Must be called before generate().
     *
     * @returns The detected capabilities
     */
    initialize(): Promise<GeneratorCapabilities>;
    /**
     * Returns the detected capabilities.
     * Throws if initialize() hasn't been called.
     *
     * @returns Generator capabilities
     */
    getCapabilities(): GeneratorCapabilities;
    /**
     * Checks if the generator has been initialized.
     *
     * @returns True if initialized
     */
    isInitialized(): boolean;
    /**
     * Generates a PDF from paper content.
     *
     * @param paper - Paper content and metadata
     * @param outputPath - Output file path (without extension)
     * @param callbacks - Optional progress and log callbacks
     * @returns Generation result
     */
    generate(paper: PaperInputForGeneration, outputPath: string, callbacks?: {
        onProgress?: (percent: number, message: string) => void;
        onLog?: (level: 'info' | 'warn' | 'error', message: string) => void;
    }): Promise<GeneratePdfResult>;
    /**
     * Returns the generator type that will be used.
     *
     * @returns The selected generator type
     */
    getSelectedGenerator(): GeneratorType;
}
/**
 * Default export for simple import usage.
 */
declare const _default: {
    generatePdf: typeof generatePdf;
    APAPdfGenerator: typeof APAPdfGenerator;
};
export default _default;
//# sourceMappingURL=index.d.ts.map