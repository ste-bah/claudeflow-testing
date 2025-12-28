/**
 * Universal Self-Learning God Agent - Public API
 *
 * Usage:
 *   import { UniversalAgent, universalAgent } from './src/god-agent/universal';
 *
 *   // Use singleton
 *   await universalAgent.initialize();
 *   const result = await universalAgent.ask("How do I implement a linked list?");
 *
 *   // Or create instance
 *   const agent = new UniversalAgent({ verbose: true });
 *   await agent.initialize();
 *
 *   // With trajectory tracking (FR-11)
 *   const { output, trajectoryId } = await agent.ask("Your question", { returnResult: true });
 *   await agent.feedback(trajectoryId, 0.9, { isTrajectoryId: true });
 */
export { UniversalAgent, universalAgent, } from './universal-agent.js';
export { InteractionStore, } from './interaction-store.js';
// Trajectory Bridge for auto-feedback (FR-11)
export { TrajectoryBridge, } from './trajectory-bridge.js';
// Quality Estimator for auto-feedback
export { estimateQuality, assessQuality, qualityToVerdict, calculateLScore, } from './quality-estimator.js';
// Style Learning System
export { StyleAnalyzer, } from './style-analyzer.js';
export { SpellingTransformer, } from './spelling-transformer.js';
export { GrammarTransformer, } from './grammar-transformer.js';
export { StyleProfileManager, getStyleProfileManager, } from './style-profile.js';
export { PDFExtractor, getPDFExtractor, } from './pdf-extractor.js';
//# sourceMappingURL=index.js.map