/**
 * APA 7th Edition Formatting Constants
 *
 * This file contains all formatting constants required for generating
 * APA 7th Edition compliant professional papers.
 *
 * Reference: American Psychological Association. (2020). Publication manual
 * of the American Psychological Association (7th ed.).
 *
 * @module pdf-generator/constants
 */
/**
 * APA 7th Edition page margins.
 * Per Section 2.22: Use 1-inch margins on all sides.
 */
export declare const APA_MARGINS: {
    readonly top: "1in";
    readonly bottom: "1in";
    readonly left: "1in";
    readonly right: "1in";
};
/** Type for APA margin configuration */
export type ApaMargins = typeof APA_MARGINS;
/**
 * APA 7th Edition font specifications.
 * Per Section 2.19: Use a consistent, accessible font throughout.
 * Times New Roman 12pt is the traditional standard.
 */
export declare const APA_FONTS: {
    /** Primary font family */
    readonly primary: "Times New Roman";
    /** Fallback fonts if primary unavailable */
    readonly fallback: readonly ["Georgia", "serif"];
    /** Font sizes in points */
    readonly size: {
        /** Body text - 12pt */
        readonly body: 12;
        /** Title page text - same as body per APA 7th */
        readonly title: 12;
        /** Level 1 heading - same as body, formatting distinguishes it */
        readonly heading1: 12;
        /** Level 2 heading */
        readonly heading2: 12;
        /** Level 3 heading */
        readonly heading3: 12;
        /** Level 4 heading */
        readonly heading4: 12;
        /** Level 5 heading */
        readonly heading5: 12;
        /** Page numbers */
        readonly pageNumber: 12;
        /** Footnotes - typically smaller */
        readonly footnote: 10;
    };
};
/** Type for APA font configuration */
export type ApaFonts = typeof APA_FONTS;
/**
 * APA 7th Edition spacing specifications.
 * Per Section 2.21: Double-space the entire paper.
 * Per Section 2.24: Indent first line of paragraphs 0.5 inches.
 */
export declare const APA_SPACING: {
    /** Line height multiplier - double-spaced */
    readonly lineHeight: 2;
    /** First line paragraph indent */
    readonly paragraphIndent: "0.5in";
    /** Space after paragraph (handled by line height) */
    readonly afterParagraph: 0;
    /** Space after heading (text follows on next double-spaced line) */
    readonly afterHeading: 0;
    /** Space before heading */
    readonly beforeHeading: 0;
};
/** Type for APA spacing configuration */
export type ApaSpacing = typeof APA_SPACING;
/**
 * APA 7th Edition running head specifications.
 * Per Section 2.18: Running head is optional for student papers,
 * required for professional papers. Maximum 50 characters.
 */
export declare const APA_RUNNING_HEAD: {
    /** Maximum character length including spaces */
    readonly maxLength: 50;
    /** Position in document */
    readonly position: "header";
    /** Text alignment */
    readonly alignment: "left";
    /** Page number alignment */
    readonly pageNumberAlignment: "right";
    /** Whether to include "Running head:" label (only on title page for professional) */
    readonly includeLabelOnTitlePage: false;
    /** All caps for running head text */
    readonly allCaps: true;
};
/** Type for APA running head configuration */
export type ApaRunningHead = typeof APA_RUNNING_HEAD;
/**
 * APA 7th Edition heading levels.
 * Per Section 2.27: Five levels of headings with specific formatting.
 *
 * Level 1: Centered, Bold, Title Case
 * Level 2: Flush Left, Bold, Title Case
 * Level 3: Flush Left, Bold Italic, Title Case
 * Level 4: Indented, Bold, Title Case, Period. Text begins after period.
 * Level 5: Indented, Bold Italic, Title Case, Period. Text begins after period.
 */
