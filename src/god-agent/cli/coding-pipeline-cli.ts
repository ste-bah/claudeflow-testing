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
 *   - RLM Context Store (namespace-based phase context, PRD Section 6)
 *   - Agent MD file loading (50 specialized instruction files)
 *   - PatternMatcher integration (task-type filtered reusable patterns)
 *   - Trajectory creation + feedback loop (SONA trajectories for Reflexion)
 *   - Algorithm-specific behavior (LATS, ReAct, ToT, Self-Debug, Reflexion, PoT)
 *   - ObservabilityBus integration
 *   - Checkpoint/rollback system
 *   - Per-phase quality gate thresholds
 *   - PipelineProgressStore tracking
 *   - Sherlock forensic automation for phase reviewers
 *   - Anti-heredoc preamble (settings file corruption prevention)
 *
 * Commands:
 *   init "<task>"                              - Initialize session, return first agent
 *   next <sessionId>                           - Get next agent with full augmentation
 *   complete <sessionId> <key> [--file <path>] - Mark agent done with dynamic quality
 *   status <sessionId>                         - Show progress + XP summary
 *   resume <sessionId>                         - Get current agent without advancing
 */

import { v4 as uuidv4 } from 'uuid';
import { UniversalAgent } from '../universal/universal-agent.js';
import type { IBatchExecutionResult } from '../core/pipeline/coding-pipeline-types.js';
import { CodingQualityCalculator, createCodingQualityContext, IMPLEMENTATION_AGENTS } from './coding-quality-calculator.js';
import { TaskType } from '../core/reasoning/pattern-types.js';
import type { CodingPipelineAgent, CodingPipelinePhase } from '../core/pipeline/types.js';

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 12a: Anti-Heredoc Preamble (settings file corruption prevention)
// ─────────────────────────────────────────────────────────────────────────────

const AGENT_FILE_SAFETY_PREAMBLE = `## MANDATORY FILE WRITING RULES

**NEVER use Bash heredoc (cat << 'EOF') to create or write files.**
**ALWAYS use the Write tool for ALL file creation and content writing.**
**ALWAYS use the Edit tool for modifying existing files.**

Bash heredoc commands pollute the settings file with their entire content.
This is a CRITICAL rule — violations corrupt the development environment.

Allowed Bash file operations: ONLY test execution (pytest, vitest, jest), git commands, and npm/pip commands.
`;

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 6: Algorithm-Specific Prompt Templates
// ─────────────────────────────────────────────────────────────────────────────

