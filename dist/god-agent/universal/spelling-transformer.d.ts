/**
 * SpellingTransformer - UK/US English spelling transformation
 *
 * Provides transformation between US and UK English spelling conventions,
 * along with automatic variant detection for source text analysis.
 *
 * @module spelling-transformer
 * Implements [REQ-STYLE-002]: Spelling transformation
 * Implements [REQ-STYLE-006]: Variant detection
 */
/**
 * Represents a single spelling transformation rule
 */
export interface SpellingRule {
    /** Regular expression pattern to match */
    pattern: RegExp;
    /** Replacement string (may contain capture group references like $1) */
    replacement: string;
    /** Human-readable description of the rule */
    description: string;
    /** Words that should be excluded from this rule */
    exceptions?: string[];
}
/**
 * Represents a grammar transformation rule (Phase 2)
 */
export interface GrammarRule {
    /** Regular expression pattern to match */
    pattern: RegExp;
    /** Replacement string */
    replacement: string;
    /** Human-readable description of the rule */
    description: string;
    /** Context where this rule applies */
    context?: 'narrative' | 'dialogue' | 'all';
}
/**
 * Result of automatic language variant detection
 */
export interface VariantDetectionResult {
    /** Detected language variant */
    variant: 'en-US' | 'en-GB' | 'mixed';
    /** Confidence score (0-1) */
    confidence: number;
    /** Count of UK spelling patterns found */
    ukSpellingCount: number;
    /** Count of US spelling patterns found */
    usSpellingCount: number;
    /** Total words checked for variant markers */
    totalChecked: number;
}
/**
 * SpellingTransformer - Transforms text between US and UK English spelling
 *
 * @example
 * ```typescript
 * const transformer = new SpellingTransformer('en-GB');
 * const ukText = transformer.transform('The organization will analyze the color.');
 * // Returns: 'The organisation will analyse the colour.'
 * ```
 *
 * Implements [REQ-STYLE-002]: Spelling transformation
 * Implements [REQ-STYLE-006]: Variant detection
 */
export declare class SpellingTransformer {
    private variant;
    private spellingRules;
    private grammarRules;
    private exceptions;
    /**
     * Creates a new SpellingTransformer instance
     * @param variant - Target language variant ('en-US' or 'en-GB')
     */
    constructor(variant: 'en-US' | 'en-GB');
    /**
     * Transforms text to the target language variant's spelling
     *
     * @param text - Input text to transform
     * @returns Transformed text with target variant spelling
     *
     * Implements [REQ-STYLE-002]: Spelling transformation
     */
    transform(text: string): string;
    /**
     * Detects the language variant of the given text
     *
     * @param text - Text to analyze for language variant
     * @returns Detection result with variant, confidence, and counts
     *
     * Implements [REQ-STYLE-006]: Variant detection
     */
    detectVariant(text: string): VariantDetectionResult;
    /**
     * Gets the current target variant
     * @returns The language variant this transformer targets
     */
    getVariant(): 'en-US' | 'en-GB';
    /**
     * Gets spelling rules for the specified variant
     *
     * @param variant - Language variant to get rules for
     * @returns Array of spelling rules (empty for en-US)
     *
     * Implements [REQ-STYLE-002]: Spelling transformation rules
     */
    static getSpellingRules(variant: 'en-US' | 'en-GB'): SpellingRule[];
    /**
     * Gets grammar rules for the specified variant
     *
     * @param variant - Language variant to get rules for
     * @returns Array of grammar rules
     *
     * Implements [REQ-STYLE-003]: Grammar transformation rules
     */
    static getGrammarRules(variant: 'en-US' | 'en-GB'): GrammarRule[];
}
//# sourceMappingURL=spelling-transformer.d.ts.map