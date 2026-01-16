/**
 * Memory query functions for God Agent Memory Visualization
 *
 * Provides comprehensive query functions for the memory_entries table with
 * filtering, pagination, aggregation, and hierarchical key analysis.
 *
 * @module services/database/queries/memoryQueries
 */

import { getDatabaseService } from '../DatabaseService';
import { safeParseJSON } from '@/utils/validation';
import type {
  MemoryEntry,
  MemoryMetadata,
  MemoryQueryFilters,
  QueryOptions,
} from '@/types/database';

/**
 * Raw memory entry row type for query results
 * Uses Record to satisfy DatabaseService.query constraints
 */
interface RawMemoryEntryRow extends Record<string, unknown> {
  id: number;
  key: string;
  value: string;
  namespace: string;
  metadata: string | null;
  embedding: Uint8Array | null;
  created_at: string;
  updated_at: string;
  accessed_at: string;
  access_count: number;
}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Namespace count aggregation result
 */
export interface NamespaceCount {
  namespace: string;
  count: number;
}

/**
 * Namespace statistics with additional metrics
 */
export interface NamespaceStats {
  namespace: string;
  entryCount: number;
  totalAccessCount: number;
  avgAccessCount: number;
  entriesWithEmbeddings: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
}

/**
 * Date range result for memory entries
 */
export interface MemoryDateRange {
  earliest: Date | null;
  latest: Date | null;
}

/**
 * Key hierarchy node for tree representation
 */
export interface KeyHierarchyNode {
  key: string;
  segment: string;
  depth: number;
  fullPath: string;
  children: KeyHierarchyNode[];
  entryCount: number;
}

/**
 * Memory entries grouped by namespace
 */
export interface NamespaceGroup {
  namespace: string;
  entries: MemoryEntry[];
  entryCount: number;
}

// ============================================================================
// Transform Functions
// ============================================================================

/**
 * Transform a raw database row into a typed MemoryEntry
 * @param row - Raw memory entry row from database
 * @returns Parsed and typed memory entry object
 */
export function transformMemoryEntry(row: RawMemoryEntryRow): MemoryEntry {
  let parsedMetadata: MemoryMetadata | null = null;
  if (row.metadata) {
    try {
      const parsed = JSON.parse(row.metadata);
      parsedMetadata = parsed as MemoryMetadata;
    } catch {
      parsedMetadata = null;
    }
  }

  return {
    id: row.id,
    key: row.key,
    value: safeParseJSON<unknown>(row.value, row.value),
    namespace: row.namespace,
    metadata: parsedMetadata,
    hasEmbedding: row.embedding !== null && row.embedding !== undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    accessedAt: new Date(row.accessed_at),
    accessCount: row.access_count,
  };
}

// ============================================================================
// Query Builder Functions
// ============================================================================

/**
 * Build WHERE clause from memory filter options
 * @param filters - Query filters
 * @returns Object with clause string and parameter values
 */
