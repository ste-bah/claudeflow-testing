/**
 * Document Structure Validator
 *
 * Prevents inconsistencies in multi-chapter documents by:
 * 1. Locking structure before writing begins
 * 2. Validating cross-references against actual structure
 * 3. Detecting orphan references to non-existent chapters
 */
export interface ChapterDefinition {
    number: number;
    title: string;
    description?: string;
}
export interface DocumentStructure {
    title: string;
    chapters: ChapterDefinition[];
    createdAt: string;
    locked: boolean;
}
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}
export interface ValidationError {
    type: 'orphan_reference' | 'missing_chapter' | 'wrong_title';
    location: string;
    message: string;
    line?: number;
}
export interface ValidationWarning {
    type: 'inconsistent_numbering' | 'missing_reference';
    location: string;
    message: string;
}
export declare class DocumentValidator {
    private structure;
    /**
     * Define and lock the document structure BEFORE any writing begins
     */
    defineStructure(title: string, chapters: ChapterDefinition[]): DocumentStructure;
    /**
     * Get the locked structure for agents to reference
     */
    getStructure(): DocumentStructure | null;
    /**
     * Get valid chapter numbers
     */
    getValidChapterNumbers(): number[];
    /**
     * Check if a chapter reference is valid
     */
    isValidChapter(chapterNum: number): boolean;
    /**
     * Validate content for invalid chapter references
     */
    validateContent(content: string, sourceFile: string): ValidationResult;
    /**
     * Extract chapter references from content
     */
    private extractChapterReferences;
    /**
     * Generate structure prompt for agents
     */
    generateStructurePrompt(): string;
    /**
     * Validate all files in a directory
     */
    validateDirectory(dirPath: string): Promise<ValidationResult>;
}
export declare const PHD_DISSERTATION_STRUCTURE: ChapterDefinition[];
export declare const documentValidator: DocumentValidator;
//# sourceMappingURL=document-validator.d.ts.map