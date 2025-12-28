/**
 * Orchestration Memory System - Core Type Definitions
 *
 * Implements: TASK-ORC-001 (TECH-ORC-001 lines 116-404)
 *
 * @module orchestration/types
 */
/**
 * Workflow phases enum
 */
export var WorkflowPhase;
(function (WorkflowPhase) {
    WorkflowPhase["PLANNING"] = "planning";
    WorkflowPhase["SPECIFICATION"] = "specification";
    WorkflowPhase["IMPLEMENTATION"] = "implementation";
    WorkflowPhase["TESTING"] = "testing";
    WorkflowPhase["REVIEW"] = "review";
    WorkflowPhase["AUDIT"] = "audit";
    WorkflowPhase["GENERAL"] = "general-purpose";
})(WorkflowPhase || (WorkflowPhase = {}));
//# sourceMappingURL=types.js.map