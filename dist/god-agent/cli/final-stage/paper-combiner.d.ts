/**
 * PaperCombiner - Combines chapters into final paper with ToC and metadata
 *
 * Implements SPEC-FUNC-001 Section 2.6 and SPEC-TECH-001 Section 2.5
 *
 * Addresses:
 * - GAP-H006: Table of Contents generation with anchor links
 * - GAP-H007: Appendices handling (inline < 5000 words, separate files otherwise)
 * - GAP-C007: Output directory structure (final/, chapters/, appendices/)
 *
 * Constitution Rules:
 * - FS-003: Chapter file naming convention ch{NN}-{slug}.md
 * - FS-004: Final paper naming final-paper.md
 * - QA-002: Validate all cross-references
 * - QA-004: Table of Contents required
 */
import type { ChapterWriterOutput, FinalPaper, PaperMetadata } from './types.js';
/**
 * Appendix definition structure
 */
interface AppendixDefinition {
    letter: string;
    title: string;
    source: string;
    content?: string;
    wordCount?: number;
}
/**
 * Appendix handling result
 */
interface AppendixResult {
    mainContent: string;
    appendixFiles: string[];
    inlined: boolean;
}
/**
 * Options for PDF generation in writeOutputFiles
 */
export interface PdfGenerationOptions {
    /** Generate PDF alongside markdown output */
    generatePdf?: boolean;
    /** Authors for the PDF title page */
    authors?: Array<{
        name: string;
        affiliationIds?: number[];
        orcid?: string;
    }>;
    /** Affiliations for the PDF title page */
    affiliations?: Array<{
        id: number;
        name: string;
        department?: string;
    }>;
    /** Abstract text (extracted from Chapter 1 if not provided) */
    abstract?: string;
    /** Keywords for the abstract */
    keywords?: string[];
}
/**
 * PaperCombiner - Combines all chapter outputs into a final paper
 *
 * @example
 * ```typescript
 * const combiner = new PaperCombiner();
 * const paper = await combiner.combine(chapters, metadata);
 * await combiner.writeOutputFiles(paper, outputDir);
 * ```
 */
export declare class PaperCombiner {
    /**
     * Maximum appendix word count for inline inclusion (5000 words ~ 5 pages)
     */
    private static readonly INLINE_APPENDIX_THRESHOLD;
    /**
     * Maximum anchor length per spec
     */
    private static readonly MAX_ANCHOR_LENGTH;
    /**
     * Default appendix structure per SPEC-FUNC-001 Section 2.6.5
     */
    private static readonly DEFAULT_APPENDICES;
    /**
     * Combine chapters into a final paper
     *
     * @param chapters - Array of chapter outputs from ChapterWriterAgent
     * @param metadata - Paper metadata (title, slug, generatedDate)
     * @returns Complete FinalPaper object
     */
    combine(chapters: ChapterWriterOutput[], metadata: PaperMetadata): Promise<FinalPaper>;
    /**
     * Generate table of contents with anchor links
     * Implements GAP-H006 and GAP-C016 anchor generation
     *
     * @param chapters - Sorted array of chapter outputs
     * @returns Markdown table of contents string
     */
    generateTableOfContents(chapters: ChapterWriterOutput[]): string;
    /**
     * Write output files to the final directory
     * Implements GAP-C007 output directory structure
     *
     * @param paper - Combined FinalPaper object
     * @param outputDir - Path to final/ output directory
     * @param pdfOptions - Optional PDF generation options
     */
    writeOutputFiles(paper: FinalPaper, outputDir: string, pdfOptions?: PdfGenerationOptions): Promise<void>;
    /**
     * Transform FinalPaper to PaperInputForGeneration format for PDF generation
     *
     * @param paper - The combined FinalPaper object
     * @param options - PDF generation options
     * @returns PaperInputForGeneration compatible object
     */
    private transformToPaperInput;
    /**
     * Extract abstract text from chapter content
     * Looks for the first substantial paragraph after the title
     *
     * @param content - Chapter markdown content
     * @returns Extracted abstract text or undefined
     */
    private extractAbstractFromContent;
    /**
     * Generate paper metadata from slug and chapters
     *
     * @param slug - Research slug identifier
     * @param chapters - Array of chapter outputs
     * @returns PaperMetadata object
     */
    generateMetadata(slug: string, chapters: ChapterWriterOutput[]): PaperMetadata;
    /**
     * Handle appendices based on total word count
     * Implements GAP-H007
     *
     * @param referencesChapterContent - Content of final chapter (references)
     * @param appendices - Array of appendix definitions with content
     * @param outputDir - Path to output directory
     * @returns AppendixResult with main content and file list
     */
    handleAppendices(referencesChapterContent: string, appendices: AppendixDefinition[], outputDir: string): Promise<AppendixResult>;
    /**
     * Generate title page with metadata
     */
    private generateTitlePage;
    /**
     * Generate markdown anchor from heading text
     * Per SPEC-FUNC-001 Section 2.6.4
     */
    private generateAnchor;
    /**
     * Validate and fix cross-references in combined content
     */
    private validateCrossReferences;
    /**
     * Build full metadata object for JSON output
     */
    private buildFullMetadata;
    /**
     * Count unique citations across all chapters
     */
    private countUniqueCitations;
    /**
     * Count words in text
     */
    private countWords;
    /**
     * Slugify a title for filename use
     */
    private slugify;
    /**
     * Infer paper title from chapters
     */
    private inferTitleFromChapters;
    /**
     * Format slug as readable title
     */
    private formatSlugAsTitle;
    /**
     * Get default appendix definitions
     */
    static getDefaultAppendices(): AppendixDefinition[];
}
export {};
//# sourceMappingURL=paper-combiner.d.ts.map