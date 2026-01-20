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
import { getPhDPipelineConfig } from './phd-pipeline-config.js';
// ===== PHD PIPELINE ORCHESTRATOR =====
export { PhDPipelineOrchestrator, } from './phd-pipeline-orchestrator.js';
/**
 * Wrapper class for god-agent.ts compatibility
 * Accepts simplified config and creates proper orchestrator
 */
export class PhdPipelineOrchestrator {
    config;
    initialized = false;
    constructor(config) {
        this.config = config;
        // The orchestrator is created lazily or during initialization
    }
    /**
     * Initialize the pipeline (if needed)
     */
    async initialize() {
        this.initialized = true;
        return { success: true };
    }
    /**
     * Check if pipeline is initialized
     */
    isInitialized() {
        return this.initialized;
    }
    /**
     * Get the underlying config
     */
    getConfig() {
        return this.config;
    }
    /**
     * Get a standardized pipeline config for the full orchestrator
     */
    static getPipelineConfig() {
        return getPhDPipelineConfig();
    }
}
// ===== PIPELINE CONFIGURATION =====
export { PHD_PIPELINE_CONFIG, getPhDPipelineConfig, getAgentById, getAgentByKey, getAgentsByPhase, getCriticalAgents, } from './phd-pipeline-config.js';
// ===== TYPE DEFINITIONS =====
export { DEFAULT_AGENT_TIMEOUT, CRITICAL_AGENT_KEYS, PHASE_NAMES, PipelineConfigError, PipelineExecutionError, CriticalAgentError, createPipelineState, generatePipelineId, isCriticalAgent, } from './pipeline-types.js';
// ===== PIPELINE BRIDGE =====
export { PipelineBridge, } from './pipeline-bridge.js';
export { PhDPipelineBridge, createPhDPipelineBridge, PHASE_QUALITY_REQUIREMENTS, CITATION_REQUIREMENTS, WRITING_PHASE_ID, QA_PHASE_ID, } from './phd-pipeline-bridge.js';
// ===== PHD QUALITY GATE VALIDATION (for /god-research pipeline) =====
export { QualityGateValidator, createPhDQualityGateValidator, DEFAULT_QUALITY_RULES, } from './phd-quality-gate-validator.js';
// ===== CODING QUALITY GATE VALIDATION (for /god-code pipeline) =====
// Types and enums from types file
export { EmergencyTrigger, GateResult, PipelinePhase, } from './coding-quality-gate-types.js';
// Weight calculation functions
export { getPhaseWeights, calculateLScore, createLScoreBreakdown, } from './coding-quality-gate-weights.js';
// Gate definitions
export { GATE_1_UNDERSTANDING, GATE_2_EXPLORATION, GATE_3_ARCHITECTURE, GATE_4_IMPLEMENTATION, GATE_5_TESTING, GATE_6_OPTIMIZATION, GATE_7_DELIVERY, ALL_GATES, getGateById, getGateForPhase, getGateThresholdsSummary, } from './coding-quality-gate-definitions.js';
// Zod schemas
export { LScoreBreakdownSchema, GateValidationContextSchema, GateIdSchema, } from './coding-quality-gate-schemas.js';
// Validator class and factory
export { CodingQualityGateValidator, createCodingQualityGateValidator, getAllGates, CodingQualityGateError, } from './coding-quality-gate-validator.js';
// ===== SHERLOCK PHASE REVIEWER (for /god-code pipeline) =====
// Types and enums from types file
export { InvestigationTier, Verdict, VerdictConfidence, EvidenceStatus, AdversarialPersona, INVESTIGATION_TIER_CONFIG, FORENSIC_MEMORY_NAMESPACE, MAX_RETRY_COUNT, DEFAULT_INVESTIGATION_TIER, PHASE_NAMES as SHERLOCK_PHASE_NAMES, SherlockPhaseReviewerError, } from './sherlock-phase-reviewer-types.js';
// Zod schemas from types file
export { PhaseNumberSchema, InvestigationTierSchema, VerdictSchema, VerdictConfidenceSchema, EvidenceStatusSchema, EvidenceItemSchema, VerificationCheckSchema, PhaseReviewInputSchema, } from './sherlock-phase-reviewer-types.js';
// Phase investigation protocols
export { PHASE_1_UNDERSTANDING_PROTOCOL, PHASE_2_EXPLORATION_PROTOCOL, PHASE_3_ARCHITECTURE_PROTOCOL, PHASE_4_IMPLEMENTATION_PROTOCOL, PHASE_5_TESTING_PROTOCOL, PHASE_6_OPTIMIZATION_PROTOCOL, PHASE_7_DELIVERY_PROTOCOL, ALL_PHASE_PROTOCOLS, getProtocolForPhase, getEvidenceSourcesForPhase, getAdversarialPersonasForPhase, getProtocolSummary, } from './sherlock-phase-reviewer-protocols.js';
// Main reviewer class and factory
export { SherlockPhaseReviewer, createSherlockPhaseReviewer, handlePhaseReviewResult, } from './sherlock-phase-reviewer.js';
// Case file builder (extracted module)
export { buildCaseFile, getCaseFileReport, } from './sherlock-case-file-builder.js';
// Verdict engine (extracted module)
export { renderVerdict, } from './sherlock-verdict-engine.js';
// Adversarial analysis (extracted module)
export { runAdversarialAnalysis, generateAdversarialFinding, } from './sherlock-adversarial-analysis.js';
// Flow handler (extracted module)
export { handlePhaseReviewResult as sherlockHandlePhaseReviewResult, } from './sherlock-flow-handler.js';
// Verification matrix engine (enhanced verification per PRD 2.3.3)
export { VerificationMethod, VerificationContextSchema, executeVerificationCheck, runVerificationMatrix, calculatePassRate, } from './sherlock-verification-matrix.js';
// ===== SHERLOCK-QUALITY GATE INTEGRATION =====
export { IntegratedValidator, createIntegratedValidator, createTestIntegratedValidator, IntegratedValidatorError, } from './sherlock-quality-gate-integration.js';
// ===== SHERLOCK-LEARNING INTEGRATION (/god-code only) =====
export { SherlockLearningIntegration, createSherlockLearningIntegration, createTestSherlockLearningIntegration, SherlockLearningError, SherlockLearningConfigSchema, DEFAULT_SHERLOCK_LEARNING_CONFIG, } from './sherlock-learning-integration.js';
// ===== PHD PIPELINE RUNNER =====
export { PhDPipelineRunner, createPhDPipelineRunner, } from './phd-pipeline-runner.js';
// ============================================================================
// DAI-002: MULTI-AGENT SEQUENTIAL PIPELINE ORCHESTRATION
// ============================================================================
// ===== DAI-002 ERROR CLASSES =====
export { 
// Base error
PipelineError, 
// Specific errors
PipelineDefinitionError, PipelineExecutionError as DAI002ExecutionError, // Alias to avoid conflict
MemoryCoordinationError, QualityGateError, PipelineTimeoutError, AgentSelectionError, 
// Type guards
isPipelineError, isPipelineDefinitionError, isPipelineExecutionError, isMemoryCoordinationError, isQualityGateError, isPipelineTimeoutError, isAgentSelectionError, 
// Factory helpers
createMissingFieldError, createInvalidAgentError, wrapAsPipelineExecutionError, } from './pipeline-errors.js';
export { PipelineEventType as DAI002EventType, 
// Constants
DEFAULT_STEP_TIMEOUT, DEFAULT_PIPELINE_TIMEOUT, DEFAULT_MIN_QUALITY, 
// Utility functions (generatePipelineId already exported from pipeline-types.js)
generatePipelineTrajectoryId, calculateOverallQuality, } from './dai-002-types.js';
// ===== DAI-002 PIPELINE VALIDATOR =====
export { PipelineValidator, createPipelineValidator, } from './pipeline-validator.js';
// ===== DAI-002 PIPELINE PROMPT BUILDER =====
export { PipelinePromptBuilder, createPipelinePromptBuilder, } from './pipeline-prompt-builder.js';
// ===== DAI-002 PIPELINE MEMORY COORDINATOR =====
export { PipelineMemoryCoordinator, createPipelineMemoryCoordinator, } from './pipeline-memory-coordinator.js';
// ===== DAI-002 PIPELINE EXECUTOR =====
export { PipelineExecutor, createPipelineExecutor, } from './pipeline-executor.js';
// Note: IPipelineOptions, IPipelineResult, IStepResult are re-exported from dai-002-types.ts above
// as DAI002PipelineOptions, DAI002PipelineResult, DAI002StepResult
// ===== DAI-002 COMMAND TASK BRIDGE =====
export { CommandTaskBridge, createCommandTaskBridge, 
// Constants
DEFAULT_PIPELINE_THRESHOLD, PHASE_KEYWORDS, DOCUMENT_KEYWORDS, MULTI_STEP_PATTERNS, CONNECTOR_WORDS, DEFAULT_PHASE_MAPPINGS, DOCUMENT_AGENT_MAPPING, } from './command-task-bridge.js';
// ===== CONSTITUTION VALIDATION =====
export { ConstitutionValidator, createConstitutionValidator, createCustomConstitutionValidator, CONSTITUTION_LIMITS, } from './constitution-validator.js';
// ===== TRUTH PROTOCOL VERIFICATION =====
export { TruthProtocolVerifier, createTruthProtocolVerifier, createCustomTruthProtocolVerifier, 
// Constants
MIN_TRUTH_SCORE, MIN_VERIFIED_PERCENTAGE, MAX_HALLUCINATION_RISK, } from './truth-protocol.js';
// ===== LEANN SEMANTIC CONTEXT SERVICE =====
export { createLeannContextService, LeannContextService } from './leann-context-service.js';
//# sourceMappingURL=index.js.map