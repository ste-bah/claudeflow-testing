/**
 * StyleApplier - Applies learned style profiles to chapter content
 *
 * Implements SPEC-FUNC-001 Section 2.7 (addresses GAP-C005)
 * Provides regional spelling, citation formatting, heading styles,
 * and punctuation conventions.
 *
 * Constitution Compliance:
 * - ST-001: Style profile MUST be applied consistently
 * - QA-002: Validation MUST report all violations
 * - FS-002: No filesystem operations in this module
 *
 * @module style-applier
 */
import type { StyleCharacteristics, StyleValidationResult, ChapterNumber } from './types.js';
/**
 * Input for style application
 */
export interface StyleApplierInput {
    /** Content to apply style to */
    content: string;
    /** Style characteristics (null for no-op) */
    style: StyleCharacteristics | null;
    /** Chapter number for context */
    chapterNumber: ChapterNumber;
}
/**
 * Output from style application
 */
export interface StyleApplierOutput {
    /** Content with style applied */
    styledContent: string;
    /** Validation result */
    validation: StyleValidationResult;
    /** List of transformations applied */
    transformationsApplied: string[];
}
/**
 * Applies style profiles to chapter content
 *
 * Implements SPEC-FUNC-001 Section 2.7:
 * - Regional spelling (en-GB vs en-US)
 * - Citation format application
 * - Heading style normalization
 * - Punctuation conventions
 * - Contraction expansion
 */
export declare class StyleApplier {
    /**
     * Apply style profile to content
     *
     * @param input - Input containing content, style, and chapter number
     * @returns Styled content with validation and transformation list
     */
    applyStyle(input: StyleApplierInput): Promise<StyleApplierOutput>;
    /**
     * Validate content against style profile
     *
     * @param content - Content to validate
     * @param style - Style characteristics to validate against
     * @returns Validation result with compliance status and violations
     */
    validateStyle(content: string, style: StyleCharacteristics): StyleValidationResult;
    /**
     * Apply regional spelling transformations
     *
     * @param content - Content to transform
     * @param region - Target region ('en-GB' or 'en-US')
     * @returns Transformed content
     */
    private applyRegionalSpelling;
    /**
     * Find US spellings in content (for en-GB validation)
     */
    private findUSSpellings;
    /**
     * Find UK spellings in content (for en-US validation)
     */
    private findUKSpellings;
    /**
     * Apply citation format transformations
     *
     * @param content - Content to transform
     * @param format - Target citation format ('APA', 'MLA', 'Chicago')
     * @returns Transformed content
     */
    private applyCitationFormat;
    /**
     * Validate citation format consistency
     */
    private validateCitationFormat;
    /**
     * Apply heading style transformations
     *
     * @param content - Content to transform
     * @param style - Heading style ('sentence' or 'title')
     * @returns Transformed content
     */
    private applyHeadingStyle;
    /**
     * Convert text to sentence case
     * Only first word and proper nouns capitalized
     */
    private toSentenceCase;
    /**
     * Convert text to title case
     * Major words capitalized
     */
    private toTitleCase;
    /**
     * Check if word is likely a proper noun
     */
    private isLikelyProperNoun;
    /**
     * Validate heading style compliance
     */
    private validateHeadingStyle;
    /**
     * Apply punctuation style conventions
     *
     * @param content - Content to transform
     * @param preferences - Punctuation preferences
     * @returns Transformed content
     */
    private applyPunctuationStyle;
    /**
     * Expand all contractions in content
     *
     * @param content - Content to transform
     * @returns Object with transformed content and count
     */
    private expandContractions;
    /**
     * Find remaining contractions for validation
     */
    private findContractions;
    /**
     * Protect technical content from style transformations (CC005)
     *
     * @param content - Original content
     * @returns Protected content with placeholders and placeholder map
     */
    private protectTechnicalContent;
    /**
     * Restore protected technical content after transformations (CC005)
     *
     * @param content - Content with placeholders
     * @param placeholders - Placeholder to original content map
     * @returns Restored content
     */
    private restoreTechnicalContent;
    /**
     * Escape special regex characters in a string
     */
    private escapeRegex;
    /**
     * Preserve the case pattern of the original word when replacing
     */
    private preserveCase;
    /**
     * Count words in content
     */
    private countWords;
}
//# sourceMappingURL=style-applier.d.ts.map