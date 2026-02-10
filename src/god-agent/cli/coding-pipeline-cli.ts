/**
 * Coding Pipeline CLI - Sequential Execution (PhD-style interface)
 *
 * Implements init/next/complete <key> loop matching phd-cli.ts exactly.
 * Each command returns a SINGLE agent (not a batch array).
 * Forces enableParallelExecution: false so every batch has exactly 1 agent.
 *
 * Commands:
 *   init "<task>"              - Initialize session, return first agent
 *   next <sessionId>           - Get next agent (or status: "complete")
 *   complete <sessionId> <key> - Mark one agent done
 *   status <sessionId>         - Show progress
 *   resume <sessionId>         - Get current agent without advancing
 */

import { v4 as uuidv4 } from 'uuid';
import { UniversalAgent } from '../universal/universal-agent.js';
import type { IBatchExecutionResult } from '../core/pipeline/coding-pipeline-types.js';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Create orchestrator with parallel execution DISABLED (sequential batches of 1) */
async function createSequentialOrchestrator() {
  const godAgent = new UniversalAgent({ verbose: false });
  await godAgent.initialize();
  const orchestrator = await godAgent.getCodingOrchestrator({
    enableParallelExecution: false,
    maxParallelAgents: 1,
  });
  return { godAgent, orchestrator };
}

