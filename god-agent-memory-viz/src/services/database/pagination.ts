/**
 * Pagination and Chunking Utilities
 *
 * Provides utilities for paginating large datasets and progressive loading
 * to maintain UI responsiveness.
 *
 * @module services/database/pagination
 */

import { PAGINATION, PERFORMANCE_THRESHOLDS, DATA_LIMITS } from '@/constants/defaults';

/**
 * Pagination state for offset-based pagination
 */
export interface PaginationState {
  /** Current page number (1-indexed) */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Total number of items */
  totalItems: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there's a next page */
  hasNextPage: boolean;
  /** Whether there's a previous page */
  hasPreviousPage: boolean;
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  /** Items for the current page */
  items: T[];
  /** Pagination state */
  pagination: PaginationState;
}

/**
 * Cursor for cursor-based pagination
 */
export interface Cursor {
  /** ID of the last item */
  lastId: number | string;
  /** Timestamp of the last item (for time-ordered data) */
  lastTimestamp?: Date;
  /** Sort field used */
  sortField: string;
  /** Sort direction */
  sortDirection: 'asc' | 'desc';
}

/**
 * Cursor-based pagination result
 */
export interface CursorResult<T> {
  /** Items in this batch */
  items: T[];
  /** Cursor for the next batch, null if no more data */
  nextCursor: Cursor | null;
  /** Whether there are more items */
  hasMore: boolean;
}

/**
 * Progress callback for chunked loading
 */
export type ChunkProgressCallback = (progress: ChunkProgress) => void;

/**
 * Progress state for chunked loading
 */
export interface ChunkProgress {
  /** Number of items loaded so far */
  loaded: number;
  /** Total items to load */
  total: number;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Current chunk number */
  currentChunk: number;
  /** Total number of chunks */
  totalChunks: number;
  /** Whether loading is complete */
  complete: boolean;
}

/**
 * Creates a pagination state object
 */
export function createPaginationState(
  page: number,
  pageSize: number,
  totalItems: number
): PaginationState {
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const validPage = Math.max(1, Math.min(page, totalPages));

  return {
    page: validPage,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: validPage < totalPages,
    hasPreviousPage: validPage > 1,
  };
}

/**
 * Calculates offset for SQL queries
 */
export function calculateOffset(page: number, pageSize: number): number {
  return (Math.max(1, page) - 1) * pageSize;
}

/**
 * Paginates an in-memory array
 */
export function paginateArray<T>(
  items: T[],
  page: number,
  pageSize: number = PAGINATION.defaultPageSize
): PaginatedResult<T> {
  const offset = calculateOffset(page, pageSize);
  const paginatedItems = items.slice(offset, offset + pageSize);
  const pagination = createPaginationState(page, pageSize, items.length);

  return {
    items: paginatedItems,
    pagination,
  };
}

/**
 * Creates a cursor from the last item in a result set
 */
export function createCursor<T extends Record<string, unknown>>(
  lastItem: T,
  sortField: string = 'id',
  sortDirection: 'asc' | 'desc' = 'asc'
): Cursor {
  const cursor: Cursor = {
    lastId: lastItem.id as number | string,
    sortField,
    sortDirection,
  };

  // Include timestamp if available for time-ordered queries
  if ('timestamp' in lastItem && lastItem.timestamp instanceof Date) {
    cursor.lastTimestamp = lastItem.timestamp;
  } else if ('createdAt' in lastItem && lastItem.createdAt instanceof Date) {
    cursor.lastTimestamp = lastItem.createdAt;
  }

  return cursor;
}

/**
 * Applies cursor-based pagination to an in-memory array
 */
export function applyCursorPagination<T extends { id: number | string }>(
  items: T[],
  cursor: Cursor | null,
  limit: number = DATA_LIMITS.defaultPageSize
): CursorResult<T> {
  let startIndex = 0;

  if (cursor) {
    const cursorIndex = items.findIndex((item) => item.id === cursor.lastId);
    if (cursorIndex !== -1) {
      startIndex = cursorIndex + 1;
    }
  }

  const paginatedItems = items.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < items.length;

  return {
    items: paginatedItems,
    nextCursor:
      hasMore && paginatedItems.length > 0
        ? createCursor(
            paginatedItems[paginatedItems.length - 1] as T & Record<string, unknown>,
            cursor?.sortField ?? 'id',
            cursor?.sortDirection ?? 'asc'
          )
        : null,
    hasMore,
  };
}

