/**
 * Phase 8B Style Validator
 *
 * Validates that generated text matches the learned style profile.
 * Implements GAP-LLM01 from the gap analysis recommendations.
 *
 * This module provides:
 * - Style metric extraction from text
 * - Comparison against learned style profiles
 * - Validation scoring with detailed feedback
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Metrics extracted from text for style comparison
 */
export interface StyleMetrics {
  /** Average sentence length in words */
  avgSentenceLength: number;
  /** Average word length in characters */
  avgWordLength: number;
  /** Vocabulary diversity (unique words / total words) */
  vocabularyDiversity: number;
  /** Passive voice ratio (0.0 - 1.0) */
  passiveVoiceRatio: number;
  /** Average paragraph length in sentences */
  avgParagraphLength: number;
  /** Ratio of complex sentences (with subordinate clauses) */
  complexSentenceRatio: number;
  /** Formality score (0.0 = informal, 1.0 = formal) */
  formalityScore: number;
  /** Academic vocabulary ratio */
  academicVocabularyRatio: number;
  /** First person usage ratio */
  firstPersonRatio: number;
  /** Hedging language ratio */
  hedgingRatio: number;
}

/**
 * A learned style profile from Phase 8
 */
export interface StyleProfile {
  /** Profile identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Target metrics (with acceptable ranges) */
  targetMetrics: StyleMetrics;
  /** Tolerance for each metric (% deviation allowed) */
  tolerance: Partial<Record<keyof StyleMetrics, number>>;
  /** Required style characteristics */
  requiredCharacteristics?: string[];
  /** Forbidden patterns */
  forbiddenPatterns?: RegExp[];
}

/**
 * Result of style validation
 */
export interface StyleValidationResult {
  /** Overall pass/fail */
  isValid: boolean;
  /** Overall score (0.0 - 1.0) */
  overallScore: number;
  /** Individual metric scores */
  metricScores: Record<keyof StyleMetrics, {
    actual: number;
    target: number;
    score: number;
    withinTolerance: boolean;
  }>;
  /** Detailed feedback */
  feedback: string[];
  /** Suggestions for improvement */
  suggestions: string[];
}

// ============================================================================
// Constants
// ============================================================================

/** Default tolerance for style metrics (20%) */
const DEFAULT_TOLERANCE = 0.2;

/** Academic vocabulary indicators */
const ACADEMIC_VOCABULARY = new Set([
  'furthermore', 'moreover', 'however', 'nevertheless', 'consequently',
  'therefore', 'thus', 'hence', 'accordingly', 'subsequently',
  'specifically', 'particularly', 'significantly', 'notably', 'importantly',
  'analysis', 'methodology', 'hypothesis', 'theoretical', 'empirical',
  'phenomenon', 'paradigm', 'conceptual', 'systematic', 'comprehensive',
  'demonstrate', 'indicate', 'suggest', 'imply', 'reveal',
  'examine', 'investigate', 'analyze', 'evaluate', 'assess'
]);

/** Hedging language indicators */
const HEDGING_WORDS = new Set([
  'may', 'might', 'could', 'would', 'should', 'possibly', 'probably',
  'perhaps', 'likely', 'potentially', 'apparently', 'seemingly',
  'suggests', 'indicates', 'appears', 'tends', 'seems'
]);

/** Informal vocabulary indicators */
const INFORMAL_VOCABULARY = new Set([
  'okay', 'ok', 'yeah', 'yep', 'nope', 'kinda', 'sorta', 'gonna', 'wanna',
  'stuff', 'thing', 'things', 'lot', 'lots', 'really', 'very', 'just',
  'basically', 'actually', 'literally', 'obviously', 'definitely'
]);

/** Passive voice indicators (simplified) */
const PASSIVE_PATTERNS = [
  /\b(is|are|was|were|been|being)\s+\w+ed\b/gi,
  /\b(is|are|was|were|been|being)\s+\w+en\b/gi
];

// ============================================================================
// Metric Extraction Functions
// ============================================================================

/**
 * Extract style metrics from text.
 *
 * @param text - The text to analyze
 * @returns StyleMetrics object
 */
