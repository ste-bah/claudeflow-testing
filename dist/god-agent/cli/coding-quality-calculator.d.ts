/**
 * CodingQualityCalculator - Discriminating quality scoring for coding pipeline outputs
 * Produces quality scores in the 0.30-0.95 range based on 5 factors
 * Mirrors PhDQualityCalculator architecture adapted for code-specific metrics
 */
export interface ICodingQualityContext {
    agentKey?: string;
    phase?: number;
    expectedMinLength?: number;
    isCriticalAgent?: boolean;
    isImplementationAgent?: boolean;
    isDocumentAgent?: boolean;
}
export interface ICodingQualityBreakdown {
    codeQuality: number;
    completeness: number;
    structuralIntegrity: number;
    documentationScore: number;
    testCoverage: number;
    rawTotal: number;
    phaseWeight: number;
    total: number;
}
export interface ICodingQualityAssessment {
    score: number;
    breakdown: ICodingQualityBreakdown;
    meetsPatternThreshold: boolean;
    tier: 'excellent' | 'good' | 'adequate' | 'poor';
    summary: string;
}
export interface ICodingQualityCalculator {
    calculateQuality(output: unknown, context?: ICodingQualityContext): number;
    assessQuality(output: unknown, context?: ICodingQualityContext): ICodingQualityAssessment;
}
/**
 * Phase-specific weight multipliers for the 7-phase coding pipeline
 */
export declare const CODING_PHASE_WEIGHTS: Record<number, number>;
/**
 * Expected minimum output lengths for all 47 coding agents
 */
export declare const CODING_AGENT_MIN_LENGTHS: Record<string, number>;
/**
 * Tiered scoring based on code line count
 */
export declare const CODE_QUALITY_TIERS: readonly [{
    readonly minLines: 5;
    readonly score: 0.03;
}, {
    readonly minLines: 15;
    readonly score: 0.06;
}, {
    readonly minLines: 30;
    readonly score: 0.1;
}, {
    readonly minLines: 60;
    readonly score: 0.15;
}, {
    readonly minLines: 100;
    readonly score: 0.2;
}, {
    readonly minLines: 200;
    readonly score: 0.25;
}, {
    readonly minLines: 500;
    readonly score: 0.28;
}, {
    readonly minLines: 1000;
    readonly score: 0.3;
}];
/**
 * Agents critical for pipeline success (reviewers, key decision makers)
 */
export declare const CRITICAL_CODING_AGENTS: string[];
/**
 * Agents that produce actual implementation code
 */
export declare const IMPLEMENTATION_AGENTS: string[];
/** Word count tiers for document agents (replaces code line count) */
export declare const DOCUMENT_DEPTH_TIERS: readonly [{
    readonly minWords: 50;
    readonly score: 0.08;
}, {
    readonly minWords: 100;
    readonly score: 0.14;
}, {
    readonly minWords: 200;
    readonly score: 0.2;
}, {
    readonly minWords: 400;
    readonly score: 0.25;
}, {
    readonly minWords: 600;
    readonly score: 0.28;
}, {
    readonly minWords: 800;
    readonly score: 0.3;
}, {
    readonly minWords: 1500;
    readonly score: 0.3;
}, {
    readonly minWords: 3000;
    readonly score: 0.3;
}];
/** Expected sections/keywords for document agents by role */
export declare const DOCUMENT_EXPECTED_SECTIONS: Record<string, string[]>;
/**
 * Expected output patterns for each agent
 */
