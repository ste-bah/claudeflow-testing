/**
 * CodingQualityCalculator - Discriminating quality scoring for coding pipeline outputs
 * Produces quality scores in the 0.30-0.95 range based on 5 factors
 * Mirrors PhDQualityCalculator architecture adapted for code-specific metrics
 */

// ============================================================================
// Interfaces
// ============================================================================

export interface ICodingQualityContext {
  agentKey?: string;
  phase?: number;
  expectedMinLength?: number;
  isCriticalAgent?: boolean;
  isImplementationAgent?: boolean;
}

export interface ICodingQualityBreakdown {
  codeQuality: number;         // 0-0.30
  completeness: number;        // 0-0.25
  structuralIntegrity: number; // 0-0.20
  documentationScore: number;  // 0-0.15
  testCoverage: number;        // 0-0.10
  rawTotal: number;
  phaseWeight: number;
  total: number;
}

export interface ICodingQualityAssessment {
  score: number;
  breakdown: ICodingQualityBreakdown;
  meetsPatternThreshold: boolean;
  tier: 'excellent' | 'good' | 'adequate' | 'poor';
  summary: string;
}

export interface ICodingQualityCalculator {
  calculateQuality(output: unknown, context?: ICodingQualityContext): number;
  assessQuality(output: unknown, context?: ICodingQualityContext): ICodingQualityAssessment;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Phase-specific weight multipliers for the 7-phase coding pipeline
 */
export const CODING_PHASE_WEIGHTS: Record<number, number> = {
  1: 1.05,  // understanding: Slightly boosted for task analysis
  2: 1.00,  // exploration: Baseline
  3: 1.10,  // architecture: Important design phase
  4: 1.15,  // implementation: Most critical for code quality
  5: 1.10,  // testing: Important for coverage
  6: 1.05,  // optimization: Moderate importance
  7: 1.00,  // delivery: Baseline for docs/release
};

/**
 * Expected minimum output lengths for all 47 coding agents
 */
export const CODING_AGENT_MIN_LENGTHS: Record<string, number> = {
  // Phase 1: Understanding (6 agents)
  'task-analyzer': 500,
  'requirement-extractor': 800,
  'requirement-prioritizer': 600,
  'scope-definer': 600,
  'context-gatherer': 1000,
  'phase-1-reviewer': 400,

  // Phase 2: Exploration (5 agents)
  'codebase-analyzer': 1200,
  'pattern-explorer': 800,
  'technology-scout': 1000,
  'feasibility-analyzer': 700,
  'phase-2-reviewer': 400,

  // Phase 3: Architecture (8 agents)
  'system-designer': 1500,
  'component-designer': 1200,
  'interface-designer': 1000,
  'data-architect': 1000,
  'security-architect': 800,
  'integration-architect': 800,
  'performance-architect': 800,
  'phase-3-reviewer': 500,

  // Phase 4: Implementation (12 agents)
  'code-generator': 2000,
  'type-implementer': 800,
  'api-implementer': 1800,
  'frontend-implementer': 1500,
  'data-layer-implementer': 1200,
  'service-implementer': 1500,
  'unit-implementer': 1000,
  'error-handler-implementer': 800,
  'config-implementer': 600,
  'logger-implementer': 600,
  'dependency-manager': 500,
  'phase-4-reviewer': 500,

  // Phase 5: Testing (7 agents)
  'test-generator': 1500,
  'test-runner': 400,
  'integration-tester': 1200,
  'security-tester': 1000,
  'coverage-analyzer': 600,
  'regression-tester': 800,
  'phase-5-reviewer': 500,

  // Phase 6: Optimization (4 agents)
  'code-quality-improver': 1200,
  'performance-optimizer': 1200,
  'final-refactorer': 1000,
  'phase-6-reviewer': 500,

  // Phase 7: Delivery (3 agents)
  'implementation-coordinator': 800,
  'sign-off-approver': 400,
  'recovery-agent': 800,
};

/**
 * Tiered scoring based on code line count
 */
export const CODE_QUALITY_TIERS = [
  { minLines: 10, score: 0.02 },
  { minLines: 30, score: 0.05 },
  { minLines: 50, score: 0.08 },
  { minLines: 100, score: 0.12 },
  { minLines: 200, score: 0.18 },
  { minLines: 500, score: 0.24 },
  { minLines: 1000, score: 0.28 },
  { minLines: 2000, score: 0.30 },
] as const;

/**
 * Agents critical for pipeline success (reviewers, key decision makers)
 */
export const CRITICAL_CODING_AGENTS: string[] = [
  'task-analyzer',
  'system-designer',
  'sign-off-approver',
  'phase-1-reviewer',
  'phase-2-reviewer',
  'phase-3-reviewer',
  'phase-4-reviewer',
  'phase-5-reviewer',
  'phase-6-reviewer',
  'recovery-agent',
];

/**
 * Agents that produce actual implementation code
 */
export const IMPLEMENTATION_AGENTS: string[] = [
  'code-generator',
  'type-implementer',
  'api-implementer',
  'frontend-implementer',
  'data-layer-implementer',
  'service-implementer',
  'unit-implementer',
  'error-handler-implementer',
  'config-implementer',
  'logger-implementer',
  'test-generator',
  'integration-tester',
  'final-refactorer',
];

/**
 * Expected output patterns for each agent
 */
export const CODING_EXPECTED_OUTPUTS: Record<string, string[]> = {
  // Phase 1: Understanding
  'task-analyzer': ['requirements', 'constraints', 'scope', 'acceptance', 'criteria'],
  'requirement-extractor': ['functional', 'non-functional', 'requirement', 'priority', 'dependency'],
  'requirement-prioritizer': ['priority', 'critical', 'must-have', 'nice-to-have', 'ranking'],
  'scope-definer': ['in-scope', 'out-of-scope', 'boundary', 'deliverable', 'milestone'],
  'context-gatherer': ['codebase', 'architecture', 'dependency', 'pattern', 'constraint'],
  'phase-1-reviewer': ['review', 'approved', 'concern', 'recommendation', 'proceed'],

  // Phase 2: Exploration
  'codebase-analyzer': ['structure', 'pattern', 'dependency', 'module', 'architecture'],
  'pattern-explorer': ['pattern', 'design', 'implementation', 'example', 'recommendation'],
  'technology-scout': ['technology', 'library', 'framework', 'comparison', 'recommendation'],
  'feasibility-analyzer': ['feasible', 'risk', 'complexity', 'estimate', 'recommendation'],
  'phase-2-reviewer': ['review', 'approved', 'concern', 'recommendation', 'proceed'],

  // Phase 3: Architecture
  'system-designer': ['architecture', 'component', 'interface', 'diagram', 'design'],
  'component-designer': ['component', 'interface', 'dependency', 'responsibility', 'contract'],
  'interface-designer': ['interface', 'api', 'contract', 'signature', 'type'],
  'data-architect': ['schema', 'model', 'relationship', 'migration', 'index'],
  'security-architect': ['authentication', 'authorization', 'encryption', 'vulnerability', 'mitigation'],
  'integration-architect': ['integration', 'api', 'protocol', 'endpoint', 'contract'],
  'performance-architect': ['performance', 'optimization', 'caching', 'scaling', 'benchmark'],
  'phase-3-reviewer': ['review', 'approved', 'concern', 'recommendation', 'proceed'],

  // Phase 4: Implementation
  'code-generator': ['function', 'class', 'implementation', 'export', 'import'],
  'type-implementer': ['interface', 'type', 'generic', 'export', 'declaration'],
  'api-implementer': ['endpoint', 'handler', 'middleware', 'route', 'controller'],
  'frontend-implementer': ['component', 'render', 'state', 'props', 'hook'],
  'data-layer-implementer': ['repository', 'query', 'model', 'migration', 'connection'],
  'service-implementer': ['service', 'method', 'dependency', 'injection', 'interface'],
  'unit-implementer': ['test', 'describe', 'it', 'expect', 'mock'],
  'error-handler-implementer': ['try', 'catch', 'error', 'throw', 'handler'],
  'config-implementer': ['config', 'environment', 'setting', 'constant', 'export'],
  'logger-implementer': ['logger', 'log', 'level', 'format', 'transport'],
  'dependency-manager': ['package', 'dependency', 'version', 'install', 'update'],
  'phase-4-reviewer': ['review', 'approved', 'concern', 'recommendation', 'proceed'],

  // Phase 5: Testing
  'test-generator': ['describe', 'it', 'test', 'expect', 'coverage'],
  'test-runner': ['pass', 'fail', 'skip', 'result', 'summary'],
  'integration-tester': ['integration', 'test', 'scenario', 'expect', 'setup'],
  'security-tester': ['vulnerability', 'security', 'test', 'penetration', 'scan'],
  'coverage-analyzer': ['coverage', 'percentage', 'uncovered', 'branch', 'line'],
  'regression-tester': ['regression', 'test', 'comparison', 'baseline', 'result'],
  'phase-5-reviewer': ['review', 'approved', 'concern', 'recommendation', 'proceed'],

  // Phase 6: Optimization
  'code-quality-improver': ['refactor', 'quality', 'lint', 'smell', 'improvement'],
  'performance-optimizer': ['optimize', 'performance', 'benchmark', 'profiling', 'improvement'],
  'final-refactorer': ['refactor', 'cleanup', 'consolidate', 'simplify', 'improvement'],
  'phase-6-reviewer': ['review', 'approved', 'concern', 'recommendation', 'proceed'],

  // Phase 7: Delivery
  'implementation-coordinator': ['coordinate', 'integrate', 'merge', 'deploy', 'release'],
  'sign-off-approver': ['approved', 'ready', 'sign-off', 'complete', 'release'],
  'recovery-agent': ['recovery', 'rollback', 'fix', 'restore', 'retry'],
};

// ============================================================================
// CodingQualityCalculator Class
// ============================================================================

export class CodingQualityCalculator implements ICodingQualityCalculator {
  private readonly patternThreshold = 0.8;

