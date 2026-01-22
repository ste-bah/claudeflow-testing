/**
 * PDFKit PDF Generator
 *
 * Pure JavaScript PDF generator using PDFKit library.
 * Fallback generator that requires no external dependencies.
 * Produces APA 7th Edition compliant PDFs.
 *
 * @module pdf-generator/generators/pdfkit
 */
import { BaseGenerator } from './base-generator.js';
import type { GeneratorResult, FormattedPaper, PdfOptions } from '../types.js';
/**
 * PDFKit-based PDF generator for APA 7th Edition papers.
 * Pure JavaScript implementation with no external dependencies.
 */
export declare class PdfKitGenerator extends BaseGenerator {
    readonly type: "pdfkit";
    constructor();
    /**
     * Check if PDFKit is available.
     * Always returns true since PDFKit is a pure JS dependency.
     *
     * @returns Always true
     */
    checkAvailability(): Promise<boolean>;
    /**
     * Generate a PDF from a formatted paper using PDFKit.
     *
     * @param paper - The formatted paper to convert
     * @param options - Generation options
     * @returns Generation result
     */
    generate(paper: FormattedPaper, options: PdfOptions): Promise<GeneratorResult>;
    /**
     * Add running head to page.
     * Per APA 7th: Running head (ALL CAPS) flush left, page number flush right.
     *
     * @param doc - PDFKit document
     * @param runningHead - Running head text
     * @param pageNumber - Current page number
     */
    private addRunningHead;
    /**
     * Render the title page following APA 7th Edition guidelines.
     *
     * @param doc - PDFKit document
     * @param paper - Formatted paper
     * @param pageNumber - Current page number (always 1 for title page)
     */
    private renderTitlePage;
    /**
     * Render the abstract page following APA 7th Edition guidelines.
     *
     * @param doc - PDFKit document
     * @param abstract - Formatted abstract
     */
    private renderAbstract;
    /**
     * Render the paper title at the start of body (per APA 7th Edition).
     *
     * @param doc - PDFKit document
     * @param title - Paper title
     */
    private renderBodyTitle;
    /**
     * Render the body content with sections.
     *
     * @param doc - PDFKit document
     * @param body - Formatted body content
     */
    private renderBody;
    /**
     * Render mixed content that may contain code blocks.
     * Parses content into text and code segments and renders each appropriately.
     *
     * @param doc - PDFKit document
     * @param content - Content string potentially containing code blocks
     * @param options - Rendering options
     */
    private renderMixedContent;
    /**
     * Render a code block with monospace font and optional background.
     *
     * @param doc - PDFKit document
     * @param code - Code content to render
     * @param language - Optional language hint for syntax highlighting (future use)
     */
    private renderCodeBlock;
    /**
     * Estimate the height of a code block for page break detection.
     *
     * @param doc - PDFKit document
     * @param code - Code content
     * @returns Estimated height in points
     */
    private estimateCodeBlockHeight;
    /**
     * Render regular text content with standard APA formatting.
     *
     * @param doc - PDFKit document
     * @param text - Text content to render
     * @param options - Rendering options
     */
    private renderTextContent;
    /**
     * Render a section with appropriate APA heading level.
     *
     * @param doc - PDFKit document
     * @param section - Formatted section
     */
    private renderSection;
    /**
     * Render the references section following APA 7th Edition guidelines.
     *
     * @param doc - PDFKit document
     * @param refs - Formatted references
     */
    private renderReferences;
    /**
     * Render appendices following APA 7th Edition guidelines.
     *
     * @param doc - PDFKit document
     * @param appendices - Array of formatted appendices
     */
    private renderAppendices;
}
/**
 * Create a new PDFKit generator instance.
 *
 * @returns New PDFKit generator
 */
export declare function createPdfKitGenerator(): PdfKitGenerator;
export default PdfKitGenerator;
//# sourceMappingURL=pdfkit.d.ts.map