/**
 * StyleAnalyzer - Extracts writing characteristics from text samples
 * Used to learn and replicate writing styles for the God Agent
 */
import { SpellingRule } from './spelling-transformer.js';
import { GrammarRule } from './grammar-transformer.js';
export interface SentenceMetrics {
    averageLength: number;
    lengthVariance: number;
    shortSentenceRatio: number;
    mediumSentenceRatio: number;
    longSentenceRatio: number;
    complexSentenceRatio: number;
}
export interface VocabularyMetrics {
    uniqueWordRatio: number;
    averageWordLength: number;
    academicWordRatio: number;
    technicalTermDensity: number;
    latinateWordRatio: number;
    contractionUsage: number;
}
export interface StructureMetrics {
    paragraphLengthAvg: number;
    transitionWordDensity: number;
    passiveVoiceRatio: number;
    firstPersonUsage: number;
    thirdPersonUsage: number;
    questionFrequency: number;
    listUsage: number;
}
export interface ToneMetrics {
    formalityScore: number;
    objectivityScore: number;
    hedgingFrequency: number;
    assertivenessScore: number;
    emotionalTone: number;
}
/**
 * Regional language settings for style profiles
 * Implements [REQ-STYLE-001]: Language variant configuration
 */
export interface RegionalSettings {
    /** Language variant: 'en-US', 'en-GB', or 'auto' for detection */
    languageVariant: 'en-US' | 'en-GB' | 'auto';
    /** Spelling transformation rules for this variant */
    spellingRules: SpellingRule[];
    /** Grammar transformation rules (Phase 2) */
    grammarRules: GrammarRule[];
    /** Date format preference */
    dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
    /** Primary quotation mark style */
    primaryQuoteMark: '"' | "'";
    /** Confidence score if auto-detected (0-1) */
    detectedConfidence?: number;
}
export interface StyleCharacteristics {
    sentences: SentenceMetrics;
    vocabulary: VocabularyMetrics;
    structure: StructureMetrics;
    tone: ToneMetrics;
    samplePhrases: string[];
    commonTransitions: string[];
    openingPatterns: string[];
    citationStyle: string;
    /**
     * Regional language settings (UK vs US English)
     * Optional - undefined for legacy profiles (backward compatibility)
     * Implements [REQ-STYLE-001, REQ-STYLE-007]
     */
    regional?: RegionalSettings;
}
export declare class StyleAnalyzer {
    /**
     * Analyze a text sample and extract style characteristics
     */
    analyze(text: string): StyleCharacteristics;
    /**
     * Merge multiple style analyses into a composite profile
     */
    mergeAnalyses(analyses: StyleCharacteristics[]): StyleCharacteristics;
    /**
     * Analyze text and detect regional language variant
     * @param text - Text to analyze
     * @param preferredVariant - Preferred variant or 'auto' for detection
     * @returns StyleCharacteristics with regional settings
     * Implements [REQ-STYLE-001, REQ-STYLE-006]
     */
    analyzeWithRegional(text: string, preferredVariant?: 'en-US' | 'en-GB' | 'auto'): StyleCharacteristics;
    /**
     * Generate a style prompt from characteristics
     * Implements [REQ-STYLE-005]
     */
    generateStylePrompt(style: StyleCharacteristics): string;
    private extractSentences;
    private extractWords;
    private extractParagraphs;
    private analyzeSentences;
    private analyzeVocabulary;
    private analyzeStructure;
    private analyzeTone;
    private extractCharacteristicPhrases;
    private extractTransitions;
    private extractOpeningPatterns;
    private detectCitationStyle;
    private estimateTechnicalDensity;
    private averageSentenceMetrics;
    private averageVocabularyMetrics;
    private averageStructureMetrics;
    private averageToneMetrics;
    private avg;
    private mergeArrays;
    private mostCommon;
}
//# sourceMappingURL=style-analyzer.d.ts.map