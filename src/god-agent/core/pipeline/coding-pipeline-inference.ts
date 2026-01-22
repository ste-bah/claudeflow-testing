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
import { CRITICAL_AGENT_KEYS } from './coding-pipeline-constants.js';

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS (TS-004)
// ═══════════════════════════════════════════════════════════════════════════

/** Schema for phase agent input */
const PhaseAgentSchema = z.object({
  key: z.string(),
  phase: z.string(),
  order: z.number(),
});

/** Schema for inference input */
export const InferenceInputSchema = z.object({
  agentKey: z.string(),
  phaseAgents: z.array(PhaseAgentSchema),
});

/** Minimal agent info needed for inference */
export interface PhaseAgentInfo {
  key: string;
  phase: CodingPipelinePhase;
  order: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// INFERENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

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
export function inferDependencies(
  agentKey: string,
  phaseAgents: PhaseAgentInfo[]
): CodingPipelineAgent[] | undefined {
  const agent = phaseAgents.find(a => a.key === agentKey);
  if (!agent) {
    return undefined;
  }

  const samePhaseAgents = phaseAgents.filter(a => a.phase === agent.phase);
  const isFirstInPhase = samePhaseAgents.length > 0 && samePhaseAgents[0].key === agentKey;

  if (isFirstInPhase && agent.order > 1) {
    // First agent in phase depends on last agent of previous phase
    const prevAgent = phaseAgents.find(a => a.order === agent.order - 1);
    if (prevAgent) {
      return [prevAgent.key as CodingPipelineAgent];
    }
  }

  if (!isFirstInPhase) {
    // Non-first agents depend on previous agent in same phase
    const prevInPhase = samePhaseAgents.find(a => a.order === agent.order - 1);
    if (prevInPhase) {
      return [prevInPhase.key as CodingPipelineAgent];
    }
  }

  return undefined;
}

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
export function inferMemoryReads(
  agentKey: string,
  phaseAgents: PhaseAgentInfo[]
): string[] {
  const agent = phaseAgents.find(a => a.key === agentKey);
  if (!agent) {
    return [];
  }

  const reads: string[] = [];
  const phaseOrder: CodingPipelinePhase[] = [
    'understanding', 'exploration', 'architecture',
    'implementation', 'testing', 'optimization', 'delivery'
  ];
  const currentIdx = phaseOrder.indexOf(agent.phase);

  // Read from previous phase
  if (currentIdx > 0) {
    reads.push(`coding/${phaseOrder[currentIdx - 1]}`);
  }

  // First agent reads from input/context
  if (agent.order === 1) {
    reads.push('coding/input/task');
    reads.push('coding/context/project');
  }

  return reads;
}

/**
 * Infer memory write keys from agent
 *
 * @param agentKey - The agent key
 * @returns Array of memory keys this agent writes to
 */
export function inferMemoryWrites(agentKey: string): string[] {
  // Extract phase from agent key pattern or use generic pattern
  // The orchestrator will provide the actual phase context
  return [`coding/agent/${agentKey}`];
}

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
export function calculateXPReward(agentKey: string, isCritical: boolean): number {
  let baseXP = 50;

  // Critical agents get more XP
  if (isCritical || CRITICAL_AGENT_KEYS.has(agentKey)) {
    baseXP += 50;
  }

  // Sherlock reviewers get bonus XP
  if (agentKey.includes('reviewer') || agentKey === 'recovery-agent') {
    baseXP += 50;
  }

  return baseXP;
}
