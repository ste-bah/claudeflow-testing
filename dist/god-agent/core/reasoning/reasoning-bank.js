/**
 * ReasoningBank - Main Unified Reasoning Interface
 *
 * Orchestrates all 4 reasoning modes:
 * 1. Pattern-Match: Template-based reasoning from historical patterns
 * 2. Causal-Inference: Graph-based cause-effect reasoning
 * 3. Contextual: GNN-enhanced semantic similarity
 * 4. Hybrid: Weighted combination of all modes
 *
 * Integrates with Sona for continuous learning through feedback.
 *
 * Performance targets:
 * - Pattern-match: <10ms
 * - Causal-inference: <20ms
 * - Contextual: <30ms
 * - Hybrid: <30ms (without GNN)
 */
import { GNNEnhancer } from './gnn-enhancer.js';
import { TrajectoryTracker } from './trajectory-tracker.js';
import { ModeSelector } from './mode-selector.js';
import { ReasoningMode } from './reasoning-types.js';
import { TaskType } from './pattern-types.js';
import { assertDimensions } from '../validation/index.js';
import { ObservabilityBus } from '../observability/bus.js';
/**
 * Default configuration for ReasoningBank
 */
const DEFAULT_CONFIG = {
    enableGNN: true,
    defaultMaxResults: 10,
    defaultConfidenceThreshold: 0.7,
    defaultMinLScore: 0.5,
    patternWeight: 0.3,
    causalWeight: 0.3,
    contextualWeight: 0.4,
    enableTrajectoryTracking: true,
    enableAutoModeSelection: true
};
/**
 * ReasoningBank - Unified reasoning orchestrator
 *
 * Main entry point for all reasoning operations in the God Agent.
 * Coordinates pattern matching, causal inference, contextual reasoning,
 * and hybrid approaches while tracking learning trajectories.
 */
