/**
 * Constitution Validator - Runtime validation of generated code against constitution.xml rules
 * @module src/god-agent/core/pipeline/constitution-validator
 * @see docs/god-agent-coding-pipeline/constitution.xml
 */
import { SherlockVerdict, type SherlockConfidence, type ISherlockEvidence, type ISherlockIssue } from './types.js';
/** Result from a single validation check */
export interface IValidationResult {
    passed: boolean;
    ruleId: string;
    ruleName: string;
    severity: 'error' | 'warning';
    message?: string;
    lineNumbers?: number[];
    actualValue?: number | string;
    expectedValue?: number | string;
}
/** Complete result from constitution validation */
export interface IConstitutionValidationResult {
    passed: boolean;
    validations: IValidationResult[];
    errorCount: number;
    warningCount: number;
    verdict: SherlockVerdict;
    confidence: SherlockConfidence;
    evidence: ISherlockEvidence[];
    issues: ISherlockIssue[];
    timestamp: string;
    filePath?: string;
}
/** File limits from constitution.xml coding_standards.file_limits */
export declare const CONSTITUTION_LIMITS: {
    readonly MAX_LINES_PER_FILE: 500;
    readonly MAX_LINES_PER_FUNCTION: 50;
    readonly MAX_LINES_PER_CLASS: 100;
    readonly MAX_PARAMETERS_PER_FUNCTION: 5;
    readonly MAX_NESTING_DEPTH: 4;
    readonly MAX_CYCLOMATIC_COMPLEXITY: 10;
};
/**
 * Constitution Validator - Validates code against constitution.xml rules
 * @example
 * const validator = new ConstitutionValidator();
 * const result = validator.validate(codeContent);
 */
export declare class ConstitutionValidator {
    private readonly maxLinesPerFile;
    private readonly maxLinesPerFunction;
    private readonly maxLinesPerClass;
    private readonly maxParameters;
    constructor(options?: {
        maxLinesPerFile?: number;
        maxLinesPerFunction?: number;
        maxLinesPerClass?: number;
        maxParameters?: number;
    });
    /** Validate file length against constitution limit */
    validateFileLength(content: string, maxLines?: number): IValidationResult;
    /** Validate function lengths against constitution limit */
    validateFunctionLength(content: string): IValidationResult;
    /** Validate class lengths against constitution limit */
    validateClassLength(content: string): IValidationResult;
    private findBraceBlockViolations;
    private createBlockViolationResult;
    /** Validate that no hardcoded secrets are present */
    validateNoSecrets(content: string): IValidationResult;
    /** Validate JSDoc presence for exported functions and classes */
    validateJSDocPresence(content: string): IValidationResult;
    private hasJSDocAbove;
    /** Validate function parameter count */
    validateParameterCount(content: string): IValidationResult;
    /** Run all constitution validations */
    validate(content: string, filePath?: string): IConstitutionValidationResult;
    /** Quick check if content passes all critical validations */
    quickCheck(content: string): boolean;
    /** Get a formatted report of validation results */
    getReport(result: IConstitutionValidationResult): string;
}
/** Create a ConstitutionValidator with default settings */
export declare function createConstitutionValidator(): ConstitutionValidator;
/** Create a ConstitutionValidator with custom limits */
export declare function createCustomConstitutionValidator(options: {
    maxLinesPerFile?: number;
    maxLinesPerFunction?: number;
    maxLinesPerClass?: number;
    maxParameters?: number;
}): ConstitutionValidator;
//# sourceMappingURL=constitution-validator.d.ts.map