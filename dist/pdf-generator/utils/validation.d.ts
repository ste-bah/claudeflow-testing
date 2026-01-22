/**
 * APA 7th Edition Validation Utilities
 *
 * Provides validation functions for ensuring APA compliance in academic papers.
 * All functions are pure and return structured ValidationResult objects.
 *
 * Reference: American Psychological Association. (2020). Publication manual
 * of the American Psychological Association (7th ed.).
 *
 * @module pdf-generator/utils/validation
 */
/** Result of a validation operation. */
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}
/** A validation error indicating a critical APA compliance issue. */
export interface ValidationError {
    code: string;
    message: string;
    field: string;
    received?: unknown;
    expected?: unknown;
}
/** A validation warning indicating a non-critical issue. */
export interface ValidationWarning {
    code: string;
    message: string;
    suggestion?: string;
}
/** Author information for APA paper. */
export interface AuthorInfo {
    name: string;
    affiliation?: string;
    orcid?: string;
}
/** Complete paper input for validation. */
export interface PaperInput {
    title: string;
    runningHead?: string;
    authors: AuthorInfo[];
    abstract?: string;
    keywords?: string[];
    body: string;
    references?: string[];
}
export declare const ValidationErrorCodes: {
    readonly RUNNING_HEAD_TOO_LONG: "RUNNING_HEAD_TOO_LONG";
    readonly RUNNING_HEAD_NOT_UPPERCASE: "RUNNING_HEAD_NOT_UPPERCASE";
    readonly RUNNING_HEAD_EMPTY: "RUNNING_HEAD_EMPTY";
    readonly ABSTRACT_TOO_LONG: "ABSTRACT_TOO_LONG";
    readonly ABSTRACT_EMPTY: "ABSTRACT_EMPTY";
    readonly TITLE_REQUIRED: "TITLE_REQUIRED";
    readonly TITLE_WHITESPACE_ONLY: "TITLE_WHITESPACE_ONLY";
    readonly AUTHOR_NAME_REQUIRED: "AUTHOR_NAME_REQUIRED";
    readonly AUTHOR_NAME_EMPTY: "AUTHOR_NAME_EMPTY";
    readonly NO_AUTHORS: "NO_AUTHORS";
    readonly REFERENCE_MISSING_AUTHOR: "REFERENCE_MISSING_AUTHOR";
    readonly REFERENCE_MISSING_YEAR: "REFERENCE_MISSING_YEAR";
    readonly REFERENCE_MISSING_TITLE: "REFERENCE_MISSING_TITLE";
    readonly REFERENCE_MALFORMED: "REFERENCE_MALFORMED";
    readonly HEADING_LEVEL_INVALID: "HEADING_LEVEL_INVALID";
    readonly BODY_EMPTY: "BODY_EMPTY";
    readonly ORCID_INVALID_FORMAT: "ORCID_INVALID_FORMAT";
};
export declare const ValidationWarningCodes: {
    readonly RUNNING_HEAD_MIXED_CASE: "RUNNING_HEAD_MIXED_CASE";
    readonly ABSTRACT_NEAR_LIMIT: "ABSTRACT_NEAR_LIMIT";
    readonly TITLE_RECOMMENDED_LENGTH: "TITLE_RECOMMENDED_LENGTH";
    readonly MISSING_AFFILIATION: "MISSING_AFFILIATION";
    readonly MISSING_ABSTRACT: "MISSING_ABSTRACT";
    readonly MISSING_KEYWORDS: "MISSING_KEYWORDS";
    readonly FEW_REFERENCES: "FEW_REFERENCES";
    readonly REFERENCE_LOWERCASE_START: "REFERENCE_LOWERCASE_START";
};
/** Counts words in a text string. */
export declare function countWords(text: string): number;
/** Checks if a string is entirely uppercase. */
export declare function isUppercase(text: string): boolean;
/** Validates ORCID format: 0000-0000-0000-000X where X can be 0-9 or X. */
export declare function isValidOrcid(orcid: string): boolean;
/** Merges multiple validation results into one. */
export declare function mergeValidationResults(...results: ValidationResult[]): ValidationResult;
/** Validates a running head for APA 7th Edition compliance. Max 50 chars, ALL CAPS. */
export declare function validateRunningHead(text: string): ValidationResult;
/** Validates an abstract for APA 7th Edition compliance. Max 250 words. */
export declare function validateAbstract(text: string): ValidationResult;
/** Validates a paper title for APA 7th Edition compliance. Required, <=12 words recommended. */
export declare function validateTitle(title: string): ValidationResult;
/** Validates author information for APA 7th Edition compliance. */
export declare function validateAuthor(author: AuthorInfo): ValidationResult;
/** Validates a reference entry for basic APA format compliance. */
export declare function validateReference(ref: string): ValidationResult;
/** Validates a heading level for APA 7th Edition compliance. Must be 1-5. */
export declare function validateHeadingLevel(level: number): ValidationResult;
/** Validates a complete paper input for APA 7th Edition compliance. */
export declare function validatePaper(paper: PaperInput): ValidationResult;
export declare const isValidRunningHead: (text: string) => boolean;
export declare const isValidAbstract: (text: string) => boolean;
export declare const isValidTitle: (title: string) => boolean;
export declare const isValidPaper: (paper: PaperInput) => boolean;
export declare const getErrorsOnly: (result: ValidationResult) => ValidationError[];
export declare const getWarningsOnly: (result: ValidationResult) => ValidationWarning[];
/** Format validation result as a human-readable string. */
export declare function formatValidationResult(result: ValidationResult): string;
//# sourceMappingURL=validation.d.ts.map