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
// =============================================================================
// CONSTANT RE-EXPORTS
// =============================================================================
export { 
// Page layout
APA_MARGINS, 
// Typography
APA_FONTS, APA_SPACING, 
// Document sections
APA_RUNNING_HEAD, APA_TITLE_PAGE, APA_ABSTRACT, APA_HEADING_STYLES, APA_REFERENCES, APA_SECTION_ORDER, APA_TABLES, APA_FIGURES, APA_APPENDICES, APA_VALIDATION_LIMITS, 
// Generator config
GENERATOR_PRIORITY, GENERATOR_CONFIG, 
// Combined config
APA_CONFIG, } from './constants.js';
// =============================================================================
// FACTORY RE-EXPORTS
// =============================================================================
export { detectCapabilities, createGenerator, createGeneratorSync, getRecommendedGeneratorType, PandocGenerator, PdfKitGenerator, } from './factory.js';
// =============================================================================
// FORMATTER RE-EXPORTS
// =============================================================================
// Title page formatter
export { formatTitlePage, generateTitlePageMarkdown, generateTitlePageHtml, getTitlePageCss, formatTitleCase, } from './formatters/title-page.js';
// Abstract formatter
export { formatAbstract, generateAbstractMarkdown, generateAbstractHtml, getAbstractCss, validateAbstract as validateAbstractFormat, countWords, formatKeywords, normalizeAbstractText, } from './formatters/abstract.js';
// Headings formatter
export { formatHeading, formatMarkdownHeading, processHeadings, extractAllHeadings, validateHeadingHierarchy, getHeadingsCss, detectHeadingLevel, extractHeadingText, getApaHeadingStyle, describeHeadingLevel, HEADING_STYLES, } from './formatters/headings.js';
// References formatter
export { formatReferences, generateReferencesMarkdown, generateReferencesHtml, getReferencesCss, parseReference, sortReferences, formatDoi, validateReferences, extractDois, countUniqueAuthors, } from './formatters/references.js';
// Running head formatter
export { formatRunningHead, generateRunningHead, getRunningHeadCss, validateRunningHead as validateRunningHeadFormat, truncateToMax, abbreviateTitle, shouldDisplayRunningHead, } from './formatters/running-head.js';
// =============================================================================
// VALIDATION RE-EXPORTS
// =============================================================================
export { validatePaper, validateAuthor, validateTitle, validateAbstract as validateAbstractContent, validateRunningHead as validateRunningHeadContent, validateReference, validateHeadingLevel, mergeValidationResults, isValidRunningHead, isValidAbstract, isValidTitle, isValidPaper, isValidOrcid, isUppercase, countWords as countWordsValidation, getErrorsOnly, getWarningsOnly, formatValidationResult, ValidationErrorCodes, ValidationWarningCodes, } from './utils/validation.js';
// =============================================================================
// GENERATOR RE-EXPORTS
// =============================================================================
export { BaseGenerator } from './generators/base-generator.js';
export { ConfigManager, loadConfig, getConfig, configure, validateConfig, resetConfig, DEFAULT_CONFIG, } from './config.js';
// =============================================================================
// IMPORTS FOR IMPLEMENTATION
// =============================================================================
import { detectCapabilities as _detectCapabilities, createGenerator as _createGenerator, } from './factory.js';
import { formatTitlePage as _formatTitlePage } from './formatters/title-page.js';
import { formatAbstract as _formatAbstract } from './formatters/abstract.js';
import { extractAllHeadings as _extractAllHeadings, parseMarkdownToSections } from './formatters/headings.js';
import { formatReferences as _formatReferences } from './formatters/references.js';
import { formatRunningHead as _formatRunningHead } from './formatters/running-head.js';
// =============================================================================
// MAIN API FUNCTION
// =============================================================================
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
export async function generatePdf(options) {
    const startTime = Date.now();
    const warnings = [];
    const { paper, outputPath, preferredGenerator, pdfOptions, onProgress, onLog } = options;
    const log = (level, message) => {
        if (level === 'warn') {
            warnings.push(message);
        }
        onLog?.(level, message);
    };
    const progress = (percent, message) => {
        onProgress?.(percent, message);
    };
    try {
        // Step 1: Detect capabilities and create generator
        progress(5, 'Detecting PDF generation capabilities...');
        const capabilities = await _detectCapabilities();
        log('info', `Capabilities detected: pandocLatex=${capabilities.pandocLatex}, pandocHtml=${capabilities.pandocHtml}, pdfkit=true`);
        let generatorType;
        if (preferredGenerator && isGeneratorAvailable(preferredGenerator, capabilities)) {
            generatorType = preferredGenerator;
        }
        else {
            generatorType = selectBestGenerator(capabilities);
        }
        progress(10, `Creating ${generatorType} generator...`);
        // createGenerator accepts PdfOptions | undefined - we pass undefined here
        // and provide outputPath when calling generate()
        const generator = await _createGenerator(undefined, generatorType);
        // Step 2: Format title page
        progress(15, 'Formatting title page...');
        // Convert PaperInputForGeneration authors to TitlePageAuthorInfo format
        const titlePageAuthors = paper.authors.map(a => ({
            name: a.name,
            orcid: a.orcid,
            // Map affiliation from affiliations array if available
            affiliation: paper.affiliations?.find(aff => a.affiliationIds?.includes(aff.id))?.name,
        }));
        // Convert affiliations to string array (TitlePageInput expects string[])
        const titlePageAffiliations = paper.affiliations?.map(aff => {
            const parts = [aff.name];
            if (aff.department)
                parts.unshift(aff.department);
            return parts.join(', ');
        });
        const titlePageInput = {
            title: paper.title,
            authors: titlePageAuthors,
            affiliations: titlePageAffiliations,
            authorNote: paper.authorNote,
            runningHead: paper.runningHead,
            courseNumber: paper.course,
            instructorName: paper.instructor,
            dueDate: paper.dueDate,
            isStudentPaper: Boolean(paper.course || paper.instructor),
        };
        const formattedTitlePage = _formatTitlePage(titlePageInput);
        // Step 3: Format abstract
        progress(25, 'Formatting abstract...');
        const formattedAbstract = _formatAbstract({
            text: paper.abstract,
            keywords: paper.keywords,
        });
        if (!formattedAbstract.validation.valid) {
            formattedAbstract.validation.errors.forEach(e => log('warn', `Abstract: ${e}`));
        }
        formattedAbstract.validation.warnings.forEach(w => log('warn', `Abstract: ${w}`));
        // Step 4: Process headings in body
        progress(35, 'Processing headings...');
        const processedHeadings = _extractAllHeadings(paper.body);
        // Step 5: Format references
        progress(45, 'Formatting references...');
        const formattedReferences = paper.references
            ? _formatReferences({
                references: paper.references,
                sortAlphabetically: true,
            })
            : null;
        // Step 6: Generate running head
        progress(55, 'Generating running head...');
        const runningHeadText = paper.runningHead || paper.title;
        const formattedRunningHead = _formatRunningHead({
            runningHead: paper.runningHead,
            title: paper.title,
        });
        // Step 7: Assemble full document
        progress(65, 'Assembling document...');
        // Build the title page structure matching FormattedTitlePage interface
        // ExtendedFormattedTitlePage has `title` (formatted), `affiliations` (formatted strings), `authors` (AuthorInfo[])
        const titlePage = {
            title: formattedTitlePage.title, // Already formatted by _formatTitlePage
            authors: formattedTitlePage.authors, // Already in AuthorInfo[] format
            affiliations: formattedTitlePage.affiliations, // Already formatted string[]
            authorNote: formattedTitlePage.authorNote,
            runningHead: formattedRunningHead?.text || formattedTitlePage.runningHead || runningHeadText.toUpperCase().substring(0, 50),
            pageNumber: formattedTitlePage.pageNumber,
        };
        const formattedPaper = {
            titlePage,
            abstract: {
                content: formattedAbstract.content,
                keywords: formattedAbstract.keywords,
                wordCount: formattedAbstract.wordCount,
            },
            body: {
                content: paper.body,
                sections: parseMarkdownToSections(paper.body),
            },
            references: formattedReferences
                ? {
                    entries: formattedReferences.entries,
                    count: formattedReferences.count,
                }
                : undefined,
        };
        // Step 8: Generate PDF
        progress(75, 'Generating PDF...');
        // Build complete PdfOptions - outputPath is always provided from GeneratePdfOptions
        const generatorOptions = {
            outputPath,
            format: pdfOptions?.format,
            preferredGenerator: pdfOptions?.preferredGenerator,
            pandocPath: pdfOptions?.pandocPath,
            debug: pdfOptions?.debug,
            tempDir: pdfOptions?.tempDir,
            keepIntermediateFiles: pdfOptions?.keepIntermediateFiles,
        };
        const result = await generator.generate(formattedPaper, generatorOptions);
        const durationMs = Date.now() - startTime;
        progress(100, 'PDF generation complete');
        if (result.success) {
            return {
                success: true,
                outputPath: result.outputPath,
                generatorUsed: generatorType,
                warnings,
                durationMs,
            };
        }
        else {
            return {
                success: false,
                generatorUsed: generatorType,
                warnings,
                error: result.error?.message || 'Unknown generation error',
                durationMs,
            };
        }
    }
    catch (error) {
        const durationMs = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        log('error', `Generation failed: ${errorMessage}`);
        return {
            success: false,
            generatorUsed: preferredGenerator || 'pdfkit',
            warnings,
            error: errorMessage,
            durationMs,
        };
    }
}
// =============================================================================
// HELPER FUNCTIONS
// =============================================================================
/**
 * Checks if a generator type is available given current capabilities.
 */
