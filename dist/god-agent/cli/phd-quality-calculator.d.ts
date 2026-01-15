/**
 * PhDQualityCalculator - Discriminating quality scoring for PhD research pipeline outputs
 * Produces quality scores in the 0.30-0.95 range based on 5 factors
 */
export interface IQualityContext {
    agentKey?: string;
    phase?: number;
    expectedMinLength?: number;
    isWritingAgent?: boolean;
    isCriticalAgent?: boolean;
}
export interface IQualityBreakdown {
    contentDepth: number;
    structuralQuality: number;
    researchRigor: number;
    completeness: number;
    formatQuality: number;
    rawTotal: number;
    phaseWeight: number;
    total: number;
}
export interface IQualityAssessment {
    score: number;
    breakdown: IQualityBreakdown;
    meetsPatternThreshold: boolean;
    tier: 'excellent' | 'good' | 'adequate' | 'poor';
    summary: string;
}
export interface IPhDQualityCalculator {
    calculateQuality(output: unknown, context?: IQualityContext): number;
    assessQuality(output: unknown, context?: IQualityContext): IQualityAssessment;
}
export declare const CONTENT_DEPTH_TIERS: readonly [{
    readonly minWords: 100;
    readonly score: 0.02;
}, {
    readonly minWords: 300;
    readonly score: 0.04;
}, {
    readonly minWords: 500;
    readonly score: 0.06;
}, {
    readonly minWords: 1000;
    readonly score: 0.1;
}, {
    readonly minWords: 2000;
    readonly score: 0.14;
}, {
    readonly minWords: 4000;
    readonly score: 0.18;
}, {
    readonly minWords: 8000;
    readonly score: 0.22;
}, {
    readonly minWords: 15000;
    readonly score: 0.25;
}];
export declare const PHASE_WEIGHTS: Record<number, number>;
export declare const AGENT_MIN_LENGTHS: Record<string, number>;
export declare const CRITICAL_AGENTS: string[];
export declare const WRITING_AGENTS: string[];
export declare class PhDQualityCalculator implements IPhDQualityCalculator {
    private readonly patternThreshold;
    calculateQuality(output: unknown, context?: IQualityContext): number;
    assessQuality(output: unknown, context?: IQualityContext): IQualityAssessment;
    private calculateContentDepth;
    private calculateStructuralQuality;
    private calculateResearchRigor;
    private calculateCompleteness;
    private calculateFormatQuality;
    private extractText;
    private countWords;
    private determineTier;
    private generateSummary;
}
export declare const phdQualityCalculator: PhDQualityCalculator;
export declare function calculatePhDQuality(output: unknown, context?: IQualityContext): number;
export declare function assessPhDQuality(output: unknown, context?: IQualityContext): IQualityAssessment;
export declare function createQualityContext(agentKey: string, phase?: number): IQualityContext;
//# sourceMappingURL=phd-quality-calculator.d.ts.map