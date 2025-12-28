/**
 * StyleInjector - Injects style profile into Phase 6 agent prompts
 * Implements REQ-PIPE-010, REQ-PIPE-012, REQ-PIPE-013, REQ-PIPE-014, REQ-PIPE-015, REQ-PIPE-016
 */
import { StyleCharacteristics } from '../universal/style-analyzer.js';
import type { AgentConfig } from './pipeline-loader.js';
/**
 * StyleInjector class for building style-injected prompts
 */
export declare class StyleInjector {
    private styleManager;
    private styleAnalyzer;
    constructor(basePath?: string);
    /**
     * Build agent prompt with conditional style injection
     * [REQ-PIPE-010, REQ-PIPE-016, REQ-PIPE-030]
     *
     * NOTE: Uses StyleProfileManager.generateStylePrompt() which internally uses
     * StyleAnalyzer.generateStylePrompt() - the same method PhDPipelineBridge uses.
     * This ensures format consistency (REQ-PIPE-016) without requiring access to
     * PhDPipelineBridge private methods.
     */
    buildAgentPrompt(agent: AgentConfig, styleProfileId?: string, query?: string): Promise<string>;
    /**
     * Build prompt with style injection using StyleProfileManager
     * [REQ-PIPE-030, REQ-PIPE-016]
     *
     * Uses StyleProfileManager.generateStylePrompt(profileId) which is PUBLIC
     * and produces identical output to PhDPipelineBridge.getStylePromptSync()
     * since both use StyleAnalyzer.generateStylePrompt() internally.
     */
    private buildStyledPrompt;
    /**
     * Generate style prompt from characteristics directly
     * Used for dynamic Phase 6 agents with custom chapter context
     */
    generateStylePromptFromCharacteristics(characteristics: StyleCharacteristics): string;
    /**
     * Get style characteristics for a profile
     * [REQ-PIPE-031]
     */
    getStyleCharacteristics(profileId?: string): StyleCharacteristics | null;
    /**
     * Get the raw style prompt for a profile
     */
    getStylePrompt(profileId?: string): string | null;
    /**
     * Validate style injection includes required components
     * [REQ-PIPE-012, REQ-PIPE-013, REQ-PIPE-014, REQ-PIPE-015]
     */
    validateStyleInjection(prompt: string): {
        valid: boolean;
        missing: string[];
    };
    /**
     * Check if a prompt contains style injection
     */
    hasStyleInjection(prompt: string): boolean;
    /**
     * Get default style prompt for fallback
     */
    getDefaultStylePrompt(): string;
}
//# sourceMappingURL=style-injector.d.ts.map