/**
 * Quality Gate Validator
 * TASK-BRG-001 - Validates agent outputs against quality gates
 *
 * Provides validation of agent execution results against
 * defined quality criteria including citations, completeness,
 * and format requirements.
 */
import type { IAgentDefinition, IAgentResult } from '../orchestration/orchestration-types.js';
/**
 * Individual quality check result
 */
export interface IQualityCheck {
    /** Check name/description */
    name: string;
    /** Whether check passed */
    passed: boolean;
    /** Failure reason (if not passed) */
    reason?: string;
    /** Extracted value (if applicable) */
    value?: string | number;
    /** Expected value (if applicable) */
    expected?: string | number;
}
/**
 * Complete quality gate validation result
 */
export interface IQualityValidationResult {
    /** Overall pass/fail */
    passed: boolean;
    /** Individual check results */
    checks: IQualityCheck[];
    /** Summary score (0-1) */
    score: number;
    /** Timestamp of validation */
    validatedAt: number;
    /** Agent that was validated */
    agentName: string;
    /** Quality gate string that was parsed */
    qualityGate: string;
}
/**
 * Quality gate rule definition
 */
export interface IQualityRule {
    /** Pattern to match in quality gate string */
    pattern: RegExp;
    /** Validation function */
    validate: (output: string, match: RegExpMatchArray) => IQualityCheck;
}
/**
 * Built-in quality validation rules
 */
export declare const DEFAULT_QUALITY_RULES: IQualityRule[];
/**
 * Quality Gate Validator
 *
 * Parses quality gate strings and validates agent output against them.
 */
export declare class QualityGateValidator {
    private rules;
    constructor(customRules?: IQualityRule[]);
    /**
     * Validate agent output against quality gate
     */
    validate(output: string, agent: IAgentDefinition, result?: IAgentResult): IQualityValidationResult;
    /**
     * Quick check if output passes quality gate
     */
    quickCheck(output: string, agent: IAgentDefinition): boolean;
    /**
     * Get detailed failure report
     */
    getFailureReport(result: IQualityValidationResult): string;
    /**
     * Add custom validation rule
     */
    addRule(rule: IQualityRule): void;
    /**
     * Parse quality gate string into individual requirements
     */
    parseQualityGate(qualityGate: string): string[];
}
/**
 * Create a quality gate validator with PhD-specific rules
 */
export declare function createPhDQualityGateValidator(): QualityGateValidator;
//# sourceMappingURL=phd-quality-gate-validator.d.ts.map