export function buildMemoryWhereClause(filters: MemoryQueryFilters): {
  clause: string;
  params: (string | number)[];
} {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.namespaces && filters.namespaces.length > 0) {
    const placeholders = filters.namespaces.map(() => '?').join(', ');
    conditions.push(`namespace IN (${placeholders})`);
    params.push(...filters.namespaces);
  }

  if (filters.keyPattern) {
    // Convert glob-style wildcards to SQL LIKE pattern
    // * becomes % for multi-character match
    // ? becomes _ for single character match
    const likePattern = filters.keyPattern
      .replace(/\*/g, '%')
      .replace(/\?/g, '_');
    conditions.push('key LIKE ?');
    params.push(likePattern);
  }

  if (filters.hasEmbedding !== undefined) {
    if (filters.hasEmbedding) {
      conditions.push('embedding IS NOT NULL');
    } else {
      conditions.push('embedding IS NULL');
    }
  }

  if (filters.minAccessCount !== undefined && filters.minAccessCount > 0) {
    conditions.push('access_count >= ?');
    params.push(filters.minAccessCount);
  }

  if (filters.searchText) {
    conditions.push('(key LIKE ? OR value LIKE ? OR namespace LIKE ?)');
    const searchPattern = `%${filters.searchText}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

/**
 * Build ORDER BY clause from memory query options
 * @param options - Query options
 * @returns ORDER BY clause string
 */
export function buildMemoryOrderClause(options: QueryOptions): string {
  const column = options.orderBy || 'updated_at';
  const direction = options.orderDirection || 'DESC';

  // Whitelist of allowed columns to prevent SQL injection
  const allowedColumns = [
    'id',
    'key',
    'namespace',
    'created_at',
    'updated_at',
    'accessed_at',
    'access_count',
  ];

  if (!allowedColumns.includes(column)) {
    return 'ORDER BY updated_at DESC';
  }

  return `ORDER BY ${column} ${direction}`;
}

/**
 * Build LIMIT/OFFSET clause from memory query options
 * @param options - Query options
 * @returns Object with clause string and parameter values
 */
export function buildMemoryLimitClause(options: QueryOptions): {
  clause: string;
  params: number[];
} {
  const params: number[] = [];
  let clause = '';

  if (options.limit !== undefined && options.limit > 0) {
    clause = 'LIMIT ?';
    params.push(options.limit);

    if (options.offset !== undefined && options.offset > 0) {
      clause += ' OFFSET ?';
      params.push(options.offset);
    }
  }

  return { clause, params };
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get memory entries with filtering and pagination
 * @param filters - Optional filter criteria
 * @param options - Optional pagination and ordering options
 * @returns Array of parsed memory entries
 */
export function getMemoryEntries(
  filters: MemoryQueryFilters = {},
  options: QueryOptions = {}
): MemoryEntry[] {
  const db = getDatabaseService();
  const where = buildMemoryWhereClause(filters);
  const order = buildMemoryOrderClause(options);
  const limit = buildMemoryLimitClause(options);

  const sql = `
    SELECT id, key, value, namespace, metadata, embedding,
           created_at, updated_at, accessed_at, access_count
    FROM memory_entries
    ${where.clause}
    ${order}
    ${limit.clause}
  `;

  const params = [...where.params, ...limit.params];
  const result = db.query<RawMemoryEntryRow>(sql, params);

  return result.rows.map(transformMemoryEntry);
}

/**
 * Get a single memory entry by ID
 * @param id - Memory entry ID
 * @returns Memory entry or null if not found
 */
export function getMemoryEntryById(id: number): MemoryEntry | null {
  const db = getDatabaseService();
  const sql = `
    SELECT id, key, value, namespace, metadata, embedding,
           created_at, updated_at, accessed_at, access_count
    FROM memory_entries
    WHERE id = ?
  `;

  const row = db.queryOne<RawMemoryEntryRow>(sql, [id]);
  return row ? transformMemoryEntry(row) : null;
}

/**
 * Get a single memory entry by key
 * @param key - Memory key
 * @returns Memory entry or null if not found
 */
export function getMemoryEntryByKey(key: string): MemoryEntry | null {
  const db = getDatabaseService();
  const sql = `
    SELECT id, key, value, namespace, metadata, embedding,
           created_at, updated_at, accessed_at, access_count
    FROM memory_entries
    WHERE key = ?
  `;

  const row = db.queryOne<RawMemoryEntryRow>(sql, [key]);
  return row ? transformMemoryEntry(row) : null;
}

/**
 * Get total count of memory entries matching filters
 * @param filters - Optional filter criteria
 * @returns Memory entry count
 */
export function getMemoryEntryCount(filters: MemoryQueryFilters = {}): number {
  const db = getDatabaseService();
  const where = buildMemoryWhereClause(filters);

  const sql = `SELECT COUNT(*) as count FROM memory_entries ${where.clause}`;
  const result = db.queryOne<{ count: number }>(sql, where.params);

  return result?.count ?? 0;
}

/**
 * Get all unique namespaces from memory entries
 * @returns Array of unique namespace strings
 */
export function getUniqueNamespaces(): string[] {
  const db = getDatabaseService();
  const sql = `
    SELECT DISTINCT namespace
    FROM memory_entries
    ORDER BY namespace ASC
  `;

  const result = db.query<{ namespace: string }>(sql);
  return result.rows.map((row) => row.namespace);
}

/**
 * Get detailed statistics for each namespace
 * @returns Array of namespace statistics
 */
export function getNamespaceStats(): NamespaceStats[] {
  const db = getDatabaseService();
  const sql = `
    SELECT
      namespace,
      COUNT(*) as entry_count,
      SUM(access_count) as total_access_count,
      AVG(access_count) as avg_access_count,
      SUM(CASE WHEN embedding IS NOT NULL THEN 1 ELSE 0 END) as entries_with_embeddings,
      MIN(created_at) as oldest_entry,
      MAX(created_at) as newest_entry
    FROM memory_entries
    GROUP BY namespace
    ORDER BY entry_count DESC
  `;

  const result = db.query<{
    namespace: string;
    entry_count: number;
    total_access_count: number;
    avg_access_count: number;
    entries_with_embeddings: number;
    oldest_entry: string | null;
    newest_entry: string | null;
  }>(sql);

  return result.rows.map((row) => ({
    namespace: row.namespace,
    entryCount: row.entry_count,
    totalAccessCount: row.total_access_count ?? 0,
    avgAccessCount: row.avg_access_count ?? 0,
    entriesWithEmbeddings: row.entries_with_embeddings ?? 0,
    oldestEntry: row.oldest_entry ? new Date(row.oldest_entry) : null,
    newestEntry: row.newest_entry ? new Date(row.newest_entry) : null,
  }));
}

/**
 * Get memory entries for a specific namespace
 * @param namespace - Namespace to filter by
 * @param options - Optional pagination and ordering options
 * @returns Array of memory entries in the namespace
 */
export function getMemoryEntriesByNamespace(
  namespace: string,
  options: QueryOptions = {}
): MemoryEntry[] {
  return getMemoryEntries({ namespaces: [namespace] }, options);
}

/**
 * Get memory entries matching a key pattern
 * @param pattern - Key pattern with wildcards (* for multi, ? for single)
 * @param options - Optional pagination and ordering options
 * @returns Array of matching memory entries
 */
export function getMemoryEntriesByKeyPattern(
  pattern: string,
  options: QueryOptions = {}
): MemoryEntry[] {
  return getMemoryEntries({ keyPattern: pattern }, options);
}

/**
 * Get the most frequently accessed memory entries
 * @param limit - Maximum number of entries to return
 * @returns Array of most accessed memory entries
 */
export function getMostAccessedEntries(limit: number = 10): MemoryEntry[] {
  return getMemoryEntries(
    {},
    {
      orderBy: 'access_count',
      orderDirection: 'DESC',
      limit,
    }
  );
}

/**
 * Get the most recently updated memory entries
 * @param limit - Maximum number of entries to return
 * @returns Array of recently updated memory entries
 */
export function getRecentlyUpdatedEntries(limit: number = 10): MemoryEntry[] {
  return getMemoryEntries(
    {},
    {
      orderBy: 'updated_at',
      orderDirection: 'DESC',
      limit,
    }
  );
}

/**
 * Get memory entries that have vector embeddings
 * @param options - Optional pagination and ordering options
 * @returns Array of memory entries with embeddings
 */
export function getEntriesWithEmbeddings(options: QueryOptions = {}): MemoryEntry[] {
  return getMemoryEntries({ hasEmbedding: true }, options);
}

/**
 * Get the date range of all memory entries
 * @returns Object with earliest and latest entry timestamps
 */
export function getMemoryDateRange(): MemoryDateRange {
  const db = getDatabaseService();
  const sql = `
    SELECT
      MIN(created_at) as earliest,
      MAX(updated_at) as latest
    FROM memory_entries
  `;

  const result = db.queryOne<{ earliest: string | null; latest: string | null }>(sql);

  return {
    earliest: result?.earliest ? new Date(result.earliest) : null,
    latest: result?.latest ? new Date(result.latest) : null,
  };
}

/**
 * Search memory entries by text in key, value, or namespace
 * @param searchText - Text to search for
 * @param options - Optional pagination and ordering options
 * @returns Array of matching memory entries
 */
export function searchMemoryEntries(
  searchText: string,
  options: QueryOptions = {}
): MemoryEntry[] {
  return getMemoryEntries({ searchText }, options);
}

/**
 * Build a hierarchical tree structure from memory keys
 * Keys are expected to be path-like (e.g., 'project/api/users')
 * @returns Root nodes of the key hierarchy
 */
export function getKeyHierarchy(): KeyHierarchyNode[] {
  const db = getDatabaseService();
  const sql = `
    SELECT key, COUNT(*) as entry_count
    FROM memory_entries
    GROUP BY key
    ORDER BY key ASC
  `;

  const result = db.query<{ key: string; entry_count: number }>(sql);

  // Build hierarchy from flat key list
  const rootNodes: KeyHierarchyNode[] = [];
  const nodeMap = new Map<string, KeyHierarchyNode>();

  for (const row of result.rows) {
    const segments = row.key.split('/');
    let currentPath = '';

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;

      if (!nodeMap.has(currentPath)) {
        const node: KeyHierarchyNode = {
          key: currentPath,
          segment,
          depth: i,
          fullPath: currentPath,
          children: [],
          entryCount: 0,
        };
        nodeMap.set(currentPath, node);

        if (parentPath) {
          const parentNode = nodeMap.get(parentPath);
          if (parentNode) {
            parentNode.children.push(node);
          }
        } else {
          rootNodes.push(node);
        }
      }

      // Only count at the leaf level (full key match)
      if (currentPath === row.key) {
        const node = nodeMap.get(currentPath);
        if (node) {
          node.entryCount = row.entry_count;
        }
      }
    }
  }

  // Propagate entry counts up the tree
  function propagateCounts(node: KeyHierarchyNode): number {
    let total = node.entryCount;
    for (const child of node.children) {
      total += propagateCounts(child);
    }
    return total;
  }

  for (const root of rootNodes) {
    propagateCounts(root);
  }

  return rootNodes;
}

/**
 * Get memory entries grouped by namespace
 * @param options - Optional pagination and ordering options (applied within each group)
 * @returns Array of namespace groups with their entries
 */
export function getEntriesGroupedByNamespace(
  options: QueryOptions = {}
): NamespaceGroup[] {
  const namespaces = getUniqueNamespaces();
  const groups: NamespaceGroup[] = [];

  for (const namespace of namespaces) {
    const entries = getMemoryEntriesByNamespace(namespace, options);
    groups.push({
      namespace,
      entries,
      entryCount: entries.length,
    });
  }

  // Sort groups by entry count descending
  groups.sort((a, b) => b.entryCount - a.entryCount);

  return groups;
}
