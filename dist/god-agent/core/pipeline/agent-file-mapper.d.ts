/**
 * DAI-002: Agent File Mapper
 *
 * Maps coding pipeline agent keys to their .md agent files and generates
 * ClaudeFlow-compliant Task() prompts for pipeline orchestration.
 *
 * This is the MISSING PIECE that connects:
 * - TypeScript agent definitions (CODING_PIPELINE_MAPPINGS)
 * - Actual .md agent files (.claude/agents/coding-pipeline/*.md)
 * - god-code.md pipeline execution
 *
 * @module src/god-agent/core/pipeline/agent-file-mapper
 * @see god-code.md
 * @see coding-pipeline-dag-builder.ts
 */
import type { CodingPipelineAgent, CodingPipelinePhase, IPipelineDAG } from './types.js';
/**
 * Get the file path for an agent's .md definition file.
 *
 * @param agentKey - The agent key (e.g., 'task-analyzer')
 * @returns Absolute path to the agent's .md file
 */
export declare function getAgentFilePath(agentKey: CodingPipelineAgent): string;
/**
 * Check if an agent's .md file exists.
 *
 * @param agentKey - The agent key
 * @returns True if the file exists
 */
export declare function agentFileExists(agentKey: CodingPipelineAgent): boolean;
/**
 * Read an agent's .md file content.
 *
 * @param agentKey - The agent key
 * @returns Promise resolving to the file content
 * @throws Error if file doesn't exist
 */
export declare function getAgentPromptContent(agentKey: CodingPipelineAgent): Promise<string>;
/**
 * Extract the agent instructions from the .md file (content after frontmatter).
 *
 * @param content - Full .md file content
 * @returns The instructions section (after YAML frontmatter)
 */
export declare function extractAgentInstructions(content: string): string;
/**
 * Execution step for a single agent in the pipeline.
 */
export interface IPipelineExecutionStep {
    /** Step number (1-47) */
    stepNumber: number;
    /** Agent key */
    agentKey: CodingPipelineAgent;
    /** Phase this agent belongs to */
    phase: CodingPipelinePhase;
    /** Is this a Sherlock forensic reviewer? */
    isSherlockReviewer: boolean;
    /** Is this a critical agent that halts pipeline on failure? */
    isCritical: boolean;
    /** Agents that must complete before this one */
    dependsOn: CodingPipelineAgent[];
    /** Memory keys to read from previous agents */
    memoryReads: string[];
    /** Memory keys this agent will write */
    memoryWrites: string[];
    /** Path to agent .md file */
    filePath: string;
    /** Algorithm to use */
    algorithm: string;
    /** XP reward for completion */
    xpReward: number;
}
/**
 * Phase boundary marker in the execution plan.
 */
export interface IPhaseBoundary {
    /** Phase name */
    phase: CodingPipelinePhase;
    /** Phase number (1-7) */
    phaseNumber: number;
    /** First agent step in this phase */
    startStep: number;
    /** Last agent step in this phase (excluding Sherlock) */
    endStep: number;
    /** Sherlock reviewer step for this phase */
    sherlockStep: number;
    /** Total agents in phase (including Sherlock) */
    agentCount: number;
}
/**
 * Complete pipeline execution plan.
 */
export interface IPipelineExecutionPlan {
    /** All 47 agents in topological execution order */
    steps: IPipelineExecutionStep[];
    /** Phase boundaries for checkpointing */
    phaseBoundaries: IPhaseBoundary[];
    /** Total XP available in pipeline */
    totalXP: number;
    /** Total agents */
    totalAgents: number;
    /** DAG structure */
    dag: IPipelineDAG;
}
/**
 * Build the complete pipeline execution plan with all 47 agents in
 * topological order, phase boundaries, and Sherlock gates.
 *
 * @returns Complete execution plan
 */
export declare function buildPipelineExecutionPlan(): IPipelineExecutionPlan;
/**
 * Memory context passed to agents.
 */
export interface IMemoryContext {
    [key: string]: unknown;
}
/**
 * Generate a ClaudeFlow-compliant Task() prompt for an agent.
 *
 * @param agentKey - The agent to generate prompt for
 * @param taskDescription - The original user task
 * @param memoryContext - Retrieved memory from previous agents
 * @param stepInfo - Optional step information for WORKFLOW CONTEXT
 * @returns Complete prompt string for Task()
 */
export declare function generateTaskPrompt(agentKey: CodingPipelineAgent, taskDescription: string, memoryContext?: IMemoryContext, stepInfo?: {
    stepNumber: number;
    totalSteps: number;
    phase: CodingPipelinePhase;
    phaseNumber: number;
    previousAgents: string[];
    nextAgents: string[];
}): Promise<string>;
/**
 * Generate a Sherlock forensic review prompt for phase gate.
 *
 * @param reviewerKey - The Sherlock reviewer agent key
 * @param phase - The phase being reviewed
 * @param phaseNumber - Phase number (1-7)
 * @param taskDescription - Original task
 * @returns Complete Sherlock review prompt
 */
export declare function generateSherlockPrompt(reviewerKey: CodingPipelineAgent, phase: CodingPipelinePhase, phaseNumber: number, taskDescription: string): Promise<string>;
/**
 * Validate that all agent .md files exist.
 *
 * @returns Array of missing agent files
 */
export declare function validateAgentFiles(): string[];
/**
 * Get validation summary for the pipeline.
 */
export declare function getPipelineValidationSummary(): {
    totalAgents: number;
    existingFiles: number;
    missingFiles: string[];
    valid: boolean;
};
//# sourceMappingURL=agent-file-mapper.d.ts.map