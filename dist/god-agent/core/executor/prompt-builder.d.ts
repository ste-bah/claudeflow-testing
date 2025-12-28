import type { ICodeExecutionRequest } from './executor-types.js';
/**
 * Build user prompt for code generation
 */
export declare function buildPrompt(task: string, language: string, request: ICodeExecutionRequest): string;
/**
 * Build system prompt for code generation
 */
export declare function buildSystemPrompt(language: string): string;
//# sourceMappingURL=prompt-builder.d.ts.map