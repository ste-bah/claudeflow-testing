/**
 * Phase 8 Final Stage - Public API
 *
 * Re-exports all public APIs for the PhD Pipeline Final Assembly stage.
 * Implements SPEC-TECH-001 and SPEC-FUNC-001.
 */
export type { FinalStageState, PhaseStatus, ChapterNumber, FinalStageErrorCode, FinalStageOptions, SemanticMapperInput, OutputScannerInput, ChapterDefinition, AgentOutputSummary, CitationRef, ChapterMapping, SemanticMapperOutput, OutputScannerOutput, CrossReference, SectionInfo, QualityMetrics, ChapterWriterOutput, PaperMetadata, FinalPaper, FinalStageResult, ProgressReport, ProgressCallback, TokenBudget, PhaseResult, ExecutionMetadata, ChapterStructureReaderOutput, ChapterWriterInput, MappingValidationResult, StyleValidationResult, StyleCharacteristics, RegionalSettings } from './types.js';
export { FinalStageError } from './types.js';
export { FinalStageOrchestrator } from './final-stage-orchestrator.js';
export { SummaryExtractor } from './summary-extractor.js';
export { SemanticMapper } from './semantic-mapper.js';
export { ChapterWriterAgent, getAgentForChapter } from './chapter-writer-agent.js';
export type { ChapterSynthesisPrompt, ChapterAgentType } from './chapter-writer-agent.js';
export { PaperCombiner } from './paper-combiner.js';
export { StyleApplier } from './style-applier.js';
export type { StyleApplierInput, StyleApplierOutput } from './style-applier.js';
export { ProgressLogger, PROGRESS_MILESTONES } from './progress-logger.js';
export type { LogLevel, LogEntry } from './progress-logger.js';
//# sourceMappingURL=index.d.ts.map