/**
 * DAI-003: Pipeline Generator Implementation
 *
 * TASK-008: Pipeline Generator
 * Constitution: US-005, US-006, INT-004, INT-008
 *
 * Generates DAI-002 pipeline definitions from natural language multi-step tasks.
 *
 * Features:
 * - Splits multi-step tasks at sequence markers (then, after, finally, etc.)
 * - Routes each stage via RoutingEngine with real capability matching
 * - Generates valid IPipelineDefinition format for DAI-002
 * - Validates 2-10 stage limits
 * - Estimates duration (30s per stage)
 * - Calculates overall confidence (min of stage confidences)
 * - NO external LLM calls (pure deterministic generation)
 *
 * Performance target: < 600ms (P95) per INT-008
 *
 * @module src/god-agent/core/routing/pipeline-generator
 */
import type { IPipelineGenerator, IGeneratedPipeline, IRoutingConfig } from './routing-types.js';
import { RoutingEngine } from './routing-engine.js';
import { TaskAnalyzer } from './task-analyzer.js';
/**
 * Configuration for PipelineGenerator
 */
export interface IPipelineGeneratorConfig {
    /** Routing engine instance (optional, creates one if not provided) */
    routingEngine?: RoutingEngine;
    /** Task analyzer instance (optional, creates one if not provided) */
    taskAnalyzer?: TaskAnalyzer;
    /** Routing configuration (optional, uses defaults) */
    routingConfig?: IRoutingConfig;
    /** Enable verbose logging (default: false) */
    verbose?: boolean;
}
/**
 * Pipeline generator for multi-step task orchestration
 * Implements deterministic pipeline generation with routing integration
 *
 * @implements IPipelineGenerator
 */
export declare class PipelineGenerator implements IPipelineGenerator {
    private routingEngine;
    private taskAnalyzer;
    private capabilityIndex;
    private readonly config;
    private readonly verbose;
    private initialized;
    constructor(config?: IPipelineGeneratorConfig);
    /**
     * Initialize the pipeline generator
     * Initializes capability index for routing engine
     */
    initialize(): Promise<void>;
    /**
     * Generate a pipeline from natural language multi-step task
     * Per INT-004: Multi-step task → pipeline stages
     * Per INT-008: Generation completes in < 600ms (P95)
     *
     * @param task - Multi-step task description
     * @returns Generated pipeline definition
     * @throws PipelineGenerationError if generation fails
     */
    generate(task: string): Promise<IGeneratedPipeline>;
    /**
     * Split task into segments using sequence markers
     * Normalizes whitespace and filters empty segments
     *
     * @param task - Task description
     * @returns Array of task segments
     */
    private splitIntoSegments;
    /**
     * Extract primary verb from task segment
     * Uses task analyzer verb extraction
     *
     * @param segment - Task segment
     * @returns Primary verb
     */
    private extractVerb;
    /**
     * Generate stages from task segments
     * Routes each segment via RoutingEngine
     *
     * @param segments - Task segments
     * @param fullTask - Full task description (for context)
     * @returns Array of generated stages
     */
    private generateStages;
    /**
     * Generate unique output domain for stage
     * Format: pipeline/{pipelineId}/stage_{index}
     *
     * @param stageIndex - Stage index
     * @param task - Task description
     * @returns Output domain path
     */
    private generateOutputDomain;
    /**
     * Build pipeline definition from stages
     * Calculates overall confidence and duration
     *
     * @param task - Original task description
     * @param stages - Generated stages
     * @param startTime - Generation start time
     * @returns Complete pipeline definition
     */
    private buildPipelineDefinition;
    /**
     * Calculate overall confidence from stage confidences
     * Uses minimum confidence (weakest link determines overall confidence)
     *
     * @param stages - Pipeline stages
     * @returns Overall confidence (0-1)
     */
    private calculateOverallConfidence;
}
//# sourceMappingURL=pipeline-generator.d.ts.map