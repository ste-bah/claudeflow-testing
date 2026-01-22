/**
 * Truth Protocol Type Definitions
 *
 * Interfaces, types, and constants for the Truth Protocol Verifier.
 *
 * @module src/god-agent/core/pipeline/truth-protocol-types
 * @see docs/god-agent-coding-pipeline/PRD-god-agent-coding-pipeline.md Section 2.3
 */
// ═════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═════════════════════════════════════════════════════════════════════════════
/** Minimum truth score to pass verification */
export const MIN_TRUTH_SCORE = 70;
/** Minimum percentage of claims that must be verified */
export const MIN_VERIFIED_PERCENTAGE = 80;
/** Maximum allowed hallucination risk score */
export const MAX_HALLUCINATION_RISK = 30;
/** Patterns indicating existence claims */
export const EXISTENCE_PATTERNS = [
    /(?:file|function|class|method|variable|module|package)\s+['"`]?(\w+)['"`]?\s+(?:exists?|is\s+(?:present|available|defined))/gi,
    /(?:there\s+is|we\s+have|contains?)\s+(?:a|an|the)\s+(\w+)/gi,
    /created?\s+(?:the\s+)?(?:file|function|class|method)\s+['"`]?(\w+)['"`]?/gi,
    /(?:implemented?|added?|wrote)\s+(?:the\s+)?(\w+)/gi,
];
/** Patterns indicating behavioral claims */
export const BEHAVIORAL_PATTERNS = [
    /(?:this|it|the\s+\w+)\s+(?:will|does|can|should|would)\s+(\w+)/gi,
    /(?:handles?|processes?|returns?|throws?|validates?)\s+/gi,
    /(?:when|if|after|before)\s+.{1,500}?\s+(?:then|it will|this will)/gi,
];
/** Patterns indicating quantitative claims */
export const QUANTITATIVE_PATTERNS = [
    /(\d+(?:\.\d+)?)\s*(?:%|percent|files?|functions?|lines?|tests?)/gi,
    /(?:all|every|no|none|most|some|few|many)\s+(\w+)/gi,
    /(?:increased?|decreased?|improved?)\s+(?:by\s+)?(\d+)/gi,
];
/** Patterns that may indicate hallucination */
export const HALLUCINATION_INDICATORS = [
    { pattern: /(?:the\s+)?file\s+['"`]([^'"`]+)['"`]\s+(?:contains?|has|includes?)/gi, type: 'NONEXISTENT_FILE' },
    { pattern: /(?:call|invoke|use)\s+(?:the\s+)?['"`]?(\w+)['"`]?\s*\(/gi, type: 'NONEXISTENT_FUNCTION' },
    { pattern: /(?:the\s+)?api\s+(?:endpoint\s+)?['"`]([^'"`]+)['"`]/gi, type: 'INVENTED_API' },
    { pattern: /output(?:s|ted)?\s*(?:is|was|:)\s*['"`]([^'"`]+)['"`]/gi, type: 'FABRICATED_OUTPUT' },
    { pattern: /(?:definitely|certainly|absolutely|always|never)\s+/gi, type: 'OVERCONFIDENT' },
    { pattern: /(?:because|since)\s+(?:it|this)\s+(?:is|was|does)/gi, type: 'CIRCULAR_REASONING' },
];
/** Words indicating low confidence or uncertainty */
export const UNCERTAINTY_INDICATORS = [
    'might', 'maybe', 'perhaps', 'possibly', 'could', 'should',
    'probably', 'likely', 'unlikely', 'uncertain', 'unclear',
    'appears', 'seems', 'suggests', 'indicates', 'implies',
];
/** Words indicating high confidence (may be overconfident) */
export const OVERCONFIDENCE_INDICATORS = [
    'definitely', 'certainly', 'absolutely', 'always', 'never',
    'guaranteed', 'impossible', 'must', 'obviously', 'clearly',
    'undoubtedly', 'unquestionably', 'perfect', 'flawless',
];
/** Base truth scores by claim type */
export const BASE_TRUTH_SCORES = {
    factual: 60,
    existence: 50,
    behavioral: 55,
    quantitative: 50,
    capability: 60,
    temporal: 65,
    causal: 55,
    comparative: 60,
    opinion: 80,
    unknown: 40,
};
/** Claim type weights for scoring */
export const CLAIM_TYPE_WEIGHTS = {
    factual: 1.5,
    existence: 1.4,
    behavioral: 1.2,
    quantitative: 1.3,
    capability: 1.1,
    temporal: 1.0,
    causal: 1.2,
    comparative: 1.0,
    opinion: 0.5,
    unknown: 0.3,
};
/** Severity scores for hallucination patterns */
export const SEVERITY_SCORES = {
    critical: 30,
    high: 20,
    medium: 10,
    low: 5,
};
/** Severity mapping for hallucination types */
export const HALLUCINATION_SEVERITY = {
    NONEXISTENT_FILE: 'critical',
    NONEXISTENT_FUNCTION: 'critical',
    INVENTED_API: 'high',
    FABRICATED_OUTPUT: 'critical',
    FALSE_CAPABILITY: 'high',
    PHANTOM_DEPENDENCY: 'high',
    CONTRADICTS_CONTEXT: 'high',
    IMPOSSIBLE_CLAIM: 'critical',
    OVERCONFIDENT: 'medium',
    KNOWLEDGE_CUTOFF: 'medium',
    CIRCULAR_REASONING: 'low',
};
/** Descriptions for hallucination types */
export const HALLUCINATION_DESCRIPTIONS = {
    NONEXISTENT_FILE: 'Claims a file exists that cannot be verified',
    NONEXISTENT_FUNCTION: 'References a function that may not exist',
    INVENTED_API: 'Describes an API endpoint that may not be real',
    FABRICATED_OUTPUT: 'Presents output that may be fabricated',
    FALSE_CAPABILITY: 'Claims a capability that may not exist',
    PHANTOM_DEPENDENCY: 'References a dependency that may not exist',
    CONTRADICTS_CONTEXT: 'Statement contradicts provided context',
    IMPOSSIBLE_CLAIM: 'Makes a logically impossible claim',
    OVERCONFIDENT: 'Uses overly confident language without basis',
    KNOWLEDGE_CUTOFF: 'May reference information beyond knowledge cutoff',
    CIRCULAR_REASONING: 'Uses circular reasoning to support claim',
};
/** Remediation suggestions for hallucination types */
export const HALLUCINATION_REMEDIATIONS = {
    NONEXISTENT_FILE: 'Verify file existence before referencing',
    NONEXISTENT_FUNCTION: 'Check function signatures in actual codebase',
    INVENTED_API: 'Reference only documented API endpoints',
    FABRICATED_OUTPUT: 'Include actual execution output or clearly mark as expected',
    FALSE_CAPABILITY: 'Verify capabilities against documentation',
    PHANTOM_DEPENDENCY: 'Check package.json or dependency list',
    CONTRADICTS_CONTEXT: 'Reconcile statement with provided context',
    IMPOSSIBLE_CLAIM: 'Review logical consistency of claim',
    OVERCONFIDENT: 'Use hedging language for uncertain claims',
    KNOWLEDGE_CUTOFF: 'Verify information currency',
    CIRCULAR_REASONING: 'Provide independent supporting evidence',
};
//# sourceMappingURL=truth-protocol-types.js.map