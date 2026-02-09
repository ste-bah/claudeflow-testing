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
 * @param fast - Skip DESC injection for faster initialization (batch mode)
 */
export async function init(task: string, fast: boolean = false): Promise<void> {
  const sessionId = uuidv4();

  // Create Universal Agent with all dependencies
  const godAgent = new UniversalAgent({ verbose: false });
  await godAgent.initialize();

  // Build pipeline configuration
  let pipelineConfig;

  if (fast) {
    // Fast mode: Skip prepareCodeTask and DESC injection
    // Just build minimal config directly
    pipelineConfig = {
      taskText: task,
      language: 'typescript' as const,
      enableParallelExecution: true,
    };
  } else {
    // Normal mode: Full DESC injection and context preparation
    // Store hook context to force pipeline mode
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

    // Build pipeline configuration using prepareCodeTask
    // triggeredByHook will now be true due to coding/context entry
    const codeTaskPreparation = await godAgent.prepareCodeTask(task, {
      language: 'typescript',
    });

    // Extract pipeline config from preparation
    pipelineConfig = codeTaskPreparation.pipeline?.config;
    if (!pipelineConfig) {
      throw new Error('Failed to build pipeline configuration - task not recognized as pipeline');
    }
  }

  // Get orchestrator
  const orchestrator = await godAgent.getCodingOrchestrator();

  // Initialize session in orchestrator (orchestrator handles all persistence)
  const batchResponse = await orchestrator.initSession(sessionId, pipelineConfig);

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
  // Create Universal Agent
  const godAgent = new UniversalAgent({ verbose: false });
  await godAgent.initialize();

  // Get orchestrator (orchestrator loads session from disk)
  const orchestrator = await godAgent.getCodingOrchestrator();

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
        console.error('Usage: coding-pipeline-cli.ts init "<task>" [--fast]');
        process.exit(1);
      }
      // Check for --fast flag
      const fastFlag = process.argv.includes('--fast');
      init(arg, fastFlag).catch((error) => {
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
