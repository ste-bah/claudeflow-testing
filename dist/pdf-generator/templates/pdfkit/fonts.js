/**
 * PDFKit Font Management
 *
 * Handles font configuration and fallback logic for PDFKit generator.
 * PDFKit has limited built-in fonts, so we provide mapping from
 * APA-required fonts to available alternatives.
 *
 * @module pdf-generator/templates/pdfkit/fonts
 */
// =============================================================================
// BUILT-IN PDFKIT FONTS
// =============================================================================
/**
 * PDFKit built-in font names.
 * These are always available without external font files.
 */
export const PDFKIT_BUILTIN_FONTS = {
    // Times family (closest to Times New Roman)
    timesRoman: 'Times-Roman',
    timesBold: 'Times-Bold',
    timesItalic: 'Times-Italic',
    timesBoldItalic: 'Times-BoldItalic',
    // Helvetica family
    helvetica: 'Helvetica',
    helveticaBold: 'Helvetica-Bold',
    helveticaOblique: 'Helvetica-Oblique',
    helveticaBoldOblique: 'Helvetica-BoldOblique',
    // Courier family (monospace)
    courier: 'Courier',
    courierBold: 'Courier-Bold',
    courierOblique: 'Courier-Oblique',
    courierBoldOblique: 'Courier-BoldOblique',
    // Symbol and Zapf Dingbats
    symbol: 'Symbol',
    zapfDingbats: 'ZapfDingbats',
};
// =============================================================================
// APA FONT MAPPING
// =============================================================================
/**
 * Maps APA font requirements to PDFKit built-in fonts.
 * Times-Roman is the closest match to Times New Roman.
 */
export const APA_TO_PDFKIT_FONTS = {
    'Times New Roman': {
        regular: PDFKIT_BUILTIN_FONTS.timesRoman,
        bold: PDFKIT_BUILTIN_FONTS.timesBold,
        italic: PDFKIT_BUILTIN_FONTS.timesItalic,
        boldItalic: PDFKIT_BUILTIN_FONTS.timesBoldItalic,
    },
    Georgia: {
        // Georgia not available, fall back to Times
        regular: PDFKIT_BUILTIN_FONTS.timesRoman,
        bold: PDFKIT_BUILTIN_FONTS.timesBold,
        italic: PDFKIT_BUILTIN_FONTS.timesItalic,
        boldItalic: PDFKIT_BUILTIN_FONTS.timesBoldItalic,
    },
    serif: {
        regular: PDFKIT_BUILTIN_FONTS.timesRoman,
        bold: PDFKIT_BUILTIN_FONTS.timesBold,
        italic: PDFKIT_BUILTIN_FONTS.timesItalic,
        boldItalic: PDFKIT_BUILTIN_FONTS.timesBoldItalic,
    },
    'sans-serif': {
        regular: PDFKIT_BUILTIN_FONTS.helvetica,
        bold: PDFKIT_BUILTIN_FONTS.helveticaBold,
        italic: PDFKIT_BUILTIN_FONTS.helveticaOblique,
        boldItalic: PDFKIT_BUILTIN_FONTS.helveticaBoldOblique,
    },
    monospace: {
        regular: PDFKIT_BUILTIN_FONTS.courier,
        bold: PDFKIT_BUILTIN_FONTS.courierBold,
        italic: PDFKIT_BUILTIN_FONTS.courierOblique,
        boldItalic: PDFKIT_BUILTIN_FONTS.courierBoldOblique,
    },
};
// =============================================================================
// FONT HELPER FUNCTIONS
// =============================================================================
/**
 * Get the appropriate PDFKit font for the given style.
 *
 * @param family - Font family name (e.g., 'Times New Roman', 'Georgia')
 * @param style - Font style options
 * @returns PDFKit font name
 */
