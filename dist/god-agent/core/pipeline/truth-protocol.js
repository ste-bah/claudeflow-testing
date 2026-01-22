/**
 * Truth Protocol Verifier - Validates agent outputs for truthfulness and evidence.
 *
 * Implements truth verification from PRD Section 2.3 (Sherlock-Holmes Integration):
 * 1. Track truth scores (0-100) for agent claims
 * 2. Flag unverifiable assertions
 * 3. Require evidence for critical claims
 * 4. Detect hallucination patterns
 * 5. Track confidence levels per claim
 *
 * @module src/god-agent/core/pipeline/truth-protocol
 * @see docs/god-agent-coding-pipeline/PRD-god-agent-coding-pipeline.md Section 2.3
 */
export { MIN_TRUTH_SCORE, MIN_VERIFIED_PERCENTAGE, MAX_HALLUCINATION_RISK, } from './truth-protocol-types.js';
import { MIN_TRUTH_SCORE, MIN_VERIFIED_PERCENTAGE, MAX_HALLUCINATION_RISK, EXISTENCE_PATTERNS, BEHAVIORAL_PATTERNS, QUANTITATIVE_PATTERNS, HALLUCINATION_INDICATORS, UNCERTAINTY_INDICATORS, OVERCONFIDENCE_INDICATORS, BASE_TRUTH_SCORES, CLAIM_TYPE_WEIGHTS, SEVERITY_SCORES, HALLUCINATION_SEVERITY, HALLUCINATION_DESCRIPTIONS, HALLUCINATION_REMEDIATIONS, } from './truth-protocol-types.js';
/**
 * Type guard to validate ISemanticContext structure
 */
function isSemanticContext(value) {
    if (!value || typeof value !== 'object')
        return false;
    const obj = value;
    return Array.isArray(obj.codeContext) &&
        typeof obj.totalResults === 'number' &&
        typeof obj.searchQuery === 'string';
}
/**
 * TruthProtocolVerifier - Validates agent outputs for truthfulness and evidence.
 *
 * @example
 * ```typescript
 * const verifier = new TruthProtocolVerifier();
 * const result = await verifier.verify(agentOutput, semanticContext);
 * if (!result.passed) {
 *   console.log('Issues:', result.issues);
 * }
 * ```
 */