/** Unwrap single-agent batch response into PhD-style output */
function formatAgentResponse(batchResponse: {
  sessionId: string;
  status: string;
  currentPhase: string;
  batch: Array<{ key: string; prompt: string; type: string; memoryWrites: string[] }>;
  completedAgents: number;
  totalAgents: number;
}) {
  if (batchResponse.status === 'complete') {
    return {
      sessionId: batchResponse.sessionId,
      status: 'complete',
      progress: {
        completed: batchResponse.totalAgents,
        total: batchResponse.totalAgents,
        percentage: 100,
      },
    };
  }

  const agent = batchResponse.batch[0];
  if (!agent) {
    return {
      sessionId: batchResponse.sessionId,
      status: 'complete',
      progress: {
        completed: batchResponse.completedAgents,
        total: batchResponse.totalAgents,
        percentage: 100,
      },
    };
  }

  return {
    sessionId: batchResponse.sessionId,
    status: 'running',
    currentPhase: batchResponse.currentPhase,
    agent: {
      key: agent.key,
      prompt: agent.prompt,
    },
    progress: {
      completed: batchResponse.completedAgents,
      total: batchResponse.totalAgents,
      percentage: Math.round((batchResponse.completedAgents / batchResponse.totalAgents) * 100),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMANDS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize a new coding pipeline session.
 * Returns the first agent as a single object (not an array).
 */
export async function init(task: string): Promise<void> {
  const sessionId = uuidv4();

  console.error('[init] Creating agent...');
  const { godAgent, orchestrator } = await createSequentialOrchestrator();

  // Store hook context to force pipeline mode
  console.error('[init] Storing hook context...');
  try {
    await godAgent['memoryClient']?.storeKnowledge({
      content: JSON.stringify({ task, sessionId, timestamp: new Date().toISOString() }),
      category: 'pipeline-trigger',
      domain: 'coding/context',
      tags: ['pipeline', 'god-code', 'hook'],
    });
  } catch {
    console.error('[init] Warning: Failed to store hook context, continuing');
  }

  // Build pipeline configuration
  console.error('[init] Preparing code task...');
  const codeTaskPreparation = await godAgent.prepareCodeTask(task, {
    language: 'typescript',
  });

  const pipelineConfig = codeTaskPreparation.pipeline?.config;
  if (!pipelineConfig) {
    throw new Error('Failed to build pipeline configuration - task not recognized as pipeline');
  }

  // Initialize session (orchestrator persists to disk)
  console.error('[init] Initializing session...');
  const batchResponse = await orchestrator.initSession(sessionId, pipelineConfig);

  // Output single agent (unwrapped from batch)
  console.log(JSON.stringify(formatAgentResponse(batchResponse), null, 2));
}

/**
 * Get the next agent to execute.
 * Returns a single agent object or status: "complete".
 */
export async function next(sessionId: string): Promise<void> {
  console.error('[next] Loading session...');
  const { orchestrator } = await createSequentialOrchestrator();

  const batchResponse = await orchestrator.getNextBatch(sessionId);
  console.log(JSON.stringify(formatAgentResponse(batchResponse), null, 2));
}

/**
 * Mark a single agent as complete.
 * Takes the agent key as argument (like phd-cli: complete <sessionId> <agentKey>).
 */
export async function complete(sessionId: string, agentKey: string): Promise<void> {
  console.error(`[complete] Marking ${agentKey} done...`);
  const { orchestrator } = await createSequentialOrchestrator();

  // Build a proper result (fixes the bug where old CLI passed empty results)
  const results: IBatchExecutionResult[] = [{
    agentKey,
    success: true,
    output: `Agent ${agentKey} completed via CLI`,
    quality: 0.8,
    duration: 0,
  }];

  await orchestrator.markBatchComplete(sessionId, results);
  console.log(JSON.stringify({ success: true, agentKey, sessionId }, null, 2));
}

/**
 * Resume an interrupted session — returns current agent WITHOUT advancing.
 */
export async function resume(sessionId: string): Promise<void> {
  console.error('[resume] Loading session...');
  const { orchestrator } = await createSequentialOrchestrator();

  // getNextBatch returns the CURRENT batch without advancing
  const batchResponse = await orchestrator.getNextBatch(sessionId);
  console.log(JSON.stringify(formatAgentResponse(batchResponse), null, 2));
}

/**
 * Show session status (fast — reads disk directly, no agent init).
 */
export async function status(sessionId: string): Promise<void> {
  const { promises: fs } = await import('fs');
  const sessionPath = `.god-agent/coding-sessions/${sessionId}.json`;

  try {
    const data = JSON.parse(await fs.readFile(sessionPath, 'utf-8'));
    const total = data.batches.flat().flat().length;
    const phase = data.config.phases[data.currentPhaseIndex] || 'complete';
    const currentAgentKey = data.status !== 'complete'
      ? data.batches[data.currentPhaseIndex]?.[data.currentBatchIndex]?.[0]?.agentKey || null
      : null;

    console.log(JSON.stringify({
      sessionId: data.sessionId,
      status: data.status,
      currentPhase: phase,
      currentAgent: currentAgentKey,
      completedAgents: data.completedAgents.length,
      totalAgents: total,
      percentage: Math.round((data.completedAgents.length / total) * 100),
    }, null, 2));
  } catch {
    console.error(`Session not found: ${sessionPath}`);
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const arg1 = process.argv[3];
  const arg2 = process.argv[4];

  const fail = (msg: string) => { console.error(msg); process.exit(1); };

  switch (command) {
    case 'init':
      if (!arg1) fail('Usage: coding-pipeline-cli.ts init "<task>"');
      init(arg1).catch(e => { console.error('Error:', e); process.exit(1); });
      break;

    case 'next':
      if (!arg1) fail('Usage: coding-pipeline-cli.ts next <sessionId>');
      next(arg1).catch(e => { console.error('Error:', e); process.exit(1); });
      break;

    case 'complete':
      if (!arg1 || !arg2) fail('Usage: coding-pipeline-cli.ts complete <sessionId> <agentKey>');
      complete(arg1, arg2).catch(e => { console.error('Error:', e); process.exit(1); });
      break;

    case 'resume':
      if (!arg1) fail('Usage: coding-pipeline-cli.ts resume <sessionId>');
      resume(arg1).catch(e => { console.error('Error:', e); process.exit(1); });
      break;

    case 'status':
      if (!arg1) fail('Usage: coding-pipeline-cli.ts status <sessionId>');
      status(arg1).catch(e => { console.error('Error:', e); process.exit(1); });
      break;

    default:
      fail('Usage: coding-pipeline-cli.ts init|next|complete|resume|status "<arg>"');
  }
}
