/**
 * Coding Pipeline CLI - Stateful Execution
 *
 * Implements init/complete loop like phd-cli for 48-agent coding pipeline.
 * Claude Code calls this CLI to get next batch of agents with fully contextualized prompts.
 *
 * The CLI is a thin wrapper around CodingPipelineOrchestrator's stateful API,
 * which handles all RLM memory handoffs, LEANN semantic search, learning feedback,
 * and smart parallelism based on agent dependencies.
 */
/**
 * Initialize a new coding pipeline session
 * Returns the first batch of agents with contextualized prompts
 *
 * @param task - User's coding task description
 */
export declare function init(task: string): Promise<void>;
/**
 * Mark current batch as complete and get next batch
 * Expects batch results on stdin as JSON array
 *
 * @param sessionId - Session identifier
 */
export declare function complete(sessionId: string): Promise<void>;
//# sourceMappingURL=coding-pipeline-cli.d.ts.map