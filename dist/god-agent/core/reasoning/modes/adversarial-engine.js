/**
 * Adversarial Reasoning Engine
 * SPEC-RSN-002 Section 2.5 - Adversarial Reasoning Mode
 *
 * Implements failure mode and security vulnerability detection using:
 * - Shadow Vector Search for contradiction/vulnerability detection
 * - Causal inference for attack scenario generation
 * - Pattern matching for failure patterns and countermeasures
 *
 * Performance target: <180ms including shadow search
 */
import { AdvancedReasoningMode } from '../advanced-reasoning-types.js';
import { ShadowVectorSearch } from '../shadow-vector-search.js';
import { TaskType } from '../pattern-types.js';
// ==================== Adversarial Reasoning Engine ====================
/**
 * Adversarial Reasoning Engine
 *
 * Identifies security vulnerabilities, failure modes, and edge cases using
 * shadow vector search and causal inference.
 */
export class AdversarialEngine {
    vectorDB;
    causalMemory;
    patternMatcher;
    shadowSearch;
    constructor(deps) {
        this.vectorDB = deps.vectorDB;
        this.causalMemory = deps.causalMemory;
        this.patternMatcher = deps.patternMatcher;
        // Initialize shadow vector search with VectorDB adapter
        this.shadowSearch = new ShadowVectorSearch({ verbose: false });
        this.shadowSearch.setVectorStore(this.createVectorStoreAdapter());
    }
    /**
     * Perform adversarial reasoning to identify vulnerabilities and failure modes
     *
     * Algorithm:
     * 1. Parse target system/code from query
     * 2. Retrieve failure patterns and security anti-patterns
     * 3. Use Shadow Vector Search for contradiction/vulnerability detection
     * 4. Generate attack scenarios using causal inference
     * 5. Rank by severity and exploitability
     * 6. Optionally add countermeasures
     *
     * @param request Reasoning request
     * @param config Adversarial configuration
     * @returns Adversarial result with ranked contradictions/vulnerabilities
     */
    async reason(request, config) {
        const startTime = Date.now();
        // 1. Parse target from query
        const target = this.parseTarget(request);
        // 2. Find failure patterns
        const taskTypes = this.inferTaskTypes(config.threatModel ?? 'adversarial');
        const failurePatterns = await this.findFailurePatterns(request.query, taskTypes);
        // 3. Shadow vector search for contradictions/vulnerabilities
        const shadowOptions = {
            type: 'contradiction',
            threshold: config.severityThreshold ?? 0.3,
            k: config.maxContradictions ?? 10,
            includeHypothesisSimilarity: true,
        };
        const shadowContradictions = await this.shadowVectorSearch(request.query, shadowOptions);
        // 4. Generate attack scenarios
        const attackVectors = config.attackVectors ?? ['logical', 'empirical', 'semantic'];
        const attackScenarios = await this.generateAttackScenarios(target, attackVectors);
        // 5. Combine into threats and rank
        const threats = this.combineThreats(failurePatterns, shadowContradictions, attackScenarios);
        const rankedThreats = this.rankThreats(threats, config.severityThreshold ?? 0.3);
        // 6. Generate countermeasures if requested
        const countermeasures = config.includeCountermeasures !== false
            ? await this.generateCountermeasures(rankedThreats)
            : undefined;
        // 7. Convert to contradictions format
        const contradictions = this.toContradictions(rankedThreats, countermeasures);
        const elapsedTime = Date.now() - startTime;
        // Generate trajectory ID for tracking
        const trajectoryId = `traj_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        // Calculate overall confidence
        const confidence = this.calculateConfidence(rankedThreats);
        // Create provenance info
        const lScores = rankedThreats.map(t => t.threatScore);
        const combinedLScore = lScores.length > 0
            ? Math.pow(lScores.reduce((prod, score) => prod * score, 1), 1 / lScores.length)
            : 0;
        const provenanceInfo = {
            lScores,
            totalSources: rankedThreats.length,
            combinedLScore,
            sourceBreakdown: {
                patterns: failurePatterns.length,
                causal: attackScenarios.length,
                contextual: shadowContradictions.length,
            },
        };
        // Build result with all required IAdvancedReasoningResult fields
        return {
            // IAdvancedReasoningResult fields
            mode: AdvancedReasoningMode.ADVERSARIAL,
            answer: this.formatAdversarialReport(rankedThreats, target),
            reasoningSteps: this.generateReasoningSteps(rankedThreats, failurePatterns, attackScenarios),
            latencyMs: elapsedTime,
            confidence,
            // IReasoningResponse fields (from base interface)
            type: 'hybrid',
            patterns: [],
            causalInferences: [],
            trajectoryId,
            processingTimeMs: elapsedTime,
            provenanceInfo: provenanceInfo,
            // Mode-specific field
            contradictions,
        };
    }
    /**
     * Generate reasoning steps for adversarial analysis
     */
    generateReasoningSteps(threats, failurePatterns, attackScenarios) {
        return [
            `Analyzed ${failurePatterns.length} failure patterns from knowledge base`,
            `Generated ${attackScenarios.length} attack scenarios`,
            `Identified ${threats.length} potential threats`,
            `High severity threats: ${threats.filter(t => t.severity > 0.7).length}`,
            `Applied shadow vector search for contradiction detection`,
        ];
    }
    /**
     * Parse target system/code from query
     */
    parseTarget(request) {
        // For IReasoningRequest, query is a Float32Array (embedding)
        // We need to infer from metadata or use a generic description
        const taskTypeStr = request.taskType ? String(request.taskType) : 'system';
        let type = 'system';
        if (taskTypeStr.includes('code') || taskTypeStr.includes('debugging')) {
            type = 'code';
        }
        else if (taskTypeStr.includes('api')) {
            type = 'api';
        }
        else if (taskTypeStr.includes('design')) {
            type = 'design';
        }
        else if (taskTypeStr.includes('architecture')) {
            type = 'architecture';
        }
        return {
            type,
            description: `${type} analysis for ${taskTypeStr}`,
            embedding: request.query,
            metadata: { taskType: request.taskType },
        };
    }
    /**
     * Infer task types based on threat model
     */
    inferTaskTypes(threatModel) {
        // Map threat models to standard TaskTypes
        switch (threatModel) {
            case 'adversarial':
                return [TaskType.DEBUGGING, TaskType.TESTING, TaskType.ANALYSIS];
            case 'skeptical':
                return [TaskType.ANALYSIS, TaskType.DEBUGGING];
            case 'cooperative':
            default:
                return [TaskType.TESTING, TaskType.DEBUGGING];
        }
    }
    /**
     * Search for failure patterns and security anti-patterns
     */
    async findFailurePatterns(embedding, taskTypes) {
        const patterns = [];
        // Search for patterns of each type
        for (const taskType of taskTypes) {
            try {
                const results = await this.patternMatcher.findPatterns({
                    embedding,
                    taskType,
                    topK: 5,
                    minConfidence: 0.3,
                });
                // Convert pattern results to failure patterns
                for (const result of results) {
                    patterns.push({
                        id: result.pattern.id,
                        type: String(taskType),
                        description: result.pattern.template,
                        severity: this.inferSeverity(String(taskType), result.confidence),
                        causes: this.extractCauses(result.pattern.template),
                        embedding: result.pattern.embedding,
                    });
                }
            }
            catch (error) {
                // Pattern type might not exist, continue
                console.warn(`Failed to find patterns for ${taskType}:`, error);
            }
        }
        return patterns;
    }
    /**
     * Perform shadow vector search for contradictions
     * Shadow vector = original vector × -1 (semantic opposite)
     */
    async shadowVectorSearch(embedding, options) {
        try {
            return await this.shadowSearch.findContradictions(embedding, options);
        }
        catch (error) {
            console.warn('Shadow vector search failed:', error);
            return [];
        }
    }
    /**
     * Generate attack scenarios using causal inference
     */
    async generateAttackScenarios(target, attackVectors) {
        const scenarios = [];
        for (const vector of attackVectors) {
            try {
                // Create a hypothetical attack node
                const attackNodeId = `attack:${vector}:${Date.now()}`;
                // Use causal inference to explore consequences
                const inference = await this.causalMemory.inferConsequences([attackNodeId], 5 // maxDepth parameter
                );
                if (inference.effects && inference.effects.length > 0) {
                    scenarios.push({
                        attackVector: vector,
                        attackChain: inference.effects.map((nodeId, idx) => ({
                            step: idx + 1,
                            action: `${vector} attack step ${idx + 1}`,
                            nodeId,
                        })),
                        impact: this.inferImpact(inference.effects),
                        exploitability: this.calculateExploitability(vector, inference.confidence),
                        severity: inference.confidence,
                    });
                }
            }
            catch (error) {
                // Causal inference might fail for unknown attack vectors
                console.warn(`Failed to generate scenario for ${vector}:`, error);
                // Create a basic scenario without causal inference
                scenarios.push({
                    attackVector: vector,
                    attackChain: [
                        { step: 1, action: `Initial ${vector} attack` },
                        { step: 2, action: `Exploit ${vector} vulnerability` },
                    ],
                    impact: `Potential ${vector} attack impact on ${target.type}`,
                    exploitability: 0.5,
                    severity: 0.5,
                });
            }
        }
        return scenarios;
    }
    /**
     * Combine failure patterns, contradictions, and attack scenarios into threats
     */
    combineThreats(failurePatterns, contradictions, attackScenarios) {
        const threats = [];
        // Add failure patterns as threats
        for (const pattern of failurePatterns) {
            threats.push({
                id: `failure:${pattern.id}`,
                type: 'failure',
                description: pattern.description,
                severity: pattern.severity,
                source: pattern,
            });
        }
        // Add contradictions as threats
        for (const contradiction of contradictions) {
            threats.push({
                id: `contradiction:${contradiction.documentId}`,
                type: 'contradiction',
                description: contradiction.claim,
                severity: contradiction.refutationStrength,
                source: contradiction,
            });
        }
        // Add attack scenarios as vulnerability threats
        for (const scenario of attackScenarios) {
            threats.push({
                id: `vulnerability:${scenario.attackVector}`,
                type: 'vulnerability',
                description: `${scenario.attackVector} attack: ${scenario.impact}`,
                severity: scenario.severity,
                exploitability: scenario.exploitability,
                source: scenario,
            });
        }
        return threats;
    }
    /**
     * Rank threats by severity and exploitability
     */
    rankThreats(threats, severityThreshold) {
        // Calculate threat scores
        const scored = threats.map(threat => {
            // Score = (severity * 0.6) + (exploitability * 0.4)
            const exploitability = threat.exploitability ?? 0.5;
            const threatScore = (threat.severity * 0.6) + (exploitability * 0.4);
            return {
                ...threat,
                threatScore,
                rank: 0, // Will be set after sorting
            };
        });
        // Filter by threshold
        const filtered = scored.filter(t => t.severity >= severityThreshold);
        // Sort by threat score (descending)
        filtered.sort((a, b) => b.threatScore - a.threatScore);
        // Assign ranks
        return filtered.map((threat, idx) => ({
            ...threat,
            rank: idx + 1,
        }));
    }
    /**
     * Generate countermeasures for identified threats
     */
    async generateCountermeasures(threats) {
        const countermeasures = [];
        for (const threat of threats.slice(0, 5)) { // Top 5 threats only
            try {
                // Search for defensive patterns using TESTING taskType
                const defensivePatterns = await this.patternMatcher.findPatterns({
                    query: `countermeasure for ${threat.description}`,
                    taskType: TaskType.TESTING,
                    topK: 1,
                    minConfidence: 0.3,
                });
                if (defensivePatterns.length > 0) {
                    const pattern = defensivePatterns[0];
                    countermeasures.push({
                        threatId: threat.id,
                        description: pattern.pattern.template,
                        effectiveness: pattern.confidence,
                        complexity: this.inferComplexity(pattern.pattern.template),
                    });
                }
            }
            catch (error) {
                // Defensive patterns might not exist
                console.warn(`Failed to find countermeasure for ${threat.id}:`, error);
            }
        }
        return countermeasures;
    }
    /**
     * Convert ranked threats to Contradiction format
     */
    toContradictions(rankedThreats, countermeasures) {
        return rankedThreats.map(threat => {
            const countermeasure = countermeasures?.find(c => c.threatId === threat.id);
            return {
                claimId: `target:system`,
                counterClaimId: threat.id,
                conflictType: threat.type === 'contradiction' ? 'semantic' : 'logical',
                strength: threat.threatScore,
                evidence: {
                    supporting: [], // Target system (assumed valid initially)
                    contradicting: [threat.description],
                },
                resolution: this.inferResolution(threat),
                countermeasure: countermeasure?.description,
            };
        });
    }
    /**
     * Format adversarial analysis report
     */
    formatAdversarialReport(rankedThreats, target) {
        if (rankedThreats.length === 0) {
            return `No significant threats identified for ${target.type}: ${target.description}`;
        }
        const lines = [
            `Adversarial Analysis Report for ${target.type}:`,
            '',
            `Total Threats Identified: ${rankedThreats.length}`,
            '',
            'Top Threats:',
        ];
        for (const threat of rankedThreats.slice(0, 5)) {
            lines.push(`${threat.rank}. [${threat.type.toUpperCase()}] ${threat.description}`, `   Severity: ${threat.severity.toFixed(2)} | Threat Score: ${threat.threatScore.toFixed(2)}`);
            if (threat.exploitability !== undefined) {
                lines.push(`   Exploitability: ${threat.exploitability.toFixed(2)}`);
            }
            lines.push('');
        }
        return lines.join('\n');
    }
    /**
     * Calculate overall confidence
     */
    calculateConfidence(rankedThreats) {
        if (rankedThreats.length === 0) {
            return 0.5; // Neutral confidence if no threats found
        }
        // Confidence based on top threat score
        const topThreatScore = rankedThreats[0].threatScore;
        return Math.max(0.3, Math.min(0.95, topThreatScore));
    }
    // ==================== Helper Methods ====================
    /**
     * Infer severity from task type and confidence
     */
    inferSeverity(taskType, confidence) {
        const baseSeverity = taskType.includes('attack') ? 0.8 : 0.5;
        return Math.min(0.95, baseSeverity * confidence);
    }
    /**
     * Extract causes from pattern description
     */
    extractCauses(description) {
        // Simple heuristic: look for common cause indicators
        const causes = [];
        if (description.includes('due to')) {
            causes.push('pattern-identified-cause');
        }
        return causes;
    }
    /**
     * Infer impact from causal path
     */
    inferImpact(path) {
        return `Potential cascade affecting ${path.length} components`;
    }
    /**
     * Calculate exploitability
     */
    calculateExploitability(vector, confidence) {
        const vectorWeights = {
            logical: 0.6,
            empirical: 0.7,
            semantic: 0.5,
            ethical: 0.4,
        };
        const baseExploitability = vectorWeights[vector] ?? 0.5;
        return Math.min(0.95, baseExploitability * confidence);
    }
    /**
     * Infer complexity from description
     */
    inferComplexity(description) {
        // Simple heuristic: longer descriptions = more complex
        const wordCount = description.split(/\s+/).length;
        return Math.min(0.9, wordCount / 50);
    }
    /**
     * Infer resolution strategy
     */
    inferResolution(threat) {
        if (threat.severity > 0.8) {
            return 'reject_claim'; // Critical threat - reject target design
        }
        else if (threat.severity > 0.5) {
            return 'conditional'; // Moderate threat - conditional approval
        }
        else {
            return 'reject_counter'; // Low threat - likely false positive
        }
    }
    /**
     * Create VectorDB adapter for ShadowVectorSearch
     */
    createVectorStoreAdapter() {
        return {
            search: async (query, k) => {
                const results = await this.vectorDB.search(query, k);
                return results.map(r => ({
                    id: r.id,
                    similarity: r.similarity,
                    vector: r.vector,
                    metadata: {}, // SearchResult doesn't have metadata field
                }));
            },
            getVector: async (_id) => {
                // VectorDB doesn't have direct getVector, return null
                return null;
            },
        };
    }
}
//# sourceMappingURL=adversarial-engine.js.map