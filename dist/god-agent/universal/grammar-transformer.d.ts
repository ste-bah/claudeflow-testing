/**
 * GrammarTransformer - UK/US English grammar transformation
 *
 * Handles grammar conventions that differ between US and UK English:
 * - Collective nouns (singular vs plural verb agreement)
 * - Past participles (gotten vs got, proven vs proved)
 * - Preposition usage (different to vs different from)
 *
 * @module grammar-transformer
 * Implements [REQ-STYLE-003]: Grammar transformation
 */
/**
 * Represents a single grammar transformation rule
 */
export interface GrammarRule {
    /** Unique rule identifier */
    id: string;
    /** Regular expression pattern to match */
    pattern: RegExp;
    /** Replacement string (may contain capture group references like $1) */
    replacement: string;
    /** Human-readable description of the rule */
    description: string;
    /** Rule category for filtering */
    category: 'collective-noun' | 'past-participle' | 'preposition';
    /** Whether rule applies only to narrative text (not quotes) */
    narrativeOnly: boolean;
}
/**
 * Result of grammar transformation operation
 */
export interface GrammarTransformResult {
    /** Transformed text */
    transformed: string;
    /** Array of rule IDs that were applied */
    rulesApplied: string[];
    /** Total number of changes made */
    changeCount: number;
}
/**
 * GrammarTransformer - Transforms text between US and UK English grammar conventions
 *
 * @example
 * ```typescript
 * const transformer = new GrammarTransformer('en-GB');
 * const result = transformer.transform('I had gotten it different than expected.');
 * // Returns: { transformed: 'I had got it different from expected.', rulesApplied: [...], changeCount: 2 }
 * ```
 *
 * Implements [REQ-STYLE-003]: Grammar transformation
 */
export declare class GrammarTransformer {
    private variant;
    private grammarRules;
    /**
     * Creates a new GrammarTransformer instance
     * @param variant - Target language variant ('en-US' or 'en-GB')
     * @param options - Optional configuration for enabled categories
     */
    constructor(variant: 'en-US' | 'en-GB', options?: {
        enabledCategories?: string[];
    });
    /**
     * Transform text grammar to target variant
     * @param text - Input text
     * @param options - Transformation options
     * @returns Transformation result with text, rules applied, and change count
     *
     * Implements [REQ-STYLE-003]: Grammar transformation
     */
    transform(text: string, options?: {
        narrativeOnly?: boolean;
        preserveQuotes?: boolean;
        categories?: ('collective-noun' | 'past-participle' | 'preposition')[];
    }): GrammarTransformResult;
    /**
     * Transform text, preserving quoted sections
     * @param text - Input text
     * @param rule - Grammar rule to apply
     * @returns Transformed text and change count
     */
    private transformOutsideQuotes;
    /**
     * Get rules by category
     * @param category - Rule category to filter by
     * @returns Array of rules in the specified category
     */
    getRulesByCategory(category: string): GrammarRule[];
    /**
     * Gets the current target variant
     * @returns The language variant this transformer targets
     */
    getVariant(): 'en-US' | 'en-GB';
    /**
     * Gets grammar rules for the specified variant
     *
     * @param variant - Language variant to get rules for
     * @returns Array of grammar rules (empty for en-US)
     *
     * Implements [REQ-STYLE-003]: Grammar transformation rules
     */
    static getGrammarRules(variant: 'en-US' | 'en-GB'): GrammarRule[];
}
//# sourceMappingURL=grammar-transformer.d.ts.map