const ALGORITHM_PROMPTS: Record<string, string> = {
  LATS: `## ALGORITHM: LATS (Language Agent Tree Search)
**Strategy**: Generate 3 candidate solutions. For each, evaluate correctness.
Use Monte Carlo evaluation: mentally simulate test execution for each candidate.
Select the candidate with highest expected pass rate.
UCT formula: exploitation (quality/visits) + exploration (C * sqrt(ln(parent_visits)/visits)), C=1.414
If all candidates score < 0.5, generate 3 more candidates from the best one and repeat.
Max iterations: 3 rounds of generate-evaluate-select.`,

  ReAct: `## ALGORITHM: ReAct (Reason + Act)
**Strategy**: Use Thought-Action-Observation loop:
1. THOUGHT: Reason about current state and what you need
2. ACTION: Use a tool (read_file, search_codebase, run_tests, etc.)
3. OBSERVATION: Analyze tool output
4. Repeat until task complete or max 10 iterations
Available actions: Read, Grep, Glob, Bash (for tests), Write, Edit
ALWAYS think before acting. ALWAYS observe results before next action.`,

  ToT: `## ALGORITHM: ToT (Tree of Thought)
**Strategy**: Explore multiple design branches:
1. Generate 3 distinct approaches to the problem
2. For each approach, evaluate: feasibility (0-1), maintainability (0-1), performance (0-1)
3. Prune approaches scoring < 0.3 on any dimension
4. For the top 2, deepen the design by one level
5. Select the design with highest combined score
Present your reasoning tree explicitly.`,

  'Self-Debug': `## ALGORITHM: Self-Debug
**Strategy**: Write code, then debug iteratively:
1. Write initial implementation
2. Write or run tests against it
3. If tests fail: analyze error, identify root cause, fix, re-test
4. Repeat until all tests pass or max 5 iterations
Track: iteration number, tests passing, tests failing, fix applied`,

  Reflexion: `## ALGORITHM: Reflexion (Episodic Memory Feedback)
**Strategy**: Learn from past failures:
1. Review the REFLEXION section above for past failure patterns
2. Explicitly state which past mistakes you will avoid
3. After completing, self-evaluate on a 0-1 scale
4. If self-evaluation < 0.7, identify what went wrong and revise
Your past success rate is shown above. Aim to improve it.`,

  PoT: `## ALGORITHM: PoT (Program of Thought)
**Strategy**: Solve through programmatic reasoning:
1. Decompose the problem into computational steps
2. Write executable pseudocode/code for each step
3. Execute mentally or via tools to verify each step
4. Combine step outputs into final solution
Focus on mathematical correctness and algorithmic efficiency.`,
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 9: Per-Phase Quality Gate Thresholds (PRD Section 9.1)
// ─────────────────────────────────────────────────────────────────────────────

const PHASE_QUALITY_THRESHOLDS: Record<number, { metric: string; threshold: number }> = {
  1: { metric: 'decomposition', threshold: 0.90 },
  2: { metric: 'candidates', threshold: 0.60 },
  3: { metric: 'consistency', threshold: 0.95 },
  4: { metric: 'type_coverage', threshold: 0.80 },
  5: { metric: 'test_coverage', threshold: 0.80 },
  6: { metric: 'security', threshold: 0.85 },
  7: { metric: 'documentation', threshold: 0.90 },
};

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
  // Expose AgentRegistry (public) and PatternMatcher (via GodAgent chain)
  const agentRegistry = godAgent.getAgentRegistry();
  const patternMatcher = (godAgent as unknown as { agent?: { getPatternMatcher?: () => unknown } })
    .agent?.getPatternMatcher?.() as import('../core/reasoning/pattern-matcher.js').PatternMatcher | undefined;
  return { godAgent, orchestrator, agentRegistry, patternMatcher };
}

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
  return AGENT_MODEL_MAP[agentKey] || 'sonnet';
}

/** Map agent category to task type for PatternMatcher filtering */
function getTaskTypeForPhase(phase: number): TaskType {
  const map: Record<number, TaskType> = {
    1: TaskType.ANALYSIS, 2: TaskType.ANALYSIS, 3: TaskType.PLANNING,
    4: TaskType.CODING, 5: TaskType.TESTING, 6: TaskType.OPTIMIZATION, 7: TaskType.CODING,
  };
  return map[phase] || TaskType.ANALYSIS;
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

  // Phase 4b: Initialize RLM Context Store for session
  try {
    const { RLMContextStore } = await import('../core/pipeline/rlm-context-store.js');
    const rlm = new RLMContextStore();
    rlm.write('coding/context/task', task);
    rlm.write('coding/context/sessionId', sessionId);
    rlm.write('coding/context/timestamp', new Date().toISOString());
    await rlm.save(`.god-agent/rlm-context/${sessionId}.json`);
    console.error(`[RLM] Context store initialized for session ${sessionId}`);
  } catch (err) {
    console.error(`[RLM] Init failed (non-fatal): ${(err as Error).message}`);
  }

  // Output single agent (unwrapped from batch)
  console.log(JSON.stringify(formatAgentResponse(batchResponse), null, 2));
}

/**
 * Get the next agent to execute with full learning augmentation.
 * Injects learning sources + RLM context + agent MD + algorithm instructions.
 * Returns a single agent object or status: "complete".
 */