export function getPdfKitFont(family = 'Times New Roman', style = { bold: false, italic: false }) {
    // Normalize family name
    const normalizedFamily = family.toLowerCase().includes('times')
        ? 'Times New Roman'
        : family.toLowerCase().includes('georgia')
            ? 'Georgia'
            : family.toLowerCase().includes('sans')
                ? 'sans-serif'
                : family.toLowerCase().includes('mono') || family.toLowerCase().includes('courier')
                    ? 'monospace'
                    : 'serif';
    const fontFamily = APA_TO_PDFKIT_FONTS[normalizedFamily] || APA_TO_PDFKIT_FONTS['serif'];
    if (style.bold && style.italic) {
        return fontFamily.boldItalic;
    }
    else if (style.bold) {
        return fontFamily.bold;
    }
    else if (style.italic) {
        return fontFamily.italic;
    }
    return fontFamily.regular;
}
/**
 * Get font specification for APA body text.
 *
 * @param style - Font style options
 * @returns Font specification for PDFKit
 */
export function getBodyFont(style = { bold: false, italic: false }) {
    return {
        font: getPdfKitFont('Times New Roman', style),
        size: 12,
    };
}
/**
 * Get font specification for APA headings.
 *
 * @param level - Heading level (1-5)
 * @returns Font specification for PDFKit
 */
export function getHeadingFont(level) {
    // All APA headings are 12pt, style varies
    const styles = {
        1: { bold: true, italic: false }, // Level 1: Bold
        2: { bold: true, italic: false }, // Level 2: Bold
        3: { bold: true, italic: true }, // Level 3: Bold Italic
        4: { bold: true, italic: false }, // Level 4: Bold (inline)
        5: { bold: true, italic: true }, // Level 5: Bold Italic (inline)
    };
    return {
        font: getPdfKitFont('Times New Roman', styles[level]),
        size: 12,
    };
}
/**
 * Get font specification for page numbers and running head.
 *
 * @returns Font specification for PDFKit
 */
export function getHeaderFont() {
    return {
        font: PDFKIT_BUILTIN_FONTS.timesRoman,
        size: 12,
    };
}
/**
 * Get font specification for footnotes.
 *
 * @returns Font specification for PDFKit
 */
export function getFootnoteFont() {
    return {
        font: PDFKIT_BUILTIN_FONTS.timesRoman,
        size: 10,
    };
}
// =============================================================================
// FONT METRICS
// =============================================================================
/**
 * Approximate character widths for built-in fonts.
 * Used for text measurement when exact metrics unavailable.
 */
export const FONT_METRICS = {
    'Times-Roman': {
        averageCharWidth: 0.44, // em units
        spaceWidth: 0.25,
    },
    'Times-Bold': {
        averageCharWidth: 0.46,
        spaceWidth: 0.25,
    },
    'Times-Italic': {
        averageCharWidth: 0.44,
        spaceWidth: 0.25,
    },
    'Times-BoldItalic': {
        averageCharWidth: 0.46,
        spaceWidth: 0.25,
    },
    Helvetica: {
        averageCharWidth: 0.52,
        spaceWidth: 0.28,
    },
    Courier: {
        averageCharWidth: 0.6, // Monospace
        spaceWidth: 0.6,
    },
};
/**
 * Estimate text width for a given string and font.
 *
 * @param text - Text to measure
 * @param font - Font name
 * @param size - Font size in points
 * @returns Approximate width in points
 */
export function estimateTextWidth(text, font, size) {
    const metrics = FONT_METRICS[font] || FONT_METRICS['Times-Roman'];
    let width = 0;
    for (const char of text) {
        if (char === ' ') {
            width += metrics.spaceWidth;
        }
        else {
            width += metrics.averageCharWidth;
        }
    }
    return width * size;
}
// =============================================================================
// EXPORTS
// =============================================================================
export default {
    PDFKIT_BUILTIN_FONTS,
    APA_TO_PDFKIT_FONTS,
    getPdfKitFont,
    getBodyFont,
    getHeadingFont,
    getHeaderFont,
    getFootnoteFont,
    estimateTextWidth,
};
//# sourceMappingURL=fonts.js.map