/**
 * Coding Pipeline CLI - Sequential Execution (PhD-style interface)
 *
 * Implements init/next/complete <key> loop matching phd-cli.ts exactly.
 * Each command returns a SINGLE agent (not a batch array).
 * Forces enableParallelExecution: false so every batch has exactly 1 agent.
 *
 * Features:
 *   - Dynamic quality scoring via CodingQualityCalculator (not hardcoded 0.8)
 *   - XP rewards per PRD Section 7.3
 *   - LEANN semantic code context injection (codebase-aware agents)
 *   - Reflexion past failure trajectory injection (self-correction)
 *   - DESC injection with pre-vetting via InjectionFilter
 *   - SONA pattern injection from SonaEngine
 *   - Post-execution DESC episode storage for future retrieval
 *
 * Commands:
 *   init "<task>"                              - Initialize session, return first agent
 *   next <sessionId>                           - Get next agent with DESC/SONA augmentation
 *   complete <sessionId> <key> [--file <path>] - Mark agent done with dynamic quality
 *   status <sessionId>                         - Show progress + XP summary
 *   resume <sessionId>                         - Get current agent without advancing
 */

import { v4 as uuidv4 } from 'uuid';
import { UniversalAgent } from '../universal/universal-agent.js';
import type { IBatchExecutionResult } from '../core/pipeline/coding-pipeline-types.js';
import { CodingQualityCalculator, createCodingQualityContext, IMPLEMENTATION_AGENTS } from './coding-quality-calculator.js';

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
// ─────────────────────────────────────────────────────────────────────────────
// MODEL ASSIGNMENT: Explicit model per agent to prevent cost-optimization downgrades
// ─────────────────────────────────────────────────────────────────────────────
const AGENT_MODEL_MAP: Record<string, 'opus' | 'sonnet' | 'haiku'> = {
  // Phase 1: Understanding
  'task-analyzer': 'opus',            // pipeline entry — sets the entire direction
  'requirement-extractor': 'sonnet',
  'requirement-prioritizer': 'sonnet',
  'scope-definer': 'sonnet',
  'context-gatherer': 'sonnet',
  'feasibility-analyzer': 'opus',     // critical go/no-go decision
  // Phase 2: Exploration
  'pattern-explorer': 'sonnet',
  'technology-scout': 'sonnet',
  'research-planner': 'sonnet',
  'codebase-analyzer': 'opus',        // deep codebase understanding drives everything
  // Phase 3: Architecture — opus (critical design decisions shape all implementation)
  'system-designer': 'opus',
  'component-designer': 'opus',
  'interface-designer': 'opus',
  'data-architect': 'opus',
  'integration-architect': 'opus',
  // Phase 4: Implementation — opus for core, sonnet for support
  'code-generator': 'opus',           // primary code author
  'type-implementer': 'sonnet',
  'unit-implementer': 'opus',         // core business logic
  'service-implementer': 'opus',      // core business logic
  'data-layer-implementer': 'opus',   // data access patterns matter
  'api-implementer': 'opus',          // public API surface
  'frontend-implementer': 'sonnet',
  'error-handler-implementer': 'sonnet',
  'config-implementer': 'haiku',      // boilerplate config
  'logger-implementer': 'haiku',      // boilerplate logging
  'dependency-manager': 'haiku',      // package management
  'implementation-coordinator': 'opus', // orchestrates all implementation
  // Phase 5: Testing
  'test-generator': 'opus',           // test quality = code quality
  'test-runner': 'haiku',             // executing tests, reading output
  'integration-tester': 'sonnet',
  'regression-tester': 'sonnet',
  'security-tester': 'opus',          // security analysis needs deep reasoning
  'coverage-analyzer': 'haiku',       // reading coverage reports
  'quality-gate': 'haiku',            // checking metrics against thresholds
  'test-fixer': 'opus',               // debugging requires deep reasoning
  // Phase 6: Optimization
  'performance-optimizer': 'sonnet',
  'performance-architect': 'sonnet',
  'code-quality-improver': 'sonnet',
  'security-architect': 'opus',       // security architecture is critical
  'final-refactorer': 'sonnet',
  // Phase 7: Delivery
  'sign-off-approver': 'opus',        // final approval — highest judgment needed
  'recovery-agent': 'opus',           // failure diagnosis needs deep reasoning
  // Phase reviewers — haiku (checking, not creating)
  'phase-1-reviewer': 'haiku',
  'phase-2-reviewer': 'haiku',
  'phase-3-reviewer': 'haiku',
  'phase-4-reviewer': 'haiku',
  'phase-5-reviewer': 'haiku',
  'phase-6-reviewer': 'haiku',
};

