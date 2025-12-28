#!/usr/bin/env node
/**
 * PhD Pipeline CLI - Guided orchestration tool
 * Implements REQ-PIPE-001 through REQ-PIPE-007
 */

import { Command } from 'commander';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { StyleProfileManager } from '../universal/style-profile.js';
import type { StoredStyleProfile } from '../universal/style-profile.js';
import { SessionManager } from './session-manager.js';
import type {
  InitOptions,
  InitResponse,
  NextOptions,
  NextResponse,
  CompleteOptions,
  CompleteResponse,
  StatusOptions,
  StatusResponse,
  ListOptions,
  ListResponse,
  SessionListItem,
  ResumeOptions,
  ResumeResponse,
  AbortOptions,
  AbortResponse,
  ProgressInfo,
  CompletionSummary,
  AgentDetails,
  ErrorResponse,
} from './cli-types.js';
import { AgentMismatchError } from './cli-types.js';
import { getPhaseName } from './cli-types.js';
import {
  PHASE_1_5_AGENT_COUNT,
  PHASE_6_START_INDEX,
  PHASE_7_AGENT_COUNT,
  STATIC_PHASE_7_START_INDEX
} from './cli-types.js';
import { PipelineConfigLoader } from './pipeline-loader.js';
import type { AgentConfig } from './pipeline-loader.js';
import { StyleInjector } from './style-injector.js';
import { SessionNotFoundError, SessionCorruptedError, SessionExpiredError } from './session-manager.js';
import { DynamicAgentGenerator } from './dynamic-agent-generator.js';
import { ChapterStructureLoader } from './chapter-structure-loader.js';
import { getUCMClient } from './ucm-daemon-client.js';
import { PhdPipelineAdapter } from '../core/ucm/adapters/phd-pipeline-adapter.js';
import { SocketClient } from '../observability/socket-client.js';
import { FinalStageOrchestrator, PROGRESS_MILESTONES } from './final-stage/index.js';
import type { FinalStageOptions, FinalStageResult, ProgressReport, FinalStageState } from './final-stage/index.js';
import type { IActivityEvent } from '../observability/types.js';

// Lazy-initialized socket client for event emission
let socketClient: SocketClient | null = null;

async function getSocketClient(): Promise<SocketClient | null> {
  if (!socketClient) {
    try {
      socketClient = new SocketClient({ verbose: false });
      await socketClient.connect();
    } catch {
      // Non-blocking - observability is optional
      return null;
    }
  }
  return socketClient;
}

function emitPipelineEvent(event: Omit<IActivityEvent, 'id' | 'timestamp'>): void {
  getSocketClient().then(client => {
    if (!client) return;
    try {
      const fullEvent: IActivityEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        ...event,
      };
      client.send(fullEvent);
    } catch { /* ignore */ }
  });
}

const program = new Command();

program
  .name('phd-cli')
  .description('PhD Pipeline CLI-guided orchestration tool')
  .version('1.0.0');

/**
 * init command - Initialize new pipeline session
 * [REQ-PIPE-001]
 */
program
  .command('init <query>')
  .description('Initialize new pipeline session')
  .option('--style-profile <id>', 'Style profile ID to use')
  .option('--config <path>', 'Custom pipeline config path')
  .option('--verbose', 'Enable verbose logging')
  .option('--json', 'Output as JSON (default: true)', true)
  .action(async (query: string, options: InitOptions) => {
    try {
      const response = await commandInit(query, options);
      console.log(JSON.stringify(response, null, 2));
      process.exit(0);
    } catch (error) {
      handleError(error);
    }
  });

/**
 * Execute init command
 * [REQ-PIPE-001, REQ-PIPE-011, REQ-PIPE-020, REQ-PIPE-021, REQ-PIPE-023]
 */
async function commandInit(
  query: string,
  options: InitOptions,
  sessionBasePath?: string
): Promise<InitResponse> {
  // [REQ-PIPE-001] Validate query
  if (!query || query.trim() === '') {
    throw new Error('Query cannot be empty');
  }

  // [REQ-PIPE-023] Generate UUID v4 session ID
  const sessionId = uuidv4();

  // Generate pipeline ID from query hash
  const pipelineId = generatePipelineId(query);

  // [REQ-PIPE-011] Determine style profile
  const styleProfileId = await determineStyleProfile(options.styleProfile);
  const styleProfile = await loadStyleProfile(styleProfileId);

  // [REQ-PIPE-020] Create and persist session using SessionManager
  const sessionManager = sessionBasePath ? new SessionManager(sessionBasePath) : new SessionManager();

  // Create session object [REQ-PIPE-021]
  const slug = generateSlug(query);
  const session = sessionManager.createSession(
    sessionId,
    query,
    styleProfile.metadata.id,
    pipelineId
  );
  session.slug = slug;
  session.researchDir = path.join(process.cwd(), 'docs/research', slug);

  // Persist to disk with atomic write pattern
  await sessionManager.saveSession(session);

  if (options.verbose) {
    console.error(`[DEBUG] Session created: ${sessionId}`);
    console.error(`[DEBUG] Style profile: ${styleProfile.metadata.name}`);
    console.error(`[DEBUG] Session saved to: ${sessionManager.getSessionDirectory()}`);
  }

  // Load first agent from pipeline config (always use project root, not session path)
  // sessionBasePath is only for session storage, not for agent definitions
  const pipelineLoader = new PipelineConfigLoader(process.cwd());
  const styleInjector = new StyleInjector(process.cwd());

  const firstAgentConfig = await pipelineLoader.getAgentByIndex(0);
  const pipelineConfig = await pipelineLoader.loadPipelineConfig();
  const totalAgentCount = pipelineConfig.agents.length;

  // Build prompt with style injection (Phase 6 only), query injection, and output context
  const prompt = await styleInjector.buildAgentPrompt(
    firstAgentConfig,
    styleProfile.metadata.id,
    query,
    { researchDir: session.researchDir!, agentIndex: 0, agentKey: firstAgentConfig.key }
  );

  // Build first agent details using pipeline loader (not hardcoded)
  const firstAgent: AgentDetails = {
    index: 0,
    key: firstAgentConfig.key,
    name: firstAgentConfig.name,
    phase: firstAgentConfig.phase,
    phaseName: getPhaseName(firstAgentConfig.phase),
    prompt,
    dependencies: firstAgentConfig.dependencies,
    timeout: firstAgentConfig.timeout,
    critical: firstAgentConfig.critical,
    expectedOutputs: firstAgentConfig.expectedOutputs
  };

  return {
    sessionId,
    pipelineId,
    query,
    styleProfile: {
      id: styleProfile.metadata.id,
      name: styleProfile.metadata.name,
      languageVariant: styleProfile.characteristics.regional?.languageVariant || 'en-GB'
    },
    totalAgents: totalAgentCount,
    agent: firstAgent
  };
}

/**
 * Determine which style profile to use
 * [REQ-PIPE-011]
 */
async function determineStyleProfile(profileId?: string): Promise<string> {
  // If profile ID provided, use it
  if (profileId) {
    return profileId;
  }

  // Otherwise, get active profile
  try {
    const spm = new StyleProfileManager();
    const activeProfile = spm.getActiveProfile();

    if (activeProfile) {
      return activeProfile.metadata.id;
    }
  } catch {
    // StyleProfileManager may not have profiles yet
  }

  // Fall back to a default identifier
  return 'default-academic';
}

/**
 * Load style profile by ID
 */
