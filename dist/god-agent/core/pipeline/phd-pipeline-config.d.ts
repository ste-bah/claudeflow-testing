/**
 * PhD Pipeline Configuration
 * TASK-PHD-001 - 48-Agent PhD Pipeline
 *
 * Complete configuration for 48-agent systematic research pipeline
 * spanning 7 phases: Foundation, Discovery, Architecture, Synthesis,
 * Design, Writing, and QA.
 */
import type { IPipelineConfig, IAgentConfig } from './pipeline-types.js';
/**
 * Complete PhD Pipeline Configuration
 */
export declare const PHD_PIPELINE_CONFIG: IPipelineConfig;
/**
 * Get the default PhD pipeline configuration
 */
export declare function getPhDPipelineConfig(): IPipelineConfig;
/**
 * Get agent by ID
 */
export declare function getAgentById(id: number): IAgentConfig | undefined;
/**
 * Get agent by key
 */
export declare function getAgentByKey(key: string): IAgentConfig | undefined;
/**
 * Get all agents in a phase
 */
export declare function getAgentsByPhase(phaseId: number): IAgentConfig[];
/**
 * Get all critical agents
 */
export declare function getCriticalAgents(): IAgentConfig[];
//# sourceMappingURL=phd-pipeline-config.d.ts.map