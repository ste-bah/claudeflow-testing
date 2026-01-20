/**
 * God Agent Pipeline Module
 *
 * TASK-PHD-001 - 48-Agent PhD Pipeline
 * - 48 agents across 7 phases
 * - DAG-based dependency management
 * - Critical agent validation
 * - Integration with Relay Race and Shadow Vector
 *
 * DAI-002 - Multi-Agent Sequential Pipeline Orchestration
 * - Sequential execution (RULE-004: no Promise.all)
 * - Memory coordination via InteractionStore (RULE-005)
 * - DAI-001 AgentSelector integration (RULE-006)
 * - Forward-looking prompts (RULE-007)
 */
export { PhDPipelineOrchestrator, type IAgentExecutor, type IShadowTracker, } from './phd-pipeline-orchestrator.js';
/**
 * Configuration interface for god-agent.ts integration
 */
export interface PhdPipelineConfig {
    relayRace?: unknown;
    attentionFactory?: unknown;
    memoryEngine?: unknown;
    verbose?: boolean;
    [key: string]: unknown;
}
/**
 * Wrapper class for god-agent.ts compatibility
 * Accepts simplified config and creates proper orchestrator
 */
export declare class PhdPipelineOrchestrator {
    private config;
    private initialized;
    constructor(config: PhdPipelineConfig);
    /**
     * Initialize the pipeline (if needed)
     */
    initialize(): Promise<{
        success: boolean;
    }>;
    /**
     * Check if pipeline is initialized
     */
    isInitialized(): boolean;
    /**
     * Get the underlying config
     */
    getConfig(): PhdPipelineConfig;
    /**
     * Get a standardized pipeline config for the full orchestrator
     */
    static getPipelineConfig(): import("./pipeline-types.js").IPipelineConfig;
}
export { PHD_PIPELINE_CONFIG, getPhDPipelineConfig, getAgentById, getAgentByKey, getAgentsByPhase, getCriticalAgents, } from './phd-pipeline-config.js';
export { DEFAULT_AGENT_TIMEOUT, CRITICAL_AGENT_KEYS, PHASE_NAMES, PipelineConfigError, PipelineExecutionError, CriticalAgentError, createPipelineState, generatePipelineId, isCriticalAgent, } from './pipeline-types.js';
export type { AgentId, AgentKey, PhaseId, IAgentConfig, IPhaseConfig, IPipelineMetadata, IPipelineConfig, AgentStatus, IAgentExecutionRecord, IPipelineState, IPipelineProgress, } from './pipeline-types.js';
export { PipelineBridge, type IPipelineBridgeConfig, type ITopologicalSortResult, type IMappedAgentDefinition, } from './pipeline-bridge.js';
export { PhDPipelineBridge, createPhDPipelineBridge, PHASE_QUALITY_REQUIREMENTS, CITATION_REQUIREMENTS, WRITING_PHASE_ID, QA_PHASE_ID, } from './phd-pipeline-bridge.js';
export { QualityGateValidator, createPhDQualityGateValidator, DEFAULT_QUALITY_RULES, type IQualityCheck, type IQualityValidationResult, type IQualityRule, } from './phd-quality-gate-validator.js';
export { EmergencyTrigger, GateResult, PipelinePhase, type ILScoreWeights, type ILScoreBreakdown, type IGateViolation, type IEmergencyEvent, type IGateValidationContext, type IGateValidationResult, type IQualityGate, type LScoreWeights, type LScoreBreakdown, type LScoreComponent, type QualityGate, type GateViolation, type GateValidationContext, type GateValidationResult, type EmergencyEvent, type ViolationSeverity, } from './coding-quality-gate-types.js';
export { getPhaseWeights, calculateLScore, createLScoreBreakdown, } from './coding-quality-gate-weights.js';
export { GATE_1_UNDERSTANDING, GATE_2_EXPLORATION, GATE_3_ARCHITECTURE, GATE_4_IMPLEMENTATION, GATE_5_TESTING, GATE_6_OPTIMIZATION, GATE_7_DELIVERY, ALL_GATES, getGateById, getGateForPhase, getGateThresholdsSummary, } from './coding-quality-gate-definitions.js';
export { LScoreBreakdownSchema, GateValidationContextSchema, GateIdSchema, } from './coding-quality-gate-schemas.js';
export { CodingQualityGateValidator, createCodingQualityGateValidator, getAllGates, CodingQualityGateError, type QualityGateErrorCode, } from './coding-quality-gate-validator.js';
export { InvestigationTier, Verdict, VerdictConfidence, EvidenceStatus, AdversarialPersona, INVESTIGATION_TIER_CONFIG, FORENSIC_MEMORY_NAMESPACE, MAX_RETRY_COUNT, DEFAULT_INVESTIGATION_TIER, PHASE_NAMES as SHERLOCK_PHASE_NAMES, SherlockPhaseReviewerError, type IInvestigationTierConfig, type IEvidenceItem, type IVerificationCheck, type IAdversarialFinding, type IChainOfCustodyEvent, type ICaseFile, type IPhaseReviewResult, type IPhaseInvestigationProtocol, type IVerificationMatrixEntry, type IVerdictCriteria, type SherlockErrorCode, } from './sherlock-phase-reviewer-types.js';
export { PhaseNumberSchema, InvestigationTierSchema, VerdictSchema, VerdictConfidenceSchema, EvidenceStatusSchema, EvidenceItemSchema, VerificationCheckSchema, PhaseReviewInputSchema, } from './sherlock-phase-reviewer-types.js';
export { PHASE_1_UNDERSTANDING_PROTOCOL, PHASE_2_EXPLORATION_PROTOCOL, PHASE_3_ARCHITECTURE_PROTOCOL, PHASE_4_IMPLEMENTATION_PROTOCOL, PHASE_5_TESTING_PROTOCOL, PHASE_6_OPTIMIZATION_PROTOCOL, PHASE_7_DELIVERY_PROTOCOL, ALL_PHASE_PROTOCOLS, getProtocolForPhase, getEvidenceSourcesForPhase, getAdversarialPersonasForPhase, getProtocolSummary, } from './sherlock-phase-reviewer-protocols.js';
export { SherlockPhaseReviewer, createSherlockPhaseReviewer, handlePhaseReviewResult, type IMemoryRetriever, type ISherlockPhaseReviewerConfig, type IPhaseReviewCallbacks, } from './sherlock-phase-reviewer.js';
export { buildCaseFile, getCaseFileReport, type IBuildCaseFileParams, } from './sherlock-case-file-builder.js';
export { renderVerdict, type IVerdictResult, } from './sherlock-verdict-engine.js';
export { runAdversarialAnalysis, generateAdversarialFinding, } from './sherlock-adversarial-analysis.js';
export { handlePhaseReviewResult as sherlockHandlePhaseReviewResult, } from './sherlock-flow-handler.js';
export { VerificationMethod, VerificationContextSchema, executeVerificationCheck, runVerificationMatrix, calculatePassRate, type IVerificationContext, } from './sherlock-verification-matrix.js';
export { IntegratedValidator, createIntegratedValidator, createTestIntegratedValidator, IntegratedValidatorError, type IIntegratedValidatorConfig, type IIntegratedValidationResult, type IntegrationErrorCode, type PipelineType, } from './sherlock-quality-gate-integration.js';
export { SherlockLearningIntegration, createSherlockLearningIntegration, createTestSherlockLearningIntegration, SherlockLearningError, SherlockLearningConfigSchema, DEFAULT_SHERLOCK_LEARNING_CONFIG, type ISherlockLearningConfig, type ISherlockLearningEvent, type SherlockLearningEventType, type SherlockLearningEventListener, type IForensicPattern, type SherlockLearningErrorCode, } from './sherlock-learning-integration.js';
export { PhDPipelineRunner, createPhDPipelineRunner, type IPhDPipelineRunnerOptions, type IRunnerStats, type IRunResult, type IMemoryEngine, } from './phd-pipeline-runner.js';
export { PipelineError, PipelineDefinitionError, PipelineExecutionError as DAI002ExecutionError, // Alias to avoid conflict
MemoryCoordinationError, QualityGateError, PipelineTimeoutError, AgentSelectionError, isPipelineError, isPipelineDefinitionError, isPipelineExecutionError, isMemoryCoordinationError, isQualityGateError, isPipelineTimeoutError, isAgentSelectionError, createMissingFieldError, createInvalidAgentError, wrapAsPipelineExecutionError, } from './pipeline-errors.js';
export type { IPipelineDefinition, IPipelineStep, IPipelineStepStorage, IPipelineEvent, PipelineEventType, IStepResult as DAI002StepResult, IPipelineResult as DAI002PipelineResult, IPipelineOptions as DAI002PipelineOptions, } from './dai-002-types.js';
export { PipelineEventType as DAI002EventType, DEFAULT_STEP_TIMEOUT, DEFAULT_PIPELINE_TIMEOUT, DEFAULT_MIN_QUALITY, generatePipelineTrajectoryId, calculateOverallQuality, } from './dai-002-types.js';
export { PipelineValidator, createPipelineValidator, type IValidationResult, } from './pipeline-validator.js';
export { PipelinePromptBuilder, createPipelinePromptBuilder, type IPromptContext, type IBuiltPrompt, } from './pipeline-prompt-builder.js';
export { PipelineMemoryCoordinator, createPipelineMemoryCoordinator, type IMemoryCoordinatorConfig, type IStoreResult, type IRetrieveResult, } from './pipeline-memory-coordinator.js';
export { PipelineExecutor, createPipelineExecutor, type IPipelineExecutorConfig, type IStepExecutor, type IStepExecutionResult, } from './pipeline-executor.js';
export { CommandTaskBridge, createCommandTaskBridge, type IComplexityAnalysis, type IPipelineDecision, type IAgentMapping, type ICommandTaskBridgeConfig, type TaskType, DEFAULT_PIPELINE_THRESHOLD, PHASE_KEYWORDS, DOCUMENT_KEYWORDS, MULTI_STEP_PATTERNS, CONNECTOR_WORDS, DEFAULT_PHASE_MAPPINGS, DOCUMENT_AGENT_MAPPING, } from './command-task-bridge.js';
export { ConstitutionValidator, createConstitutionValidator, createCustomConstitutionValidator, CONSTITUTION_LIMITS, type IValidationResult as IConstitutionValidationCheck, type IConstitutionValidationResult, } from './constitution-validator.js';
export { TruthProtocolVerifier, createTruthProtocolVerifier, createCustomTruthProtocolVerifier, MIN_TRUTH_SCORE, MIN_VERIFIED_PERCENTAGE, MAX_HALLUCINATION_RISK, type ITruthClaim, type ClaimType, type ClaimConfidence, type ClaimFlag, type IClaimEvidence, type EvidenceType, type IHallucinationResult, type IHallucinationPattern, type HallucinationPatternType, type ITruthVerificationResult, type ITruthStatistics, } from './truth-protocol.js';
export { createLeannContextService, LeannContextService } from './leann-context-service.js';
export type { ISemanticContext, ICodeContextResult, ISemanticContextParams, ILeannContextConfig } from './leann-context-service.js';
//# sourceMappingURL=index.d.ts.map