  calculateQuality(output: unknown, context?: ICodingQualityContext): number {
    return this.assessQuality(output, context).score;
  }

  assessQuality(output: unknown, context?: ICodingQualityContext): ICodingQualityAssessment {
    const text = this.extractText(output);
    const codeQuality = this.calculateCodeQuality(text, context);
    const completeness = this.calculateCompleteness(text, context);
    const structuralIntegrity = this.calculateStructuralIntegrity(text);
    const documentationScore = this.calculateDocumentation(text);
    const testCoverage = this.calculateTestCoverage(text, context);

    const rawTotal = codeQuality + completeness + structuralIntegrity + documentationScore + testCoverage;
    const phaseWeight = CODING_PHASE_WEIGHTS[context?.phase ?? 4] ?? 1.0;
    const total = Math.min(0.95, rawTotal * phaseWeight);

    const breakdown: ICodingQualityBreakdown = {
      codeQuality,
      completeness,
      structuralIntegrity,
      documentationScore,
      testCoverage,
      rawTotal,
      phaseWeight,
      total,
    };

    const tier = this.determineTier(total);
    return {
      score: total,
      breakdown,
      tier,
      meetsPatternThreshold: total >= this.patternThreshold,
      summary: this.generateSummary(breakdown, context),
    };
  }

