/**
 * CodingPipelineInference - Agent dependency and reward inference functions
 *
 * Extracted from coding-pipeline-config-loader.ts for modularity.
 * Provides inference logic for agent dependencies, memory access patterns, and XP rewards.
 *
 * @module src/god-agent/core/pipeline/coding-pipeline-inference
 * @see TS-004 (Zod validation)
 * @see ERR-002 (Error handling)
 */
import { z } from 'zod';
import type { CodingPipelineAgent, CodingPipelinePhase } from './types.js';
/** Schema for inference input */
export declare const InferenceInputSchema: z.ZodObject<{
    agentKey: z.ZodString;
    phaseAgents: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        phase: z.ZodString;
        order: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        key: string;
        phase: string;
        order: number;
    }, {
        key: string;
        phase: string;
        order: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    agentKey: string;
    phaseAgents: {
        key: string;
        phase: string;
        order: number;
    }[];
}, {
    agentKey: string;
    phaseAgents: {
        key: string;
        phase: string;
        order: number;
    }[];
}>;
/** Minimal agent info needed for inference */
export interface PhaseAgentInfo {
    key: string;
    phase: CodingPipelinePhase;
    order: number;
}
/**
 * Infer dependencies from agent position and phase
 *
 * Rules:
 * - First agent in phase depends on last agent of previous phase
 * - Non-first agents depend on previous agent in same phase
 *
 * @param agentKey - The agent key to infer dependencies for
 * @param phaseAgents - All agents in the pipeline sorted by order
 * @returns Array of dependent agent keys, or undefined if no dependencies
 */
export declare function inferDependencies(agentKey: string, phaseAgents: PhaseAgentInfo[]): CodingPipelineAgent[] | undefined;
/**
 * Infer memory read keys from agent phase
 *
 * Rules:
 * - Agents read from previous phase's memory namespace
 * - First agent (order=1) reads from input/task and context/project
 *
 * @param agentKey - The agent key
 * @param phaseAgents - All agents to determine phase
 * @returns Array of memory keys this agent should read
 */
export declare function inferMemoryReads(agentKey: string, phaseAgents: PhaseAgentInfo[]): string[];
/**
 * Infer memory write keys from agent
 *
 * @param agentKey - The agent key
 * @returns Array of memory keys this agent writes to
 */
export declare function inferMemoryWrites(agentKey: string): string[];
/**
 * Calculate XP reward based on agent criticality and type
 *
 * Reward tiers:
 * - Base: 50 XP
 * - Critical agents: +50 XP
 * - Sherlock reviewers: +50 XP
 *
 * @param agentKey - The agent key
 * @param isCritical - Whether the agent is marked as critical
 * @returns XP reward value
 */
export declare function calculateXPReward(agentKey: string, isCritical: boolean): number;
//# sourceMappingURL=coding-pipeline-inference.d.ts.map