async function loadStyleProfile(profileId: string): Promise<StoredStyleProfile> {
  try {
    const spm = new StyleProfileManager();

    // Try to get specified profile
    const profile = spm.getProfile(profileId);
    if (profile) {
      return profile;
    }

    // Try active profile
    const activeProfile = spm.getActiveProfile();
    if (activeProfile) {
      return activeProfile;
    }
  } catch {
    // StyleProfileManager may fail if no profiles exist
  }

  // Return minimal default profile
  return {
    metadata: {
      id: 'default-academic',
      name: 'Default Academic',
      description: 'Default UK English academic style',
      sourceType: 'text',
      sourceCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: ['academic', 'uk-english']
    },
    characteristics: {
      sentences: {
        averageLength: 25,
        lengthVariance: 8,
        shortSentenceRatio: 0.15,
        mediumSentenceRatio: 0.65,
        longSentenceRatio: 0.2,
        complexSentenceRatio: 0.3
      },
      vocabulary: {
        uniqueWordRatio: 0.7,
        averageWordLength: 5.5,
        academicWordRatio: 0.15,
        technicalTermDensity: 0.1,
        latinateWordRatio: 0.2,
        contractionUsage: 0.02
      },
      structure: {
        paragraphLengthAvg: 150,
        transitionWordDensity: 0.12,
        passiveVoiceRatio: 0.25,
        firstPersonUsage: 0.05,
        thirdPersonUsage: 0.4,
        questionFrequency: 0.02,
        listUsage: 0.05
      },
      tone: {
        formalityScore: 0.85,
        objectivityScore: 0.9,
        hedgingFrequency: 0.1,
        assertivenessScore: 0.6,
        emotionalTone: 0.1
      },
      samplePhrases: [],
      commonTransitions: ['however', 'therefore', 'moreover', 'furthermore'],
      openingPatterns: [],
      citationStyle: 'APA',
      regional: {
        languageVariant: 'en-GB',
        spellingRules: [],
        grammarRules: [],
        dateFormat: 'DD/MM/YYYY',
        primaryQuoteMark: "'"
      }
    },
    sampleTexts: []
  };
}

/**
 * Generate pipeline ID from query
 */
function generatePipelineId(query: string): string {
  // Simple hash-based ID generation
  let hash = 0;
  for (let i = 0; i < query.length; i++) {
    const char = query.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `pipeline-${Math.abs(hash).toString(16)}`;
}

/**
 * Generate research folder slug from query
 */
function generateSlug(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

/**
 * Get expected output path for an agent
 * [REQ-PIPE-025] Consistent file naming: {index:02d}-{agent-key}.md
 */
function getExpectedOutputPath(researchDir: string, agentIndex: number, agentKey: string): string {
  const paddedIndex = String(agentIndex).padStart(2, '0');
  return path.join(researchDir, `${paddedIndex}-${agentKey}.md`);
}

/**
 * Try to find and read agent output file with fallback paths
 * [REQ-PIPE-026] Auto-capture output from expected locations
 */
async function tryReadAgentOutput(
  researchDir: string,
  agentIndex: number,
  agentKey: string
): Promise<{ content: string; outputPath: string } | null> {
  const fs = await import('fs/promises');

  // Transform agent key to common file name patterns
  const baseKey = agentKey.replace(/-/g, '-');
  const keyWithoutSuffix = agentKey
    .replace(/-analyst$/, '')
    .replace(/-analyzer$/, '')
    .replace(/-hunter$/, '')
    .replace(/-manager$/, '')
    .replace(/-definer$/, '');

  // Priority order of paths to check
  const pathsToTry = [
    // Standard numbered path: 00-agent-key.md
    getExpectedOutputPath(researchDir, agentIndex, agentKey),
    // Unnumbered: agent-key.md
    path.join(researchDir, `${agentKey}.md`),
    // Common variations: *-analysis.md, *-tiers.md, etc.
    path.join(researchDir, `${keyWithoutSuffix}-analysis.md`),
    path.join(researchDir, `${keyWithoutSuffix}-tiers.md`),
    path.join(researchDir, `${keyWithoutSuffix}s.md`),
    path.join(researchDir, `${keyWithoutSuffix}.md`),
    // Legacy patterns from fourth-turning
    path.join(researchDir, `${baseKey}-analysis.md`),
    path.join(researchDir, 'risk-analysis-fmea.md'), // specific risk-analyst fallback
    // In synthesis subfolder (legacy)
    path.join(researchDir, 'synthesis', `${String(agentIndex).padStart(2, '0')}-${agentKey}.md`),
    path.join(researchDir, 'synthesis', `${agentKey}.md`),
    path.join(researchDir, 'synthesis', `${keyWithoutSuffix}.md`),
  ];

  for (const filePath of pathsToTry) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return { content, outputPath: filePath };
    } catch {
      // File doesn't exist at this path, try next
    }
  }

  return null;
}


// ============================================================================
// TASK-PIPE-004: Next Command
// ============================================================================

/**
 * next command - Get next agent details for session
 * [REQ-PIPE-002]
 */
program
  .command('next <session-id>')
  .description('Get next agent details for session')
  .option('--json', 'Output as JSON (default: true)', true)
  .option('--verbose', 'Enable verbose logging')
  .action(async (sessionId: string, options: NextOptions) => {
    try {
      const response = await commandNext(sessionId, options);
      console.log(JSON.stringify(response, null, 2));
      process.exit(0);
    } catch (error) {
      handleError(error);
    }
  });

/**
 * Execute next command
 * [REQ-PIPE-002]
 *
 * @param sessionId - Session ID to get next agent for
 * @param options - Command options
 * @param sessionBasePath - Optional base path for session storage (for testing)
 */
