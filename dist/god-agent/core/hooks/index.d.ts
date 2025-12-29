/**
 * Hooks Module Index
 * TASK-HOOK-001 - Hook Registration Service
 *
 * Exports hook registry, types, and helper functions.
 *
 * Usage:
 * ```typescript
 * import {
 *   getHookRegistry,
 *   registerPreToolUseHook,
 *   registerPostToolUseHook,
 *   IHook,
 *   HookError
 * } from './core/hooks';
 * ```
 */
export { type HookType, type HookPriority, type IHookContext, type IPostToolUseContext, type IHookResult, type IHookExecutionResult, type IHookChainResult, type HookHandler, type PreToolUseHandler, type PostToolUseHandler, type IHook, type IPreToolUseHook, type IPostToolUseHook, type IHookRegistrationOptions, type IHookInput, type IHookRegistry, type IHookExecutor, type AnyHook, REQUIRED_HOOKS, DEFAULT_PRIORITIES, HookErrorCode, HookError } from './types.js';
export { HookRegistry, getHookRegistry, registerPreToolUseHook, registerPostToolUseHook, _resetHookRegistryForTesting } from './hook-registry.js';
export { HookExecutor, getHookExecutor, _resetHookExecutorForTesting } from './hook-executor.js';
export { registerRequiredHooks, registerTaskResultCaptureHook, getCapturedResult, hasCapturedResult, getCapturedResultCount, getCapturedTrajectoryIds, clearCapturedResult, _clearCapturedResultsForTesting, type ICapturedResult, registerQualityAssessmentTriggerHook, setQualityAssessmentCallback, hasQualityAssessmentCallback, QUALITY_THRESHOLDS, _clearQualityAssessmentCallbackForTesting, type QualityAssessmentCallback, type IQualityAssessment, setLearningFeedbackCallback, hasLearningFeedbackCallback, _clearLearningFeedbackCallbackForTesting, type LearningFeedbackCallback, registerAutoInjectionHook, setDescServiceGetter, setSonaEngineGetter, _resetAutoInjectionForTesting, type IDescServiceLike, type ISonaEngineLike } from './handlers/index.js';
//# sourceMappingURL=index.d.ts.map