export declare const APA_HEADING_STYLES: {
    /** Level 1: Centered, Bold, Title Case Heading */
    readonly level1: {
        readonly bold: true;
        readonly italic: false;
        readonly centered: true;
        readonly leftAlign: false;
        readonly indented: false;
        readonly titleCase: true;
        readonly endWithPeriod: false;
        readonly inline: false;
    };
    /** Level 2: Flush Left, Bold, Title Case Heading */
    readonly level2: {
        readonly bold: true;
        readonly italic: false;
        readonly centered: false;
        readonly leftAlign: true;
        readonly indented: false;
        readonly titleCase: true;
        readonly endWithPeriod: false;
        readonly inline: false;
    };
    /** Level 3: Flush Left, Bold Italic, Title Case Heading */
    readonly level3: {
        readonly bold: true;
        readonly italic: true;
        readonly centered: false;
        readonly leftAlign: true;
        readonly indented: false;
        readonly titleCase: true;
        readonly endWithPeriod: false;
        readonly inline: false;
    };
    /** Level 4: Indented, Bold, Title Case Heading, Ending With Period. */
    readonly level4: {
        readonly bold: true;
        readonly italic: false;
        readonly centered: false;
        readonly leftAlign: false;
        readonly indented: true;
        readonly titleCase: true;
        readonly endWithPeriod: true;
        readonly inline: true;
    };
    /** Level 5: Indented, Bold Italic, Title Case Heading, Ending With Period. */
    readonly level5: {
        readonly bold: true;
        readonly italic: true;
        readonly centered: false;
        readonly leftAlign: false;
        readonly indented: true;
        readonly titleCase: true;
        readonly endWithPeriod: true;
        readonly inline: true;
    };
};
/** Type for APA heading style configuration */
export type ApaHeadingStyles = typeof APA_HEADING_STYLES;
/** Type for a single heading level configuration */
export type ApaHeadingLevel = ApaHeadingStyles[keyof ApaHeadingStyles];
/** Valid heading level keys */
export type HeadingLevelKey = keyof ApaHeadingStyles;
/**
 * APA 7th Edition reference list formatting.
 * Per Section 2.12: References start on new page.
 * Per Section 9.43: Hanging indent of 0.5 inches.
 */
export declare const APA_REFERENCES: {
    /** Hanging indent for reference entries */
    readonly hangingIndent: "0.5in";
    /** Sort entries alphabetically by author surname */
    readonly sortAlphabetically: true;
    /** Double-space all entries */
    readonly doubleSpaced: true;
    /** Start on new page */
    readonly newPage: true;
    /** Center the "References" heading */
    readonly headingCentered: true;
    /** Bold the "References" heading */
    readonly headingBold: true;
    /** Title for the section */
    readonly sectionTitle: "References";
};
/** Type for APA references configuration */
export type ApaReferences = typeof APA_REFERENCES;
/**
 * APA 7th Edition title page specifications.
 * Per Section 2.3-2.6: Professional paper title page elements.
 */
export declare const APA_TITLE_PAGE: {
    /** Title position from top (approximately 3-4 lines down) */
    readonly titlePosition: "upper-third";
    /** Title should be bold */
    readonly titleBold: true;
    /** Title case for title */
    readonly titleCase: true;
    /** Maximum recommended title length in words */
    readonly maxTitleWords: 12;
    /** Author name follows title */
    readonly authorFollowsTitle: true;
    /** Affiliation follows author */
    readonly affiliationFollowsAuthor: true;
    /** Include author note on title page for professional papers */
    readonly includeAuthorNote: true;
    /** Include running head on title page */
    readonly includeRunningHead: true;
    /** Page number on title page */
    readonly pageNumber: 1;
};
/** Type for APA title page configuration */
export type ApaTitlePage = typeof APA_TITLE_PAGE;
/**
 * APA 7th Edition abstract specifications.
 * Per Section 2.9: Abstract is a single paragraph without indentation.
 */
export declare const APA_ABSTRACT: {
    /** Maximum word count */
    readonly maxWords: 250;
    /** Section title */
    readonly sectionTitle: "Abstract";
    /** No paragraph indentation in abstract */
    readonly noIndent: true;
    /** Start on new page */
    readonly newPage: true;
    /** Keywords label */
    readonly keywordsLabel: "Keywords:";
    /** Keywords should be italicized */
    readonly keywordsItalic: true;
    /** Indent the keywords line */
    readonly keywordsIndented: true;
};
/** Type for APA abstract configuration */
export type ApaAbstract = typeof APA_ABSTRACT;
/**
 * APA 7th Edition paper section order.
 * Per Chapter 2: Standard order of manuscript pages.
 */
