/**
 * Memory Engine Validation Utilities
 */
import type { NodeID } from '../graph-db/index.js';
/**
 * Root namespaces that don't require linkTo
 */
export declare const ROOT_NAMESPACES: readonly ["project", "research", "patterns"];
/**
 * Check if a namespace is a root namespace
 * @param namespace - Namespace to check
 * @returns True if namespace is a root namespace
 */
export declare function isRootNamespace(namespace: string): boolean;
/**
 * Validate namespace format
 * @param namespace - Namespace to validate
 * @throws {NamespaceValidationError} If namespace is invalid
 *
 * Valid examples:
 * - 'project'
 * - 'research/literature'
 * - 'project/api-design'
 *
 * Invalid examples:
 * - 'Research/Papers' (uppercase)
 * - 'project/' (trailing slash)
 * - '_private' (underscore)
 * - 'project//api' (double slash)
 */
export declare function validateNamespace(namespace: string): void;
/**
 * Validate orphan prevention rules
 * Non-root namespaces must provide linkTo to prevent orphaned nodes
 *
 * @param namespace - Namespace being used
 * @param linkTo - Optional node to link to
 * @throws {OrphanNodeError} If non-root namespace lacks linkTo
 */
export declare function validateOrphanPrevention(namespace: string, linkTo?: NodeID): void;
//# sourceMappingURL=validation.d.ts.map