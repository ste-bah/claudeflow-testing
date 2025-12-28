/**
 * Content Classifier Service
 * Detects content type and provides detailed breakdown
 *
 * CONSTITUTION RULES: RULE-001 to RULE-006
 */
import type { IContentClassifier, ITokenBreakdown } from '../types.js';
import { ContentType } from '../types.js';
/**
 * Content type classification for accurate token estimation
 */
export declare class ContentClassifier implements IContentClassifier {
    private wordCounter;
    constructor();
    /**
     * Classify content type based on dominant content
     * @param text - Input text to classify
     * @returns Primary content type
     */
    classify(text: string): ContentType;
    /**
     * Classify content with detailed breakdown by type
     * @param text - Input text to classify
     * @returns Array of token breakdowns by content type
     */
    classifyDetailed(text: string): ITokenBreakdown[];
    /**
     * Check if text contains code blocks
     */
    hasCodeBlocks(text: string): boolean;
    /**
     * Check if text contains tables
     */
    hasTables(text: string): boolean;
    /**
     * Check if text contains citations
     */
    hasCitations(text: string): boolean;
}
//# sourceMappingURL=content-classifier.d.ts.map