async function commandNext(
  sessionId: string,
  options: NextOptions,
  sessionBasePath?: string
): Promise<NextResponse> {
  const sessionManager = sessionBasePath ? new SessionManager(sessionBasePath) : new SessionManager();
  const pipelineLoader = new PipelineConfigLoader();
  const styleInjector = new StyleInjector();
  const dynamicGenerator = new DynamicAgentGenerator();
  const structureLoader = new ChapterStructureLoader();

  // [REQ-PIPE-002] Load session from disk
  const session = await sessionManager.loadSession(sessionId);

  // Check session not expired
  if (sessionManager.isSessionExpired(session)) {
    throw new SessionExpiredError(sessionId);
  }

  // Load static pipeline config
  const staticConfig = await pipelineLoader.loadPipelineConfig();

  // CRITICAL: Detect Phase 6 entry and generate dynamic agents [DYNAMIC-001, DYNAMIC-002]
  if (!session.dynamicPhase6Agents && session.currentAgentIndex >= PHASE_6_START_INDEX) {
    const slug = session.slug || generateSlug(session.query);

    try {
      // Load locked chapter structure [DYNAMIC-002]
      const chapterStructure = await structureLoader.loadChapterStructure(slug);

      // Generate dynamic Phase 6 agents [DYNAMIC-001, DYNAMIC-004]
      const styleChars = styleInjector.getStyleCharacteristics(session.styleProfileId);
      const phase6Agents = await dynamicGenerator.generatePhase6Agents(
        chapterStructure,
        styleChars,
        slug
      );

      // Calculate total [DYNAMIC-007]
      const dynamicTotal = PHASE_1_5_AGENT_COUNT + phase6Agents.length + PHASE_7_AGENT_COUNT;

      // Store in session
      session.slug = slug;
      session.chapterStructure = chapterStructure;
      session.dynamicPhase6Agents = phase6Agents;
      session.dynamicTotalAgents = dynamicTotal;

      await sessionManager.saveSession(session);

      if (options.verbose) {
        console.error(`[DEBUG] Generated ${phase6Agents.length} dynamic Phase 6 agents`);
        console.error(`[DEBUG] Total agents: ${dynamicTotal}`);
      }
    } catch (error) {
      // Chapter structure not ready - fall back to static agents
      if (options.verbose) {
        console.error(`[DEBUG] Chapter structure not found, using static agents: ${error}`);
      }
    }
  }

  // Determine total agents (dynamic if available, else static)
  const totalAgents = session.dynamicTotalAgents || staticConfig.agents.length;

  if (options.verbose) {
    console.error(`[DEBUG] Session: ${sessionId}`);
    console.error(`[DEBUG] Current agent index: ${session.currentAgentIndex}`);
    console.error(`[DEBUG] Total agents: ${totalAgents}`);
    console.error(`[DEBUG] Using dynamic agents: ${!!session.dynamicPhase6Agents}`);
  }

  // Check if pipeline is complete
  if (session.currentAgentIndex >= totalAgents) {
    const duration = Date.now() - session.startTime;
    const summary: CompletionSummary = {
      duration,
      agentsCompleted: session.completedAgents.length,
      errors: session.errors.length
    };

    return {
      sessionId: session.sessionId,
      status: 'complete',
      progress: {
        completed: totalAgents,
        total: totalAgents,
        percentage: 100,
        currentPhase: 7,
        phaseName: getPhaseName(7)
      },
      summary
    };
  }

  // Get appropriate agent based on current index
  let agentConfig: AgentConfig;

  if (session.dynamicPhase6Agents) {
    const phase6End = PHASE_6_START_INDEX + session.dynamicPhase6Agents.length - 1;

    if (session.currentAgentIndex < PHASE_6_START_INDEX) {
      // Phase 1-5: use static agent
      agentConfig = await pipelineLoader.getAgentByIndex(session.currentAgentIndex);
    } else if (session.currentAgentIndex <= phase6End) {
      // Phase 6: use dynamic agent [DYNAMIC-004]
      const phase6Index = session.currentAgentIndex - PHASE_6_START_INDEX;
      const dynamicAgent = session.dynamicPhase6Agents[phase6Index];
      // Convert DynamicAgentDetails to AgentConfig
      agentConfig = {
        ...dynamicAgent,
        order: session.currentAgentIndex,
        description: dynamicAgent.prompt || '',
        inputs: [],
        outputs: dynamicAgent.expectedOutputs || []
      };
    } else {
      // Phase 7: map to static agents
      const phase7Offset = session.currentAgentIndex - (phase6End + 1);
      const staticIndex = STATIC_PHASE_7_START_INDEX + phase7Offset;
      agentConfig = await pipelineLoader.getAgentByIndex(staticIndex);
    }
  } else {
    // No dynamic agents, use static
    agentConfig = await pipelineLoader.getAgentByIndex(session.currentAgentIndex);
  }

  // Compute researchDir (handle legacy sessions without it)
  const researchDir = session.researchDir ||
    path.join(process.cwd(), 'docs/research', session.slug || generateSlug(session.query));

  // Build prompt with style injection (Phase 6 only), query injection, and output context
  let prompt = await styleInjector.buildAgentPrompt(
    agentConfig,
    session.styleProfileId,
    session.query,
    { researchDir, agentIndex: session.currentAgentIndex, agentKey: agentConfig.key }
  );

  // [ROLLING-PROMPT] Add dynamic workflow context
  const previousAgentKey = session.currentAgentIndex > 0
    ? session.completedAgents[session.completedAgents.length - 1] || 'N/A'
    : 'None';

  // Look ahead to find next agent (if not last)
  let nextAgentKey = 'Pipeline Complete';
  const nextIndex = session.currentAgentIndex + 1;
  if (nextIndex < totalAgents) {
    if (session.dynamicPhase6Agents) {
      const phase6End = PHASE_6_START_INDEX + session.dynamicPhase6Agents.length - 1;
      if (nextIndex < PHASE_6_START_INDEX) {
        const nextStatic = await pipelineLoader.getAgentByIndex(nextIndex);
        nextAgentKey = nextStatic?.key || 'N/A';
      } else if (nextIndex <= phase6End) {
        const phase6Index = nextIndex - PHASE_6_START_INDEX;
        nextAgentKey = session.dynamicPhase6Agents[phase6Index]?.key || 'N/A';
      } else {
        const phase7Offset = nextIndex - (phase6End + 1);
        const staticIndex = STATIC_PHASE_7_START_INDEX + phase7Offset;
        const nextStatic = await pipelineLoader.getAgentByIndex(staticIndex);
        nextAgentKey = nextStatic?.key || 'N/A';
      }
    } else {
      const nextStatic = await pipelineLoader.getAgentByIndex(nextIndex);
      nextAgentKey = nextStatic?.key || 'N/A';
    }
  }

  const workflowContext = `
## WORKFLOW CONTEXT
Agent #${session.currentAgentIndex + 1}/${totalAgents} | Phase ${agentConfig.phase}: ${getPhaseName(agentConfig.phase)}
Previous: ${previousAgentKey} | Next: ${nextAgentKey}

## TASK COMPLETION SUMMARY (REQUIRED FORMAT)
When you complete this task, end your response with:

**What I Did**: [1-2 sentence summary of work completed]

**Files Created/Modified**:
- \`path/to/file\` - Brief description

**Key Findings**: [If applicable - important discoveries or decisions made]

**Next Agent Guidance**: [Brief hint for ${nextAgentKey} about context they need]

---

`;

  // Prepend workflow context to prompt
  prompt = workflowContext + prompt;

  // [UCM-DESC] Inject prior solutions from DESC episodic memory
  // Use PhdPipelineAdapter for phase-aware window sizes (RULE-010 to RULE-014)
  let descInjectionResult: { episodesUsed: number; episodeIds: string[]; windowSize: number } = { episodesUsed: 0, episodeIds: [], windowSize: 3 };
  try {
    const ucmClient = getUCMClient();
    if (await ucmClient.isHealthy()) {
      // Use PhdPipelineAdapter to get phase-aware window size
      const pipelineAdapter = new PhdPipelineAdapter();
      const phaseName = getPhaseName(agentConfig.phase);

      // Map numeric phase to adapter's phase detection context
      // Phase 1: Foundation -> planning (2 messages, RULE-011)
      // Phase 2: Discovery -> research (3 messages, RULE-012)
      // Phase 3-5: Architecture/Synthesis/Design -> default (3 messages, RULE-010)
      // Phase 6: Writing -> writing (5 messages, RULE-013)
      // Phase 7: Validation -> qa (10 messages, RULE-014)
      const phaseContext = {
        pipelineName: 'phd-pipeline',
        agentId: agentConfig.key,
        phase: phaseName.toLowerCase(),
        task: session.query
      };

      const windowSize = pipelineAdapter.getWindowSize(phaseContext);

      const injection = await ucmClient.injectSolutions(prompt, {
        threshold: 0.80, // Per task requirements
        maxEpisodes: windowSize,
        agentType: agentConfig.key,
        metadata: {
          sessionId: session.sessionId,
          phase: agentConfig.phase,
          phaseName,
          agentIndex: session.currentAgentIndex,
          totalAgents,
          windowSize, // Include for traceability
        },
      });

      if (injection.episodesUsed > 0) {
        prompt = injection.augmentedPrompt;
        descInjectionResult = {
          episodesUsed: injection.episodesUsed,
          episodeIds: injection.episodeIds,
          windowSize
        };

        if (options.verbose) {
          console.error(`[UCM-DESC] Injected ${injection.episodesUsed} prior solutions for ${agentConfig.key} (window: ${windowSize}, phase: ${phaseName})`);
        }
      } else if (options.verbose) {
        console.error(`[UCM-DESC] No matching episodes found for ${agentConfig.key} (window: ${windowSize}, phase: ${phaseName})`);
      }
    }
  } catch (error) {
    // DESC injection is optional - continue without it (graceful fallback)
    if (options.verbose) {
      console.error(`[UCM-DESC] Injection skipped: ${error}`);
    }
  }

  // Build AgentDetails
  const agentDetails: AgentDetails = {
    index: session.currentAgentIndex,
    key: agentConfig.key,
    name: agentConfig.name,
    phase: agentConfig.phase,
    phaseName: getPhaseName(agentConfig.phase),
    prompt,
    dependencies: agentConfig.dependencies,
    timeout: agentConfig.timeout,
    critical: agentConfig.critical,
    expectedOutputs: agentConfig.expectedOutputs
  };

  // Calculate progress
  const progress: ProgressInfo = {
    completed: session.completedAgents.length,
    total: totalAgents,
    percentage: Math.round((session.completedAgents.length / totalAgents) * 1000) / 10,
    currentPhase: agentConfig.phase,
    phaseName: getPhaseName(agentConfig.phase)
  };

  // Update session activity time
  await sessionManager.updateActivity(session);

  // Emit step_started event for dashboard observability
  emitPipelineEvent({
    component: 'pipeline',
    operation: 'step_started',
    status: 'running',
    metadata: {
      pipelineId: session.pipelineId,
      stepId: `step_${session.pipelineId}_${session.currentAgentIndex}`,
      stepName: agentConfig.key,
      stepIndex: session.currentAgentIndex,
      agentType: agentConfig.key,
      phase: getPhaseName(agentConfig.phase),
      totalSteps: totalAgents,
      progress: progress.percentage,
    },
  });

  if (options.verbose) {
    console.error(`[DEBUG] Next agent: ${agentConfig.key}`);
    console.error(`[DEBUG] Phase: ${agentConfig.phase} (${getPhaseName(agentConfig.phase)})`);
    console.error(`[DEBUG] Progress: ${progress.percentage}%`);
  }

  return {
    sessionId: session.sessionId,
    status: 'next',
    progress,
    agent: agentDetails,
    desc: descInjectionResult.episodesUsed > 0 ? {
      episodesInjected: descInjectionResult.episodesUsed,
      episodeIds: descInjectionResult.episodeIds,
      windowSize: descInjectionResult.windowSize,
    } : undefined,
  };
}

