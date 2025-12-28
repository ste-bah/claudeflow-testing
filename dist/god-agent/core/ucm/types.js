/**
 * UCM Core Types
 * Universal Context Management System Type Definitions
 *
 * CONSTITUTION RULES: RULE-001 to RULE-075
 */
// ============================================================================
// Token Estimation Types (RULE-001 to RULE-006)
// ============================================================================
/**
 * Content type for token estimation
 * RULE-001: prose = 1.3 tokens/word
 * RULE-002: code = 1.5 tokens/word
 * RULE-003: tables = 2.0 tokens/word
 * RULE-004: citations = 1.4 tokens/word
 * RULE-006: default = 1.3 tokens/word
 */
export var ContentType;
(function (ContentType) {
    ContentType["PROSE"] = "prose";
    ContentType["CODE"] = "code";
    ContentType["TABLE"] = "table";
    ContentType["CITATION"] = "citation";
    ContentType["MIXED"] = "mixed";
})(ContentType || (ContentType = {}));
/**
 * Token ratio constants (immutable per CONSTITUTION)
 */
export const TOKEN_RATIOS = {
    [ContentType.PROSE]: 1.3,
    [ContentType.CODE]: 1.5,
    [ContentType.TABLE]: 2.0,
    [ContentType.CITATION]: 1.4,
    [ContentType.MIXED]: 1.3 // Default ratio
};
// ============================================================================
// Injection Filter Types (Safety for DESC)
// ============================================================================
/**
 * Workflow category for context-aware filtering
 */
export var WorkflowCategory;
(function (WorkflowCategory) {
    WorkflowCategory["RESEARCH"] = "research";
    WorkflowCategory["CODING"] = "coding";
    WorkflowCategory["GENERAL"] = "general";
})(WorkflowCategory || (WorkflowCategory = {}));
// ============================================================================
// IDESC-001: Intelligent DESC v2 Types
// TASK-IDESC-INFRA-002: Define Outcome Types and Interfaces
// Implements: REQ-IDESC-001, REQ-IDESC-002
// ============================================================================
/**
 * Error types for outcome recording
 * Implements: REQ-IDESC-004 (negative examples)
 */
export var ErrorType;
(function (ErrorType) {
    ErrorType["SYNTAX_ERROR"] = "syntax_error";
    ErrorType["LOGIC_ERROR"] = "logic_error";
    ErrorType["NOT_APPLICABLE"] = "not_applicable";
    ErrorType["STALE_SOLUTION"] = "stale_solution";
    ErrorType["INCOMPLETE"] = "incomplete";
    ErrorType["SECURITY_ISSUE"] = "security_issue";
})(ErrorType || (ErrorType = {}));
//# sourceMappingURL=types.js.map