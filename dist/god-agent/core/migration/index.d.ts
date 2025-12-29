/**
 * Migration Module Exports
 *
 * Implements: TASK-VEC-001-009 (Data Migration Strategy)
 * Constitution: RULE-009 (zero data loss)
 *
 * Provides backward compatibility layer for 768D -> 1536D vector migration.
 */
export { BackwardCompatLayer, getBackwardCompatLayer, resetBackwardCompatLayer, isLegacyVector, isCurrentVector, ensureVectorDimension, checkVectorsNeedMigration, assertLegacyDimension, assertCurrentDimension, assertValidDimension, type BackwardCompatStats, type BackwardCompatOptions, LEGACY_VECTOR_DIM, } from './backward-compat.js';
//# sourceMappingURL=index.d.ts.map