// ============================================================================
// TASK-PIPE-005: Complete Command
// ============================================================================

/**
 * complete command - Mark agent as complete and optionally store output
 * [REQ-PIPE-003, REQ-PIPE-024]
 */
program
  .command('complete <session-id> <agent-key>')
  .description('Mark agent as complete and optionally store output')
  .option('--result <json>', 'Agent output as JSON string')
  .option('--file <path>', 'Agent output from file')
  .option('--json', 'Output as JSON (default: true)', true)
  .action(async (sessionId: string, agentKey: string, options: CompleteOptions) => {
    try {
      const response = await commandComplete(sessionId, agentKey, options);
      console.log(JSON.stringify(response, null, 2));
      process.exit(0);
    } catch (error) {
      handleError(error);
    }
  });

/**
 * Execute complete command
 * [REQ-PIPE-003, REQ-PIPE-024]
 *
 * @param sessionId - Session ID to update
 * @param agentKey - Agent key being completed
 * @param options - Command options
 * @param sessionBasePath - Optional base path for session storage (for testing)
 */
async function commandComplete(
  sessionId: string,
  agentKey: string,
  options: CompleteOptions,
  sessionBasePath?: string
): Promise<CompleteResponse> {
  const sessionManager = sessionBasePath ? new SessionManager(sessionBasePath) : new SessionManager();
  const pipelineLoader = new PipelineConfigLoader();

  // Load session
  const session = await sessionManager.loadSession(sessionId);

  // Check not expired
  if (sessionManager.isSessionExpired(session)) {
    throw new SessionExpiredError(sessionId);
  }

  // Load static pipeline config
  const pipelineConfig = await pipelineLoader.loadPipelineConfig();

  // Determine total agents (dynamic if available, else static)
  const totalAgents = session.dynamicTotalAgents || pipelineConfig.agents.length;

  // Check if pipeline already complete
  if (session.currentAgentIndex >= totalAgents) {
    throw new Error('Pipeline already complete');
  }

  // Get current agent key using dynamic routing [DYNAMIC-004]
  let expectedAgentKey: string;

  if (session.dynamicPhase6Agents) {
    const phase6End = PHASE_6_START_INDEX + session.dynamicPhase6Agents.length - 1;

    if (session.currentAgentIndex < PHASE_6_START_INDEX) {
      // Phase 1-5: use static agent
      const staticAgent = pipelineConfig.agents[session.currentAgentIndex];
      expectedAgentKey = staticAgent?.key || '';
    } else if (session.currentAgentIndex <= phase6End) {
      // Phase 6: use dynamic agent
      const phase6Index = session.currentAgentIndex - PHASE_6_START_INDEX;
      const dynamicAgent = session.dynamicPhase6Agents[phase6Index];
      expectedAgentKey = dynamicAgent?.key || '';
    } else {
      // Phase 7: map to static agents
      const phase7Offset = session.currentAgentIndex - (phase6End + 1);
      const staticIndex = STATIC_PHASE_7_START_INDEX + phase7Offset;
      const staticAgent = await pipelineLoader.getAgentByIndex(staticIndex);
      expectedAgentKey = staticAgent?.key || '';
    }
  } else {
    // No dynamic agents, use static
    const staticAgent = pipelineConfig.agents[session.currentAgentIndex];
    expectedAgentKey = staticAgent?.key || '';
  }

  if (!expectedAgentKey) {
    throw new Error('Pipeline already complete');
  }

  // [REQ-PIPE-003] Validate agent-key matches current agent
  if (expectedAgentKey !== agentKey) {
    throw new AgentMismatchError(expectedAgentKey, agentKey);
  }

  // [REQ-PIPE-024] Parse and store output if provided
  let output: unknown = null;

  if (options.result) {
    try {
      output = JSON.parse(options.result);
    } catch {
      // JSON parse error - still complete agent, but warn
      console.error(JSON.stringify({
        warning: 'Invalid JSON in --result parameter; agent marked complete without output'
      }));
    }
  } else if (options.file) {
    const fs = await import('fs/promises');
    try {
      const content = await fs.readFile(options.file, 'utf-8');
      try {
        output = JSON.parse(content);
      } catch {
        console.error(JSON.stringify({
          warning: 'Invalid JSON in file; agent marked complete without output'
        }));
      }
    } catch (err) {
      console.error(JSON.stringify({
        warning: `Could not read file ${options.file}; agent marked complete without output`
      }));
    }
  }

  // [REQ-PIPE-026] Auto-read output from expected location if not explicitly provided
  if (output === null) {
    // Compute researchDir from session or generate from slug
    const researchDir = session.researchDir ||
      path.join(process.cwd(), 'docs/research', session.slug || generateSlug(session.query));

    // Store researchDir in session if not already set (for legacy sessions)
    if (!session.researchDir) {
      session.researchDir = researchDir;
    }

    const autoRead = await tryReadAgentOutput(researchDir, session.currentAgentIndex, agentKey);
    if (autoRead) {
      output = {
        status: 'complete',
        content: autoRead.content,
        output_file: autoRead.outputPath,
        auto_captured: true,
        word_count: autoRead.content.split(/\s+/).length,
      };
      console.error(JSON.stringify({
        info: `[REQ-PIPE-026] Auto-captured output from: ${autoRead.outputPath}`
      }));
    } else {
      console.error(JSON.stringify({
        warning: `[REQ-PIPE-026] No output file found for ${agentKey} at index ${session.currentAgentIndex}`
      }));
    }
  }

  // Update session state
  session.completedAgents.push(agentKey);

  if (output !== null) {
    session.agentOutputs[agentKey] = output;
  }

  // Increment to next agent
  session.currentAgentIndex += 1;

  // Update phase based on new index using dynamic routing
  if (session.currentAgentIndex < totalAgents) {
    if (session.dynamicPhase6Agents) {
      const phase6End = PHASE_6_START_INDEX + session.dynamicPhase6Agents.length - 1;

      if (session.currentAgentIndex < PHASE_6_START_INDEX) {
        const nextAgent = pipelineConfig.agents[session.currentAgentIndex];
        session.currentPhase = nextAgent?.phase || session.currentPhase;
      } else if (session.currentAgentIndex <= phase6End) {
        session.currentPhase = 6; // Writing phase
      } else {
        session.currentPhase = 7; // Validation phase
      }
    } else if (session.currentAgentIndex < pipelineConfig.agents.length) {
      const nextAgent = pipelineConfig.agents[session.currentAgentIndex];
      session.currentPhase = nextAgent?.phase || session.currentPhase;
    }
  }

  // Update activity time
  session.lastActivityTime = Date.now();

  // Persist updated session
  await sessionManager.saveSession(session);

  // Emit step_completed event for dashboard observability
  emitPipelineEvent({
    component: 'pipeline',
    operation: 'step_completed',
    status: 'success',
    durationMs: Date.now() - session.lastActivityTime,
    metadata: {
      pipelineId: session.pipelineId,
      stepId: `step_${session.pipelineId}_${session.currentAgentIndex - 1}`,
      stepName: agentKey,
      agentType: agentKey,
      phase: getPhaseName(session.currentPhase),
      completedSteps: session.completedAgents.length,
      totalSteps: totalAgents,
      progress: Math.round((session.completedAgents.length / totalAgents) * 100),
    },
  });

  // [UCM-DESC] Store completed agent result as episode for future retrieval
  if (output !== null && typeof output === 'object') {
    try {
      const ucmClient = getUCMClient();
      if (await ucmClient.isHealthy()) {
        // Extract answer text from output (look for common summary fields)
        const outputObj = output as Record<string, unknown>;
        let answerText = '';

        if (typeof outputObj.summary === 'string') {
          answerText = outputObj.summary;
        } else if (typeof outputObj.result === 'string') {
          answerText = outputObj.result;
        } else if (typeof outputObj.output === 'string') {
          answerText = outputObj.output;
        } else if (typeof outputObj.content === 'string') {
          answerText = outputObj.content;
        } else {
          // Use JSON representation as answer
          answerText = JSON.stringify(output, null, 2);
        }

        // Get the original prompt from the current agent
        const agentConfig = session.dynamicPhase6Agents
          ? (session.currentAgentIndex - 1 < PHASE_6_START_INDEX
              ? pipelineConfig.agents[session.currentAgentIndex - 1]
              : session.dynamicPhase6Agents[session.currentAgentIndex - 1 - PHASE_6_START_INDEX])
          : pipelineConfig.agents[session.currentAgentIndex - 1];

        const queryText = agentConfig
          ? `Agent: ${agentConfig.name}\nPhase: ${getPhaseName(agentConfig.phase)}\nTask: ${session.query}`
          : `Agent: ${agentKey}\nTask: ${session.query}`;

        await ucmClient.storeEpisode(queryText, answerText, {
          sessionId: session.sessionId,
          agentKey,
          phase: session.currentPhase,
          pipelineId: session.pipelineId,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      // DESC storage is optional - continue without it
      console.error(`[UCM-DESC] Failed to store episode: ${error}`);
    }
  }

  // Determine next agent key (if any) using dynamic routing
  let nextAgentKey: string | undefined;

  if (session.currentAgentIndex < totalAgents) {
    if (session.dynamicPhase6Agents) {
      const phase6End = PHASE_6_START_INDEX + session.dynamicPhase6Agents.length - 1;

      if (session.currentAgentIndex < PHASE_6_START_INDEX) {
        nextAgentKey = pipelineConfig.agents[session.currentAgentIndex]?.key;
      } else if (session.currentAgentIndex <= phase6End) {
        const phase6Index = session.currentAgentIndex - PHASE_6_START_INDEX;
        nextAgentKey = session.dynamicPhase6Agents[phase6Index]?.key;
      } else {
        const phase7Offset = session.currentAgentIndex - (phase6End + 1);
        const staticIndex = STATIC_PHASE_7_START_INDEX + phase7Offset;
        const staticAgent = await pipelineLoader.getAgentByIndex(staticIndex);
        nextAgentKey = staticAgent?.key;
      }
    } else if (session.currentAgentIndex < pipelineConfig.agents.length) {
      nextAgentKey = pipelineConfig.agents[session.currentAgentIndex]?.key;
    }
  }

  // [PHASE-8-AUTO] Check if pipeline is complete and trigger Phase 8 automatically
  const pipelineComplete = !nextAgentKey && session.currentAgentIndex >= totalAgents;

  if (pipelineComplete) {
    console.error('[Pipeline] All Phase 1-7 agents complete. Triggering Phase 8 (finalize)...');

    // Emit pipeline completion event
    emitPipelineEvent({
      component: 'pipeline',
      operation: 'phases_1_7_complete',
      status: 'success',
      metadata: {
        pipelineId: session.pipelineId,
        completedAgents: session.completedAgents.length,
        totalAgents,
        triggeringPhase8: true,
      },
    });

    // Extract slug from session (stored during init)
    const slug = session.slug || session.pipelineId;

    // Trigger Phase 8 finalize asynchronously (don't block)
    // The user can also run it manually if needed
    triggerPhase8Finalize(slug, session.styleProfileId).catch((error) => {
      console.error(`[Phase 8] Auto-finalize failed: ${error}`);
      console.error('[Phase 8] Run manually: npx tsx src/god-agent/cli/phd-cli.ts finalize --slug ' + slug);
    });
  }

  return {
    success: true,
    nextAgent: nextAgentKey,
    pipelineComplete,
    phase8Triggered: pipelineComplete
  };
}

/**
 * Trigger Phase 8 finalize after pipeline completion
 * [PHASE-8-AUTO] Automatic integration with main pipeline
 *
 * @param slug - Research session slug
 * @param styleProfileId - Optional style profile ID
 */
async function triggerPhase8Finalize(slug: string, styleProfileId?: string): Promise<void> {
  console.error(`[Phase 8] Starting finalize for: ${slug}`);

  const basePath = process.cwd();
  const orchestrator = new FinalStageOrchestrator(basePath, slug);

  // Set up progress callback
  orchestrator.onProgress((report: ProgressReport) => {
    const progress = report.total > 0 ? Math.round((report.current / report.total) * 100) : 0;
    console.error(`[Phase 8] ${report.phase}: ${report.message} (${progress}%)`);
  });

  try {
    const result = await orchestrator.execute({
      force: false, // Don't overwrite existing final output
      dryRun: false,
      threshold: 0.30,
      verbose: false,
      sequential: true, // Safer for automatic execution
      styleProfileId,
    });

    if (result.success) {
      console.error(`[Phase 8] SUCCESS: Final paper generated`);
      console.error(`[Phase 8] Output: ${result.outputPath}`);
      console.error(`[Phase 8] Words: ${result.totalWords}, Citations: ${result.totalCitations}`);

      // Emit Phase 8 completion event
      emitPipelineEvent({
        component: 'pipeline',
        operation: 'phase8_auto_completed',
        status: 'success',
        metadata: {
          slug,
          outputPath: result.outputPath,
          totalWords: result.totalWords,
          totalCitations: result.totalCitations,
        },
      });
    } else {
      console.error(`[Phase 8] FAILED: ${result.errors?.join(', ')}`);
      console.error(`[Phase 8] Warnings: ${result.warnings?.join(', ')}`);
    }
  } catch (error) {
    console.error(`[Phase 8] Error during finalize:`, error);
    throw error;
  }
}

// ============================================================================
// TASK-PIPE-006: Status/List/Resume/Abort Commands
// ============================================================================

/**
 * status command - Show detailed session progress
 * [REQ-PIPE-004]
 */
program
  .command('status <session-id>')
  .description('Show detailed session progress')
  .option('--json', 'Output as JSON (default: true)', true)
  .action(async (sessionId: string, options: StatusOptions) => {
    try {
      const response = await commandStatus(sessionId, options);
      console.log(JSON.stringify(response, null, 2));
      process.exit(0);
    } catch (error) {
      handleError(error);
    }
  });

/**
 * Execute status command
 * [REQ-PIPE-004]
 *
 * @param sessionId - Session ID to get status for
 * @param options - Command options
 * @param sessionBasePath - Optional base path for session storage (for testing)
 */
async function commandStatus(
  sessionId: string,
  options: StatusOptions,
  sessionBasePath?: string
): Promise<StatusResponse> {
  const sessionManager = sessionBasePath ? new SessionManager(sessionBasePath) : new SessionManager();
  const pipelineLoader = new PipelineConfigLoader();

  // Load session
  const session = await sessionManager.loadSession(sessionId);

  // Load pipeline config
  const pipelineConfig = await pipelineLoader.loadPipelineConfig();
  const totalAgents = pipelineConfig.agents.length;

  // Get current agent
  const currentAgentConfig = session.currentAgentIndex < totalAgents
    ? pipelineConfig.agents[session.currentAgentIndex]
    : null;

  // Build current agent details (simplified for status)
  const currentAgent: AgentDetails = currentAgentConfig ? {
    index: session.currentAgentIndex,
    key: currentAgentConfig.key,
    name: currentAgentConfig.name,
    phase: currentAgentConfig.phase,
    phaseName: getPhaseName(currentAgentConfig.phase),
    prompt: '', // Not needed for status
    dependencies: currentAgentConfig.dependencies,
    timeout: currentAgentConfig.timeout,
    critical: currentAgentConfig.critical,
    expectedOutputs: currentAgentConfig.expectedOutputs
  } : {
    index: totalAgents,
    key: 'complete',
    name: 'Pipeline Complete',
    phase: 7,
    phaseName: getPhaseName(7),
    prompt: '',
    dependencies: [],
    timeout: 0,
    critical: false,
    expectedOutputs: []
  };

  // Calculate progress
  const completed = session.completedAgents.length;
  const percentage = Math.round((completed / totalAgents) * 1000) / 10;

  // Calculate elapsed time
  const elapsedTime = Date.now() - session.startTime;

  // Truncate query for display (200 chars)
  const displayQuery = session.query.length > 200
    ? session.query.substring(0, 197) + '...'
    : session.query;

  return {
    sessionId: session.sessionId,
    pipelineId: session.pipelineId,
    query: displayQuery,
    status: session.status,
    currentPhase: currentAgent.phase,
    phaseName: currentAgent.phaseName,
    currentAgent,
    progress: {
      completed,
      total: totalAgents,
      percentage
    },
    startTime: session.startTime,
    lastActivityTime: session.lastActivityTime,
    elapsedTime,
    errors: session.errors
  };
}

/**
 * list command - List all active/recent sessions
 * [REQ-PIPE-005]
 */
program
  .command('list')
  .description('List all active/recent sessions')
  .option('--all', 'Include completed/expired sessions')
  .option('--json', 'Output as JSON (default: true)', true)
  .action(async (options: ListOptions) => {
    try {
      const response = await commandList(options);
      console.log(JSON.stringify(response, null, 2));
      process.exit(0);
    } catch (error) {
      handleError(error);
    }
  });

/**
 * Execute list command
 * [REQ-PIPE-005]
 *
 * @param options - Command options
 * @param sessionBasePath - Optional base path for session storage (for testing)
 */
async function commandList(
  options: ListOptions,
  sessionBasePath?: string
): Promise<ListResponse> {
  const sessionManager = sessionBasePath ? new SessionManager(sessionBasePath) : new SessionManager();

  // Get sessions - SessionManager.listSessions already filters by default
  const sessions = await sessionManager.listSessions({
    includeAll: options.all,
    maxAgeDays: options.all ? 365 : 7 // 7 days default, 1 year if --all
  });

  // Map to session list items
  const sessionItems: SessionListItem[] = sessions.map(session => ({
    sessionId: session.sessionId,
    pipelineId: session.pipelineId,
    query: session.query.length > 50
      ? session.query.substring(0, 47) + '...'
      : session.query,
    status: session.status,
    progress: Math.round((session.completedAgents.length / 45) * 1000) / 10, // 45 = base agent count
    startTime: session.startTime,
    lastActivityTime: session.lastActivityTime
  }));

  return {
    sessions: sessionItems,
    total: sessionItems.length
  };
}

/**
 * resume command - Resume interrupted session
 * [REQ-PIPE-006]
 */
program
  .command('resume <session-id>')
  .description('Resume interrupted session')
  .option('--json', 'Output as JSON (default: true)', true)
  .action(async (sessionId: string, options: ResumeOptions) => {
    try {
      const response = await commandResume(sessionId, options);
      console.log(JSON.stringify(response, null, 2));
      process.exit(0);
    } catch (error) {
      handleError(error);
    }
  });

/**
 * Execute resume command
 * [REQ-PIPE-006]
 *
 * @param sessionId - Session ID to resume
 * @param options - Command options
 * @param sessionBasePath - Optional base path for session storage (for testing)
 */
async function commandResume(
  sessionId: string,
  options: ResumeOptions,
  sessionBasePath?: string
): Promise<ResumeResponse> {
  const sessionManager = sessionBasePath ? new SessionManager(sessionBasePath) : new SessionManager();
  const pipelineLoader = new PipelineConfigLoader();
  const styleInjector = new StyleInjector();
  const dynamicGenerator = new DynamicAgentGenerator();
  const structureLoader = new ChapterStructureLoader();

  // Load session
  const session = await sessionManager.loadSession(sessionId);

  // Check not expired
  if (sessionManager.isSessionExpired(session)) {
    throw new SessionExpiredError(sessionId);
  }

  // Load static pipeline config
  const staticConfig = await pipelineLoader.loadPipelineConfig();

  // CRITICAL: Detect Phase 6 entry and generate dynamic agents [DYNAMIC-001, DYNAMIC-002]
  if (!session.dynamicPhase6Agents && session.currentAgentIndex >= PHASE_6_START_INDEX) {
    const slug = session.slug || generateSlug(session.query);

    try {
      // Load locked chapter structure [DYNAMIC-002]
      const chapterStructure = await structureLoader.loadChapterStructure(slug);

      // Generate dynamic Phase 6 agents [DYNAMIC-001, DYNAMIC-004]
      const styleChars = styleInjector.getStyleCharacteristics(session.styleProfileId);
      const phase6Agents = await dynamicGenerator.generatePhase6Agents(
        chapterStructure,
        styleChars,
        slug
      );

      // Calculate total [DYNAMIC-007]
      const dynamicTotal = PHASE_1_5_AGENT_COUNT + phase6Agents.length + PHASE_7_AGENT_COUNT;

      // Store in session
      session.slug = slug;
      session.chapterStructure = chapterStructure;
      session.dynamicPhase6Agents = phase6Agents;
      session.dynamicTotalAgents = dynamicTotal;

      await sessionManager.saveSession(session);
    } catch (error) {
      // Chapter structure not ready - fall back to static agents
      // Silent fallback for resume
    }
  }

  // Determine total agents (dynamic if available, else static)
  const totalAgents = session.dynamicTotalAgents || staticConfig.agents.length;

  // Check if pipeline is complete
  if (session.currentAgentIndex >= totalAgents) {
    throw new Error('Pipeline already complete, cannot resume');
  }

  // Get appropriate agent based on current index
  let agentConfig: AgentConfig;

  if (session.dynamicPhase6Agents) {
    const phase6End = PHASE_6_START_INDEX + session.dynamicPhase6Agents.length - 1;

    if (session.currentAgentIndex < PHASE_6_START_INDEX) {
      // Phase 1-5: use static agent
      agentConfig = await pipelineLoader.getAgentByIndex(session.currentAgentIndex);
    } else if (session.currentAgentIndex <= phase6End) {
      // Phase 6: use dynamic agent [DYNAMIC-004]
      const phase6Index = session.currentAgentIndex - PHASE_6_START_INDEX;
      const dynamicAgent = session.dynamicPhase6Agents[phase6Index];
      // Convert DynamicAgentDetails to AgentConfig
      agentConfig = {
        ...dynamicAgent,
        order: session.currentAgentIndex,
        description: dynamicAgent.prompt || '',
        inputs: [],
        outputs: dynamicAgent.expectedOutputs || []
      };
    } else {
      // Phase 7: map to static agents
      const phase7Offset = session.currentAgentIndex - (phase6End + 1);
      const staticIndex = STATIC_PHASE_7_START_INDEX + phase7Offset;
      agentConfig = await pipelineLoader.getAgentByIndex(staticIndex);
    }
  } else {
    // No dynamic agents, use static
    agentConfig = await pipelineLoader.getAgentByIndex(session.currentAgentIndex);
  }

  // Compute researchDir (handle legacy sessions without it)
  const researchDir = session.researchDir ||
    path.join(process.cwd(), 'docs/research', session.slug || generateSlug(session.query));

  // Build prompt with style injection, query injection, and output context
  const prompt = await styleInjector.buildAgentPrompt(
    agentConfig,
    session.styleProfileId,
    session.query,
    { researchDir, agentIndex: session.currentAgentIndex, agentKey: agentConfig.key }
  );

  // Build agent details
  const agentDetails: AgentDetails = {
    index: session.currentAgentIndex,
    key: agentConfig.key,
    name: agentConfig.name,
    phase: agentConfig.phase,
    phaseName: getPhaseName(agentConfig.phase),
    prompt,
    dependencies: agentConfig.dependencies,
    timeout: agentConfig.timeout,
    critical: agentConfig.critical,
    expectedOutputs: agentConfig.expectedOutputs
  };

  // Calculate progress
  const progress = {
    completed: session.completedAgents.length,
    total: totalAgents,
    percentage: Math.round((session.completedAgents.length / totalAgents) * 1000) / 10
  };

  // Update activity time
  await sessionManager.updateActivity(session);

  return {
    sessionId: session.sessionId,
    resumed: true,
    agent: agentDetails,
    progress
  };
}

/**
 * abort command - Cancel session
 * [REQ-PIPE-007]
 */
program
  .command('abort <session-id>')
  .description('Cancel session and clean up')
  .option('--force', 'Force abort without confirmation')
  .option('--json', 'Output as JSON (default: true)', true)
  .action(async (sessionId: string, options: AbortOptions) => {
    try {
      const response = await commandAbort(sessionId, options);
      console.log(JSON.stringify(response, null, 2));
      process.exit(0);
    } catch (error) {
      handleError(error);
    }
  });

/**
 * Execute abort command
 * [REQ-PIPE-007]
 *
 * @param sessionId - Session ID to abort
 * @param options - Command options
 * @param sessionBasePath - Optional base path for session storage (for testing)
 */
async function commandAbort(
  sessionId: string,
  options: AbortOptions,
  sessionBasePath?: string
): Promise<AbortResponse> {
  const sessionManager = sessionBasePath ? new SessionManager(sessionBasePath) : new SessionManager();

  // Load session
  const session = await sessionManager.loadSession(sessionId);

  // Store completed count before update
  const completedCount = session.completedAgents.length;

  // Update session status to failed
  await sessionManager.updateStatus(session, 'failed');

  return {
    sessionId: session.sessionId,
    aborted: true,
    finalStatus: 'failed',
    completedAgents: completedCount
  };
}

// ============================================================================
// TASK-003: Finalize Command (Phase 8 Final Assembly)
// ============================================================================

/**
 * CLI options interface for finalize command
 */
interface FinalizeCliOptions {
  slug: string;
  force?: boolean;
  dryRun?: boolean;
  threshold?: string;
  verbose?: boolean;
  sequential?: boolean;
  skipValidation?: boolean;
  /** Generate synthesis prompts for Claude Code instead of writing chapters */
  generatePrompts?: boolean;
  /** Style profile ID to use (overrides session lookup) */
  styleProfile?: string;
}

/**
 * finalize command - Run Phase 8 final paper assembly
 * [REQ-PIPE-008] Per SPEC-FUNC-001 Section 3.1, CONSTITUTION Appendix B
 * Aliases: final, phase8
 */
program
  .command('finalize')
  .alias('final')
  .alias('phase8')
  .description('Run Phase 8 final paper assembly - generates dissertation from research outputs')
  .requiredOption('--slug <slug>', 'Research task slug (directory name)')
  .option('--force', 'Overwrite existing final/ outputs', false)
  .option('--dry-run', 'Preview mapping without generating chapters', false)
  .option('--threshold <n>', 'Semantic matching threshold 0-1 (default: 0.30)', '0.30')
  .option('--verbose', 'Enable detailed logging', false)
  .option('--sequential', 'Write chapters sequentially (safer, slower)', false)
  .option('--skip-validation', 'Skip quality validation (debug only)', false)
  .option('--generate-prompts', 'Output synthesis prompts for Claude Code agents', false)
  .option('--style-profile <id>', 'Style profile ID to use (overrides session lookup)')
  .action(async (options: FinalizeCliOptions) => {
    try {
      // If --generate-prompts is set, output synthesis prompts for Claude Code
      if (options.generatePrompts) {
        const prompts = await commandGeneratePrompts(options);
        // Output prompts as JSON for Claude Code to consume
        console.log(JSON.stringify({
          success: true,
          mode: 'generate-prompts',
          totalPrompts: prompts.length,
          prompts: prompts.map(p => ({
            chapterNumber: p.chapterNumber,
            chapterTitle: p.chapterTitle,
            wordTarget: p.wordTarget,
            sections: p.sections,
            styleProfileId: p.styleProfileId,
            outputPath: p.outputPath,
            agentType: p.agentType,
            prompt: p.prompt
          }))
        }, null, 2));
        process.exit(0);
        return;
      }

      const result = await commandFinalize(options);

      // Output result as JSON
      console.log(JSON.stringify({
        success: result.success,
        dryRun: result.dryRun,
        outputPath: result.outputPath,
        totalWords: result.totalWords,
        totalCitations: result.totalCitations,
        chaptersGenerated: result.chaptersGenerated,
        warnings: result.warnings,
        errors: result.errors,
        exitCode: result.exitCode
      }, null, 2));

      process.exit(result.exitCode);
    } catch (error) {
      handleFinalizeError(error);
    }
  });

/**
 * Format duration in human-readable form
 */
function formatDuration(ms: number): string {
  if (ms < 0) return 'unknown';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Create a simple progress bar
 */
function createProgressBar(progress: number, width: number = 20): string {
  const filled = Math.floor((progress / 100) * width);
  const empty = width - filled;
  return '[' + '='.repeat(filled) + (filled < width ? '>' : '') + ' '.repeat(Math.max(0, empty - 1)) + ']';
}

/**
 * Execute finalize command
 * [REQ-PIPE-008] Per SPEC-FUNC-001 Section 3.1
 *
 * Exit Codes per CONSTITUTION Appendix B:
 * 0 - SUCCESS: All phases completed successfully
 * 1 - GENERAL_ERROR: Unspecified error
 * 2 - MISSING_FILES: Required input files missing
 * 3 - TOKEN_OVERFLOW: Context limit exceeded
 * 4 - MAPPING_FAILURE: Chapter with zero sources
 * 5 - VALIDATION_FAILURE: Output quality validation failed
 * 6 - SECURITY_VIOLATION: SE-xxx rule violated
 * 7 - CONSTITUTION_VIOLATION: Critical DI-xxx or FS-xxx rule violated
 *
 * @param cliOptions - Command line options
 * @returns FinalStageResult with output details
 */
async function commandFinalize(cliOptions: FinalizeCliOptions): Promise<FinalStageResult> {
  const basePath = process.cwd();

  // Parse threshold (string from CLI to number)
  const threshold = parseFloat(cliOptions.threshold ?? '0.30');
  if (isNaN(threshold) || threshold < 0 || threshold > 1) {
    throw new Error('Threshold must be a number between 0 and 1');
  }

  // Create orchestrator
  const orchestrator = new FinalStageOrchestrator(basePath, cliOptions.slug);

  // Track last phase for progress display
  let lastPhase = '';
  let phaseStartTime = Date.now();

  // Set up progress callback [EX-004]
  orchestrator.onProgress((report: ProgressReport) => {
    // Detect phase change
    if (report.phase !== lastPhase) {
      if (lastPhase && cliOptions.verbose) {
        // Print phase completion
        const phaseDuration = Date.now() - phaseStartTime;
        console.error(`  Completed in ${formatDuration(phaseDuration)}`);
        console.error('');
      }
      lastPhase = report.phase;
      phaseStartTime = Date.now();

      // Print new phase header
      if (cliOptions.verbose) {
        console.error(`Phase: ${report.phase}`);
      }
    }

    if (cliOptions.verbose) {
      // Verbose mode: detailed output per SPEC-FUNC-001 Section 4.3
      const progressStr = report.current >= 0 && report.total >= 0
        ? ` (${report.current}/${report.total})`
        : '';

      // Calculate phase progress percentage
      let phaseProgress = 0;
      if (report.current >= 0 && report.total > 0) {
        phaseProgress = Math.round((report.current / report.total) * 100);
      }

      // Calculate overall progress using milestones (for future use in estimated time)
      const milestone = PROGRESS_MILESTONES[report.phase as FinalStageState];
      if (milestone) {
        const phaseRange = milestone.end - milestone.start;
        // Could be used for estimated remaining time calculation
        const _overallProgress = milestone.start + (phaseRange * (phaseProgress / 100));
        void _overallProgress; // Suppress unused warning
      }

      const progressBar = createProgressBar(phaseProgress);
      const elapsed = formatDuration(report.elapsedMs);

      console.error(`  ${progressBar} ${phaseProgress}%${progressStr}`);
      console.error(`  ${report.message}`);
      console.error(`  Elapsed: ${elapsed}`);
    } else {
      // Simple mode: just dots
      process.stdout.write('.');
    }
  });

  // Build orchestrator options
  const options: FinalStageOptions = {
    force: cliOptions.force ?? false,
    dryRun: cliOptions.dryRun ?? false,
    threshold,
    verbose: cliOptions.verbose ?? false,
    sequential: cliOptions.sequential ?? false,
    skipValidation: cliOptions.skipValidation ?? false
  };

  // Emit pipeline event for observability
  emitPipelineEvent({
    component: 'pipeline',
    operation: 'phase8_started',
    status: 'running',
    metadata: {
      slug: cliOptions.slug,
      options: {
        force: options.force,
        dryRun: options.dryRun,
        threshold: options.threshold,
        sequential: options.sequential
      }
    }
  });

  // Execute Phase 8
  const result = await orchestrator.execute(options);

  // Emit completion event
  emitPipelineEvent({
    component: 'pipeline',
    operation: 'phase8_completed',
    status: result.success ? 'success' : 'error',
    metadata: {
      slug: cliOptions.slug,
      success: result.success,
      exitCode: result.exitCode,
      chaptersGenerated: result.chaptersGenerated,
      totalWords: result.totalWords,
      totalCitations: result.totalCitations,
      warningCount: result.warnings.length,
      errorCount: result.errors.length
    }
  });

  // Verbose output for success/failure
  if (cliOptions.verbose) {
    console.error(''); // Newline after progress dots

    if (result.success) {
      console.error('='.repeat(60));
      console.error('[SUCCESS] Final paper generated');
      console.error('='.repeat(60));
      console.error('');
      console.error(`  Output: ${result.outputPath}`);
      console.error(`  Total words: ${result.totalWords?.toLocaleString() ?? 0}`);
      console.error(`  Total citations: ${result.totalCitations ?? 0}`);
      console.error(`  Chapters generated: ${result.chaptersGenerated}`);

      // Show phase timings
      const phaseTimings = orchestrator.getPhaseTimings();
      if (Object.keys(phaseTimings).length > 0) {
        console.error('');
        console.error('Phase Timings:');
        for (const [key, value] of Object.entries(phaseTimings)) {
          if (key.endsWith('_duration')) {
            const phaseName = key.replace('_duration', '');
            console.error(`  ${phaseName}: ${formatDuration(value)}`);
          }
        }
      }

      // Show token usage
      const tokenBudget = orchestrator.getTokenBudget();
      if (tokenBudget) {
        console.error('');
        console.error(`Token Usage: ${tokenBudget.total.used.toLocaleString()} / ${tokenBudget.total.budget.toLocaleString()} (${tokenBudget.total.utilization})`);
      }

      if (result.warnings.length > 0) {
        console.error('');
        console.error(`Warnings (${result.warnings.length}):`);
        for (const warning of result.warnings) {
          console.error(`  - ${warning}`);
        }
      }
    } else {
      console.error('='.repeat(60));
      console.error(`[FAILED] Exit code: ${result.exitCode}`);
      console.error('='.repeat(60));
      for (const err of result.errors) {
        console.error(`  Error: ${err}`);
      }
    }
  } else if (!cliOptions.verbose) {
    // End the dots line for non-verbose mode
    console.log('');
  }

  return result;
}

/**
 * Generate synthesis prompts for Claude Code to spawn chapter-synthesizer agents
 *
 * This is the PREFERRED method for high-quality chapter generation.
 * Instead of basic concatenation, it outputs prompts that Claude Code
 * uses to spawn the chapter-synthesizer agent for each chapter.
 *
 * @param cliOptions - Command line options
 * @returns Array of synthesis prompts for Claude Code Task tool
 */
async function commandGeneratePrompts(
  cliOptions: FinalizeCliOptions
): Promise<import('./final-stage/chapter-writer-agent.js').ChapterSynthesisPrompt[]> {
  const basePath = process.cwd();
  const threshold = parseFloat(cliOptions.threshold ?? '0.30');

  if (isNaN(threshold) || threshold < 0 || threshold > 1) {
    throw new Error('Threshold must be a number between 0 and 1');
  }

  console.error('[Phase 8 - Generate Prompts] Initializing...');

  // Find session to get style profile ID
  const sessionManager = new SessionManager();
  const sessions = await sessionManager.listSessions();
  const matchingSession = sessions.find(
    (s: { slug?: string; query?: string; styleProfileId?: string }) =>
      s.slug === cliOptions.slug ||
      s.query?.toLowerCase().includes(cliOptions.slug.toLowerCase().replace(/-/g, ' '))
  );

  // Use explicitly passed style profile, or fall back to session lookup
  const styleProfileId = cliOptions.styleProfile || matchingSession?.styleProfileId;
  if (styleProfileId) {
    const source = cliOptions.styleProfile ? 'CLI option' : 'session';
    console.error(`[Phase 8] Using style profile: ${styleProfileId} (from ${source})`);
  } else {
    console.error('[Phase 8] WARNING: No style profile found - using UK English defaults');
  }

  // Create orchestrator (styleProfileId passed to execute())
  const orchestrator = new FinalStageOrchestrator(
    basePath,
    cliOptions.slug
  );

  // Initialize and run scanning/mapping phases
  console.error('[Phase 8] Scanning and mapping research outputs...');
  // Run dry-run mode which executes SCANNING -> SUMMARIZING -> MAPPING phases
  // This populates the cached structure, summaries, and mapping
  const dryRunResult = await orchestrator.execute({
    dryRun: true,
    force: cliOptions.force ?? false,
    verbose: cliOptions.verbose ?? false,
    threshold,
    styleProfileId
  });

  if (!dryRunResult.success) {
    throw new Error(`Dry run failed: ${dryRunResult.errors?.join(', ') || 'unknown error'}`);
  }

  // Get the internal data we need
  const structure = orchestrator.getChapterStructure();
  const summaries = orchestrator.getSummaries();
  const mapping = orchestrator.getMapping();

  if (!structure || !summaries || !mapping) {
    throw new Error('Failed to initialize - missing structure, summaries, or mapping');
  }

  // Generate synthesis prompts
  console.error(`[Phase 8] Generating ${structure.totalChapters} synthesis prompts...`);
  const prompts = await orchestrator.generateSynthesisPrompts(structure, summaries, mapping);

  console.error('[Phase 8] Prompts generated successfully');
  console.error('');
  console.error('Use these prompts with Claude Code Task tool to spawn chapter-synthesizer agents.');

  return prompts;
}

/**
 * Handle finalize command errors with appropriate exit codes
 * Per CONSTITUTION Appendix B
 */
function handleFinalizeError(error: unknown): never {
  const err = error as Error;

  // Map error messages to exit codes per CONSTITUTION Appendix B
  let exitCode = 1; // Default: GENERAL_ERROR

  if (err.message.includes('Security') || err.message.includes('Invalid research slug')) {
    exitCode = 6; // SECURITY_VIOLATION
  } else if (err.message.includes('not found') || err.message.includes('missing')) {
    exitCode = 2; // MISSING_FILES
  } else if (err.message.includes('Token') || err.message.includes('overflow')) {
    exitCode = 3; // TOKEN_OVERFLOW
  } else if (err.message.includes('mapping') || err.message.includes('zero sources')) {
    exitCode = 4; // MAPPING_FAILURE
  } else if (err.message.includes('validation') || err.message.includes('quality')) {
    exitCode = 5; // VALIDATION_FAILURE
  } else if (err.message.includes('Constitution') || err.message.includes('DI-') || err.message.includes('FS-')) {
    exitCode = 7; // CONSTITUTION_VIOLATION
  }

  console.error(JSON.stringify({
    error: err.message,
    exitCode,
    suggestion: exitCode === 2
      ? 'Ensure research directory exists with 05-chapter-structure.md'
      : exitCode === 6
      ? 'Slug must be lowercase alphanumeric with dashes only'
      : 'Check logs for details'
  }));

  process.exit(exitCode);
}

/**
 * Handle CLI errors
 */
function handleError(error: unknown): never {
  const err = error as Error;

  // Handle specific error types
  if (err instanceof SessionNotFoundError) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }

  if (err instanceof SessionExpiredError) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }

  if (err instanceof SessionCorruptedError) {
    console.error(JSON.stringify({
      error: err.message,
      suggestion: 'Delete session file manually or use phd-cli abort <session-id>'
    }));
    process.exit(1);
  }

  if (err instanceof AgentMismatchError) {
    console.error(JSON.stringify({
      error: err.message,
      expected: err.expected,
      got: err.got,
      suggestion: 'Use phd-cli status <session-id> to verify current agent'
    }));
    process.exit(1);
  }

  // Unknown error
  const response: ErrorResponse = {
    error: err.message
  };
  console.error(JSON.stringify(response));
  process.exit(1);
}

// Export for testing
export {
  commandInit,
  commandNext,
  commandComplete,
  commandStatus,
  commandList,
  commandResume,
  commandAbort,
  commandFinalize,
  determineStyleProfile,
  loadStyleProfile,
  generatePipelineId,
  generateSlug
};

// Run if called directly (not when imported as a module)
// Check if this is the main module using import.meta.url
const isMainModule = process.argv[1] &&
  (process.argv[1].endsWith('phd-cli.ts') ||
   process.argv[1].endsWith('phd-cli.js') ||
   process.argv[1].includes('phd-cli'));

if (isMainModule) {
  program.parse(process.argv);
}
