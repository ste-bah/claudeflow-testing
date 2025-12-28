/**
 * Pattern Matching Type Definitions
 *
 * Implements: TASK-PAT-001 (Type Definitions)
 *
 * Defines types for template-based pattern retrieval with confidence scoring.
 */
/**
 * Task types for pattern categorization
 */
export var TaskType;
(function (TaskType) {
    TaskType["CODING"] = "coding";
    TaskType["DEBUGGING"] = "debugging";
    TaskType["ANALYSIS"] = "analysis";
    TaskType["REFACTORING"] = "refactoring";
    TaskType["TESTING"] = "testing";
    TaskType["DOCUMENTATION"] = "documentation";
    TaskType["PLANNING"] = "planning";
    TaskType["OPTIMIZATION"] = "optimization";
})(TaskType || (TaskType = {}));
//# sourceMappingURL=pattern-types.js.map