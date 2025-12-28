/**
 * PDF Text Extractor for Style Learning
 *
 * Extracts text from PDF files for style analysis.
 * Supports multiple extraction methods:
 * 1. Direct file reading (for pre-extracted text)
 * 2. External tool invocation (pdftotext if available)
 * 3. Fallback to basic extraction
 */
export interface PDFExtractionResult {
    filename: string;
    text: string;
    pageCount?: number;
    wordCount: number;
    extractionMethod: 'pdftotext' | 'node' | 'cached' | 'manual';
    success: boolean;
    error?: string;
}
export interface BatchExtractionResult {
    successful: PDFExtractionResult[];
    failed: PDFExtractionResult[];
    totalFiles: number;
    totalWords: number;
}
export declare class PDFExtractor {
    private cacheDir;
    private hasPoppler;
    constructor(basePath?: string);
    private ensureCacheDir;
    /**
     * Check if pdftotext (poppler-utils) is available
     */
    private checkPoppler;
    /**
     * Get cached text for a PDF if available
     */
    private getCachedText;
    /**
     * Cache extracted text
     */
    private cacheText;
    /**
     * Generate cache key from file path
     */
    private getCacheKey;
    /**
     * Extract text from a single PDF
     */
    extractText(pdfPath: string): Promise<PDFExtractionResult>;
    /**
     * Basic text extraction from PDF buffer (extracts visible text strings)
     */
    private extractTextFromBuffer;
    /**
     * Decode PDF string escape sequences
     */
    private decodePDFString;
    /**
     * Clean extracted text for analysis
     */
    private cleanExtractedText;
    /**
     * Extract text from multiple PDFs in a directory
     */
    extractFromDirectory(dirPath: string, options?: {
        recursive?: boolean;
        maxFiles?: number;
    }): Promise<BatchExtractionResult>;
    /**
     * Find PDF files in directory
     */
    private findPDFs;
    /**
     * Store manually provided text for a PDF (for when extraction fails)
     */
    storeManualText(pdfPath: string, text: string): void;
    /**
     * Get extraction statistics
     */
    getStats(): {
        cachedFiles: number;
        cacheSize: number;
    };
}
export declare function getPDFExtractor(basePath?: string): PDFExtractor;
//# sourceMappingURL=pdf-extractor.d.ts.map