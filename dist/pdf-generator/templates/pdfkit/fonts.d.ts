/**
 * PDFKit Font Management
 *
 * Handles font configuration and fallback logic for PDFKit generator.
 * PDFKit has limited built-in fonts, so we provide mapping from
 * APA-required fonts to available alternatives.
 *
 * @module pdf-generator/templates/pdfkit/fonts
 */
/**
 * PDFKit built-in font names.
 * These are always available without external font files.
 */
export declare const PDFKIT_BUILTIN_FONTS: {
    readonly timesRoman: "Times-Roman";
    readonly timesBold: "Times-Bold";
    readonly timesItalic: "Times-Italic";
    readonly timesBoldItalic: "Times-BoldItalic";
    readonly helvetica: "Helvetica";
    readonly helveticaBold: "Helvetica-Bold";
    readonly helveticaOblique: "Helvetica-Oblique";
    readonly helveticaBoldOblique: "Helvetica-BoldOblique";
    readonly courier: "Courier";
    readonly courierBold: "Courier-Bold";
    readonly courierOblique: "Courier-Oblique";
    readonly courierBoldOblique: "Courier-BoldOblique";
    readonly symbol: "Symbol";
    readonly zapfDingbats: "ZapfDingbats";
};
export type PdfKitBuiltinFont = (typeof PDFKIT_BUILTIN_FONTS)[keyof typeof PDFKIT_BUILTIN_FONTS];
/**
 * Font style options for text rendering.
 */
export interface FontStyle {
    bold: boolean;
    italic: boolean;
}
/**
 * Complete font specification for PDFKit.
 */
export interface FontSpec {
    /** PDFKit font name */
    font: string;
    /** Font size in points */
    size: number;
}
/**
 * Maps APA font requirements to PDFKit built-in fonts.
 * Times-Roman is the closest match to Times New Roman.
 */
export declare const APA_TO_PDFKIT_FONTS: {
    readonly 'Times New Roman': {
        readonly regular: "Times-Roman";
        readonly bold: "Times-Bold";
        readonly italic: "Times-Italic";
        readonly boldItalic: "Times-BoldItalic";
    };
    readonly Georgia: {
        readonly regular: "Times-Roman";
        readonly bold: "Times-Bold";
        readonly italic: "Times-Italic";
        readonly boldItalic: "Times-BoldItalic";
    };
    readonly serif: {
        readonly regular: "Times-Roman";
        readonly bold: "Times-Bold";
        readonly italic: "Times-Italic";
        readonly boldItalic: "Times-BoldItalic";
    };
    readonly 'sans-serif': {
        readonly regular: "Helvetica";
        readonly bold: "Helvetica-Bold";
        readonly italic: "Helvetica-Oblique";
        readonly boldItalic: "Helvetica-BoldOblique";
    };
    readonly monospace: {
        readonly regular: "Courier";
        readonly bold: "Courier-Bold";
        readonly italic: "Courier-Oblique";
        readonly boldItalic: "Courier-BoldOblique";
    };
};
export type ApaFontFamily = keyof typeof APA_TO_PDFKIT_FONTS;
/**
 * Get the appropriate PDFKit font for the given style.
 *
 * @param family - Font family name (e.g., 'Times New Roman', 'Georgia')
 * @param style - Font style options
 * @returns PDFKit font name
 */
export declare function getPdfKitFont(family?: string, style?: FontStyle): string;
/**
 * Get font specification for APA body text.
 *
 * @param style - Font style options
 * @returns Font specification for PDFKit
 */
export declare function getBodyFont(style?: FontStyle): FontSpec;
/**
 * Get font specification for APA headings.
 *
 * @param level - Heading level (1-5)
 * @returns Font specification for PDFKit
 */
export declare function getHeadingFont(level: 1 | 2 | 3 | 4 | 5): FontSpec;
/**
 * Get font specification for page numbers and running head.
 *
 * @returns Font specification for PDFKit
 */
export declare function getHeaderFont(): FontSpec;
/**
 * Get font specification for footnotes.
 *
 * @returns Font specification for PDFKit
 */
export declare function getFootnoteFont(): FontSpec;
/**
 * Approximate character widths for built-in fonts.
 * Used for text measurement when exact metrics unavailable.
 */
export declare const FONT_METRICS: {
    readonly 'Times-Roman': {
        readonly averageCharWidth: 0.44;
        readonly spaceWidth: 0.25;
    };
    readonly 'Times-Bold': {
        readonly averageCharWidth: 0.46;
        readonly spaceWidth: 0.25;
    };
    readonly 'Times-Italic': {
        readonly averageCharWidth: 0.44;
        readonly spaceWidth: 0.25;
    };
    readonly 'Times-BoldItalic': {
        readonly averageCharWidth: 0.46;
        readonly spaceWidth: 0.25;
    };
    readonly Helvetica: {
        readonly averageCharWidth: 0.52;
        readonly spaceWidth: 0.28;
    };
    readonly Courier: {
        readonly averageCharWidth: 0.6;
        readonly spaceWidth: 0.6;
    };
};
/**
 * Estimate text width for a given string and font.
 *
 * @param text - Text to measure
 * @param font - Font name
 * @param size - Font size in points
 * @returns Approximate width in points
 */
export declare function estimateTextWidth(text: string, font: string, size: number): number;
declare const _default: {
    PDFKIT_BUILTIN_FONTS: {
        readonly timesRoman: "Times-Roman";
        readonly timesBold: "Times-Bold";
        readonly timesItalic: "Times-Italic";
        readonly timesBoldItalic: "Times-BoldItalic";
        readonly helvetica: "Helvetica";
        readonly helveticaBold: "Helvetica-Bold";
        readonly helveticaOblique: "Helvetica-Oblique";
        readonly helveticaBoldOblique: "Helvetica-BoldOblique";
        readonly courier: "Courier";
        readonly courierBold: "Courier-Bold";
        readonly courierOblique: "Courier-Oblique";
        readonly courierBoldOblique: "Courier-BoldOblique";
        readonly symbol: "Symbol";
        readonly zapfDingbats: "ZapfDingbats";
    };
    APA_TO_PDFKIT_FONTS: {
        readonly 'Times New Roman': {
            readonly regular: "Times-Roman";
            readonly bold: "Times-Bold";
            readonly italic: "Times-Italic";
            readonly boldItalic: "Times-BoldItalic";
        };
        readonly Georgia: {
            readonly regular: "Times-Roman";
            readonly bold: "Times-Bold";
            readonly italic: "Times-Italic";
            readonly boldItalic: "Times-BoldItalic";
        };
        readonly serif: {
            readonly regular: "Times-Roman";
            readonly bold: "Times-Bold";
            readonly italic: "Times-Italic";
            readonly boldItalic: "Times-BoldItalic";
        };
        readonly 'sans-serif': {
            readonly regular: "Helvetica";
            readonly bold: "Helvetica-Bold";
            readonly italic: "Helvetica-Oblique";
            readonly boldItalic: "Helvetica-BoldOblique";
        };
        readonly monospace: {
            readonly regular: "Courier";
            readonly bold: "Courier-Bold";
            readonly italic: "Courier-Oblique";
            readonly boldItalic: "Courier-BoldOblique";
        };
    };
    getPdfKitFont: typeof getPdfKitFont;
    getBodyFont: typeof getBodyFont;
    getHeadingFont: typeof getHeadingFont;
    getHeaderFont: typeof getHeaderFont;
    getFootnoteFont: typeof getFootnoteFont;
    estimateTextWidth: typeof estimateTextWidth;
};
export default _default;
//# sourceMappingURL=fonts.d.ts.map