/**
 * Chunks an array into smaller pieces for progressive loading
 */
export function chunkArray<T>(
  items: T[],
  chunkSize: number = PERFORMANCE_THRESHOLDS.chunkSize
): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Processes items in chunks with progress callback and delay between chunks
 */
export async function processInChunks<T, R>(
  items: T[],
  processor: (chunk: T[], chunkIndex: number) => R | Promise<R>,
  options?: {
    chunkSize?: number;
    delayMs?: number;
    onProgress?: ChunkProgressCallback;
  }
): Promise<R[]> {
  const chunkSize = options?.chunkSize ?? PERFORMANCE_THRESHOLDS.chunkSize;
  const delayMs = options?.delayMs ?? PERFORMANCE_THRESHOLDS.chunkDelayMs;
  const onProgress = options?.onProgress;

  const chunks = chunkArray(items, chunkSize);
  const results: R[] = [];
  let loaded = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const result = await processor(chunk, i);
    results.push(result);
    loaded += chunk.length;

    if (onProgress) {
      onProgress({
        loaded,
        total: items.length,
        percentage: Math.round((loaded / items.length) * 100),
        currentChunk: i + 1,
        totalChunks: chunks.length,
        complete: i === chunks.length - 1,
      });
    }

    // Yield to UI between chunks (except for the last chunk)
    if (i < chunks.length - 1 && delayMs > 0) {
      await delay(delayMs);
    }
  }

  return results;
}

/**
 * Loads items progressively with accumulated results
 */
export async function loadProgressively<T>(
  items: T[],
  onChunkLoaded: (accumulated: T[], newItems: T[], progress: ChunkProgress) => void,
  options?: {
    chunkSize?: number;
    delayMs?: number;
  }
): Promise<T[]> {
  const accumulated: T[] = [];

  await processInChunks(
    items,
    (chunk) => {
      accumulated.push(...chunk);
      return chunk;
    },
    {
      ...options,
      onProgress: (progress) => {
        const lastChunkSize =
          progress.currentChunk === progress.totalChunks
            ? items.length % (options?.chunkSize ?? PERFORMANCE_THRESHOLDS.chunkSize) ||
              (options?.chunkSize ?? PERFORMANCE_THRESHOLDS.chunkSize)
            : options?.chunkSize ?? PERFORMANCE_THRESHOLDS.chunkSize;
        const newItems = accumulated.slice(-lastChunkSize);
        onChunkLoaded(accumulated, newItems, progress);
      },
    }
  );

  return accumulated;
}

/**
 * Creates an async iterator for paginated data fetching
 */
export async function* paginatedIterator<T>(
  fetchPage: (page: number, pageSize: number) => Promise<PaginatedResult<T>>,
  pageSize: number = PAGINATION.defaultPageSize
): AsyncGenerator<T[], void, unknown> {
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const result = await fetchPage(page, pageSize);
    yield result.items;

    hasMore = result.pagination.hasNextPage;
    page++;
  }
}

/**
 * Creates an async iterator for cursor-based data fetching
 */
export async function* cursorIterator<T>(
  fetchBatch: (cursor: Cursor | null, limit: number) => Promise<CursorResult<T>>,
  limit: number = DATA_LIMITS.defaultPageSize
): AsyncGenerator<T[], void, unknown> {
  let cursor: Cursor | null = null;
  let hasMore = true;

  while (hasMore) {
    const result = await fetchBatch(cursor, limit);
    yield result.items;

    hasMore = result.hasMore;
    cursor = result.nextCursor;
  }
}

/**
 * Validates page size against limits
 */
export function validatePageSize(pageSize: number): number {
  return Math.max(1, Math.min(pageSize, DATA_LIMITS.maxPageSize));
}

/**
 * Validates page number
 */
export function validatePageNumber(page: number, totalPages: number): number {
  return Math.max(1, Math.min(page, totalPages || 1));
}

/**
 * Calculates visible page numbers for pagination UI
 */
export function getVisiblePageNumbers(
  currentPage: number,
  totalPages: number,
  maxVisible: number = PAGINATION.visiblePages
): number[] {
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const half = Math.floor(maxVisible / 2);
  let start = Math.max(1, currentPage - half);
  const end = Math.min(totalPages, start + maxVisible - 1);

  // Adjust start if we're near the end
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }

  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/**
 * Utility function for delay
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
