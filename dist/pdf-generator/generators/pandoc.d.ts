/**
 * Pandoc PDF Generator
 *
 * Generates APA 7th Edition compliant PDFs using Pandoc with LaTeX.
 * Provides the highest quality output when LaTeX is available,
 * with HTML fallback for environments without LaTeX.
 *
 * @module pdf-generator/generators/pandoc
 */
import { BaseGenerator } from './base-generator.js';
import type { GeneratorType, GeneratorResult, FormattedPaper, PdfOptions } from '../types.js';
/**
 * PDF generator using Pandoc with LaTeX for APA 7th Edition compliance.
 *
 * Features:
 * - High-quality PDF output via LaTeX
 * - HTML/CSS fallback when LaTeX unavailable
 * - Full APA 7th Edition heading hierarchy
 * - Running head with page numbers
 * - Hanging indent for references
 *
 * @example
 * ```typescript
 * const generator = new PandocGenerator();
 * await generator.checkAvailability();
 *
 * if (generator.available) {
 *   const result = await generator.generate(paper, { outputPath: 'paper.pdf' });
 *   console.log(result.success ? 'PDF created!' : result.error);
 * }
 * ```
 */
export declare class PandocGenerator extends BaseGenerator {
    /** Generator type identifier */
    readonly type: GeneratorType;
    /** Path to pandoc executable */
    private pandocPath;
    /** Whether LaTeX (xelatex) is available - required for fontspec/system fonts */
    private latexAvailable;
    /** Path to xelatex executable (for TinyTeX or non-PATH installations) */
    private latexPath?;
    /** Whether wkhtmltopdf is available for HTML fallback */
    private wkhtmltopdfAvailable;
    /** Cached pandoc version */
    private pandocVersion?;
    /** Temporary files created during generation */
    private tempFiles;
    /**
     * Create a new PandocGenerator.
     * @param pandocPath - Custom path to pandoc executable (optional)
     */
    constructor(pandocPath?: string);
    /**
     * Check if Pandoc and related tools are available.
     * @returns Promise resolving to availability status
     */
    checkAvailability(): Promise<boolean>;
    /**
     * Detect Pandoc installation path based on common locations.
     */
    private detectPandocPath;
    /**
     * Detect availability of Pandoc and related tools.
     */
    private detectAvailability;
    /**
     * Parse Pandoc version from --version output.
     */
    private parsePandocVersion;
    /**
     * Generate a PDF from a formatted paper.
     * @param paper - The formatted paper to convert
     * @param options - Generation options
     * @returns Generation result
     */
    generate(paper: FormattedPaper, options: PdfOptions): Promise<GeneratorResult>;
    /**
     * Build Pandoc command-line arguments.
     */
    private buildPandocArgs;
    /**
     * Convert a formatted paper to Pandoc Markdown.
     */
    private formatToMarkdown;
    /**
     * Format body content with proper markdown headings.
     */
    private formatBodyContent;
    /**
     * Format sections recursively with proper markdown heading levels.
     */
    private formatSections;
    /**
     * Escape special characters for YAML strings.
     */
    private escapeYaml;
    /**
     * Clean up temporary files created during generation.
     */
    cleanup(): Promise<void>;
}
/**
 * Create a new PandocGenerator instance.
 * @param pandocPath - Optional custom path to pandoc executable
 * @returns New PandocGenerator instance
 */
export declare function createPandocGenerator(pandocPath?: string): PandocGenerator;
//# sourceMappingURL=pandoc.d.ts.map