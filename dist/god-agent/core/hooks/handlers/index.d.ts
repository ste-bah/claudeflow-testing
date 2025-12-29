/**
 * Hook Handlers Module
 * TASK-HOOK-003, TASK-HOOK-004
 *
 * Exports and registers all required hook handlers.
 *
 * CONSTITUTION COMPLIANCE:
 * - REQ-CONST-003: Auto-injection into ALL Task() spawns
 * - RULE-032: All hooks registered at daemon startup
 * - RULE-033: Quality assessed on Task() result, NOT prompt
 * - RULE-035: Uses thresholds 0.5 (feedback), 0.7 (pattern)
 * - RULE-036: Capture actual execution output
 */
export { registerTaskResultCaptureHook, getCapturedResult, hasCapturedResult, getCapturedResultCount, getCapturedTrajectoryIds, clearCapturedResult, _clearCapturedResultsForTesting, type ICapturedResult } from './task-result-capture.js';
export { registerQualityAssessmentTriggerHook, setQualityAssessmentCallback, hasQualityAssessmentCallback, setLearningFeedbackCallback, hasLearningFeedbackCallback, QUALITY_THRESHOLDS, _clearQualityAssessmentCallbackForTesting, _clearLearningFeedbackCallbackForTesting, type QualityAssessmentCallback, type IQualityAssessment, type LearningFeedbackCallback } from './quality-assessment-trigger.js';
export { registerAutoInjectionHook, setDescServiceGetter, setSonaEngineGetter, _resetAutoInjectionForTesting, type IDescServiceLike, type ISonaEngineLike } from './auto-injection.js';
/**
 * Register all required hooks
 *
 * Call this during daemon startup BEFORE HookRegistry.initialize().
 * This ensures all REQUIRED_HOOKS are registered per RULE-032.
 *
 * Registration order (by priority):
 * 1. auto-injection (priority 20 - INJECTION)
 * 2. task-result-capture (priority 40 - CAPTURE)
 * 3. quality-assessment-trigger (priority 60 - POST_PROCESS)
 *
 * @example
 * ```typescript
 * import { registerRequiredHooks, getHookRegistry } from './core/hooks';
 *
 * // During daemon startup
 * registerRequiredHooks();
 * getHookRegistry().initialize();  // Validates required hooks
 * ```
 */
export declare function registerRequiredHooks(): void;
//# sourceMappingURL=index.d.ts.map