export function extractStyleMetrics(text: string): StyleMetrics {
  // Tokenize
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  const words: string[] = text.toLowerCase().match(/\b[a-z]+\b/g) || [];
  const uniqueWords = new Set(words);

  // Calculate metrics
  const avgSentenceLength = sentences.length > 0
    ? words.length / sentences.length
    : 0;

  const avgWordLength = words.length > 0
    ? words.reduce((sum: number, w: string) => sum + w.length, 0) / words.length
    : 0;

  const vocabularyDiversity = words.length > 0
    ? uniqueWords.size / words.length
    : 0;

  // Count passive voice occurrences
  let passiveCount = 0;
  for (const pattern of PASSIVE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      passiveCount += matches.length;
    }
  }
  const passiveVoiceRatio = sentences.length > 0
    ? Math.min(passiveCount / sentences.length, 1.0)
    : 0;

  const avgParagraphLength = paragraphs.length > 0
    ? sentences.length / paragraphs.length
    : 0;

  // Complex sentence ratio (sentences with commas, semicolons, or conjunctions)
  const complexCount = sentences.filter(s =>
    s.includes(',') || s.includes(';') ||
    /\b(because|although|while|whereas|since|unless|if|when)\b/i.test(s)
  ).length;
  const complexSentenceRatio = sentences.length > 0
    ? complexCount / sentences.length
    : 0;

  // Formality score based on vocabulary
  const academicCount = words.filter(w => ACADEMIC_VOCABULARY.has(w)).length;
  const informalCount = words.filter(w => INFORMAL_VOCABULARY.has(w)).length;
  const formalityScore = words.length > 0
    ? Math.min(1.0, (academicCount * 2 - informalCount) / words.length + 0.5)
    : 0.5;

  const academicVocabularyRatio = words.length > 0
    ? academicCount / words.length
    : 0;

  // First person usage
  const firstPersonWords = words.filter(w =>
    ['i', 'me', 'my', 'mine', 'we', 'us', 'our', 'ours'].includes(w)
  ).length;
  const firstPersonRatio = words.length > 0
    ? firstPersonWords / words.length
    : 0;

  // Hedging ratio
  const hedgingCount = words.filter(w => HEDGING_WORDS.has(w)).length;
  const hedgingRatio = words.length > 0
    ? hedgingCount / words.length
    : 0;

  return {
    avgSentenceLength,
    avgWordLength,
    vocabularyDiversity,
    passiveVoiceRatio,
    avgParagraphLength,
    complexSentenceRatio,
    formalityScore,
    academicVocabularyRatio,
    firstPersonRatio,
    hedgingRatio
  };
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Calculate score for a single metric.
 *
 * @param actual - Actual value
 * @param target - Target value
 * @param tolerance - Acceptable tolerance (0.0 - 1.0)
 * @returns Score between 0.0 and 1.0
 */
function calculateMetricScore(
  actual: number,
  target: number,
  tolerance: number
): number {
  if (target === 0) {
    return actual === 0 ? 1.0 : 0.0;
  }

  const deviation = Math.abs(actual - target) / target;
  if (deviation <= tolerance) {
    return 1.0 - (deviation / tolerance) * 0.5; // Score 0.5 - 1.0 within tolerance
  }
  return Math.max(0, 0.5 - (deviation - tolerance)); // Score 0.0 - 0.5 outside tolerance
}

/**
 * Validate text against a style profile.
 *
 * GAP-LLM01: Phase 8B style validation implementation
 *
 * @param text - The text to validate
 * @param profile - The style profile to validate against
 * @returns StyleValidationResult
 */
