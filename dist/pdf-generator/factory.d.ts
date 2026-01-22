/**
 * PDF Generator Factory
 *
 * Factory functions for creating PDF generators with automatic
 * capability detection and fallback selection.
 *
 * Priority order:
 * 1. pandoc-latex (highest quality, requires LaTeX)
 * 2. pandoc-html (good quality, no LaTeX required)
 * 3. pdfkit (always available, pure JavaScript)
 *
 * @module pdf-generator/factory
 */
import type { GeneratorType, IPdfGenerator, PdfOptions } from './types.js';
/**
 * Result of capability detection across all generators.
 */
export interface GeneratorCapabilities {
    /** Whether Pandoc with LaTeX (pdflatex) is available */
    pandocLatex: boolean;
    /** Whether Pandoc with HTML engine (wkhtmltopdf) is available */
    pandocHtml: boolean;
    /** Whether PDFKit is available (always true) */
    pdfkit: boolean;
}
/**
 * Detect available PDF generation capabilities.
 *
 * Creates a temporary PandocGenerator to check for Pandoc and LaTeX
 * availability. PDFKit is always available as it's a pure JavaScript library.
 *
 * @returns Promise resolving to capability status for each generator type
 *
 * @example
 * ```typescript
 * const caps = await detectCapabilities();
 * console.log(caps.pandocLatex); // true if LaTeX available
 * console.log(caps.pandocHtml);  // true if wkhtmltopdf available
 * console.log(caps.pdfkit);      // always true
 * ```
 */
export declare function detectCapabilities(): Promise<GeneratorCapabilities>;
/**
 * Create a PDF generator with automatic capability detection and fallback.
 *
 * This async factory function detects available generators and selects
 * the best one based on priority:
 * 1. pandoc-latex (if LaTeX available)
 * 2. pandoc-html (if wkhtmltopdf available)
 * 3. pdfkit (always available)
 *
 * @param options - Optional PDF generation options
 * @param preferredType - Optional preferred generator type (will use if available)
 * @returns Promise resolving to the best available generator
 *
 * @example
 * ```typescript
 * // Auto-select best available generator
 * const generator = await createGenerator({ outputPath: 'output.pdf' });
 *
 * // Request specific generator type
 * const pdfkitGen = await createGenerator(undefined, 'pdfkit');
 *
 * // Prefer pandoc-latex, fallback if unavailable
 * const latexGen = await createGenerator({ outputPath: 'paper.pdf' }, 'pandoc-latex');
 * ```
 */
export declare function createGenerator(options?: PdfOptions, preferredType?: GeneratorType): Promise<IPdfGenerator>;
/**
 * Create a PDF generator synchronously without capability detection.
 *
 * Use this when you know which generator type you want and don't need
 * automatic fallback. Note: This does not verify the generator is actually
 * available on the system.
 *
 * @param type - Generator type to create
 * @param options - Optional PDF generation options
 * @returns The requested generator instance
 *
 * @example
 * ```typescript
 * // Create specific generator type
 * const pandocGen = createGeneratorSync('pandoc-latex');
 * const pdfkitGen = createGeneratorSync('pdfkit');
 *
 * // With options
 * const gen = createGeneratorSync('pdfkit', { outputPath: 'out.pdf' });
 * ```
 */
export declare function createGeneratorSync(type: GeneratorType, options?: PdfOptions): IPdfGenerator;
/**
 * Get the recommended generator type based on system capabilities.
 *
 * Useful for informing users about available options or for
 * logging/debugging purposes.
 *
 * @returns Promise resolving to the recommended generator type
 */
export declare function getRecommendedGeneratorType(): Promise<GeneratorType>;
export { PandocGenerator } from './generators/pandoc.js';
export { PdfKitGenerator } from './generators/pdfkit.js';
//# sourceMappingURL=factory.d.ts.map