export class ReasoningBank {
    patternMatcher;
    causalMemory;
    vectorDB;
    gnnEnhancer;
    trajectoryTracker;
    // Reserved for future auto-selection feature
    _modeSelector;
    config;
    initialized = false;
    sonaEngine;
    provenanceStore;
    constructor(deps) {
        this.patternMatcher = deps.patternMatcher;
        this.causalMemory = deps.causalMemory;
        this.vectorDB = deps.vectorDB;
        this.sonaEngine = deps.sonaEngine;
        this.provenanceStore = deps.provenanceStore;
        this.config = { ...DEFAULT_CONFIG, ...deps.config };
        // Initialize GNN enhancer with proper config (1536D per architecture diagram)
        this.gnnEnhancer = new GNNEnhancer({
            inputDim: 1536,
            outputDim: 1536,
            numLayers: 3,
            attentionHeads: 12,
            dropout: 0.1,
            maxNodes: 50
        });
        // Initialize trajectory tracker with config
        this.trajectoryTracker = new TrajectoryTracker({
            maxTrajectories: 10000,
            autoPrune: true
        });
        // Initialize mode selector with thresholds
        this._modeSelector = new ModeSelector({
            patternMatchThreshold: 0.6,
            causalInferenceThreshold: 0.6,
            contextualThreshold: 0.6,
            hybridThreshold: 0.15
        });
    }
    /**
     * Initialize all components
     * Must be called before using reason()
     */
    async initialize() {
        if (this.initialized) {
            return;
        }
        // Components are ready to use after construction
        // No async initialization needed for current implementations
        this.initialized = true;
    }
    /**
     * Set SonaEngine for feedback loop integration (late binding)
     * Called after SonaEngine is initialized to break circular dependency
     */
    setSonaEngine(engine) {
        this.sonaEngine = engine;
        // FIX: Register callback to sync SonaEngine patterns to PatternStore
        // This connects the learning system to the reasoning system
        engine.onPatternCreated(async (pattern) => {
            try {
                // Convert SONA pattern to PatternStore format
                await this.patternMatcher.createPattern({
                    taskType: pattern.taskType || 'learning',
                    template: pattern.template ?? `Pattern from trajectory ${pattern.sourceTrajectory ?? 'unknown'}`,
                    embedding: pattern.embedding,
                    successRate: pattern.successRate ?? 0.9,
                    metadata: pattern.metadata,
                });
                console.log(`[ReasoningBank] Synced pattern ${pattern.id} to PatternStore`);
            }
            catch (error) {
                // May fail if duplicate or validation error - that's ok
                console.debug(`[ReasoningBank] Pattern sync skipped: ${error}`);
            }
        });
    }
    /**
     * Get L-Score for a pattern or inference
     * Uses ProvenanceStore lookup with fallback to default
     *
     * @param id - Pattern ID or inference node ID
     * @returns L-Score value (0-1), defaults to 0.5 if not found
     */
    getLScoreForId(id) {
        if (!this.provenanceStore) {
            return this.config.defaultMinLScore; // Default 0.5
        }
        // Attempt to lookup provenance by ID
        // Pattern IDs may map to provenance IDs in some cases
        const provenance = this.provenanceStore.getProvenance(id);
        if (provenance) {
            // Calculate L-Score from provenance depth (deeper = lower trust)
            // This is a simplified heuristic - full implementation would use calculateLScore
            const depthPenalty = Math.max(0.1, 1 - (provenance.depth * 0.1));
            return Math.min(1.0, depthPenalty);
        }
        return this.config.defaultMinLScore; // Default fallback
    }
    /**
     * Main reasoning API entry point
     *
     * Executes reasoning based on the request type (or auto-selects mode).
     * Tracks trajectories for learning and applies GNN enhancement if requested.
     *
     * @param request - Reasoning request with query and parameters
     * @returns Reasoning response with patterns, inferences, and metadata
     */
    async reason(request) {
        const startTime = performance.now();
        // 1. Validate request
        await this.validateRequest(request);
        // 2. Use explicit mode or default to PATTERN_MATCH
        // (ModeSelector expects string query, but we have embedding)
        const mode = request.type ?? ReasoningMode.PATTERN_MATCH;
        // 3. Apply GNN enhancement if requested
        let enhancedEmbedding;
        if (request.enhanceWithGNN && this.config.enableGNN) {
            enhancedEmbedding = await this.applyGNNEnhancement(request.query);
        }
        // 4. Execute reasoning based on mode
        let result;
        switch (mode) {
            case ReasoningMode.PATTERN_MATCH:
                result = await this.patternMatchReasoning(request);
                break;
            case ReasoningMode.CAUSAL_INFERENCE:
                result = await this.causalInferenceReasoning(request);
                break;
            case ReasoningMode.CONTEXTUAL:
                result = await this.contextualReasoning(request);
                break;
            case ReasoningMode.HYBRID:
                result = await this.hybridReasoning(request);
                break;
            default:
                throw new Error(`Unknown reasoning mode: ${mode}`);
        }
        // 5. Add enhanced embedding if available
        if (enhancedEmbedding) {
            result.enhancedEmbedding = enhancedEmbedding;
        }
        // 6. Track trajectory if enabled
        if (this.config.enableTrajectoryTracking) {
            const trajectory = await this.trajectoryTracker.createTrajectory(request, result, request.query, enhancedEmbedding);
            result.trajectoryId = trajectory.id;
        }
        else {
            result.trajectoryId = `traj_${Date.now()}_untracked`;
        }
        // 7. Set processing time
        result.processingTimeMs = performance.now() - startTime;
        return result;
    }
    /**
     * Pattern-match reasoning mode
     *
     * Finds historical patterns similar to the query embedding.
     * Filters by confidence and L-Score thresholds.
     */
    async patternMatchReasoning(request) {
        const patterns = await this.patternMatcher.findPatterns({
            embedding: request.query,
            taskType: this.inferTaskType(request),
            topK: request.maxResults ?? this.config.defaultMaxResults,
            minConfidence: request.confidenceThreshold ?? this.config.defaultConfidenceThreshold
        });
        // Map to IPatternMatch (PatternResult has pattern and confidence)
        const patternMatches = patterns.map(p => ({
            patternId: p.pattern.id,
            confidence: p.confidence,
            template: p.pattern.template,
            taskType: p.pattern.taskType,
            lScore: this.getLScoreForId(p.pattern.id)
        }));
        // Filter by L-Score
        const minLScore = request.minLScore ?? this.config.defaultMinLScore;
        const filteredPatterns = patternMatches.filter(p => p.lScore >= minLScore);
        return this.buildResponse({
            query: request.query,
            type: ReasoningMode.PATTERN_MATCH,
            patterns: filteredPatterns,
            causalInferences: [],
            confidence: filteredPatterns[0]?.confidence ?? 0,
            provenanceInfo: this.calculateProvenanceInfo(filteredPatterns)
        });
    }
    /**
     * Causal-inference reasoning mode
     *
     * Uses VectorDB to find relevant nodes, then infers consequences
     * through the causal graph using edge weights and transitivity.
     */
    async causalInferenceReasoning(request) {
        // Use VectorDB to find relevant nodes based on query embedding
        const searchResults = await this.vectorDB.search(request.query, request.maxResults ?? this.config.defaultMaxResults);
        const nodeIds = searchResults.map(r => r.id);
        if (nodeIds.length === 0) {
            return this.buildResponse({
                query: request.query,
                type: ReasoningMode.CAUSAL_INFERENCE,
                patterns: [],
                causalInferences: [],
                confidence: 0,
                provenanceInfo: { lScores: [], totalSources: 0, combinedLScore: 0 }
            });
        }
        // Infer consequences (default depth: 3)
        const inference = await this.causalMemory.inferConsequences(nodeIds, 3);
        // Map to IInferenceResult - effects are NodeIDs, chains provide paths
        const inferences = inference.effects.map((effectId, index) => {
            const chain = inference.chains[index];
            // Extract node IDs from chain path (CausalLink[] -> string[])
            const pathNodeIds = chain?.path
                ? chain.path.flatMap(link => link.effects) // Use effect nodes from each link
                : [effectId];
            return {
                nodeId: effectId,
                probability: 1.0, // Default probability
                confidence: chain?.totalConfidence ?? inference.confidence,
                chain: pathNodeIds,
                lScore: this.getLScoreForId(effectId)
            };
        });
        // Filter by confidence threshold
        const filtered = inferences.filter(i => i.confidence >= (request.confidenceThreshold ?? this.config.defaultConfidenceThreshold));
        return this.buildResponse({
            query: request.query,
            type: ReasoningMode.CAUSAL_INFERENCE,
            patterns: [],
            causalInferences: filtered,
            confidence: filtered[0]?.confidence ?? 0,
            provenanceInfo: this.calculateProvenanceInfo(filtered)
        });
    }
    /**
     * Contextual reasoning mode
     *
     * Uses GNN-enhanced embeddings for semantic similarity search.
     * Leverages graph structure to improve context understanding.
     */
    async contextualReasoning(request) {
        // Note: VectorDB only supports 1536D vectors
        // Always use original 1536D query for search (GNN enhancement is for response only)
        const searchEmbedding = request.query.length === 1536
            ? request.query
            : request.query.slice(0, 1536);
        // Search VectorDB for similar contexts
        const results = await this.vectorDB.search(new Float32Array(searchEmbedding), request.maxResults ?? this.config.defaultMaxResults);
        // Filter by similarity threshold
        const minConfidence = request.confidenceThreshold ?? this.config.defaultConfidenceThreshold;
        const filtered = results.filter(r => r.similarity >= minConfidence);
        // Map to IPatternMatch (contextual matches use pattern-like structure)
        const patterns = filtered.map(r => ({
            patternId: r.id,
            confidence: r.similarity,
            template: '', // Would need metadata lookup for actual content
            taskType: TaskType.ANALYSIS, // Default for contextual
            lScore: this.getLScoreForId(r.id)
        }));
        return this.buildResponse({
            query: request.query,
            type: ReasoningMode.CONTEXTUAL,
            patterns,
            causalInferences: [],
            confidence: patterns[0]?.confidence ?? 0,
            provenanceInfo: this.calculateProvenanceInfo(patterns)
        });
    }
    /**
     * Hybrid reasoning mode
     *
     * Combines all reasoning modes with configurable weights.
     * Executes modes in parallel for optimal performance.
     */
    async hybridReasoning(request) {
        // Execute all modes in parallel
        const [patternResult, causalResult, contextualResult] = await Promise.all([
            this.patternMatchReasoning(request).catch(() => null),
            this.causalInferenceReasoning(request).catch(() => null),
            this.contextualReasoning(request).catch(() => null)
        ]);
        // Combine results with weights
        const weights = {
            pattern: this.config.patternWeight,
            causal: this.config.causalWeight,
            contextual: this.config.contextualWeight
        };
        // Merge patterns and inferences
        const allPatterns = [
            ...(patternResult?.patterns ?? []),
            ...(contextualResult?.patterns ?? [])
        ];
        const allInferences = causalResult?.causalInferences ?? [];
        // Calculate weighted confidence
        let totalWeight = 0;
        let weightedConfidence = 0;
        if (patternResult) {
            weightedConfidence += patternResult.confidence * weights.pattern;
            totalWeight += weights.pattern;
        }
        if (causalResult) {
            weightedConfidence += causalResult.confidence * weights.causal;
            totalWeight += weights.causal;
        }
        if (contextualResult) {
            weightedConfidence += contextualResult.confidence * weights.contextual;
            totalWeight += weights.contextual;
        }
        return this.buildResponse({
            query: request.query,
            type: ReasoningMode.HYBRID,
            patterns: allPatterns,
            causalInferences: allInferences,
            confidence: totalWeight > 0 ? weightedConfidence / totalWeight : 0,
            provenanceInfo: this.calculateProvenanceInfo([...allPatterns, ...allInferences])
        });
    }
    /**
     * Provide feedback for a trajectory (Sona integration)
     *
     * Updates trajectory with feedback quality.
     * High quality (>= 0.8) triggers pattern creation.
     *
     * @param feedback - Learning feedback with quality score
     */
    async provideFeedback(feedback) {
        // Implements [REQ-OBS-17]: Emit learning_feedback event
        ObservabilityBus.getInstance().emit({
            component: 'learning',
            operation: 'learning_feedback',
            status: 'success',
            metadata: {
                trajectoryId: feedback.trajectoryId,
                quality: feedback.quality,
                outcome: feedback.outcome,
                hasFeedbackText: !!feedback.userFeedback,
            },
        });
        // Update trajectory with feedback
        await this.trajectoryTracker.updateFeedback(feedback.trajectoryId, feedback);
        // Call SonaEngine for weight updates if available
        if (this.sonaEngine && feedback.quality !== undefined) {
            const trajectory = await this.trajectoryTracker.getTrajectory(feedback.trajectoryId);
            if (trajectory) {
                try {
                    // FIX: Ensure trajectory exists in SonaEngine before providing feedback
                    // TrajectoryTracker and SonaEngine have separate trajectory stores
                    const existingTrajectory = this.sonaEngine.getTrajectory(feedback.trajectoryId);
                    if (!existingTrajectory) {
                        // Create trajectory in SonaEngine with pattern IDs from TrajectoryTracker
                        const route = this.inferRouteFromReasoningMode(trajectory.request.type);
                        const patternIds = trajectory.response.patterns.map(p => p.patternId);
                        const contextIds = trajectory.response.causalInferences?.map(c => c.nodeId) ?? [];
                        // Always create trajectory - enables route-level learning even without patterns
                        // This fixes the chicken-egg problem where patterns can't accumulate without trajectories
                        this.sonaEngine.createTrajectoryWithId(feedback.trajectoryId, route, patternIds, contextIds);
                        console.log(`[ReasoningBank] Created SonaEngine trajectory: ${feedback.trajectoryId} with ${patternIds.length} patterns (route: ${route})`);
                    }
                    // Only provide feedback if trajectory exists in SonaEngine
                    // (prevents FeedbackValidationError when no patterns were available)
                    const trajectoryInSona = this.sonaEngine.getTrajectory(feedback.trajectoryId);
                    if (trajectoryInSona) {
                        await this.sonaEngine.provideFeedback(feedback.trajectoryId, feedback.quality, { lScore: trajectory.lScore ?? 1.0 });
                        console.log(`[ReasoningBank] SonaEngine updated for trajectory ${feedback.trajectoryId}`);
                    }
                    else {
                        console.log(`[ReasoningBank] Skipping SonaEngine feedback (no trajectory): ${feedback.trajectoryId}`);
                    }
                }
                catch (error) {
                    console.warn(`[ReasoningBank] SonaEngine feedback failed:`, error);
                }
            }
        }
        // Get high-quality trajectories for hyperedge creation
        if (feedback.quality !== undefined && feedback.quality >= 0.8) {
            const trajectory = await this.trajectoryTracker.getTrajectory(feedback.trajectoryId);
            if (trajectory) {
                console.log(`[ReasoningBank] High-quality trajectory ${feedback.trajectoryId} (quality=${feedback.quality}) eligible for hyperedge creation`);
                // Create causal hyperedge from high-quality trajectory
                await this.createCausalHyperedge(trajectory);
            }
        }
    }
    /**
     * Close and cleanup resources
     */
    async close() {
        // Reserved for future cleanup
        this.initialized = false;
    }
    /**
     * Validate reasoning request
     */
    async validateRequest(request) {
        if (!this.initialized) {
            throw new Error('ReasoningBank not initialized. Call initialize() first.');
        }
        if (!request.query || request.query.length === 0) {
            throw new Error('Query embedding is required');
        }
        // Validate embedding dimensions (1536 for base)
        if (request.query.length !== 1536) {
            assertDimensions(request.query, 1536, 'Query embedding');
        }
        if (request.maxResults !== undefined && request.maxResults <= 0) {
            throw new Error('maxResults must be positive');
        }
        if (request.confidenceThreshold !== undefined &&
            (request.confidenceThreshold < 0 || request.confidenceThreshold > 1)) {
            throw new Error('confidenceThreshold must be between 0 and 1');
        }
        if (request.minLScore !== undefined &&
            (request.minLScore < 0 || request.minLScore > 1)) {
            throw new Error('minLScore must be between 0 and 1');
        }
    }
    /**
     * Apply GNN enhancement to embedding
     */
    async applyGNNEnhancement(embedding) {
        try {
            const result = await this.gnnEnhancer.enhance(embedding);
            return result.enhanced;
        }
        catch (error) {
            console.warn('[ReasoningBank] GNN enhancement failed:', error);
            return undefined;
        }
    }
    /**
     * Calculate provenance information from results
     *
     * Uses geometric mean for combined L-Score to account for
     * multiplicative uncertainty across sources.
     */
    calculateProvenanceInfo(results) {
        const lScores = results.map(r => r.lScore);
        const totalSources = results.length;
        // Geometric mean for combined L-Score
        const combinedLScore = totalSources > 0
            ? Math.pow(lScores.reduce((a, b) => a * b, 1), 1 / totalSources)
            : 0;
        return { lScores, totalSources, combinedLScore };
    }
    /**
     * Build standardized reasoning response
     */
    buildResponse(params) {
        return {
            query: params.query,
            type: params.type,
            patterns: params.patterns,
            causalInferences: params.causalInferences,
            trajectoryId: params.trajectoryId ?? '',
            confidence: params.confidence,
            provenanceInfo: params.provenanceInfo,
            processingTimeMs: 0 // Will be set by reason()
        };
    }
    /**
     * Generate deterministic node ID from trajectory data
     */
    generateCausalNodeId(prefix, data) {
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            hash = ((hash << 5) - hash) + data.charCodeAt(i);
            hash |= 0;
        }
        return `${prefix}_${Math.abs(hash).toString(16)}`;
    }
    /**
     * Ensure a causal node exists, create if missing
     */
    async ensureNodeExists(node) {
        try {
            const existing = this.causalMemory.getNode(node.id);
            if (!existing) {
                await this.causalMemory.addNode(node);
            }
        }
        catch {
            // Node might already exist, ignore
        }
    }
    /**
     * Create causal hyperedge from high-quality trajectory
     * Called when feedback.quality >= 0.8
     */
    async createCausalHyperedge(trajectory) {
        try {
            const now = Date.now();
            // 1. Create query node (cause)
            const queryNodeId = this.generateCausalNodeId('query', trajectory.id);
            await this.ensureNodeExists({
                id: queryNodeId,
                label: `Query: ${trajectory.request.type}`,
                type: 'concept',
                metadata: {
                    trajectoryId: trajectory.id,
                    reasoningMode: trajectory.request.type,
                    timestamp: trajectory.timestamp
                },
                createdAt: now
            });
            // 2. Create pattern nodes (additional causes) - limit to top 3
            const patternNodeIds = [];
            for (const pattern of trajectory.response.patterns.slice(0, 3)) {
                const patternNodeId = this.generateCausalNodeId('pattern', pattern.patternId);
                await this.ensureNodeExists({
                    id: patternNodeId,
                    label: `Pattern: ${pattern.patternId}`,
                    type: 'concept',
                    metadata: {
                        patternId: pattern.patternId,
                        confidence: pattern.confidence,
                        taskType: pattern.taskType
                    },
                    createdAt: now
                });
                patternNodeIds.push(patternNodeId);
            }
            // 3. Create effect nodes from causal inferences - limit to top 3
            const effectNodeIds = [];
            for (const inference of trajectory.response.causalInferences.slice(0, 3)) {
                const effectNodeId = this.generateCausalNodeId('effect', inference.nodeId);
                await this.ensureNodeExists({
                    id: effectNodeId,
                    label: `Effect: ${inference.nodeId}`,
                    type: 'state',
                    metadata: {
                        nodeId: inference.nodeId,
                        probability: inference.probability,
                        confidence: inference.confidence
                    },
                    createdAt: now
                });
                effectNodeIds.push(effectNodeId);
            }
            // 4. Create outcome node (final effect representing success)
            const outcomeNodeId = this.generateCausalNodeId('outcome', trajectory.id);
            await this.ensureNodeExists({
                id: outcomeNodeId,
                label: `Outcome: Quality ${trajectory.feedback?.quality?.toFixed(2)}`,
                type: 'state',
                metadata: {
                    trajectoryId: trajectory.id,
                    quality: trajectory.feedback?.quality,
                    lScore: trajectory.lScore
                },
                createdAt: now
            });
            // 5. Create hyperedge linking causes to effects
            const allCauses = [queryNodeId, ...patternNodeIds];
            const allEffects = [...effectNodeIds, outcomeNodeId];
            // Only create if we have valid causes and effects
            if (allCauses.length >= 1 && allEffects.length >= 1) {
                await this.causalMemory.addCausalLink({
                    causes: allCauses,
                    effects: allEffects,
                    confidence: trajectory.feedback?.quality ?? 0.8,
                    strength: trajectory.lScore ?? 0.8,
                    metadata: {
                        source: 'high-quality-feedback',
                        trajectoryId: trajectory.id,
                        reasoningMode: trajectory.request.type,
                        createdAt: now
                    }
                });
                console.log(`[ReasoningBank] Created causal hyperedge: ${allCauses.length} causes → ${allEffects.length} effects`);
            }
        }
        catch (error) {
            // Don't fail feedback on hyperedge creation error
            console.warn(`[ReasoningBank] Hyperedge creation failed:`, error);
        }
    }
    /**
     * Infer task type from request context
     *
     * Uses heuristics to determine task type when not explicitly provided.
     * Can be extended with more sophisticated classification.
     */
    inferTaskType(_request) {
        // Default to ANALYSIS for now
        // Future: Use request.context or embedding classification
        return TaskType.ANALYSIS;
    }
    /**
     * Convert ReasoningMode to SonaEngine route string
     *
     * Maps reasoning modes to route identifiers for trajectory tracking.
     * Routes are used by SonaEngine for per-task-type weight management.
     */
    inferRouteFromReasoningMode(mode) {
        switch (mode) {
            case ReasoningMode.PATTERN_MATCH:
                return 'reasoning.pattern';
            case ReasoningMode.CAUSAL_INFERENCE:
                return 'reasoning.causal';
            case ReasoningMode.CONTEXTUAL:
                return 'reasoning.contextual';
            case ReasoningMode.HYBRID:
                return 'reasoning.hybrid';
            default:
                return 'reasoning.general';
        }
    }
}
//# sourceMappingURL=reasoning-bank.js.map