/**
 * Phase 8 Final Stage - Public API
 *
 * Re-exports all public APIs for the PhD Pipeline Final Assembly stage.
 * Implements SPEC-TECH-001 and SPEC-FUNC-001.
 */
// ============================================
// Class Exports
// ============================================
export { FinalStageError } from './types.js';
// ============================================
// Module Exports
// ============================================
// TASK-002: FinalStageOrchestrator - IMPLEMENTED
export { FinalStageOrchestrator } from './final-stage-orchestrator.js';
// TASK-004: SummaryExtractor - IMPLEMENTED
export { SummaryExtractor } from './summary-extractor.js';
// TASK-005: SemanticMapper - IMPLEMENTED
export { SemanticMapper } from './semantic-mapper.js';
// TASK-006: ChapterWriterAgent - IMPLEMENTED
export { ChapterWriterAgent, getAgentForChapter } from './chapter-writer-agent.js';
// TASK-007: PaperCombiner - IMPLEMENTED
export { PaperCombiner } from './paper-combiner.js';
// TASK-008: StyleApplier - IMPLEMENTED
export { StyleApplier } from './style-applier.js';
// TASK-010: ProgressLogger - IMPLEMENTED
export { ProgressLogger, PROGRESS_MILESTONES } from './progress-logger.js';
//# sourceMappingURL=index.js.map