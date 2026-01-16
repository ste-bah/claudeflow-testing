/**
 * Integration tests for pagination and chunking utilities
 *
 * @module services/database/__tests__/pagination.test
 */

import { describe, it, expect } from 'vitest';
import {
  createPaginationState,
  calculateOffset,
  paginateArray,
  createCursor,
  applyCursorPagination,
  chunkArray,
  processInChunks,
  loadProgressively,
  validatePageSize,
  validatePageNumber,
  getVisiblePageNumbers,
} from '../pagination';

describe('Pagination Utilities', () => {
  describe('createPaginationState', () => {
    it('creates pagination state with correct values', () => {
      const state = createPaginationState(2, 10, 45);

      expect(state.page).toBe(2);
      expect(state.pageSize).toBe(10);
      expect(state.totalItems).toBe(45);
      expect(state.totalPages).toBe(5);
      expect(state.hasNextPage).toBe(true);
      expect(state.hasPreviousPage).toBe(true);
    });

    it('handles first page correctly', () => {
      const state = createPaginationState(1, 10, 45);

      expect(state.hasNextPage).toBe(true);
      expect(state.hasPreviousPage).toBe(false);
    });

    it('handles last page correctly', () => {
      const state = createPaginationState(5, 10, 45);

      expect(state.hasNextPage).toBe(false);
      expect(state.hasPreviousPage).toBe(true);
    });

    it('clamps page number to valid range', () => {
      const tooHigh = createPaginationState(100, 10, 45);
      expect(tooHigh.page).toBe(5);

      const tooLow = createPaginationState(0, 10, 45);
      expect(tooLow.page).toBe(1);
    });

    it('handles empty dataset', () => {
      const state = createPaginationState(1, 10, 0);

      expect(state.totalPages).toBe(1);
      expect(state.hasNextPage).toBe(false);
      expect(state.hasPreviousPage).toBe(false);
    });
  });

  describe('calculateOffset', () => {
    it('calculates correct offset for given page', () => {
      expect(calculateOffset(1, 10)).toBe(0);
      expect(calculateOffset(2, 10)).toBe(10);
      expect(calculateOffset(3, 25)).toBe(50);
    });

    it('handles page 0 or negative as page 1', () => {
      expect(calculateOffset(0, 10)).toBe(0);
      expect(calculateOffset(-1, 10)).toBe(0);
    });
  });

  describe('paginateArray', () => {
    const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));

    it('returns correct items for a page', () => {
      const result = paginateArray(items, 2, 10);

      expect(result.items).toHaveLength(10);
      expect(result.items[0].id).toBe(11);
      expect(result.items[9].id).toBe(20);
    });

    it('returns correct items for last page', () => {
      const result = paginateArray(items, 3, 10);

      expect(result.items).toHaveLength(5);
      expect(result.items[0].id).toBe(21);
    });

    it('includes pagination state', () => {
      const result = paginateArray(items, 2, 10);

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.totalItems).toBe(25);
    });
  });

  describe('createCursor', () => {
    it('creates cursor from last item', () => {
      const item = { id: 42, name: 'test' };
      const cursor = createCursor(item);

      expect(cursor.lastId).toBe(42);
      expect(cursor.sortField).toBe('id');
      expect(cursor.sortDirection).toBe('asc');
    });

    it('includes timestamp if available', () => {
      const item = { id: 42, timestamp: new Date('2024-01-01') };
      const cursor = createCursor(item);

      expect(cursor.lastTimestamp).toEqual(new Date('2024-01-01'));
    });
  });

  describe('applyCursorPagination', () => {
    const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));

    it('returns first batch when cursor is null', () => {
      const result = applyCursorPagination(items, null, 10);

      expect(result.items).toHaveLength(10);
      expect(result.items[0].id).toBe(1);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeDefined();
    });

    it('returns items after cursor position', () => {
      const cursor = { lastId: 10, sortField: 'id', sortDirection: 'asc' as const };
      const result = applyCursorPagination(items, cursor, 10);

      expect(result.items).toHaveLength(10);
      expect(result.items[0].id).toBe(11);
    });

    it('returns no more items when exhausted', () => {
      const cursor = { lastId: 20, sortField: 'id', sortDirection: 'asc' as const };
      const result = applyCursorPagination(items, cursor, 10);

      expect(result.items).toHaveLength(5);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });
  });
});