export class TruthProtocolVerifier {
    minTruthScore;
    minVerifiedPercentage;
    maxHallucinationRisk;
    constructor(options) {
        this.minTruthScore = options?.minTruthScore ?? MIN_TRUTH_SCORE;
        this.minVerifiedPercentage = options?.minVerifiedPercentage ?? MIN_VERIFIED_PERCENTAGE;
        this.maxHallucinationRisk = options?.maxHallucinationRisk ?? MAX_HALLUCINATION_RISK;
    }
    /** Verify a single claim for truthfulness */
    verifyClaim(claim, evidence) {
        const id = `claim-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const type = this.determineClaimType(claim);
        const requiresEvidence = this.claimRequiresEvidence(type, claim);
        const flags = [];
        let truthScore = this.calculateBaseTruthScore(claim, type);
        const evidenceList = [];
        if (evidence) {
            const evidenceItem = this.parseEvidence(evidence);
            evidenceList.push(evidenceItem);
            truthScore = Math.min(100, truthScore + evidenceItem.strength * 20);
        }
        else if (requiresEvidence) {
            flags.push('MISSING_EVIDENCE');
            truthScore = Math.max(0, truthScore - 30);
        }
        if (this.hasUncertaintyIndicators(claim)) {
            flags.push('VAGUE');
            truthScore = Math.max(0, truthScore - 10);
        }
        if (this.hasOverconfidenceIndicators(claim)) {
            flags.push('OVERSTATED');
            truthScore = Math.max(0, truthScore - 15);
        }
        const isVerifiable = !['opinion', 'unknown'].includes(type);
        if (!isVerifiable)
            flags.push('UNVERIFIABLE');
        return {
            id, statement: claim, type, truthScore,
            confidence: this.calculateClaimConfidence(truthScore, flags, evidenceList),
            evidence: evidenceList, isVerifiable, requiresEvidence, flags,
        };
    }
    /** Detect hallucination patterns in agent output */
    detectHallucinations(output, context) {
        const patterns = [];
        const suspectedClaims = [];
        let totalRisk = 0;
        for (const { pattern, type } of HALLUCINATION_INDICATORS) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(output)) !== null) {
                const severity = HALLUCINATION_SEVERITY[type];
                if (context && type === 'NONEXISTENT_FILE') {
                    const claimedFile = match[1];
                    const exists = context.codeContext.some(c => c.filePath.includes(claimedFile) || c.content.includes(claimedFile));
                    if (!exists) {
                        patterns.push({
                            type, description: HALLUCINATION_DESCRIPTIONS[type],
                            evidence: match[0], severity, affectedClaims: [],
                        });
                        suspectedClaims.push(match[0]);
                        totalRisk += SEVERITY_SCORES[severity];
                    }
                }
                else if (type === 'OVERCONFIDENT' || type === 'CIRCULAR_REASONING') {
                    patterns.push({
                        type, description: HALLUCINATION_DESCRIPTIONS[type],
                        evidence: match[0], severity, affectedClaims: [],
                    });
                    totalRisk += SEVERITY_SCORES[severity];
                }
            }
        }
        if (context && context.codeContext.length > 0) {
            const contradictions = this.findContextContradictions(output, context);
            patterns.push(...contradictions);
            totalRisk += contradictions.length * 15;
        }
        return {
            detected: patterns.length > 0,
            riskScore: Math.min(100, totalRisk),
            patterns, suspectedClaims,
            confidence: context?.codeContext.length ? (patterns.length === 0 ? 'HIGH' : 'MEDIUM') : 'LOW',
        };
    }
    /** Calculate truth score from an array of claims */
    calculateTruthScore(claims) {
        if (claims.length === 0)
            return 100;
        let weightedSum = 0, totalWeight = 0;
        for (const claim of claims) {
            const weight = CLAIM_TYPE_WEIGHTS[claim.type] || 1.0;
            weightedSum += claim.truthScore * weight;
            totalWeight += weight;
        }
        return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
    }
    /** Perform complete truth verification on agent output */
    verify(agentOutput, context) {
        const semanticContext = isSemanticContext(context) ? context : undefined;
        const extractedClaims = this.extractClaims(agentOutput);
        const claims = extractedClaims.map(c => this.verifyClaim(c.text, c.evidence));
        const hallucinationResult = this.detectHallucinations(agentOutput, semanticContext);
        this.linkHallucinationsToClaims(hallucinationResult, claims);
        const statistics = this.calculateStatistics(claims);
        let overallTruthScore = this.calculateTruthScore(claims);
        overallTruthScore = Math.max(0, overallTruthScore - (hallucinationResult.riskScore * 0.3));
        const verifiedPercentage = statistics.totalClaims > 0
            ? (statistics.verifiedClaims / statistics.totalClaims) * 100 : 100;
        const passed = overallTruthScore >= this.minTruthScore &&
            verifiedPercentage >= this.minVerifiedPercentage &&
            hallucinationResult.riskScore <= this.maxHallucinationRisk;
        return {
            passed, overallTruthScore: Math.round(overallTruthScore),
            claims, hallucinationResult, statistics,
            verdict: this.determineVerdict(passed, overallTruthScore, hallucinationResult),
            confidence: this.determineConfidence(claims, hallucinationResult),
            evidence: this.generateEvidence(claims, hallucinationResult),
            issues: this.generateIssues(claims, hallucinationResult),
            timestamp: new Date().toISOString(),
            recommendations: this.generateRecommendations(claims, hallucinationResult, statistics),
        };
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE METHODS
    // ═══════════════════════════════════════════════════════════════════════════
    determineClaimType(claim) {
        const claimLower = claim.toLowerCase();
        for (const p of EXISTENCE_PATTERNS) {
            p.lastIndex = 0;
            if (p.test(claim))
                return 'existence';
        }
        for (const p of BEHAVIORAL_PATTERNS) {
            p.lastIndex = 0;
            if (p.test(claim))
                return 'behavioral';
        }
        for (const p of QUANTITATIVE_PATTERNS) {
            p.lastIndex = 0;
            if (p.test(claim))
                return 'quantitative';
        }
        if (/(?:should|recommend|suggest|prefer|best|better|worse|opinion)/i.test(claimLower))
            return 'opinion';
        if (/(?:can|able|capable|supports?|allows?)/i.test(claimLower))
            return 'capability';
        if (/(?:before|after|during|when|while|until|since)/i.test(claimLower))
            return 'temporal';
        if (/(?:because|therefore|causes?|results?\s+in|leads?\s+to)/i.test(claimLower))
            return 'causal';
        if (/(?:faster|slower|better|worse|more|less|than|compared)/i.test(claimLower))
            return 'comparative';
        if (/(?:is|are|was|were|has|have)\s+/i.test(claimLower))
            return 'factual';
        return 'unknown';
    }
    claimRequiresEvidence(type, claim) {
        const criticalTypes = ['factual', 'existence', 'quantitative'];
        if (criticalTypes.includes(type))
            return true;
        if (/(?:successfully|verified|confirmed|tested|proved)/i.test(claim))
            return true;
        return false;
    }
    calculateBaseTruthScore(claim, type) {
        let score = BASE_TRUTH_SCORES[type] || 50;
        score += this.measureSpecificity(claim) * 10;
        if (this.hasAppropriateHedging(claim, type))
            score += 5;
        return Math.min(100, Math.max(0, score));
    }
    measureSpecificity(claim) {
        let s = 0;
        if (/['"`][\w./]+['"`]/.test(claim))
            s += 0.3;
        if (/\d+/.test(claim))
            s += 0.2;
        if (/[\w/]+\.\w+/.test(claim))
            s += 0.3;
        if (/\w+\(.*?\)/.test(claim))
            s += 0.2;
        return Math.min(1, s);
    }
    hasAppropriateHedging(claim, type) {
        const claimLower = claim.toLowerCase();
        if (type === 'opinion')
            return UNCERTAINTY_INDICATORS.some(w => claimLower.includes(w));
        if (type === 'factual' || type === 'existence') {
            return UNCERTAINTY_INDICATORS.filter(w => claimLower.includes(w)).length <= 1;
        }
        return true;
    }
    parseEvidence(evidence) {
        let type = 'context_provided', strength = 0.5;
        if (/(?:file|path):/i.test(evidence)) {
            type = 'file_exists';
            strength = 0.8;
        }
        else if (/(?:code|function|class):/i.test(evidence)) {
            type = 'code_reference';
            strength = 0.9;
        }
        else if (/(?:test|spec):/i.test(evidence)) {
            type = 'test_result';
            strength = 0.95;
        }
        else if (/(?:doc|documentation):/i.test(evidence)) {
            type = 'documentation';
            strength = 0.6;
        }
        return { type, source: 'provided', content: evidence, strength };
    }
    hasUncertaintyIndicators(claim) {
        const l = claim.toLowerCase();
        return UNCERTAINTY_INDICATORS.filter(w => l.includes(w)).length >= 2;
    }
    hasOverconfidenceIndicators(claim) {
        const l = claim.toLowerCase();
        return OVERCONFIDENCE_INDICATORS.some(w => l.includes(w));
    }
    calculateClaimConfidence(score, flags, evidence) {
        let c = score >= 80 ? 'HIGH' : score >= 60 ? 'MEDIUM' : score >= 40 ? 'LOW' : 'NONE';
        if (flags.includes('HALLUCINATION') || flags.includes('MISSING_EVIDENCE')) {
            c = c === 'HIGH' ? 'MEDIUM' : c === 'MEDIUM' ? 'LOW' : 'NONE';
        }
        if (evidence.some(e => e.strength >= 0.9) && c !== 'HIGH') {
            c = c === 'LOW' ? 'MEDIUM' : c === 'MEDIUM' ? 'HIGH' : c;
        }
        return c;
    }
    findContextContradictions(output, context) {
        const patterns = [];
        const p = /(?:the\s+)?file\s+['"`]([^'"`]+)['"`]\s+(?:does not|doesn't|has no)/gi;
        let m;
        while ((m = p.exec(output)) !== null) {
            if (context.codeContext.some(c => c.filePath.includes(m[1]))) {
                patterns.push({
                    type: 'CONTRADICTS_CONTEXT',
                    description: `Claims "${m[1]}" is missing but it exists in context`,
                    evidence: m[0], severity: 'high', affectedClaims: [],
                });
            }
        }
        return patterns;
    }
    extractClaims(output) {
        const claims = [];
        for (const s of output.split(/(?<=[.!?])\s+/)) {
            const t = s.trim();
            if (t.length < 10 || /^#|^\*|^-\s*$/i.test(t) || t.endsWith('?'))
                continue;
            if (/^(?:please|try|make sure|remember|note)/i.test(t))
                continue;
            if (/(?:is|are|was|were|has|have|does|did|will|can|should|contains?|exists?|creates?|returns?)/i.test(t)) {
                claims.push({ text: t });
            }
        }
        return claims;
    }
    linkHallucinationsToClaims(result, claims) {
        for (const p of result.patterns) {
            for (const c of claims) {
                if (c.statement.toLowerCase().includes(p.evidence.toLowerCase().slice(0, 30))) {
                    p.affectedClaims.push(c.id);
                    if (!c.flags.includes('HALLUCINATION')) {
                        c.flags.push('HALLUCINATION');
                        c.truthScore = Math.max(0, c.truthScore - 40);
                    }
                }
            }
        }
    }
    calculateStatistics(claims) {
        const claimTypeDistribution = {
            factual: 0, existence: 0, behavioral: 0, quantitative: 0, capability: 0,
            temporal: 0, causal: 0, comparative: 0, opinion: 0, unknown: 0,
        };
        const flagDistribution = {
            UNVERIFIABLE: 0, MISSING_EVIDENCE: 0, HALLUCINATION: 0, VAGUE: 0,
            CONTRADICTORY: 0, UNSUPPORTED: 0, STALE: 0, ASSUMPTION: 0, OVERSTATED: 0,
        };
        let verifiedClaims = 0, flaggedClaims = 0, unverifiableClaims = 0, evidencedClaims = 0, totalScore = 0;
        for (const c of claims) {
            claimTypeDistribution[c.type]++;
            for (const f of c.flags)
                flagDistribution[f]++;
            if (c.truthScore >= 70)
                verifiedClaims++;
            if (c.flags.length > 0)
                flaggedClaims++;
            if (!c.isVerifiable)
                unverifiableClaims++;
            if (c.evidence.length > 0)
                evidencedClaims++;
            totalScore += c.truthScore;
        }
        return {
            totalClaims: claims.length, verifiedClaims, flaggedClaims, unverifiableClaims, evidencedClaims,
            averageTruthScore: claims.length > 0 ? Math.round(totalScore / claims.length) : 0,
            claimTypeDistribution, flagDistribution,
        };
    }
    determineVerdict(passed, score, hal) {
        if (!passed) {
            if (hal.patterns.some(p => p.severity === 'critical') || score < 50)
                return 'GUILTY';
            return 'INSUFFICIENT_EVIDENCE';
        }
        return 'INNOCENT';
    }
    determineConfidence(claims, hal) {
        if (claims.length >= 5 && hal.riskScore < 10 &&
            claims.filter(c => c.confidence === 'HIGH').length >= claims.length * 0.6)
            return 'HIGH';
        if (claims.length >= 3 && hal.riskScore < 30)
            return 'MEDIUM';
        return 'LOW';
    }
    generateEvidence(claims, hal) {
        const evidence = [{
                type: 'truth_protocol_analysis',
                description: `Analyzed ${claims.length} claims with average truth score of ${claims.length > 0 ? Math.round(claims.reduce((s, c) => s + c.truthScore, 0) / claims.length) : 0}`,
                data: { totalClaims: claims.length, verifiedClaims: claims.filter(c => c.truthScore >= 70).length },
            }];
        if (hal.detected) {
            evidence.push({
                type: 'hallucination_detection',
                description: `Detected ${hal.patterns.length} potential hallucination patterns`,
                data: { riskScore: hal.riskScore, patterns: hal.patterns.map(p => ({ type: p.type, severity: p.severity })) },
            });
        }
        return evidence;
    }
    generateIssues(claims, hal) {
        const issues = [];
        for (const p of hal.patterns) {
            issues.push({
                severity: p.severity, category: 'hallucination',
                description: p.description, remediation: HALLUCINATION_REMEDIATIONS[p.type],
            });
        }
        for (const c of claims) {
            if (c.flags.includes('MISSING_EVIDENCE') && c.requiresEvidence) {
                issues.push({
                    severity: 'high', category: 'evidence',
                    description: `Claim requires evidence: "${c.statement.slice(0, 80)}..."`,
                    remediation: 'Provide supporting evidence such as file references, test results, or code snippets',
                });
            }
        }
        return issues;
    }
    generateRecommendations(claims, hal, stats) {
        const rec = [];
        if (hal.riskScore > 50)
            rec.push('High hallucination risk. Verify all existence claims against codebase.');
        if (stats.flagDistribution.MISSING_EVIDENCE > 0)
            rec.push(`${stats.flagDistribution.MISSING_EVIDENCE} claims need evidence.`);
        if (stats.flagDistribution.OVERSTATED > 0)
            rec.push('Some claims use overly confident language.');
        if (stats.unverifiableClaims > stats.totalClaims * 0.3)
            rec.push('Many claims are unverifiable.');
        if (stats.averageTruthScore < 60)
            rec.push('Overall truth score is low. Focus on verifiable facts.');
        return rec;
    }
}
/** Create a TruthProtocolVerifier with default settings */
export function createTruthProtocolVerifier() {
    return new TruthProtocolVerifier();
}
/** Create a TruthProtocolVerifier with custom thresholds */
export function createCustomTruthProtocolVerifier(options) {
    return new TruthProtocolVerifier(options);
}
//# sourceMappingURL=truth-protocol.js.map