export async function next(sessionId: string): Promise<void> {
  console.error('[next] Loading session...');
  const { orchestrator, agentRegistry, patternMatcher } = await createSequentialOrchestrator();
  const { existsSync, readFileSync } = await import('fs');
  const fsP = (await import('fs')).promises;

  const batchResponse = await orchestrator.getNextBatch(sessionId);

  if (batchResponse.status !== 'complete' && batchResponse.batch[0]) {
    let prompt = batchResponse.batch[0].prompt;
    const agentKey = batchResponse.batch[0].key;

    // Read session data for phase/algorithm info
    let sessionData: Record<string, unknown> = {};
    try {
      sessionData = JSON.parse(
        await fsP.readFile(`.god-agent/coding-sessions/${sessionId}.json`, 'utf-8'),
      );
    } catch { /* proceed without session data */ }

    const phaseIndex = (sessionData.currentPhaseIndex as number) ?? 0;
    const batchIndex = (sessionData.currentBatchIndex as number) ?? 0;
    const phase = phaseIndex + 1;
    const completedAgents = batchResponse.completedAgents;

    // ── Phase 12a: Anti-heredoc preamble (ALWAYS first) ──────────────────
    prompt = AGENT_FILE_SAFETY_PREAMBLE + '\n' + prompt;

    // ── Phase 1: Agent MD file loading ───────────────────────────────────
    try {
      const mdPath = `.claude/agents/coding-pipeline/${agentKey}.md`;
      if (existsSync(mdPath)) {
        const mdContent = readFileSync(mdPath, 'utf-8');
        prompt = `# Agent Instructions\n\n${mdContent}\n\n---\n\n# Task\n\n${prompt}`;
        console.error(`[MD] Loaded agent instructions for ${agentKey} (${mdContent.length} chars)`);
      }
    } catch { /* optional — missing MD is not an error */ }

    // ── Phase 4c: RLM context injection ──────────────────────────────────
    try {
      const { RLMContextStore } = await import('../core/pipeline/rlm-context-store.js');
      const rlm = new RLMContextStore();
      const rlmPath = `.god-agent/rlm-context/${sessionId}.json`;
      if (await rlm.load(rlmPath)) {
        // Collect namespaces from all prior phases
        const namespaces = ['coding/context/task'];
        for (let i = 1; i < phase; i++) {
          namespaces.push(`coding/phase${i}/`);
        }
        const matchingNs = rlm.getNamespaces().filter(ns =>
          namespaces.some(pattern => pattern.endsWith('/')
            ? ns.startsWith(pattern)
            : ns === pattern),
        );
        if (matchingNs.length > 0) {
          const phaseContext = await rlm.retrieve(
            prompt.substring(0, 500), matchingNs, 50000,
          );
          if (phaseContext.length > 0) {
            prompt = `## PIPELINE CONTEXT (from prior phases)\n\n${phaseContext}\n\n---\n\n${prompt}`;
            console.error(`[RLM] Injected ${matchingNs.length} namespace(s) (${rlm.getTotalTokenCount()} tokens total)`);
          }
        }
      }
    } catch (err) {
      console.error(`[RLM] Context injection failed (non-fatal): ${(err as Error).message}`);
    }

    // ── DESC injection with pre-vetting ──────────────────────────────────
    try {
      const { getUCMClient } = await import('./ucm-daemon-client.js');
      const ucmClient = getUCMClient();
      if (await ucmClient.isHealthy()) {
        const candidates = await ucmClient.retrieveSimilar(prompt, {
          threshold: 0.80,
          maxResults: 5,
        });

        if (candidates.length > 0) {
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

    // ── SONA pattern injection ───────────────────────────────────────────
    try {
      const { SonaEngine } = await import('../core/learning/sona-engine.js');
      const engine = new SonaEngine();
      await engine.initialize();
      const allPatterns = engine.getPatterns();
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
    } catch { /* optional — SONA unavailable is not an error */ }

    // ── Phase 2: PatternMatcher integration (task-type filtered) ───────
    try {
      if (patternMatcher) {
        const taskType = getTaskTypeForPhase(phase);
        const taskPatterns = patternMatcher.getPatternsByTaskType(taskType)
          .filter(p => (p.successRate ?? 0) >= 0.5)
          .sort((a, b) => (b.successRate ?? 0) - (a.successRate ?? 0))
          .slice(0, 5);
        if (taskPatterns.length > 0) {
          prompt += '\n\n## REUSABLE PATTERNS (from PatternStore)\n';
          for (const p of taskPatterns) {
            const successLabel = `${Math.round((p.successRate ?? 0) * 100)}% success`;
            prompt += `- **${p.id}** (${successLabel}): ${p.template}\n`;
          }
          console.error(`[PATTERNS] Injected ${taskPatterns.length} reusable patterns for ${agentKey} (type: ${taskType})`);
        }
      }
    } catch { /* optional — PatternMatcher unavailable is not an error */ }

    // ── LEANN semantic code context injection ────────────────────────────
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

      const loaded = await leannService.load('vector_db_leann');
      if (loaded) {
        const vectorCount = leannService.getVectorCount();
        console.error(`[LEANN] Loaded ${vectorCount} vectors from persisted index`);

        const searchQuery = prompt.substring(0, 500);
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

    // ── Reflexion: past failure trajectory injection ─────────────────────
    try {
      const { SonaEngine } = await import('../core/learning/sona-engine.js');
      const engine = new SonaEngine();
      await engine.initialize();

      const allTrajectories = engine.listTrajectories('reasoning.pattern');
      const agentTag = `agent:${agentKey}`;
      const agentTrajectories = allTrajectories.filter(t =>
        t.context?.includes(agentTag) ?? false,
      );
      const failures = agentTrajectories.filter(t =>
        (t.quality !== undefined && t.quality < 0.7) || t.context?.includes('failed'),
      );

      if (failures.length > 0) {
        const totalExec = agentTrajectories.length;
        const successCount = agentTrajectories.filter(t =>
          t.quality !== undefined && t.quality >= 0.7,
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

    // ── Phase 6: Algorithm-specific behavior ─────────────────────────────
    try {
      const batches = sessionData.batches as unknown[][][] | undefined;
      const currentBatchAgents = batches?.[phaseIndex]?.[batchIndex] as Array<{ algorithm?: string }> | undefined;
      const algorithm = currentBatchAgents?.[0]?.algorithm || 'Standard';
      const algorithmPrompt = ALGORITHM_PROMPTS[algorithm];
      if (algorithmPrompt) {
        prompt += '\n\n' + algorithmPrompt + '\n';
        console.error(`[ALGORITHM] Injected ${algorithm} strategy for ${agentKey}`);
      }
    } catch { /* algorithm lookup failed — proceed without */ }

    // ── Phase 11: Sherlock forensic automation for phase reviewers ───────
    if (/^phase-\d+-reviewer$/.test(agentKey)) {
      try {
        const phaseNum = parseInt(agentKey.match(/phase-(\d+)-reviewer/)?.[1] || '0');
        const { Verdict, VerdictConfidence, InvestigationTier, PHASE_NAMES } =
          await import('../core/pipeline/sherlock-phase-reviewer-types.js');
        const { RLMContextStore } = await import('../core/pipeline/rlm-context-store.js');
        const rlm = new RLMContextStore();
        const rlmPath = `.god-agent/rlm-context/${sessionId}.json`;
        if (await rlm.load(rlmPath)) {
          const phaseOutputNs = rlm.getNamespaces().filter(ns =>
            ns.startsWith(`coding/phase${phaseNum}/`),
          );
          const phaseName = PHASE_NAMES[phaseNum] || `Phase ${phaseNum}`;
          if (phaseOutputNs.length > 0) {
            prompt += '\n\n## SHERLOCK FORENSIC INVESTIGATION PROTOCOL\n';
            prompt += `**Phase Under Review**: ${phaseName} (Phase ${phaseNum})\n`;
            prompt += `**Verdict Options**: ${Verdict.INNOCENT} (proceed) | ${Verdict.GUILTY} (remediation needed) | ${Verdict.INSUFFICIENT_EVIDENCE} (extended investigation)\n`;
            prompt += `**Confidence Levels**: ${VerdictConfidence.HIGH} (>=90%) | ${VerdictConfidence.MEDIUM} (70-89%) | ${VerdictConfidence.LOW} (<70%)\n`;
            prompt += `**Phase ${phaseNum} Evidence** (${phaseOutputNs.length} agent outputs):\n`;
            for (const ns of phaseOutputNs) {
              const content = rlm.read(ns) || '';
              prompt += `- ${ns}: ${content.substring(0, 200)}...\n`;
            }
            prompt += `\n**Investigation Tiers**: ${InvestigationTier.GLANCE} (5s) | ${InvestigationTier.SCAN} (30s) | ${InvestigationTier.INVESTIGATION} (5min) | ${InvestigationTier.DEEP_DIVE} (30min+)\n`;
            prompt += '**Your investigation must produce**:\n';
            prompt += '1. Evidence chain analysis\n';
            prompt += '2. Verification matrix (check each requirement against evidence)\n';
            prompt += '3. Adversarial analysis (what could go wrong?)\n';
            prompt += `4. VERDICT (${Verdict.INNOCENT}/${Verdict.GUILTY}/${Verdict.INSUFFICIENT_EVIDENCE}) with confidence (${VerdictConfidence.HIGH}/${VerdictConfidence.MEDIUM}/${VerdictConfidence.LOW})\n`;
            prompt += '\nYou are GUILTY-UNTIL-PROVEN-INNOCENT. Be thorough.\n';
            console.error(`[SHERLOCK] Injected forensic protocol for ${phaseName} review (${phaseOutputNs.length} evidence sources)`);
          }
        }
      } catch { /* Sherlock injection failed — proceed without */ }
    }

    // ── Phase 5: Structured prompt via PipelinePromptBuilder ────────────
    try {
      const { PipelinePromptBuilder } = await import('../core/pipeline/pipeline-prompt-builder.js');
      const promptBuilder = new PipelinePromptBuilder(agentRegistry);

      // Build IPromptContext for the builder
      const totalAgents = batchResponse.totalAgents;
      const step = {
        agentKey,
        task: prompt,
        inputDomain: 'coding/input',
        outputDomain: `coding/phase${phase}/${agentKey}`,
        inputTags: [] as string[],
        outputTags: [`phase:${phase}`, `agent:${agentKey}`],
      };
      const pipelineDef = {
        name: 'coding-pipeline',
        description: '48-agent sequential coding pipeline',
        agents: Array.from({ length: totalAgents }, (_, i) => ({
          task: `Agent ${i + 1}`,
          outputDomain: `coding/phase`,
          outputTags: [] as string[],
        })),
        sequential: true,
      };

      const built = promptBuilder.buildPrompt({
        step,
        stepIndex: completedAgents,
        pipeline: pipelineDef,
        pipelineId: sessionId,
        previousOutput: undefined,
      });

      // Use the builder's structured workflow context sections, keep CLI augmentations
      // The builder output replaces the task section — we prepend our CLI-specific augmentations
      prompt = built.prompt;
      console.error(`[PROMPT-BUILDER] Built structured prompt for ${agentKey} (step ${built.stepNumber}/${built.totalSteps})`);
    } catch (err) {
      // Fallback: add basic workflow context if builder unavailable
      const totalAgents = batchResponse.totalAgents;
      prompt += `\n\n## WORKFLOW CONTEXT\n`;
      prompt += `Agent #${completedAgents + 1} of ${totalAgents} | Phase ${phase}/7 | Session: ${sessionId}\n`;
      prompt += `Progress: ${Math.round((completedAgents / totalAgents) * 100)}% complete\n`;
      console.error(`[PROMPT-BUILDER] Fallback to basic context (${(err as Error).message})`);
    }

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
  options?: { file?: string },
): Promise<void> {
  console.error(`[complete] Marking ${agentKey} done...`);
  const { orchestrator, patternMatcher } = await createSequentialOrchestrator();
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
    await fsP.readFile(`.god-agent/coding-sessions/${sessionId}.json`, 'utf-8'),
  );
  const phase = (sessionData.currentPhaseIndex ?? 0) + 1;

  // 4. Dynamic quality scoring
  const calculator = new CodingQualityCalculator();
  const context = createCodingQualityContext(agentKey, phase);
  const assessment = calculator.assessQuality(scoringOutput, context);
  console.error(`[complete] Quality: ${assessment.score.toFixed(2)} (${assessment.tier}) | ${assessment.summary}`);

  // ── Phase 0: Create SONA trajectory ────────────────────────────────────
  let trajectoryId = '';
  try {
    const { SonaEngine } = await import('../core/learning/sona-engine.js');
    const engine = new SonaEngine();
    await engine.initialize();

    trajectoryId = `trajectory_coding_${sessionId}_${agentKey}`;
    const tags = [
      `agent:${agentKey}`, `phase:${phase}`, `pipeline:${sessionId}`,
      ...(assessment.score < 0.7 ? ['failed'] : []),
    ];
    engine.createTrajectoryWithId(trajectoryId, 'reasoning.pattern', [], tags);
    console.error(`[TRAJECTORY] Created trajectory for ${agentKey} (quality: ${assessment.score.toFixed(2)})`);

    // ── Phase 3: Provide quality feedback via provideStepFeedback ─────
    try {
      const { provideStepFeedback } = await import('../core/pipeline/coding-phase-executor.js');
      const phaseName = ['', 'understanding', 'exploration', 'architecture',
        'implementation', 'testing', 'optimization', 'delivery'][phase] || 'understanding';
      await provideStepFeedback(
        { sonaEngine: engine, reasoningBank: undefined },
        trajectoryId,
        assessment.score,
        agentKey as CodingPipelineAgent,
        phaseName as CodingPipelinePhase,
        undefined, // rlmContext — CLI doesn't hold a live IRlmContext reference
        (msg: string) => console.error(`[FEEDBACK] ${msg}`),
      );
      console.error(`[FEEDBACK] Quality feedback submitted (${assessment.score.toFixed(2)}) for ${agentKey}`);
    } catch (fbErr) {
      console.error(`[FEEDBACK] Failed (non-fatal): ${(fbErr as Error).message}`);
    }

    // ── Phase 3b: Store high-quality output as reusable pattern ──────
    if (assessment.score > 0.80 && patternMatcher) {
      try {
        const { createDualCodeEmbeddingProvider } = await import('../core/search/dual-code-embedding.js');
        const dualProvider = createDualCodeEmbeddingProvider({
          nlpWeight: 0.4, codeWeight: 0.6, cacheEnabled: true, provider: 'local',
        });
        const embedding = await dualProvider.embed(output.substring(0, 2000));
        const taskType = getTaskTypeForPhase(phase);
        await patternMatcher.createPattern({
          taskType,
          template: output.substring(0, 500),
          embedding,
          successRate: assessment.score,
        });
        console.error(`[PATTERNS] Created reusable pattern from ${agentKey} (${taskType}, quality: ${assessment.score.toFixed(2)})`);
      } catch (patErr) {
        console.error(`[PATTERNS] Pattern creation failed (non-fatal): ${(patErr as Error).message}`);
      }
    }
  } catch (trajErr) {
    console.error(`[TRAJECTORY] Creation failed (non-fatal): ${(trajErr as Error).message}`);
  }

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
    await fsP.readFile(`.god-agent/coding-sessions/${sessionId}.json`, 'utf-8'),
  );
  if (!updatedSession.xp) updatedSession.xp = { total: 0, breakdown: [] };
  updatedSession.xp.total += xp.total;
  updatedSession.xp.breakdown.push({
    agentKey, phase, quality: assessment.score, tier: assessment.tier,
    rewards: xp.rewards, total: xp.total, timestamp: Date.now(),
  });
  await fsP.writeFile(
    `.god-agent/coding-sessions/${sessionId}.json`,
    JSON.stringify(updatedSession, null, 2),
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

      await leannService.load('vector_db_leann');

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

  // ── Phase 4d: Store output in RLM context ──────────────────────────────
  try {
    const { RLMContextStore } = await import('../core/pipeline/rlm-context-store.js');
    const rlm = new RLMContextStore();
    const rlmPath = `.god-agent/rlm-context/${sessionId}.json`;
    await rlm.load(rlmPath);
    const namespace = `coding/phase${phase}/${agentKey}`;
    rlm.write(namespace, output.substring(0, 10000));
    await rlm.save(rlmPath);
    console.error(`[RLM] Stored output for ${agentKey} at ${namespace} (${rlm.getTotalTokenCount()} total tokens)`);
  } catch (err) {
    console.error(`[RLM] Storage failed (non-fatal): ${(err as Error).message}`);
  }

  // ── Phase 7: ObservabilityBus integration ──────────────────────────────
  try {
    // Read algorithm from session for metadata
    let algorithm = 'Standard';
    try {
      const batches = sessionData.batches as unknown[][][] | undefined;
      const phaseIdx = (sessionData.currentPhaseIndex as number) ?? 0;
      const batchIdx = (sessionData.currentBatchIndex as number) ?? 0;
      const currentBatchAgents = batches?.[phaseIdx]?.[batchIdx] as Array<{ algorithm?: string }> | undefined;
      algorithm = currentBatchAgents?.[0]?.algorithm || 'Standard';
    } catch { /* default to Standard */ }

    const { ObservabilityBus } = await import('../core/observability/bus.js');
    ObservabilityBus.getInstance().emit({
      component: 'pipeline',
      operation: 'agent_completed',
      status: 'success',
      durationMs: 0,
      metadata: {
        pipelineId: sessionId,
        agentKey,
        quality: assessment.score,
        tier: assessment.tier,
        phase,
        algorithm,
      },
    });
    console.error(`[OBS] Emitted agent_completed event for ${agentKey}`);
  } catch { /* observability bus unavailable — non-fatal */ }

  // ── Phase 8: Checkpoint creation ───────────────────────────────────────
  try {
    const { PipelineCheckpointManager } = await import('./coding-pipeline-checkpoints.js');
    const checkpointMgr = new PipelineCheckpointManager();
    await checkpointMgr.loadCheckpoints(sessionId);
    const cpId = await checkpointMgr.createCheckpoint(sessionId, phase, agentKey, assessment.score);
    console.error(`[CHECKPOINT] Created ${cpId} for ${agentKey} (phase ${phase})`);
  } catch (err) {
    console.error(`[CHECKPOINT] Creation failed (non-fatal): ${(err as Error).message}`);
  }

  // ── Phase 9: Per-phase quality gate check ──────────────────────────────
  const phaseGate = PHASE_QUALITY_THRESHOLDS[phase];
  if (phaseGate && assessment.score < phaseGate.threshold) {
    console.error(
      `[QUALITY-GATE] WARNING: ${agentKey} scored ${assessment.score.toFixed(2)} below ` +
      `phase ${phase} threshold (${phaseGate.threshold} for ${phaseGate.metric})`,
    );
  }

  // ── Phase 10: PipelineProgressStore tracking ───────────────────────────
  try {
    const { PipelineProgressStore } = await import('../core/pipeline/pipeline-progress-store.js');
    const progressStore = new PipelineProgressStore();
    const phaseName = ['', 'understanding', 'exploration', 'architecture',
      'implementation', 'testing', 'optimization', 'delivery'][phase] || 'unknown';
    progressStore.registerAgent(agentKey, phaseName);
    const outputSummary = PipelineProgressStore.extractOutputSummary(output);
    progressStore.markCompleted(agentKey, outputSummary);
    await fsP.mkdir('.god-agent/progress', { recursive: true });
    await fsP.writeFile(
      `.god-agent/progress/${sessionId}.json`,
      JSON.stringify({
        completed: agentKey, phase, timestamp: Date.now(),
        summary: outputSummary,
      }, null, 2),
    );
    console.error(
      `[PROGRESS] ${agentKey} completed — files: ${outputSummary.filesCreated.length} created, ${outputSummary.filesModified.length} modified`,
    );
  } catch (err) {
    console.error(`[PROGRESS] Tracking failed (non-fatal): ${(err as Error).message}`);
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
  agentKey: string,
): XPResult {
  const rewards: Record<string, number> = {};

  // Task Completion: 100 XP (always, if successful)
  rewards.task_completion = 100;

  // Quality Bonus: 50 XP (exceed quality gate threshold of 0.80)
  if (quality > 0.80) rewards.quality_bonus = 50;

  // First-Time Success: 75 XP (agent not previously completed in this session)
  const completedKeys = (session.completedAgents || []).map(
    (a: { agentKey?: string }) => a.agentKey || a,
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