export declare const APA_SECTION_ORDER: readonly ["title-page", "abstract", "body", "references", "footnotes", "tables", "figures", "appendices"];
/** Type for section order */
export type ApaSectionOrder = typeof APA_SECTION_ORDER;
/** Type for individual section names */
export type ApaSectionName = ApaSectionOrder[number];
/**
 * APA 7th Edition table formatting.
 * Per Section 7.1-7.21: Table formatting guidelines.
 */
export declare const APA_TABLES: {
    /** Table number format */
    readonly numberPrefix: "Table";
    /** Table number is bold */
    readonly numberBold: true;
    /** Table title is italic */
    readonly titleItalic: true;
    /** Title case for table title */
    readonly titleCase: true;
    /** Notes prefix */
    readonly notePrefix: "Note.";
    /** Note prefix is italic */
    readonly notePrefixItalic: true;
    /** Single-space within table cells */
    readonly cellSpacing: 1;
    /** Double-space between table and text */
    readonly spacingFromText: 2;
};
/** Type for APA table configuration */
export type ApaTables = typeof APA_TABLES;
/**
 * APA 7th Edition figure formatting.
 * Per Section 7.22-7.36: Figure formatting guidelines.
 */
export declare const APA_FIGURES: {
    /** Figure number format */
    readonly numberPrefix: "Figure";
    /** Figure number is bold */
    readonly numberBold: true;
    /** Figure title is italic */
    readonly titleItalic: true;
    /** Title case for figure title */
    readonly titleCase: true;
    /** Notes prefix */
    readonly notePrefix: "Note.";
    /** Note prefix is italic */
    readonly notePrefixItalic: true;
    /** Double-space between figure and text */
    readonly spacingFromText: 2;
};
/** Type for APA figure configuration */
export type ApaFigures = typeof APA_FIGURES;
/**
 * APA 7th Edition appendix formatting.
 * Per Section 2.14: Appendix formatting guidelines.
 */
export declare const APA_APPENDICES: {
    /** Label for single appendix */
    readonly singleLabel: "Appendix";
    /** Label format for multiple appendices */
    readonly multiplePrefix: "Appendix";
    /** Use letters for multiple appendices (A, B, C) */
    readonly useLetters: true;
    /** Each appendix starts on new page */
    readonly newPage: true;
    /** Center the appendix label */
    readonly labelCentered: true;
    /** Bold the appendix label */
    readonly labelBold: true;
    /** Title follows label on same line or next */
    readonly titleOnNextLine: true;
};
/** Type for APA appendix configuration */
export type ApaAppendices = typeof APA_APPENDICES;
/**
 * PDF generator priority order.
 * Defines fallback chain for PDF generation methods.
 */
export declare const GENERATOR_PRIORITY: readonly ["pandoc-latex", "pandoc-html", "pdfkit", "puppeteer"];
/** Type for generator priority */
export type GeneratorPriority = typeof GENERATOR_PRIORITY;
/** Type for individual generator names */
export type GeneratorName = GeneratorPriority[number];
/**
 * Generator-specific configurations.
 */
export declare const GENERATOR_CONFIG: {
    readonly 'pandoc-latex': {
        /** Preferred for best APA compliance */
        readonly preferredForApa: true;
        /** Requires LaTeX installation */
        readonly requiresLatex: true;
        /** Output quality rating */
        readonly qualityRating: "high";
    };
    readonly 'pandoc-html': {
        /** Fallback when LaTeX unavailable */
        readonly preferredForApa: false;
        /** Uses wkhtmltopdf or similar */
        readonly requiresLatex: false;
        /** Output quality rating */
        readonly qualityRating: "medium";
    };
    readonly pdfkit: {
        /** Pure JavaScript solution */
        readonly preferredForApa: false;
        /** No external dependencies */
        readonly requiresLatex: false;
        /** Output quality rating */
        readonly qualityRating: "medium";
    };
    readonly puppeteer: {
        /** Browser-based rendering */
        readonly preferredForApa: false;
        /** Requires Chromium */
        readonly requiresLatex: false;
        /** Output quality rating */
        readonly qualityRating: "medium";
    };
};
/** Type for generator configuration */
export type GeneratorConfig = typeof GENERATOR_CONFIG;
/**
 * Validation limits and constraints for APA compliance checking.
 */
