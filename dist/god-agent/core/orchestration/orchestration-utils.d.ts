/**
 * Orchestration Utilities
 * TASK-ORC-001 - Relay Race Protocol Utilities
 *
 * Provides utility functions for pipeline validation,
 * ID generation, and prompt building.
 */
import type { IPipelineDefinition, IAgentDefinition } from './orchestration-types.js';
/** Default namespace for memory operations */
export declare const DEFAULT_NAMESPACE = "pipeline";
/** Default agent timeout (5 minutes) */
export declare const DEFAULT_AGENT_TIMEOUT = 300000;
/** Maximum agents in a pipeline */
export declare const MAX_PIPELINE_AGENTS = 100;
/**
 * Generate a unique pipeline execution ID
 * Format: "pipeline-{timestamp}-{random8hex}"
 */
export declare function generatePipelineID(): string;
/**
 * Validate pipeline ID format
 */
export declare function isValidPipelineID(id: string): boolean;
/**
 * Validate a pipeline definition
 * @throws PipelineValidationError if validation fails
 */
export declare function validatePipelineDefinition(pipeline: IPipelineDefinition): void;
/**
 * Validate a single agent definition
 */
export declare function validateAgentDefinition(agent: IAgentDefinition, index: number, isSequential: boolean, existingOutputKeys: Set<string>): void;
/**
 * Validate memory key chain forms a proper sequence
 */
export declare function validateMemoryKeyChain(agents: IAgentDefinition[]): void;
/**
 * Build the prompt for an agent with memory key injection
 */
export declare function buildAgentPrompt(agent: IAgentDefinition, previousContext: string | null, pipelineName?: string): string;
/**
 * Format agent position string
 * @param index - Zero-based agent index
 * @param total - Total agents in pipeline
 * @returns Position string (e.g., "Agent #5/48")
 */
export declare function formatAgentPosition(index: number, total: number): string;
/**
 * Parse agent position string
 * @param position - Position string (e.g., "Agent #5/48")
 * @returns { index, total } or null if invalid
 */
export declare function parseAgentPosition(position: string): {
    index: number;
    total: number;
} | null;
/**
 * Simple quality gate validation
 * Returns true if output appears to meet the gate requirement
 */
export declare function validateQualityGate(output: string, qualityGate: string): boolean;
/**
 * Serialize Map to array for JSON
 */
export declare function serializeMap<K, V>(map: Map<K, V>): Array<{
    key: K;
    value: V;
}>;
/**
 * Deserialize array to Map
 */
export declare function deserializeMap<K, V>(arr: Array<{
    key: K;
    value: V;
}>): Map<K, V>;
//# sourceMappingURL=orchestration-utils.d.ts.map