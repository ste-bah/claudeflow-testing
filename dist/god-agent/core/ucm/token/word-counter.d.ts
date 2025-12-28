/**
 * Word Counter Service
 * Accurate word counting with special handling for code blocks, tables, and citations
 *
 * CONSTITUTION RULES: RULE-020 (accuracy)
 */
import type { IWordCounter } from '../types.js';
/**
 * Word counting utility for token estimation
 * Handles special content types appropriately
 */
export declare class WordCounter implements IWordCounter {
    /**
     * Count words in text with accurate handling of special content
     * @param text - Input text to count words
     * @returns Number of words
     */
    count(text: string): number;
    /**
     * Count words by splitting text into segments
     * Useful for validation and debugging
     */
    countDetailed(text: string): {
        total: number;
        prose: number;
        code: number;
        tables: number;
    };
}
//# sourceMappingURL=word-counter.d.ts.map