describe('Chunking Utilities', () => {
  describe('chunkArray', () => {
    it('splits array into chunks of specified size', () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const chunks = chunkArray(items, 3);

      expect(chunks).toHaveLength(4);
      expect(chunks[0]).toEqual([1, 2, 3]);
      expect(chunks[1]).toEqual([4, 5, 6]);
      expect(chunks[2]).toEqual([7, 8, 9]);
      expect(chunks[3]).toEqual([10]);
    });

    it('returns single chunk for small arrays', () => {
      const items = [1, 2, 3];
      const chunks = chunkArray(items, 10);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toEqual([1, 2, 3]);
    });

    it('handles empty array', () => {
      const chunks = chunkArray([], 10);

      expect(chunks).toHaveLength(0);
    });
  });

  describe('processInChunks', () => {
    it('processes all chunks and returns results', async () => {
      const items = [1, 2, 3, 4, 5];
      const results = await processInChunks(
        items,
        (chunk) => chunk.map((x) => x * 2),
        { chunkSize: 2, delayMs: 0 }
      );

      expect(results).toHaveLength(3);
      expect(results.flat()).toEqual([2, 4, 6, 8, 10]);
    });

    it('calls progress callback', async () => {
      const items = [1, 2, 3, 4, 5];
      const progressCalls: number[] = [];

      await processInChunks(
        items,
        (chunk) => chunk,
        {
          chunkSize: 2,
          delayMs: 0,
          onProgress: (p) => progressCalls.push(p.percentage),
        }
      );

      expect(progressCalls).toContain(100);
      expect(progressCalls.length).toBe(3);
    });
  });

  describe('loadProgressively', () => {
    it('accumulates items across chunks', async () => {
      const items = [1, 2, 3, 4, 5];
      const accumulated: number[][] = [];

      await loadProgressively(
        items,
        (acc) => accumulated.push([...acc]),
        { chunkSize: 2, delayMs: 0 }
      );

      expect(accumulated[accumulated.length - 1]).toEqual([1, 2, 3, 4, 5]);
    });
  });
});

describe('Validation Utilities', () => {
  describe('validatePageSize', () => {
    it('clamps page size to valid range', () => {
      expect(validatePageSize(0)).toBe(1);
      expect(validatePageSize(-5)).toBe(1);
      expect(validatePageSize(50)).toBe(50);
      expect(validatePageSize(10000)).toBe(1000); // MAX_PAGE_SIZE
    });
  });

  describe('validatePageNumber', () => {
    it('clamps page number to valid range', () => {
      expect(validatePageNumber(0, 10)).toBe(1);
      expect(validatePageNumber(5, 10)).toBe(5);
      expect(validatePageNumber(15, 10)).toBe(10);
    });

    it('handles zero total pages', () => {
      expect(validatePageNumber(1, 0)).toBe(1);
    });
  });

  describe('getVisiblePageNumbers', () => {
    it('returns all pages when total is less than max visible', () => {
      const pages = getVisiblePageNumbers(1, 3, 5);
      expect(pages).toEqual([1, 2, 3]);
    });

    it('centers around current page', () => {
      const pages = getVisiblePageNumbers(5, 10, 5);
      expect(pages).toEqual([3, 4, 5, 6, 7]);
    });

    it('adjusts at the start', () => {
      const pages = getVisiblePageNumbers(1, 10, 5);
      expect(pages).toEqual([1, 2, 3, 4, 5]);
    });

    it('adjusts at the end', () => {
      const pages = getVisiblePageNumbers(10, 10, 5);
      expect(pages).toEqual([6, 7, 8, 9, 10]);
    });
  });
});