function isGeneratorAvailable(type, capabilities) {
    switch (type) {
        case 'pandoc-latex':
            return capabilities.pandocLatex;
        case 'pandoc-html':
            return capabilities.pandocHtml;
        case 'pdfkit':
            return true; // Always available
        default:
            return false;
    }
}
/**
 * Selects the best available generator based on capabilities.
 * Preference: pandoc-latex > pandoc-html > pdfkit
 */
function selectBestGenerator(capabilities) {
    if (capabilities.pandocLatex) {
        return 'pandoc-latex';
    }
    if (capabilities.pandocHtml) {
        return 'pandoc-html';
    }
    return 'pdfkit';
}
// =============================================================================
// CLASS-BASED API
// =============================================================================
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
export class APAPdfGenerator {
    capabilities = null;
    initialized = false;
    preferredGenerator;
    pdfOptions;
    /**
     * Creates a new APAPdfGenerator instance.
     *
     * @param options - Optional configuration
     */
    constructor(options) {
        this.preferredGenerator = options?.preferredGenerator;
        this.pdfOptions = options?.pdfOptions;
    }
    /**
     * Initializes the generator by detecting system capabilities.
     * Must be called before generate().
     *
     * @returns The detected capabilities
     */
    async initialize() {
        this.capabilities = await _detectCapabilities();
        this.initialized = true;
        return this.capabilities;
    }
    /**
     * Returns the detected capabilities.
     * Throws if initialize() hasn't been called.
     *
     * @returns Generator capabilities
     */
    getCapabilities() {
        if (!this.capabilities) {
            throw new Error('APAPdfGenerator not initialized. Call initialize() first.');
        }
        return this.capabilities;
    }
    /**
     * Checks if the generator has been initialized.
     *
     * @returns True if initialized
     */
    isInitialized() {
        return this.initialized;
    }
    /**
     * Generates a PDF from paper content.
     *
     * @param paper - Paper content and metadata
     * @param outputPath - Output file path (without extension)
     * @param callbacks - Optional progress and log callbacks
     * @returns Generation result
     */
    async generate(paper, outputPath, callbacks) {
        if (!this.initialized) {
            await this.initialize();
        }
        return generatePdf({
            paper,
            outputPath,
            preferredGenerator: this.preferredGenerator,
            pdfOptions: this.pdfOptions,
            onProgress: callbacks?.onProgress,
            onLog: callbacks?.onLog,
        });
    }
    /**
     * Returns the generator type that will be used.
     *
     * @returns The selected generator type
     */
    getSelectedGenerator() {
        if (!this.capabilities) {
            throw new Error('APAPdfGenerator not initialized. Call initialize() first.');
        }
        if (this.preferredGenerator && isGeneratorAvailable(this.preferredGenerator, this.capabilities)) {
            return this.preferredGenerator;
        }
        return selectBestGenerator(this.capabilities);
    }
}
// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================
/**
 * Default export for simple import usage.
 */
export default {
    generatePdf,
    APAPdfGenerator,
};
//# sourceMappingURL=index.js.map