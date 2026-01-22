/**
 * Coding Quality Gate Zod Schemas
 *
 * Zod validation schemas for the L-Score quality gate system.
 * Provides runtime input validation per constitution TS-004.
 *
 * @module src/god-agent/core/pipeline/coding-quality-gate-schemas
 * @see docs/coding-pipeline/quality-gate-system.md
 */
import { z } from 'zod';
/**
 * Schema for L-Score component values (0.0 - 1.0).
 */
export declare const LScoreValueSchema: z.ZodNumber;
/**
 * Schema for validating L-Score breakdown input.
 */
export declare const LScoreBreakdownSchema: z.ZodObject<{
    accuracy: z.ZodNumber;
    completeness: z.ZodNumber;
    maintainability: z.ZodNumber;
    security: z.ZodNumber;
    performance: z.ZodNumber;
    testCoverage: z.ZodNumber;
    composite: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    performance: number;
    accuracy: number;
    security: number;
    composite: number;
    completeness: number;
    maintainability: number;
    testCoverage: number;
}, {
    performance: number;
    accuracy: number;
    security: number;
    composite: number;
    completeness: number;
    maintainability: number;
    testCoverage: number;
}>;
/**
 * Schema for validating gate validation context.
 */
export declare const GateValidationContextSchema: z.ZodObject<{
    remediationAttempts: z.ZodNumber;
    activeEmergency: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        trigger: z.ZodString;
        timestamp: z.ZodDate;
        context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        timestamp: Date;
        trigger: string;
        context?: Record<string, unknown> | undefined;
    }, {
        id: string;
        timestamp: Date;
        trigger: string;
        context?: Record<string, unknown> | undefined;
    }>>;
    previousValidations: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
}, "strip", z.ZodTypeAny, {
    remediationAttempts: number;
    activeEmergency?: {
        id: string;
        timestamp: Date;
        trigger: string;
        context?: Record<string, unknown> | undefined;
    } | undefined;
    previousValidations?: any[] | undefined;
}, {
    remediationAttempts: number;
    activeEmergency?: {
        id: string;
        timestamp: Date;
        trigger: string;
        context?: Record<string, unknown> | undefined;
    } | undefined;
    previousValidations?: any[] | undefined;
}>;
/**
 * Schema for validating gate ID.
 */
export declare const GateIdSchema: z.ZodString;
//# sourceMappingURL=coding-quality-gate-schemas.d.ts.map