export function validateStyle(
  text: string,
  profile: StyleProfile
): StyleValidationResult {
  const actualMetrics = extractStyleMetrics(text);
  const targetMetrics = profile.targetMetrics;

  const metricScores: Record<keyof StyleMetrics, {
    actual: number;
    target: number;
    score: number;
    withinTolerance: boolean;
  }> = {} as any;

  const feedback: string[] = [];
  const suggestions: string[] = [];

  // Calculate score for each metric
  const metricKeys: (keyof StyleMetrics)[] = [
    'avgSentenceLength', 'avgWordLength', 'vocabularyDiversity',
    'passiveVoiceRatio', 'avgParagraphLength', 'complexSentenceRatio',
    'formalityScore', 'academicVocabularyRatio', 'firstPersonRatio',
    'hedgingRatio'
  ];

  let totalScore = 0;
  let validMetrics = 0;

  for (const key of metricKeys) {
    const actual = actualMetrics[key];
    const target = targetMetrics[key];
    const tolerance = profile.tolerance[key] ?? DEFAULT_TOLERANCE;

    const score = calculateMetricScore(actual, target, tolerance);
    const withinTolerance = score >= 0.5;

    metricScores[key] = { actual, target, score, withinTolerance };
    totalScore += score;
    validMetrics++;

    // Generate feedback for metrics outside tolerance
    if (!withinTolerance) {
      const direction = actual > target ? 'higher' : 'lower';
      feedback.push(
        `${key}: actual ${actual.toFixed(2)} is ${direction} than target ${target.toFixed(2)}`
      );

      // Generate suggestions
      switch (key) {
        case 'avgSentenceLength':
          suggestions.push(
            actual > target
              ? 'Consider breaking long sentences into shorter ones'
              : 'Consider combining short sentences for better flow'
          );
          break;
        case 'passiveVoiceRatio':
          suggestions.push(
            actual > target
              ? 'Reduce passive voice usage for more direct writing'
              : 'Consider using more passive constructions for formality'
          );
          break;
        case 'formalityScore':
          suggestions.push(
            actual > target
              ? 'Consider using more accessible language'
              : 'Use more formal and academic vocabulary'
          );
          break;
        case 'firstPersonRatio':
          suggestions.push(
            actual > target
              ? 'Reduce first-person pronouns for objectivity'
              : 'Consider adding personal voice where appropriate'
          );
          break;
        case 'hedgingRatio':
          suggestions.push(
            actual > target
              ? 'Be more assertive in claims where evidence supports'
              : 'Add hedging language to qualify uncertain claims'
          );
          break;
      }
    }
  }

  // Check forbidden patterns
  if (profile.forbiddenPatterns) {
    for (const pattern of profile.forbiddenPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        feedback.push(`Forbidden pattern found: "${matches[0]}"`);
        totalScore -= 0.1; // Penalty for forbidden patterns
      }
    }
  }

  const overallScore = Math.max(0, Math.min(1, totalScore / validMetrics));
  const isValid = overallScore >= 0.7; // 70% threshold for passing

  return {
    isValid,
    overallScore,
    metricScores,
    feedback,
    suggestions: Array.from(new Set(suggestions)) // Remove duplicates
  };
}

/**
 * Create a default academic style profile.
 */
export function createAcademicStyleProfile(): StyleProfile {
  return {
    id: 'academic-default',
    name: 'Default Academic Style',
    targetMetrics: {
      avgSentenceLength: 20,       // 20 words per sentence
      avgWordLength: 5.5,          // Slightly longer words
      vocabularyDiversity: 0.6,    // 60% unique words
      passiveVoiceRatio: 0.2,      // 20% passive voice
      avgParagraphLength: 5,       // 5 sentences per paragraph
      complexSentenceRatio: 0.5,   // 50% complex sentences
      formalityScore: 0.75,        // High formality
      academicVocabularyRatio: 0.05, // 5% academic words
      firstPersonRatio: 0.01,      // Minimal first person
      hedgingRatio: 0.02           // Some hedging
    },
    tolerance: {
      avgSentenceLength: 0.3,      // 30% tolerance
      avgWordLength: 0.2,
      vocabularyDiversity: 0.2,
      passiveVoiceRatio: 0.5,      // Higher tolerance for passive
      avgParagraphLength: 0.4,
      complexSentenceRatio: 0.3,
      formalityScore: 0.2,
      academicVocabularyRatio: 0.5,
      firstPersonRatio: 1.0,       // Very tolerant
      hedgingRatio: 0.5
    },
    forbiddenPatterns: [
      /\b(gonna|wanna|kinda|sorta)\b/gi,
      /\b(stuff|things)\b/gi,
      /!{2,}/g  // Multiple exclamation marks
    ]
  };
}

/**
 * Format validation result for display.
 *
 * @param result - The validation result
 * @returns Formatted markdown string
 */
export function formatValidationResult(result: StyleValidationResult): string {
  const status = result.isValid ? 'PASS' : 'FAIL';
  const scorePercent = (result.overallScore * 100).toFixed(1);

  const lines = [
    '## Style Validation Result',
    '',
    `**Status**: ${status}`,
    `**Overall Score**: ${scorePercent}%`,
    '',
    '### Metric Details',
    '',
    '| Metric | Actual | Target | Score | Status |',
    '|--------|--------|--------|-------|--------|'
  ];

  for (const [key, value] of Object.entries(result.metricScores)) {
    const status = value.withinTolerance ? 'OK' : 'WARN';
    lines.push(
      `| ${key} | ${value.actual.toFixed(2)} | ${value.target.toFixed(2)} | ${(value.score * 100).toFixed(0)}% | ${status} |`
    );
  }

  if (result.feedback.length > 0) {
    lines.push('', '### Feedback', '');
    for (const item of result.feedback) {
      lines.push(`- ${item}`);
    }
  }

  if (result.suggestions.length > 0) {
    lines.push('', '### Suggestions', '');
    for (const item of result.suggestions) {
      lines.push(`- ${item}`);
    }
  }

  return lines.join('\n');
}