function getAgentModel(agentKey: string): 'opus' | 'sonnet' | 'haiku' {
  return AGENT_MODEL_MAP[agentKey] || 'sonnet'; // default to sonnet for unknown agents
}

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
      model: getAgentModel(agent.key),
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
 * Get the next agent to execute with full learning augmentation.
 * Injects 4 learning sources into agent prompts:
 *   1. DESC: pre-vetted episodic memory of prior solutions
 *   2. SONA: high-quality learned patterns
 *   3. LEANN: semantic code context from codebase search
 *   4. Reflexion: past failure trajectories for self-correction
 * Returns a single agent object or status: "complete".
 */
export async function next(sessionId: string): Promise<void> {
  console.error('[next] Loading session...');
  const { orchestrator } = await createSequentialOrchestrator();

  const batchResponse = await orchestrator.getNextBatch(sessionId);

  if (batchResponse.status !== 'complete' && batchResponse.batch[0]) {
    let prompt = batchResponse.batch[0].prompt;
    const agentKey = batchResponse.batch[0].key;

    // DESC injection with pre-vetting (graceful — if UCM unavailable, continue without)
    try {
      const { getUCMClient } = await import('./ucm-daemon-client.js');
      const ucmClient = getUCMClient();
      if (await ucmClient.isHealthy()) {
        // Step 1: Retrieve candidates (not inject) — get raw episodes with metadata
        const candidates = await ucmClient.retrieveSimilar(prompt, {
          threshold: 0.80,
          maxResults: 5,
        });

        if (candidates.length > 0) {
          // Step 2: Pre-vet each candidate with InjectionFilter
          const { InjectionFilter } = await import('../core/ucm/desc/injection-filter.js');
          const filter = new InjectionFilter();
          const taskContext = {
            agentId: agentKey,
            pipelineName: 'coding-pipeline',
            task: prompt.substring(0, 500),
            metadata: {},
          };

          const vetted = candidates.filter(candidate => {
            const episode = {
              episodeId: candidate.episodeId,
              queryText: '',
              answerText: candidate.answerText,
              queryChunkEmbeddings: [] as Float32Array[],
              answerChunkEmbeddings: [] as Float32Array[],
              queryChunkCount: 0,
              answerChunkCount: 0,
              createdAt: candidate.metadata?.storedAt
                ? new Date(candidate.metadata.storedAt as string)
                : new Date(),
              metadata: candidate.metadata,
            };

            const decision = filter.shouldInject(episode, candidate.maxSimilarity, taskContext);

            // Additional quality gate: reject if stored quality < 0.50
            const storedQuality = candidate.metadata?.quality as number | undefined;
            if (storedQuality !== undefined && storedQuality < 0.50) {
              console.error(`[DESC-VET] Rejected ${candidate.episodeId}: low quality (${storedQuality})`);
              return false;
            }

            if (!decision.inject) {
              console.error(`[DESC-VET] Rejected ${candidate.episodeId}: ${decision.reason}`);
            }
            return decision.inject;
          });

          // Step 3: Build augmented prompt with vetted episodes + confidence metadata
          if (vetted.length > 0) {
            const toInject = vetted.slice(0, 3);
            prompt += '\n\n---\n# Relevant Prior Solutions (vetted)\n';
            prompt += 'These solutions passed quality and relevance vetting. ';
            prompt += 'Evaluate their applicability to your specific context.\n';

            for (let idx = 0; idx < toInject.length; idx++) {
              const ep = toInject[idx];
              const quality = ep.metadata?.quality as number | undefined;
              const qualityLabel = quality !== undefined
                ? ` | quality: ${(quality * 100).toFixed(0)}%`
                : '';
              prompt += `\n## Prior Solution ${idx + 1} (similarity: ${ep.maxSimilarity.toFixed(2)}${qualityLabel})\n`;
              prompt += ep.answerText;
            }
            prompt += '\n---\n';

            console.error(`[DESC] Injected ${toInject.length} vetted solutions (${candidates.length - vetted.length} rejected)`);
          } else {
            console.error(`[DESC] ${candidates.length} candidates retrieved, 0 passed vetting`);
          }
        }
      }
    } catch { /* optional — DESC unavailable is not an error */ }

    // SONA pattern injection (graceful)
    try {
      const { SonaEngine } = await import('../core/learning/sona-engine.js');
      const engine = new SonaEngine();
      await engine.initialize();
      const allPatterns = engine.getPatterns();
      // Filter to high-quality patterns and take top 3 by sonaWeight
      const patterns = allPatterns
        .filter(p => (p.quality ?? 0) > 0.5)
        .sort((a, b) => (b.sonaWeight ?? 0) - (a.sonaWeight ?? 0))
        .slice(0, 3);
      if (patterns.length > 0) {
        prompt += '\n\n## LEARNED PATTERNS (from past successful executions)\n';
        prompt += 'The following patterns have been learned from high-quality past outputs:\n\n';
        for (const p of patterns) {
          const confidence = p.sonaWeight ?? p.quality ?? 0;
          const description = p.metadata?.description || p.taskType || p.id;
          prompt += `- **${p.id}** (confidence: ${Math.round(confidence * 100)}%): ${description}\n`;
        }
        prompt += '\nConsider these patterns when executing your task.\n';
        console.error(`[SONA] Injected ${patterns.length} learned patterns for ${agentKey}`);
      }
    } catch { /* optional */ }

    // LEANN semantic code context injection (graceful)
    try {
      const { createLeannContextService } = await import('../core/pipeline/leann-context-service.js');
      const { createLEANNAdapter } = await import('../core/search/adapters/leann-adapter.js');
      const { createDualCodeEmbeddingProvider, createLEANNEmbedder } = await import('../core/search/dual-code-embedding.js');

      const leannService = createLeannContextService({
        defaultMaxResults: 5,
        minSimilarityThreshold: 0.3,
      });

      const dualProvider = createDualCodeEmbeddingProvider({
        nlpWeight: 0.4,
        codeWeight: 0.6,
        cacheEnabled: true,
        cacheMaxSize: 500,
        provider: 'local',
      });

      const dimension = dualProvider.getDimensions();
      const embedder = createLEANNEmbedder(dualProvider);
      const adapter = createLEANNAdapter(embedder, dimension);
      await leannService.initialize(adapter);

      // Load persisted vectors
      const loaded = await leannService.load('vector_db_leann');
      if (loaded) {
        const vectorCount = leannService.getVectorCount();
        console.error(`[LEANN] Loaded ${vectorCount} vectors from persisted index`);

        // Search for relevant code context using the agent prompt as query
        const searchQuery = prompt.substring(0, 500); // first 500 chars for search
        const context = await leannService.buildSemanticContext({
          taskDescription: searchQuery,
          phase: 0,
          maxResults: 5,
        });

        if (context.codeContext.length > 0) {
          prompt += '\n\n---\n## SEMANTIC CODE CONTEXT (from codebase search)\n';
          prompt += `**Found ${context.totalResults} relevant code sections:**\n`;
          for (let i = 0; i < context.codeContext.length; i++) {
            const c = context.codeContext[i];
            const truncated = c.content.length > 2000
              ? c.content.substring(0, 2000) + '\n... [truncated]'
              : c.content;
            const escaped = truncated.replace(/```/g, '\\`\\`\\`');
            prompt += `\n### Context ${i + 1}: ${c.filePath} (${(c.similarity * 100).toFixed(1)}% relevant)\n`;
            prompt += `\`\`\`${c.language ?? ''}\n${escaped}\n\`\`\`\n`;
          }
          prompt += '\n**Note:** Use this context to understand existing patterns and conventions.\n---\n';
          console.error(`[LEANN] Injected ${context.codeContext.length} code contexts for ${agentKey}`);
        }
      } else {
        console.error('[LEANN] No persisted vectors found, skipping semantic context');
      }
    } catch (err) {
      console.error(`[LEANN] Semantic context injection failed (non-fatal): ${(err as Error).message}`);
    }

    // Reflexion: past failure trajectory injection for self-correction (graceful)
    try {
      const { SonaEngine } = await import('../core/learning/sona-engine.js');
      const engine = new SonaEngine();
      await engine.initialize();

      const allTrajectories = engine.listTrajectories('reasoning.pattern');
      const agentTag = `agent:${agentKey}`;
      const agentTrajectories = allTrajectories.filter(t =>
        t.context?.includes(agentTag) ?? false
      );
      const failures = agentTrajectories.filter(t =>
        (t.quality !== undefined && t.quality < 0.7) || t.context?.includes('failed')
      );

      if (failures.length > 0) {
        const totalExec = agentTrajectories.length;
        const successCount = agentTrajectories.filter(t =>
          t.quality !== undefined && t.quality >= 0.7
        ).length;
        const successRate = totalExec > 0 ? successCount / totalExec : 1;

        prompt += '\n\n## REFLEXION (lessons from past failures)\n';
        prompt += `**History:** ${totalExec} past executions, ${(successRate * 100).toFixed(0)}% success rate\n`;
        prompt += `**Recent failures (${Math.min(failures.length, 5)}):**\n`;

        const recentFailures = failures.slice(-5);
        for (let i = 0; i < recentFailures.length; i++) {
          const f = recentFailures[i];
          const pipelineId = f.context?.find((c: string) => c.startsWith('pipeline:'))?.replace('pipeline:', '');
          const pipelineNote = pipelineId ? ` (pipeline: ${pipelineId})` : '';
          const date = new Date(f.createdAt).toISOString();
          prompt += `${i + 1}. Quality ${(f.quality ?? 0).toFixed(2)} on ${date}${pipelineNote}\n`;
        }

        prompt += '\n**Action:** Learn from these failures. Avoid repeating the same mistakes. Focus on completeness and correctness.\n';
        console.error(`[REFLEXION] Injected ${recentFailures.length} failure lessons for ${agentKey} (${(successRate * 100).toFixed(0)}% success rate)`);
      }
    } catch { /* optional — Reflexion unavailable is not an error */ }

    batchResponse.batch[0].prompt = prompt;
  }

  console.log(JSON.stringify(formatAgentResponse(batchResponse), null, 2));
}

/**
 * Mark a single agent as complete with dynamic quality scoring and XP rewards.
 * Accepts --file <path> to read actual agent output for quality assessment.
 */
export async function complete(
  sessionId: string, agentKey: string,
  options?: { file?: string }
): Promise<void> {
  console.error(`[complete] Marking ${agentKey} done...`);
  const { orchestrator } = await createSequentialOrchestrator();
  const fsP = (await import('fs')).promises;

  // 1. Read agent output (from --file or fallback)
  let output = `Agent ${agentKey} completed via CLI`;
  if (options?.file) {
    try {
      output = await fsP.readFile(options.file, 'utf-8');
      console.error(`[complete] Read ${output.length} chars from ${options.file}`);
    } catch {
      console.error(`[complete] Warning: could not read ${options.file}, using default output`);
    }
  }

  // 2. For implementation agents, also read the actual source files they produced
  let scoringOutput = output;
  if (IMPLEMENTATION_AGENTS.includes(agentKey)) {
    const filePathPattern = /[`'"]\s*([./\w-]+\.(?:ts|tsx|js|jsx|py|sql|json|yaml|yml|css|scss|html))\s*[`'"]/g;
    const mentioned = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = filePathPattern.exec(output)) !== null) {
      mentioned.add(match[1]);
    }
    if (mentioned.size > 0) {
      const codeParts: string[] = [output];
      for (const filePath of mentioned) {
        try {
          const content = await fsP.readFile(filePath, 'utf-8');
          codeParts.push(`\n\n// === FILE: ${filePath} ===\n${content}`);
        } catch {
          // File doesn't exist or isn't readable — skip silently
        }
      }
      if (codeParts.length > 1) {
        scoringOutput = codeParts.join('');
        console.error(`[complete] Augmented scoring with ${codeParts.length - 1} source file(s) from ${mentioned.size} mentioned`);
      }
    }
  }

  // 3. Read session to get phase index
  const sessionData = JSON.parse(
    await fsP.readFile(`.god-agent/coding-sessions/${sessionId}.json`, 'utf-8')
  );
  const phase = (sessionData.currentPhaseIndex ?? 0) + 1;

  // 4. Dynamic quality scoring
  const calculator = new CodingQualityCalculator();
  const context = createCodingQualityContext(agentKey, phase);
  const assessment = calculator.assessQuality(scoringOutput, context);
  console.error(`[complete] Quality: ${assessment.score.toFixed(2)} (${assessment.tier}) | ${assessment.summary}`);

  // 5. Calculate XP rewards
  const xp = calculateXP(assessment.score, assessment.tier, sessionData, agentKey);

  // 6. Submit to orchestrator with real quality
  const results: IBatchExecutionResult[] = [{
    agentKey,
    success: true,
    output,
    quality: assessment.score,
    duration: 0,
  }];
  await orchestrator.markBatchComplete(sessionId, results);

  // 7. Persist XP to session file
  const updatedSession = JSON.parse(
    await fsP.readFile(`.god-agent/coding-sessions/${sessionId}.json`, 'utf-8')
  );
  if (!updatedSession.xp) updatedSession.xp = { total: 0, breakdown: [] };
  updatedSession.xp.total += xp.total;
  updatedSession.xp.breakdown.push({
    agentKey, phase, quality: assessment.score, tier: assessment.tier,
    rewards: xp.rewards, total: xp.total, timestamp: Date.now(),
  });
  await fsP.writeFile(
    `.god-agent/coding-sessions/${sessionId}.json`,
    JSON.stringify(updatedSession, null, 2)
  );

  // 8. Store as DESC episode for future injection (quality > 0.50 only)
  if (assessment.score > 0.50 && output.length > 100) {
    try {
      const { getUCMClient } = await import('./ucm-daemon-client.js');
      const ucmClient = getUCMClient();
      if (await ucmClient.isHealthy()) {
        const sessionPrompt = sessionData.batches?.[sessionData.currentPhaseIndex]
          ?.[sessionData.currentBatchIndex]?.[0]?.prompt || agentKey;
        await ucmClient.storeEpisode(sessionPrompt, output, {
          agentKey, phase,
          quality: assessment.score,
          tier: assessment.tier,
          contentType: 'code',
          storedAt: new Date().toISOString(),
          sessionId,
          pipelineName: 'coding-pipeline',
        });
        console.error(`[DESC] Stored episode for ${agentKey} (quality: ${assessment.score.toFixed(2)})`);
      }
    } catch { /* optional — DESC unavailable is not an error */ }
  }

  // 9. Index produced files into LEANN for subsequent agents (graceful)
  if (IMPLEMENTATION_AGENTS.includes(agentKey)) {
    try {
      const { createLeannContextService } = await import('../core/pipeline/leann-context-service.js');
      const { createLEANNAdapter } = await import('../core/search/adapters/leann-adapter.js');
      const { createDualCodeEmbeddingProvider, createLEANNEmbedder } = await import('../core/search/dual-code-embedding.js');
      const { existsSync, readFileSync } = await import('fs');

      const leannService = createLeannContextService({ defaultMaxResults: 5, minSimilarityThreshold: 0.3 });
      const dualProvider = createDualCodeEmbeddingProvider({
        nlpWeight: 0.4, codeWeight: 0.6, cacheEnabled: true, provider: 'local',
      });
      const dimension = dualProvider.getDimensions();
      const embedder = createLEANNEmbedder(dualProvider);
      const adapter = createLEANNAdapter(embedder, dimension);
      await leannService.initialize(adapter);

      // Load existing index
      await leannService.load('vector_db_leann');

      // Extract file paths from output and index them
      const filePathPattern = /[`'"]\s*([./\w-]+\.(?:ts|tsx|js|jsx|py|sql|json|yaml|yml|css|scss|html))\s*[`'"]/g;
      const filesToIndex = new Set<string>();
      let m: RegExpExecArray | null;
      while ((m = filePathPattern.exec(output)) !== null) {
        filesToIndex.add(m[1]);
      }

      let indexedCount = 0;
      for (const filePath of filesToIndex) {
        try {
          if (!existsSync(filePath)) continue;
          const code = readFileSync(filePath, 'utf-8');
          if (code.trim().length === 0) continue;
          await adapter.index(code, { filePath, source: agentKey, indexed_at: Date.now() });
          indexedCount++;
        } catch { /* skip unreadable files */ }
      }

      if (indexedCount > 0) {
        await leannService.save('vector_db_leann');
        console.error(`[LEANN] Indexed ${indexedCount} files from ${agentKey}, saved to vector_db_leann`);
      }
    } catch (err) {
      console.error(`[LEANN] Indexing failed (non-fatal): ${(err as Error).message}`);
    }
  }

  // 10. Output with quality + XP
  console.log(JSON.stringify({
    success: true, agentKey, sessionId,
    quality: { score: assessment.score, tier: assessment.tier },
    xp: { earned: xp.total, rewards: xp.rewards, sessionTotal: updatedSession.xp.total },
  }, null, 2));
}

// ─────────────────────────────────────────────────────────────────────────────
// XP CALCULATION (PRD Section 7.3)
// ─────────────────────────────────────────────────────────────────────────────

interface XPResult {
  total: number;
  rewards: Record<string, number>;
}

function calculateXP(
  quality: number, _tier: string,
  session: { completedAgents?: Array<{ agentKey?: string }> },
  agentKey: string
): XPResult {
  const rewards: Record<string, number> = {};

  // Task Completion: 100 XP (always, if successful)
  rewards.task_completion = 100;

  // Quality Bonus: 50 XP (exceed quality gate threshold of 0.80)
  if (quality > 0.80) rewards.quality_bonus = 50;

  // First-Time Success: 75 XP (agent not previously completed in this session)
  const completedKeys = (session.completedAgents || []).map(
    (a: { agentKey?: string }) => a.agentKey || a
  );
  if (!completedKeys.includes(agentKey)) {
    rewards.first_time_success = 75;
  }

  // Pattern Contribution: 30 XP (quality > 0.80 triggers SonaEngine pattern creation)
  if (quality > 0.80) rewards.pattern_contribution = 30;

  const total = Object.values(rewards).reduce((sum, v) => sum + v, 0);
  return { total, rewards };
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
 * Show session status with XP summary (fast — reads disk directly, no agent init).
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

    // XP summary
    const xpBreakdown: Array<{ quality: number; total: number; agentKey: string }> = data.xp?.breakdown || [];
    const avgQuality = xpBreakdown.length > 0
      ? xpBreakdown.reduce((sum: number, b: { quality: number }) => sum + b.quality, 0) / xpBreakdown.length
      : 0;
    const topAgent = xpBreakdown.length > 0
      ? xpBreakdown.reduce((best: { total: number; agentKey: string }, b: { total: number; agentKey: string }) =>
          b.total > best.total ? b : best, xpBreakdown[0])
      : null;

    console.log(JSON.stringify({
      sessionId: data.sessionId,
      status: data.status,
      currentPhase: phase,
      currentAgent: currentAgentKey,
      completedAgents: data.completedAgents.length,
      totalAgents: total,
      percentage: Math.round((data.completedAgents.length / total) * 100),
      xp: {
        total: data.xp?.total || 0,
        agentsScored: xpBreakdown.length,
        avgQuality: avgQuality.toFixed(2),
        topAgent: topAgent ? { key: topAgent.agentKey, xp: topAgent.total } : null,
      },
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

  // Parse --file flag from remaining args (for complete command)
  const parseFileFlag = (): string | undefined => {
    const args = process.argv.slice(5);
    const fileIdx = args.indexOf('--file');
    return fileIdx >= 0 && args[fileIdx + 1] ? args[fileIdx + 1] : undefined;
  };

  switch (command) {
    case 'init':
      if (!arg1) fail('Usage: coding-pipeline-cli.ts init "<task>"');
      init(arg1).catch(e => { console.error('Error:', e); process.exit(1); });
      break;

    case 'next':
      if (!arg1) fail('Usage: coding-pipeline-cli.ts next <sessionId>');
      next(arg1).catch(e => { console.error('Error:', e); process.exit(1); });
      break;

    case 'complete': {
      if (!arg1 || !arg2) fail('Usage: coding-pipeline-cli.ts complete <sessionId> <agentKey> [--file <path>]');
      const file = parseFileFlag();
      complete(arg1, arg2, file ? { file } : undefined).catch(e => { console.error('Error:', e); process.exit(1); });
      break;
    }

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
