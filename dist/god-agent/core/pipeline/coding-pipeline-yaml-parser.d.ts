/**
 * Coding Pipeline YAML Parser
 *
 * YAML parsing utilities for agent definition file frontmatter.
 * Handles arrays, nested objects, multiline values, and type coercion.
 *
 * @module src/god-agent/core/pipeline/coding-pipeline-yaml-parser
 * @see PRD Section 2.3 - Pipeline Configuration
 */
import { z } from 'zod';
export type YAMLParseResult = Record<string, unknown>;
export interface MultilineContext {
    lines: string[];
    startIndex: number;
}
/** Schema for validating parsed YAML values (TS-004) */
export declare const YAMLValueSchema: z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString, "many">, z.ZodRecord<z.ZodString, z.ZodUnknown>]>;
export declare const YAMLFrontmatterSchema: z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString, "many">, z.ZodRecord<z.ZodString, z.ZodUnknown>]>>;
/**
 * Extract YAML frontmatter from markdown content
 * @returns Tuple of [frontmatterYAML, remainingContent] or null
 */
export declare function extractFrontmatter(content: string): [string, string] | null;
/**
 * Collect multiline value from YAML pipe syntax (|)
 */
export declare function collectMultilineValue(ctx: MultilineContext): string;
/** Parse single YAML value to appropriate type */
export declare function parseYAMLValue(value: string): unknown;
/**
 * Parse YAML frontmatter into key-value object
 * Handles: key:value, arrays, nested objects, multiline (|), quoted strings
 */
export declare function parseYAML(yaml: string): YAMLParseResult;
//# sourceMappingURL=coding-pipeline-yaml-parser.d.ts.map