  /**
   * Calculate code quality factor (max 0.30)
   * - Code blocks: 0.08 (codeBlocks >= 1: +0.03, >= 3: +0.03, >= 5: +0.02)
   * - Functions/classes: 0.08 (funcCount >= 1: +0.02, >= 3: +0.02, >= 5: +0.02, >= 10: +0.02)
   * - Imports/exports: 0.06 (count >= 1: +0.02, >= 3: +0.02, >= 5: +0.02)
   * - Code length tiers: 0.08 (tiered based on line count)
   */
  private calculateCodeQuality(text: string, context?: ICodingQualityContext): number {
    let score = 0;

    // Code blocks detection (0.08 max)
    const codeBlockMatches = text.match(/```(?:typescript|ts|javascript|js|python|py|go|rust|java|c|cpp|csharp|sql|bash|sh|json|yaml|xml|html|css|scss)?[\s\S]*?```/g);
    const codeBlocks = codeBlockMatches ? codeBlockMatches.length : 0;
    if (codeBlocks >= 1) score += 0.03;
    if (codeBlocks >= 3) score += 0.03;
    if (codeBlocks >= 5) score += 0.02;

    // Functions/classes detection (0.08 max)
    const funcPatterns = [
      /(?:function|const|let|var)\s+\w+\s*(?:=\s*)?(?:\([^)]*\)|async\s*\([^)]*\))\s*(?:=>|{)/g,
      /(?:class|interface|type|enum)\s+\w+/g,
      /(?:public|private|protected|static|async)\s+\w+\s*\([^)]*\)/g,
      /def\s+\w+\s*\([^)]*\)/g,  // Python
      /func\s+\w+\s*\([^)]*\)/g,  // Go
    ];
    let funcCount = 0;
    for (const pattern of funcPatterns) {
      const matches = text.match(pattern);
      funcCount += matches ? matches.length : 0;
    }
    if (funcCount >= 1) score += 0.02;
    if (funcCount >= 3) score += 0.02;
    if (funcCount >= 5) score += 0.02;
    if (funcCount >= 10) score += 0.02;

    // Imports/exports detection (0.06 max)
    const importExportPatterns = [
      /^import\s+/gm,
      /^export\s+/gm,
      /^from\s+['"][^'"]+['"]\s+import/gm,
      /require\s*\(['"]/g,
      /module\.exports/g,
    ];
    let importExportCount = 0;
    for (const pattern of importExportPatterns) {
      const matches = text.match(pattern);
      importExportCount += matches ? matches.length : 0;
    }
    if (importExportCount >= 1) score += 0.02;
    if (importExportCount >= 3) score += 0.02;
    if (importExportCount >= 5) score += 0.02;

    // Code length tiers (0.08 max via CODE_QUALITY_TIERS, capped to 0.08)
    const codeLines = this.countCodeLines(text);
    let lengthScore = 0;
    for (const tier of CODE_QUALITY_TIERS) {
      if (codeLines >= tier.minLines) lengthScore = tier.score;
      else break;
    }
    // Scale tier score to max 0.08 (tiers go up to 0.30, we want max 0.08)
    score += Math.min(0.08, lengthScore * (0.08 / 0.30));

    // Implementation agent bonus (1.1x multiplier)
    if (context?.isImplementationAgent) {
      score *= 1.1;
    }

    return Math.min(0.30, score);
  }

  /**
   * Calculate completeness factor (max 0.25)
   * - Agent expected outputs: 0.10 (foundCount / expectedOutputs.length)
   * - Structural elements: 0.08 (export, import, code block types)
   * - Completion indicators: 0.04 (task complete, files created)
   * - Cross-references: 0.03
   */
  private calculateCompleteness(text: string, context?: ICodingQualityContext): number {
    let score = 0;
    const lowerText = text.toLowerCase();

    // Agent expected outputs (0.10 max)
    const expectedOutputs = context?.agentKey && CODING_EXPECTED_OUTPUTS[context.agentKey]
      ? CODING_EXPECTED_OUTPUTS[context.agentKey]
      : ['function', 'class', 'implementation', 'export', 'import'];
    const foundCount = expectedOutputs.filter(s => lowerText.includes(s)).length;
    score += (foundCount / expectedOutputs.length) * 0.10;

    // Structural elements (0.08 max)
    const structuralPatterns = [
      { pattern: /^export\s+/m, weight: 0.02 },
      { pattern: /^import\s+/m, weight: 0.02 },
      { pattern: /```typescript|```ts/i, weight: 0.02 },
      { pattern: /```javascript|```js/i, weight: 0.01 },
      { pattern: /interface\s+\w+|type\s+\w+\s*=/i, weight: 0.01 },
    ];
    for (const { pattern, weight } of structuralPatterns) {
      if (pattern.test(text)) score += weight;
    }

    // Completion indicators (0.04 max)
    const completionPatterns = [
      /task\s+complete/i,
      /implementation\s+complete/i,
      /files?\s+created/i,
      /files?\s+modified/i,
      /successfully\s+(implemented|created|generated)/i,
      /all\s+requirements?\s+met/i,
    ];
    const completionCount = completionPatterns.filter(p => p.test(text)).length;
    if (completionCount >= 1) score += 0.02;
    if (completionCount >= 3) score += 0.02;

    // Cross-references (0.03 max)
    const crossRefPatterns = [
      /see\s+(above|below|section|file)/i,
      /as\s+(mentioned|described|defined)\s+(above|earlier|previously)/i,
      /refer\s+to/i,
      /imports?\s+from/i,
      /extends|implements/i,
    ];
    const crossRefCount = crossRefPatterns.filter(p => p.test(text)).length;
    if (crossRefCount >= 1) score += 0.01;
    if (crossRefCount >= 2) score += 0.01;
    if (crossRefCount >= 3) score += 0.01;

    return Math.min(0.25, score);
  }

  /**
   * Calculate structural integrity factor (max 0.20)
   * - Type annotations: 0.06 (typeCount >= 3: +0.02, >= 10: +0.02, >= 20: +0.02)
   * - Error handling: 0.06 (errorCount >= 1: +0.02, >= 3: +0.02, >= 5: +0.02)
   * - Modularity: 0.04 (private/public, readonly/static, abstract)
   * - Design patterns: 0.04 (factory, builder, repository, etc.)
   */
  private calculateStructuralIntegrity(text: string): number {
    let score = 0;

    // Type annotations (0.06 max)
    const typePatterns = [
      /:\s*(?:string|number|boolean|any|void|null|undefined|object|never)/gi,
      /:\s*\w+(?:\[\])?(?:\s*\||\s*&)?/g,
      /interface\s+\w+/gi,
      /type\s+\w+\s*=/gi,
      /<\w+(?:,\s*\w+)*>/g,  // Generics
    ];
    let typeCount = 0;
    for (const pattern of typePatterns) {
      const matches = text.match(pattern);
      typeCount += matches ? matches.length : 0;
    }
    if (typeCount >= 3) score += 0.02;
    if (typeCount >= 10) score += 0.02;
    if (typeCount >= 20) score += 0.02;

    // Error handling (0.06 max)
    const errorPatterns = [
      /try\s*{/gi,
      /catch\s*\(/gi,
      /throw\s+(?:new\s+)?\w*Error/gi,
      /\.catch\s*\(/gi,
      /finally\s*{/gi,
      /if\s*\(\s*!?\w+\s*\)\s*throw/gi,
    ];
    let errorCount = 0;
    for (const pattern of errorPatterns) {
      const matches = text.match(pattern);
      errorCount += matches ? matches.length : 0;
    }
    if (errorCount >= 1) score += 0.02;
    if (errorCount >= 3) score += 0.02;
    if (errorCount >= 5) score += 0.02;

    // Modularity indicators (0.04 max)
    const modularityPatterns = [
      /\b(?:private|public|protected)\s+/gi,
      /\breadonly\s+/gi,
      /\bstatic\s+/gi,
      /\babstract\s+(?:class|method)/gi,
      /\boverride\s+/gi,
    ];
    let modularityCount = 0;
    for (const pattern of modularityPatterns) {
      const matches = text.match(pattern);
      modularityCount += matches ? matches.length : 0;
    }
    if (modularityCount >= 2) score += 0.02;
    if (modularityCount >= 5) score += 0.02;

    // Design patterns (0.04 max)
    const patternIndicators = [
      /factory/i,
      /builder/i,
      /repository/i,
      /service/i,
      /singleton/i,
      /observer/i,
      /strategy/i,
      /adapter/i,
      /facade/i,
      /decorator/i,
      /dependency\s*injection/i,
      /inversion\s*of\s*control/i,
    ];
    const patternCount = patternIndicators.filter(p => p.test(text)).length;
    if (patternCount >= 1) score += 0.02;
    if (patternCount >= 3) score += 0.02;

    return Math.min(0.20, score);
  }

  /**
   * Calculate documentation factor (max 0.15)
   * - JSDoc: 0.06 (/** *\/, @param, @returns)
   * - Inline comments: 0.04
   * - README sections: 0.03
   * - Markdown formatting: 0.02
   */
  private calculateDocumentation(text: string): number {
    let score = 0;

    // JSDoc comments (0.06 max)
    const jsdocPatterns = [
      /\/\*\*[\s\S]*?\*\//g,  // JSDoc blocks
      /@param\s+/gi,
      /@returns?\s+/gi,
      /@throws?\s+/gi,
      /@example/gi,
      /@description/gi,
    ];
    let jsdocCount = 0;
    for (const pattern of jsdocPatterns) {
      const matches = text.match(pattern);
      jsdocCount += matches ? matches.length : 0;
    }
    if (jsdocCount >= 1) score += 0.02;
    if (jsdocCount >= 3) score += 0.02;
    if (jsdocCount >= 6) score += 0.02;

    // Inline comments (0.04 max)
    const inlineComments = (text.match(/\/\/[^\n]+/g) || []).length;
    const blockComments = (text.match(/\/\*(?!\*)[\s\S]*?\*\//g) || []).length;
    const totalInlineComments = inlineComments + blockComments;
    if (totalInlineComments >= 2) score += 0.02;
    if (totalInlineComments >= 5) score += 0.02;

    // README sections (0.03 max)
    const readmePatterns = [
      /##?\s*(?:installation|usage|api|configuration|examples?)/i,
      /##?\s*(?:getting\s+started|quick\s+start)/i,
      /##?\s*(?:features?|overview|description)/i,
    ];
    const readmeCount = readmePatterns.filter(p => p.test(text)).length;
    if (readmeCount >= 1) score += 0.01;
    if (readmeCount >= 2) score += 0.01;
    if (readmeCount >= 3) score += 0.01;

    // Markdown formatting (0.02 max)
    const markdownPatterns = [
      /^#{1,6}\s+/m,           // Headers
      /\*\*[^*]+\*\*/,         // Bold
      /`[^`\n]+`/,             // Inline code
      /^\s*[-*]\s+/m,          // Lists
      /^\s*\d+\.\s+/m,         // Numbered lists
    ];
    const markdownCount = markdownPatterns.filter(p => p.test(text)).length;
    if (markdownCount >= 2) score += 0.01;
    if (markdownCount >= 4) score += 0.01;

    return Math.min(0.15, score);
  }

  /**
   * Calculate test coverage factor (max 0.10)
   * - Test patterns: 0.04 (describe, it, test, expect)
   * - Mock patterns: 0.03
   * - Coverage mentions: 0.02
   * - Testing agent bonus: 1.2x multiplier
   */
  private calculateTestCoverage(text: string, context?: ICodingQualityContext): number {
    let score = 0;

    // Test patterns (0.04 max)
    const testPatterns = [
      /\bdescribe\s*\(/gi,
      /\bit\s*\(/gi,
      /\btest\s*\(/gi,
      /\bexpect\s*\(/gi,
      /\bassert\s*[.(]/gi,
      /\bshould\s*[.(]/gi,
    ];
    let testCount = 0;
    for (const pattern of testPatterns) {
      const matches = text.match(pattern);
      testCount += matches ? matches.length : 0;
    }
    if (testCount >= 2) score += 0.02;
    if (testCount >= 5) score += 0.02;

    // Mock patterns (0.03 max)
    const mockPatterns = [
      /jest\.mock/gi,
      /vi\.mock/gi,
      /sinon\./gi,
      /\bmock\w*/gi,
      /\bspy\w*/gi,
      /\bstub\w*/gi,
    ];
    let mockCount = 0;
    for (const pattern of mockPatterns) {
      const matches = text.match(pattern);
      mockCount += matches ? matches.length : 0;
    }
    if (mockCount >= 1) score += 0.01;
    if (mockCount >= 3) score += 0.01;
    if (mockCount >= 5) score += 0.01;

    // Coverage mentions (0.02 max)
    const coveragePatterns = [
      /coverage/i,
      /\d+%\s*(?:covered|coverage)/i,
      /line\s*coverage/i,
      /branch\s*coverage/i,
      /statement\s*coverage/i,
    ];
    const coverageCount = coveragePatterns.filter(p => p.test(text)).length;
    if (coverageCount >= 1) score += 0.01;
    if (coverageCount >= 2) score += 0.01;

    // Testing agent bonus (1.2x multiplier)
    const testingAgents = ['test-generator', 'integration-tester', 'security-tester', 'regression-tester', 'coverage-analyzer'];
    if (context?.agentKey && testingAgents.includes(context.agentKey)) {
      score *= 1.2;
    }

    return Math.min(0.10, score);
  }

  /**
   * Extract text content from various output formats
   */
  private extractText(output: unknown): string {
    if (typeof output === 'string') return output;
    if (output === null || output === undefined) return '';
    if (typeof output === 'object') {
      const obj = output as Record<string, unknown>;
      for (const field of ['content', 'text', 'output', 'result', 'body', 'message', 'code']) {
        if (typeof obj[field] === 'string') return obj[field] as string;
      }
      if (obj.data && typeof obj.data === 'object') return this.extractText(obj.data);
      try { return JSON.stringify(output, null, 2); } catch { return ''; }
    }
    return String(output);
  }

  /**
   * Count lines of code (excluding empty lines and pure comments)
   */
  private countCodeLines(text: string): number {
    // Extract code from code blocks
    const codeBlockRegex = /```(?:typescript|ts|javascript|js|python|py|go|rust|java|c|cpp|csharp|sql|bash|sh)?[\s\S]*?```/g;
    const codeBlocks = text.match(codeBlockRegex) || [];

    let totalLines = 0;
    for (const block of codeBlocks) {
      // Remove the opening and closing ``` lines
      const codeContent = block.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
      const lines = codeContent.split('\n').filter(line => {
        const trimmed = line.trim();
        // Count non-empty lines that aren't pure comments
        return trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('#');
      });
      totalLines += lines.length;
    }

    // Also count inline code patterns if no code blocks found
    if (totalLines === 0) {
      const inlineCodePatterns = [
        /(?:function|const|let|var|class|interface|type|export|import)\s+\w+/g,
        /(?:if|else|for|while|switch|try|catch)\s*[({]/g,
        /return\s+/g,
      ];
      for (const pattern of inlineCodePatterns) {
        const matches = text.match(pattern);
        totalLines += matches ? matches.length : 0;
      }
    }

    return totalLines;
  }

  /**
   * Determine quality tier based on score
   */
  private determineTier(score: number): 'excellent' | 'good' | 'adequate' | 'poor' {
    if (score >= 0.85) return 'excellent';
    if (score >= 0.70) return 'good';
    if (score >= 0.50) return 'adequate';
    return 'poor';
  }

  /**
   * Generate human-readable quality summary
   */
  private generateSummary(breakdown: ICodingQualityBreakdown, context?: ICodingQualityContext): string {
    const tier = this.determineTier(breakdown.total);
    const factors = [
      { name: 'Code', value: breakdown.codeQuality, max: 0.30 },
      { name: 'Complete', value: breakdown.completeness, max: 0.25 },
      { name: 'Structure', value: breakdown.structuralIntegrity, max: 0.20 },
      { name: 'Docs', value: breakdown.documentationScore, max: 0.15 },
      { name: 'Tests', value: breakdown.testCoverage, max: 0.10 },
    ].sort((a, b) => (b.value / b.max) - (a.value / a.max));

    const parts = [
      `Quality: ${tier} (${(breakdown.total * 100).toFixed(1)}%)`,
      `Best: ${factors[0].name} (${(factors[0].value / factors[0].max * 100).toFixed(0)}%)`,
      `Weak: ${factors[4].name} (${(factors[4].value / factors[4].max * 100).toFixed(0)}%)`,
    ];
    if (context?.agentKey) parts.push(`Agent: ${context.agentKey}`);
    if (context?.phase) parts.push(`Phase: ${context.phase}`);
    return parts.join(' | ');
  }
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Singleton instance of CodingQualityCalculator
 */
export const codingQualityCalculator = new CodingQualityCalculator();

/**
 * Calculate quality score for coding pipeline output
 * @param output - The output to assess (string or object with content field)
 * @param context - Optional context including agent key and phase
 * @returns Quality score between 0 and 0.95
 */
export function calculateCodingQuality(output: unknown, context?: ICodingQualityContext): number {
  return codingQualityCalculator.calculateQuality(output, context);
}

/**
 * Perform full quality assessment with breakdown
 * @param output - The output to assess
 * @param context - Optional context including agent key and phase
 * @returns Full assessment including score, breakdown, tier, and summary
 */
export function assessCodingQuality(output: unknown, context?: ICodingQualityContext): ICodingQualityAssessment {
  return codingQualityCalculator.assessQuality(output, context);
}

/**
 * Create a quality context for a specific agent and phase
 * @param agentKey - The agent identifier
 * @param phase - Optional phase number (1-7)
 * @returns Populated context object
 */
export function createCodingQualityContext(agentKey: string, phase?: number): ICodingQualityContext {
  return {
    agentKey,
    phase,
    expectedMinLength: CODING_AGENT_MIN_LENGTHS[agentKey],
    isCriticalAgent: CRITICAL_CODING_AGENTS.includes(agentKey),
    isImplementationAgent: IMPLEMENTATION_AGENTS.includes(agentKey),
  };
}