export declare const CODING_EXPECTED_OUTPUTS: Record<string, string[]>;
export declare class CodingQualityCalculator implements ICodingQualityCalculator {
    private readonly patternThreshold;
    calculateQuality(output: unknown, context?: ICodingQualityContext): number;
    assessQuality(output: unknown, context?: ICodingQualityContext): ICodingQualityAssessment;
    /**
     * Calculate code quality factor (max 0.30)
     * - Code blocks: 0.08 (codeBlocks >= 1: +0.04, >= 2: +0.02, >= 4: +0.02)
     * - Functions/classes: 0.08 (funcCount >= 1: +0.03, >= 2: +0.02, >= 4: +0.02, >= 8: +0.01)
     * - Imports/exports: 0.06 (count >= 1: +0.03, >= 2: +0.02, >= 4: +0.01)
     * - Code length tiers: 0.08 (tiered based on line count)
     */
    private calculateCodeQuality;
    /**
     * Calculate completeness factor (max 0.25)
     * - Agent expected outputs: 0.10 (foundCount / expectedOutputs.length)
     * - Structural elements: 0.08 (export, import, code block types)
     * - Completion indicators: 0.04 (task complete, files created)
     * - Cross-references: 0.03
     */
    private calculateCompleteness;
    /**
     * Calculate structural integrity factor (max 0.20)
     * - Type annotations: 0.06 (typeCount >= 1: +0.02, >= 5: +0.02, >= 12: +0.02)
     * - Error handling: 0.06 (errorCount >= 1: +0.03, >= 3: +0.02, >= 5: +0.01)
     * - Modularity: 0.04 (private/public, readonly/static, abstract)
     * - Design patterns: 0.04 (factory, builder, repository, etc.)
     */
    private calculateStructuralIntegrity;
    /**
     * Calculate documentation factor (max 0.15)
     * - JSDoc: 0.06 (/** *\/, @param, @returns)
     * - Inline comments: 0.04
     * - README sections: 0.03
     * - Markdown formatting: 0.02
     */
    private calculateDocumentation;
    /**
     * Calculate test coverage factor (max 0.10)
     * - Test patterns: 0.04 (describe, it, test, expect)
     * - Mock patterns: 0.03
     * - Coverage mentions: 0.02
     * - Testing agent bonus: 1.2x multiplier
     */
    private calculateTestCoverage;
    /**
     * Calculate content depth for document agents (max 0.30)
     * Replaces calculateCodeQuality — measures substance via word count
     */
    private calculateContentDepth;
    /**
     * Calculate document completeness (max 0.25)
     * Replaces calculateCompleteness — agent-specific section coverage
     */
    private calculateDocumentCompleteness;
    /**
     * Calculate design rigor (max 0.20)
     * Replaces calculateStructuralIntegrity — measures analytical depth
     */
    private calculateDesignRigor;
    /**
     * Calculate document structure quality (max 0.15)
     * Replaces calculateDocumentation — measures formatting quality
     */
    private calculateDocumentStructure;
    /**
     * Calculate actionability for downstream agents (max 0.10)
     * Replaces calculateTestCoverage — measures usefulness for next agents
     */
    private calculateActionability;
    /**
     * Count words in text, stripping code blocks, inline code, and markdown formatting
     */
    private countWords;
    /**
     * Extract text content from various output formats
     */
    private extractText;
    /**
     * Count lines of code (excluding empty lines and pure comments)
     */
    private countCodeLines;
    /**
     * Determine quality tier based on score
     */
    private determineTier;
    /**
     * Generate human-readable quality summary
     */
    private generateSummary;
}
/**
 * Singleton instance of CodingQualityCalculator
 */
export declare const codingQualityCalculator: CodingQualityCalculator;
/**
 * Calculate quality score for coding pipeline output
 * @param output - The output to assess (string or object with content field)
 * @param context - Optional context including agent key and phase
 * @returns Quality score between 0 and 0.95
 */
export declare function calculateCodingQuality(output: unknown, context?: ICodingQualityContext): number;
/**
 * Perform full quality assessment with breakdown
 * @param output - The output to assess
 * @param context - Optional context including agent key and phase
 * @returns Full assessment including score, breakdown, tier, and summary
 */
export declare function assessCodingQuality(output: unknown, context?: ICodingQualityContext): ICodingQualityAssessment;
/**
 * Create a quality context for a specific agent and phase
 * @param agentKey - The agent identifier
 * @param phase - Optional phase number (1-7)
 * @returns Populated context object
 */
export declare function createCodingQualityContext(agentKey: string, phase?: number): ICodingQualityContext;
//# sourceMappingURL=coding-quality-calculator.d.ts.map