#!/usr/bin/env node
/**
 * PhD Pipeline CLI - Guided orchestration tool
 * Implements REQ-PIPE-001 through REQ-PIPE-007
 */

import { Command } from 'commander';
import { v4 as uuidv4 } from 'uuid';
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

  // Build prompt with style injection (Phase 6 only) and query injection
  const prompt = await styleInjector.buildAgentPrompt(
    firstAgentConfig,
    styleProfile.metadata.id,
    query
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

  // Build prompt with style injection (Phase 6 only) and query injection
  let prompt = await styleInjector.buildAgentPrompt(
    agentConfig,
    session.styleProfileId,
    session.query
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
  let descInjectionResult: { episodesUsed: number; episodeIds: string[] } = { episodesUsed: 0, episodeIds: [] };
  try {
    const ucmClient = getUCMClient();
    if (await ucmClient.isHealthy()) {
      const injection = await ucmClient.injectSolutions(prompt, {
        threshold: 0.75,
        maxEpisodes: 3,
        agentType: agentConfig.key,
        metadata: {
          sessionId: session.sessionId,
          phase: agentConfig.phase,
          phaseName: getPhaseName(agentConfig.phase),
          agentIndex: session.currentAgentIndex,
          totalAgents,
        },
      });

      if (injection.episodesUsed > 0) {
        prompt = injection.augmentedPrompt;
        descInjectionResult = { episodesUsed: injection.episodesUsed, episodeIds: injection.episodeIds };

        if (options.verbose) {
          console.error(`[UCM-DESC] Injected ${injection.episodesUsed} prior solutions for ${agentConfig.key}`);
        }
      }
    }
  } catch (error) {
    // DESC injection is optional - continue without it
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

  return {
    success: true,
    nextAgent: nextAgentKey
  };
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

  // Build prompt with style injection and query injection
  const prompt = await styleInjector.buildAgentPrompt(
    agentConfig,
    session.styleProfileId,
    session.query
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
