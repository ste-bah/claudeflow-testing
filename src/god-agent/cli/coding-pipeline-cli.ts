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

import { v4 as uuidv4 } from 'uuid';
import { UniversalAgent } from '../universal/universal-agent.js';
import type { ISessionBatchResponse, IBatchExecutionResult } from '../core/pipeline/coding-pipeline-types.js';

/**
 * Initialize a new coding pipeline session
 * Returns the first batch of agents with contextualized prompts
 *
 * @param task - User's coding task description
 */
export async function init(task: string): Promise<void> {
  const sessionId = uuidv4();
  const timings: Record<string, number> = {};

  // Create Universal Agent with all dependencies
  const t0 = performance.now();
  const godAgent = new UniversalAgent({ verbose: false });
  timings['create_agent'] = performance.now() - t0;

  // Initialize Universal Agent
  const t1 = performance.now();
  await godAgent.initialize();
  timings['initialize_agent'] = performance.now() - t1;

  // Store hook context to force pipeline mode
  // This sets triggeredByHook = true in prepareCodeTask()
  const t2 = performance.now();
  try {
    await godAgent['memoryClient']?.storeKnowledge({
      content: JSON.stringify({ task, sessionId, timestamp: new Date().toISOString() }),
      category: 'pipeline-trigger',
      domain: 'coding/context',
      tags: ['pipeline', 'god-code', 'hook'],
    });
  } catch (err) {
    console.error('Warning: Failed to store hook context, continuing anyway');
  }
  timings['store_hook_context'] = performance.now() - t2;

  // Build pipeline configuration using prepareCodeTask
  // triggeredByHook will now be true due to coding/context entry
  const t3 = performance.now();
  const codeTaskPreparation = await godAgent.prepareCodeTask(task, {
    language: 'typescript',
  });
  timings['prepare_code_task'] = performance.now() - t3;

  // Extract pipeline config from preparation
  const pipelineConfig = codeTaskPreparation.pipeline?.config;
  if (!pipelineConfig) {
    throw new Error('Failed to build pipeline configuration - task not recognized as pipeline');
  }

  // Get orchestrator
  const t4 = performance.now();
  const orchestrator = await godAgent.getCodingOrchestrator();
  timings['get_orchestrator'] = performance.now() - t4;

  // Initialize session in orchestrator (orchestrator handles all persistence)
  const t5 = performance.now();
  const batchResponse = await orchestrator.initSession(sessionId, pipelineConfig);
  timings['init_session'] = performance.now() - t5;

  // Log timing breakdown
  console.error('[TIMING] Initialization breakdown:');
  for (const [step, duration] of Object.entries(timings)) {
    console.error(`  ${step}: ${duration.toFixed(2)}ms`);
  }
  const total = Object.values(timings).reduce((a, b) => a + b, 0);
  console.error(`  TOTAL: ${total.toFixed(2)}ms\n`);

  // Output batch response as JSON for Claude Code to parse
  console.log(JSON.stringify({
    sessionId: batchResponse.sessionId,
    status: batchResponse.status,
    currentPhase: batchResponse.currentPhase,
    batch: batchResponse.batch,
    progress: {
      completed: batchResponse.completedAgents,
      total: batchResponse.totalAgents,
      percentage: Math.round((batchResponse.completedAgents / batchResponse.totalAgents) * 100),
    },
  }, null, 2));
}

/**
 * Mark current batch as complete and get next batch
 * Expects batch results on stdin as JSON array
 *
 * @param sessionId - Session identifier
 */
export async function complete(sessionId: string): Promise<void> {
  // Create Universal Agent (stderr progress so caller knows we're alive)
  console.error('[complete] Initializing agent...');
  const godAgent = new UniversalAgent({ verbose: false });
  await godAgent.initialize();
  console.error('[complete] Agent ready, loading session...');

  // Get orchestrator (orchestrator loads session from disk)
  const orchestrator = await godAgent.getCodingOrchestrator();
  console.error('[complete] Advancing batch...');

  // Read batch results from stdin (provided by god-code.md)
  // For now, we'll use a placeholder - Claude Code will provide actual results
  const results: IBatchExecutionResult[] = [];

  // TODO: Parse results from stdin once god-code.md provides them
  // For now, mark batch as complete with placeholder results
  await orchestrator.markBatchComplete(sessionId, results);

  // Get next batch
  const batchResponse = await orchestrator.getNextBatch(sessionId);

  // Output next batch or completion status
  console.log(JSON.stringify({
    sessionId: batchResponse.sessionId,
    status: batchResponse.status,
    currentPhase: batchResponse.currentPhase,
    batch: batchResponse.batch,
    progress: {
      completed: batchResponse.completedAgents,
      total: batchResponse.totalAgents,
      percentage: Math.round((batchResponse.completedAgents / batchResponse.totalAgents) * 100),
    },
  }, null, 2));
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const arg = process.argv[3];

  switch (command) {
    case 'init':
      if (!arg) {
        console.error('Usage: coding-pipeline-cli.ts init "<task>"');
        process.exit(1);
      }
      init(arg).catch((error) => {
        console.error('Error:', error);
        process.exit(1);
      });
      break;
    case 'complete':
      if (!arg) {
        console.error('Usage: coding-pipeline-cli.ts complete "<sessionId>"');
        process.exit(1);
      }
      complete(arg).catch((error) => {
        console.error('Error:', error);
        process.exit(1);
      });
      break;
    default:
      console.error('Usage: coding-pipeline-cli.ts init "<task>" | complete "<sessionId>"');
      process.exit(1);
  }
}
