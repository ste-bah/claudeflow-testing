/**
 * StyleProfile - Stores and manages learned writing styles
 * Integrates with AgentDB for persistent storage
 */
import { StyleCharacteristics } from './style-analyzer.js';
export interface StyleProfileMetadata {
    id: string;
    name: string;
    description: string;
    sourceType: 'pdf' | 'text' | 'url' | 'mixed';
    sourceCount: number;
    createdAt: number;
    updatedAt: number;
    tags: string[];
}
export interface StoredStyleProfile {
    metadata: StyleProfileMetadata;
    characteristics: StyleCharacteristics;
    sampleTexts: string[];
}
export interface StyleProfileStore {
    profiles: Map<string, StoredStyleProfile>;
    activeProfile: string | null;
}
export declare class StyleProfileManager {
    private store;
    private storagePath;
    private analyzer;
    private dirty;
    constructor(basePath?: string);
    /**
     * Create a new style profile from text samples
     */
    createProfile(name: string, textSamples: string[], options?: {
        description?: string;
        sourceType?: 'pdf' | 'text' | 'url' | 'mixed';
        tags?: string[];
    }): Promise<StoredStyleProfile>;
    /**
     * Update existing profile with additional samples
     */
    updateProfile(profileId: string, additionalSamples: string[]): Promise<StoredStyleProfile>;
    /**
     * Get a profile by ID
     */
    getProfile(profileId: string): StoredStyleProfile | undefined;
    /**
     * Get the active profile
     */
    getActiveProfile(): StoredStyleProfile | undefined;
    /**
     * Set the active profile
     */
    setActiveProfile(profileId: string | null): Promise<void>;
    /**
     * List all profiles
     */
    listProfiles(): StyleProfileMetadata[];
    /**
     * Delete a profile
     */
    deleteProfile(profileId: string): Promise<boolean>;
    /**
     * Generate a style prompt for use in generation
     */
    generateStylePrompt(profileId?: string): string | null;
    /**
     * Get style characteristics for a profile
     */
    getStyleCharacteristics(profileId?: string): StyleCharacteristics | null;
    /**
     * Get sample texts from a profile for few-shot learning
     */
    getSampleTexts(profileId?: string, count?: number): string[];
    /**
     * Get statistics about stored profiles
     */
    getStats(): {
        totalProfiles: number;
        activeProfile: string | null;
        totalSourceDocuments: number;
        profilesByType: Record<string, number>;
    };
    private generateId;
    private extractRepresentativeSamples;
    private load;
    private save;
}
export declare function getStyleProfileManager(basePath?: string): StyleProfileManager;
//# sourceMappingURL=style-profile.d.ts.map