export declare const APA_VALIDATION_LIMITS: {
    /** Running head maximum characters */
    readonly runningHeadMaxChars: 50;
    /** Abstract maximum words */
    readonly abstractMaxWords: 250;
    /** Recommended title maximum words */
    readonly titleMaxWords: 12;
    /** Maximum heading levels */
    readonly maxHeadingLevels: 5;
    /** Minimum margin in inches */
    readonly minMarginInches: 1;
};
/** Type for validation limits */
export type ApaValidationLimits = typeof APA_VALIDATION_LIMITS;
/**
 * Aggregated APA configuration object for convenient access.
 */
export declare const APA_CONFIG: {
    readonly margins: {
        readonly top: "1in";
        readonly bottom: "1in";
        readonly left: "1in";
        readonly right: "1in";
    };
    readonly fonts: {
        /** Primary font family */
        readonly primary: "Times New Roman";
        /** Fallback fonts if primary unavailable */
        readonly fallback: readonly ["Georgia", "serif"];
        /** Font sizes in points */
        readonly size: {
            /** Body text - 12pt */
            readonly body: 12;
            /** Title page text - same as body per APA 7th */
            readonly title: 12;
            /** Level 1 heading - same as body, formatting distinguishes it */
            readonly heading1: 12;
            /** Level 2 heading */
            readonly heading2: 12;
            /** Level 3 heading */
            readonly heading3: 12;
            /** Level 4 heading */
            readonly heading4: 12;
            /** Level 5 heading */
            readonly heading5: 12;
            /** Page numbers */
            readonly pageNumber: 12;
            /** Footnotes - typically smaller */
            readonly footnote: 10;
        };
    };
    readonly spacing: {
        /** Line height multiplier - double-spaced */
        readonly lineHeight: 2;
        /** First line paragraph indent */
        readonly paragraphIndent: "0.5in";
        /** Space after paragraph (handled by line height) */
        readonly afterParagraph: 0;
        /** Space after heading (text follows on next double-spaced line) */
        readonly afterHeading: 0;
        /** Space before heading */
        readonly beforeHeading: 0;
    };
    readonly runningHead: {
        /** Maximum character length including spaces */
        readonly maxLength: 50;
        /** Position in document */
        readonly position: "header";
        /** Text alignment */
        readonly alignment: "left";
        /** Page number alignment */
        readonly pageNumberAlignment: "right";
        /** Whether to include "Running head:" label (only on title page for professional) */
        readonly includeLabelOnTitlePage: false;
        /** All caps for running head text */
        readonly allCaps: true;
    };
    readonly headingStyles: {
        /** Level 1: Centered, Bold, Title Case Heading */
        readonly level1: {
            readonly bold: true;
            readonly italic: false;
            readonly centered: true;
            readonly leftAlign: false;
            readonly indented: false;
            readonly titleCase: true;
            readonly endWithPeriod: false;
            readonly inline: false;
        };
        /** Level 2: Flush Left, Bold, Title Case Heading */
        readonly level2: {
            readonly bold: true;
            readonly italic: false;
            readonly centered: false;
            readonly leftAlign: true;
            readonly indented: false;
            readonly titleCase: true;
            readonly endWithPeriod: false;
            readonly inline: false;
        };
        /** Level 3: Flush Left, Bold Italic, Title Case Heading */
        readonly level3: {
            readonly bold: true;
            readonly italic: true;
            readonly centered: false;
            readonly leftAlign: true;
            readonly indented: false;
            readonly titleCase: true;
            readonly endWithPeriod: false;
            readonly inline: false;
        };
        /** Level 4: Indented, Bold, Title Case Heading, Ending With Period. */
        readonly level4: {
            readonly bold: true;
            readonly italic: false;
            readonly centered: false;
            readonly leftAlign: false;
            readonly indented: true;
            readonly titleCase: true;
            readonly endWithPeriod: true;
            readonly inline: true;
        };
        /** Level 5: Indented, Bold Italic, Title Case Heading, Ending With Period. */
        readonly level5: {
            readonly bold: true;
            readonly italic: true;
            readonly centered: false;
            readonly leftAlign: false;
            readonly indented: true;
            readonly titleCase: true;
            readonly endWithPeriod: true;
            readonly inline: true;
        };
    };
    readonly references: {
        /** Hanging indent for reference entries */
        readonly hangingIndent: "0.5in";
        /** Sort entries alphabetically by author surname */
        readonly sortAlphabetically: true;
        /** Double-space all entries */
        readonly doubleSpaced: true;
        /** Start on new page */
        readonly newPage: true;
        /** Center the "References" heading */
        readonly headingCentered: true;
        /** Bold the "References" heading */
        readonly headingBold: true;
        /** Title for the section */
        readonly sectionTitle: "References";
    };
    readonly titlePage: {
        /** Title position from top (approximately 3-4 lines down) */
        readonly titlePosition: "upper-third";
        /** Title should be bold */
        readonly titleBold: true;
        /** Title case for title */
        readonly titleCase: true;
        /** Maximum recommended title length in words */
        readonly maxTitleWords: 12;
        /** Author name follows title */
        readonly authorFollowsTitle: true;
        /** Affiliation follows author */
        readonly affiliationFollowsAuthor: true;
        /** Include author note on title page for professional papers */
        readonly includeAuthorNote: true;
        /** Include running head on title page */
        readonly includeRunningHead: true;
        /** Page number on title page */
        readonly pageNumber: 1;
    };
    readonly abstract: {
        /** Maximum word count */
        readonly maxWords: 250;
        /** Section title */
        readonly sectionTitle: "Abstract";
        /** No paragraph indentation in abstract */
        readonly noIndent: true;
        /** Start on new page */
        readonly newPage: true;
        /** Keywords label */
        readonly keywordsLabel: "Keywords:";
        /** Keywords should be italicized */
        readonly keywordsItalic: true;
        /** Indent the keywords line */
        readonly keywordsIndented: true;
    };
    readonly sectionOrder: readonly ["title-page", "abstract", "body", "references", "footnotes", "tables", "figures", "appendices"];
    readonly tables: {
        /** Table number format */
        readonly numberPrefix: "Table";
        /** Table number is bold */
        readonly numberBold: true;
        /** Table title is italic */
        readonly titleItalic: true;
        /** Title case for table title */
        readonly titleCase: true;
        /** Notes prefix */
        readonly notePrefix: "Note.";
        /** Note prefix is italic */
        readonly notePrefixItalic: true;
        /** Single-space within table cells */
        readonly cellSpacing: 1;
        /** Double-space between table and text */
        readonly spacingFromText: 2;
    };
    readonly figures: {
        /** Figure number format */
        readonly numberPrefix: "Figure";
        /** Figure number is bold */
        readonly numberBold: true;
        /** Figure title is italic */
        readonly titleItalic: true;
        /** Title case for figure title */
        readonly titleCase: true;
        /** Notes prefix */
        readonly notePrefix: "Note.";
        /** Note prefix is italic */
        readonly notePrefixItalic: true;
        /** Double-space between figure and text */
        readonly spacingFromText: 2;
    };
    readonly appendices: {
        /** Label for single appendix */
        readonly singleLabel: "Appendix";
        /** Label format for multiple appendices */
        readonly multiplePrefix: "Appendix";
        /** Use letters for multiple appendices (A, B, C) */
        readonly useLetters: true;
        /** Each appendix starts on new page */
        readonly newPage: true;
        /** Center the appendix label */
        readonly labelCentered: true;
        /** Bold the appendix label */
        readonly labelBold: true;
        /** Title follows label on same line or next */
        readonly titleOnNextLine: true;
    };
    readonly validationLimits: {
        /** Running head maximum characters */
        readonly runningHeadMaxChars: 50;
        /** Abstract maximum words */
        readonly abstractMaxWords: 250;
        /** Recommended title maximum words */
        readonly titleMaxWords: 12;
        /** Maximum heading levels */
        readonly maxHeadingLevels: 5;
        /** Minimum margin in inches */
        readonly minMarginInches: 1;
    };
};
/** Type for complete APA configuration */
export type ApaConfig = typeof APA_CONFIG;
//# sourceMappingURL=constants.d.ts.map