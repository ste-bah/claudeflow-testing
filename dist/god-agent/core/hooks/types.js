/**
 * Hook System Type Definitions
 * TASK-HOOK-001 - Hook Registration Service
 *
 * Defines interfaces for preToolUse and postToolUse hooks
 * as specified in TASKS-PHASE3.md and TECH-HOOK-001.md
 *
 * CONSTITUTION COMPLIANCE: RULE-032 (All hooks MUST be registered at daemon startup)
 */
/**
 * Required hooks that MUST be registered before initialization
 * Per CONSTITUTION RULE-032
 */
export const REQUIRED_HOOKS = [
    'task-result-capture',
    'quality-assessment-trigger'
];
/**
 * Default hook priorities by category
 */
export const DEFAULT_PRIORITIES = {
    /** Validation and safety hooks */
    VALIDATION: 10,
    /** Context injection hooks */
    INJECTION: 20,
    /** Logging and metrics hooks */
    LOGGING: 30,
    /** Result capture hooks */
    CAPTURE: 40,
    /** Default priority */
    DEFAULT: 50,
    /** Post-processing hooks */
    POST_PROCESS: 60,
    /** Cleanup hooks */
    CLEANUP: 90
};
// ============================================================================
// Error Types
// ============================================================================
/**
 * Error codes for hook system
 */
export var HookErrorCode;
(function (HookErrorCode) {
    /** Hook registration attempted after initialization */
    HookErrorCode["REGISTRATION_AFTER_INIT"] = "HOOK_REG_AFTER_INIT";
    /** Duplicate hook ID */
    HookErrorCode["DUPLICATE_HOOK_ID"] = "HOOK_DUPLICATE_ID";
    /** Required hook not registered */
    HookErrorCode["REQUIRED_HOOK_MISSING"] = "HOOK_REQUIRED_MISSING";
    /** Hook not found */
    HookErrorCode["HOOK_NOT_FOUND"] = "HOOK_NOT_FOUND";
    /** Hook execution failed */
    HookErrorCode["HOOK_EXECUTION_FAILED"] = "HOOK_EXEC_FAILED";
    /** Hook timeout */
    HookErrorCode["HOOK_TIMEOUT"] = "HOOK_TIMEOUT";
    /** Registry not initialized */
    HookErrorCode["REGISTRY_NOT_INITIALIZED"] = "HOOK_REG_NOT_INIT";
})(HookErrorCode || (HookErrorCode = {}));
/**
 * Hook-specific error class
 */
export class HookError extends Error {
    code;
    context;
    constructor(code, message, context) {
        super(message);
        this.code = code;
        this.context = context;
        this.name = 'HookError';
        Object.setPrototypeOf(this, HookError.prototype);
    }
}
//# sourceMappingURL=types.js.map