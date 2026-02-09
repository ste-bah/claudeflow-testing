/**
 * Coding Pipeline Batch Processor
 *
 * Processes multiple coding tasks sequentially, each with the full 48-agent pipeline.
 *
 * Usage:
 *   npx tsx src/god-agent/cli/coding-pipeline-batch.ts "task 1" "task 2" "task 3"
 *   npx tsx src/god-agent/cli/coding-pipeline-batch.ts --file tasks.txt
 */

import { readFileSync } from 'fs';
import { UniversalAgent } from '../universal/universal-agent.js';

interface BatchResult {
  task: string;
  sessionId: string;
  status: 'completed' | 'failed';
  error?: string;
  completedAgents: number;
  totalAgents: number;
}

/**
 * Process a single task through the full pipeline
 * Uses executePipeline() for REAL agent execution (not fake results)
 */
async function processTask(task: string, taskNum: number, totalTasks: number): Promise<BatchResult> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Task ${taskNum}/${totalTasks}: ${task}`);
  console.log('='.repeat(80));

  const godAgent = new UniversalAgent({ verbose: true });
  await godAgent.initialize();

  try {
    // Build pipeline configuration
    const codeTaskPreparation = await godAgent.prepareCodeTask(task, {
      language: 'typescript',
    });

    const pipelineConfig = codeTaskPreparation.pipeline?.config;
    if (!pipelineConfig) {
      throw new Error('Failed to build pipeline configuration');
    }

    console.log(`\n✓ Pipeline configured for task ${taskNum}`);
    console.log(`  Task: ${task.substring(0, 100)}${task.length > 100 ? '...' : ''}`);
    console.log(`  Total agents: 48\n`);

    // EXECUTE WITH REAL AGENTS (not fake results!)
    // Uses ClaudeCodeStepExecutor by default (calls orchestrator.execute())
    const result = await godAgent.executePipeline(pipelineConfig);

    if (!result.success) {
      const errorMsg = result.failedPhase
        ? `Pipeline failed at phase: ${result.failedPhase}`
        : 'Pipeline execution failed';
      throw new Error(errorMsg);
    }

    console.log(`\n✓ Task completed successfully!`);
    console.log(`  Completed: ${result.completedPhases.length}/${pipelineConfig.phases.length} phases`);
    console.log(`  Total XP: ${result.totalXP}\n`);

    const sessionId = `batch-${Date.now()}-${taskNum}`;
    return {
      task,
      sessionId,
      status: 'completed',
      completedAgents: 48, // All agents from all phases
      totalAgents: 48,
    };
  } catch (error) {
    console.error(`\n✗ Task failed: ${error instanceof Error ? error.message : String(error)}`);

    return {
      task,
      sessionId: '',
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      completedAgents: 0,
      totalAgents: 48,
    };
  }
}

/**
 * Process multiple tasks in batch
 */
async function processBatch(tasks: string[]): Promise<void> {
  const results: BatchResult[] = [];
  const startTime = Date.now();

  console.log(`\n${'='.repeat(80)}`);
  console.log(`BATCH MODE: Processing ${tasks.length} tasks`);
  console.log('='.repeat(80));

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const result = await processTask(task, i + 1, tasks.length);
    results.push(result);
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);

  // Print summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('BATCH SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total tasks: ${tasks.length}`);
  console.log(`Completed: ${results.filter((r) => r.status === 'completed').length}`);
  console.log(`Failed: ${results.filter((r) => r.status === 'failed').length}`);
  console.log(`Duration: ${duration} minutes\n`);

  // Print individual results
  results.forEach((result, i) => {
    const status = result.status === 'completed' ? '✓' : '✗';
    console.log(`${status} Task ${i + 1}: ${result.task}`);
    if (result.status === 'completed') {
      console.log(`  Session: ${result.sessionId}`);
      console.log(`  Agents: ${result.completedAgents}/${result.totalAgents}`);
    } else {
      console.log(`  Error: ${result.error}`);
    }
  });

  console.log();

  // Exit with error if any tasks failed
  if (results.some((r) => r.status === 'failed')) {
    process.exit(1);
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage:');
    console.error('  npx tsx coding-pipeline-batch.ts "task 1" "task 2" "task 3"');
    console.error('  npx tsx coding-pipeline-batch.ts --file tasks.txt');
    process.exit(1);
  }

  let tasks: string[];

  if (args[0] === '--file') {
    if (!args[1]) {
      console.error('Error: --file requires a filename');
      process.exit(1);
    }

    try {
      const content = readFileSync(args[1], 'utf-8');
      tasks = content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
    } catch (error) {
      console.error(`Error reading file: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  } else {
    tasks = args;
  }

  processBatch(tasks).catch((error) => {
    console.error('Batch processing error:', error);
    process.exit(1);
  });
}
