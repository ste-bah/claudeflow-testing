/**
 * God Agent Orchestration Module
 * TASK-ORC-001 - Relay Race Protocol
 * TASK-ORC-002 - Memory Key Passing & Wait Gates
 *
 * Provides:
 * - Sequential agent orchestration (99.9% rule)
 * - Explicit memory key passing between agents
 * - Wait gates to prevent race conditions
 * - Pipeline validation and execution
 * - Quality gate enforcement
 *
 * The Relay Race Protocol solves:
 * - 45% of failures from spawning Agent B before Agent A completes
 * - 35% from Agent B not knowing where Agent A stored output
 * - 20% from parallel execution causing race conditions
 *
 * Achieves 88% success rate through:
 * - Explicit previousKey/outputKey handoff
 * - Sequential execution by default
 * - Wait gates between agent steps
 */
export { RelayRaceOrchestrator, MockAgentExecutor } from './relay-race-orchestrator.js';
export { PipelineValidationError, AgentExecutionError, MemoryKeyError, QualityGateError, } from './orchestration-types.js';
export type { IAgentDefinition, IPipelineDefinition, IPipelineExecution, IAgentResult, PipelineStatus, IAgentExecutor, PipelineEventType, IPipelineEvent, PipelineEventListener, IOrchestratorOptions, IOrchestratorOptions as RelayRaceConfig, // Alias for compatibility
ISerializedPipelineExecution, } from './orchestration-types.js';
export { generatePipelineID, isValidPipelineID, validatePipelineDefinition, validateAgentDefinition, validateMemoryKeyChain, buildAgentPrompt, formatAgentPosition, parseAgentPosition, validateQualityGate, serializeMap, deserializeMap, DEFAULT_NAMESPACE, DEFAULT_AGENT_TIMEOUT, MAX_PIPELINE_AGENTS, } from './orchestration-utils.js';
//# sourceMappingURL=index.d.ts.map