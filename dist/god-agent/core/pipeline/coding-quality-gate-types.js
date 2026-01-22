/**
 * Coding Quality Gate Types
 *
 * Type definitions for the L-Score quality gate system used in the
 * God Agent Coding Pipeline (/god-code).
 *
 * @module src/god-agent/core/pipeline/coding-quality-gate-types
 * @see docs/coding-pipeline/quality-gate-system.md
 */
// ═══════════════════════════════════════════════════════════════════════════
// EMERG TRIGGER TYPES (from emerg-triggers.md)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Emergency trigger identifiers that can bypass quality gates.
 * These correspond to the 17 EMERG triggers defined in emerg-triggers.md.
 */
export var EmergencyTrigger;
(function (EmergencyTrigger) {
    EmergencyTrigger["EMERG_01_AGENT_CATASTROPHIC_FAILURE"] = "emerg_01_agent_catastrophic_failure";
    EmergencyTrigger["EMERG_02_MEMORY_CORRUPTION"] = "emerg_02_memory_corruption";
    EmergencyTrigger["EMERG_03_INFINITE_LOOP_RUNTIME"] = "emerg_03_infinite_loop_runtime";
    EmergencyTrigger["EMERG_04_SECURITY_BREACH"] = "emerg_04_security_breach";
    EmergencyTrigger["EMERG_05_RESOURCE_EXHAUSTION"] = "emerg_05_resource_exhaustion";
    EmergencyTrigger["EMERG_06_EXTERNAL_SERVICE_DOWN"] = "emerg_06_external_service_down";
    EmergencyTrigger["EMERG_07_PIPELINE_DEADLOCK"] = "emerg_07_pipeline_deadlock";
    EmergencyTrigger["EMERG_08_DATA_INTEGRITY_COMPROMISE"] = "emerg_08_data_integrity_compromise";
    EmergencyTrigger["EMERG_09_QUALITY_CATASTROPHIC_DROP"] = "emerg_09_quality_catastrophic_drop";
    EmergencyTrigger["EMERG_10_AUTH_FAILURE"] = "emerg_10_auth_failure";
    EmergencyTrigger["EMERG_11_CONFIG_CORRUPTION"] = "emerg_11_config_corruption";
    EmergencyTrigger["EMERG_12_DEPENDENCY_RESOLUTION_FAIL"] = "emerg_12_dependency_resolution_fail";
    EmergencyTrigger["EMERG_13_BUILD_CATASTROPHIC_FAIL"] = "emerg_13_build_catastrophic_fail";
    EmergencyTrigger["EMERG_14_TEST_SUITE_CATASTROPHIC_FAIL"] = "emerg_14_test_suite_catastrophic_fail";
    EmergencyTrigger["EMERG_15_DEPLOYMENT_ROLLBACK_REQUIRED"] = "emerg_15_deployment_rollback_required";
    EmergencyTrigger["EMERG_16_USER_ABORT"] = "emerg_16_user_abort";
    EmergencyTrigger["EMERG_17_SYSTEM_HEALTH_CRITICAL"] = "emerg_17_system_health_critical";
})(EmergencyTrigger || (EmergencyTrigger = {}));
// ═══════════════════════════════════════════════════════════════════════════
// GATE RESULT TYPES
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Gate validation result states.
 */
export var GateResult;
(function (GateResult) {
    /** All checks passed - proceed to next phase */
    GateResult["PASSED"] = "passed";
    /** Passed with warnings - proceed but address warnings */
    GateResult["CONDITIONAL_PASS"] = "conditional_pass";
    /** Remediation possible within current phase */
    GateResult["SOFT_REJECT"] = "soft_reject";
    /** Phase restart required - remediation attempts exhausted */
    GateResult["HARD_REJECT"] = "hard_reject";
    /** Emergency override active - bypassing normal validation */
    GateResult["EMERGENCY_BYPASS"] = "emergency_bypass";
})(GateResult || (GateResult = {}));
// ═══════════════════════════════════════════════════════════════════════════
// QUALITY GATE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Pipeline phase enum (mirrors CodingPipelinePhase but with COMPLETE).
 */
export var PipelinePhase;
(function (PipelinePhase) {
    PipelinePhase["UNDERSTANDING"] = "understanding";
    PipelinePhase["EXPLORATION"] = "exploration";
    PipelinePhase["ARCHITECTURE"] = "architecture";
    PipelinePhase["IMPLEMENTATION"] = "implementation";
    PipelinePhase["TESTING"] = "testing";
    PipelinePhase["OPTIMIZATION"] = "optimization";
    PipelinePhase["DELIVERY"] = "delivery";
    PipelinePhase["COMPLETE"] = "complete";
})(PipelinePhase || (PipelinePhase = {}));
//# sourceMappingURL=coding-quality-gate-types.js.map