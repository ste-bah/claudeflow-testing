import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { NewsApiResponse, NewsArticleRaw } from '../../types/news';

// ---------------------------------------------------------------------------
// Mock the API client
// ---------------------------------------------------------------------------

const mockGetNews = vi.fn<(symbol: string, opts?: { limit?: number; offset?: number }) => Promise<NewsApiResponse>>();

vi.mock('../../api/client', () => ({
  getNews: (...args: [string, { limit?: number; offset?: number }?]) =>
    mockGetNews(...(args as [string, { limit?: number; offset?: number } | undefined])),
}));

// ---------------------------------------------------------------------------
// Import AFTER mock setup
// ---------------------------------------------------------------------------

import { useNewsFeed, clearNewsFeedCache } from '../../hooks/useNewsFeed';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a valid raw backend article. */
function makeRawArticle(overrides: Partial<NewsArticleRaw> = {}): NewsArticleRaw {
  return {
    id: `article-${Math.random().toString(36).slice(2, 8)}`,
    headline: 'Test Headline',
    summary: 'Summary text.',
    source: 'Reuters',
    url: 'https://example.com/article',
    image_url: null,
    published_at: '2024-06-15T10:30:00Z',
    category: 'technology',
    related_tickers: ['AAPL'],
    sentiment: null,
    ...overrides,
  };
}

/** Build a minimal valid NewsApiResponse. */
function makeResponse(
  articles: NewsArticleRaw[],
  overrides: Partial<NewsApiResponse> = {},
): NewsApiResponse {
  return {
    symbol: 'AAPL',
    articles,
    total_count: articles.length,
    limit: 20,
    offset: 0,
    data_source: 'finnhub',
    data_timestamp: '2024-06-15T10:30:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('useNewsFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearNewsFeedCache();
  });

  // -------------------------------------------------------------------------
  // 1. Empty symbol
  // -------------------------------------------------------------------------

  describe('empty symbol', () => {
    it('should return empty state immediately without fetching', () => {
      const { result } = renderHook(() => useNewsFeed(''));

      expect(result.current.articles).toEqual([]);
      expect(result.current.totalCount).toBe(0);
      expect(result.current.hasMore).toBe(false);
      expect(result.current.loading).toBe(false);
      expect(result.current.loadingMore).toBe(false);
      expect(result.current.error).toBeNull();
      expect(mockGetNews).not.toHaveBeenCalled();
    });

    it('should reset state when symbol changes from valid to empty', async () => {
      const articles = [makeRawArticle({ id: 'a1', headline: 'Headline A' })];
      mockGetNews.mockResolvedValueOnce(makeResponse(articles, { total_count: 1 }));

      const { result, rerender } = renderHook(
        ({ symbol }: { symbol: string }) => useNewsFeed(symbol),
        { initialProps: { symbol: 'AAPL' } },
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.articles).toHaveLength(1);

      // Change to empty symbol
      rerender({ symbol: '' });

      expect(result.current.articles).toEqual([]);
      expect(result.current.totalCount).toBe(0);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Successful initial fetch
  // -------------------------------------------------------------------------

  describe('successful initial fetch', () => {
    it('should fetch and normalise articles on mount', async () => {
      const rawArticles = [
        makeRawArticle({ id: 'a1', headline: 'First' }),
        makeRawArticle({ id: 'a2', headline: 'Second' }),
      ];
      mockGetNews.mockResolvedValueOnce(
        makeResponse(rawArticles, { total_count: 2 }),
      );

      const { result } = renderHook(() => useNewsFeed('AAPL'));

      // Initially loading
      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.articles).toHaveLength(2);
      expect(result.current.totalCount).toBe(2);
      expect(result.current.error).toBeNull();
      expect(mockGetNews).toHaveBeenCalledWith('AAPL', { limit: 20, offset: 0 });
      expect(mockGetNews).toHaveBeenCalledTimes(1);
    });

    it('should filter out articles with null headline', async () => {
      const rawArticles = [
        makeRawArticle({ id: 'good', headline: 'Valid' }),
        makeRawArticle({ id: 'bad', headline: null }),
      ];
      mockGetNews.mockResolvedValueOnce(
        makeResponse(rawArticles, { total_count: 2 }),
      );

      const { result } = renderHook(() => useNewsFeed('TSLA'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.articles).toHaveLength(1);
      expect(result.current.articles[0].headline).toBe('Valid');
    });

    it('should sort articles by publishedAt descending', async () => {
      const rawArticles = [
        makeRawArticle({ id: 'old', headline: 'Old', published_at: '2024-01-01T00:00:00Z' }),
        makeRawArticle({ id: 'new', headline: 'New', published_at: '2024-12-01T00:00:00Z' }),
        makeRawArticle({ id: 'mid', headline: 'Mid', published_at: '2024-06-01T00:00:00Z' }),
      ];
      mockGetNews.mockResolvedValueOnce(
        makeResponse(rawArticles, { total_count: 3 }),
      );

      const { result } = renderHook(() => useNewsFeed('GOOG'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.articles[0].id).toBe('new');
      expect(result.current.articles[1].id).toBe('mid');
      expect(result.current.articles[2].id).toBe('old');
    });

    it('should handle response with non-array articles field', async () => {
      const response = makeResponse([]);
      const badResponse = {
        ...response,
        articles: 'not-an-array',
      } as unknown as NewsApiResponse;
      mockGetNews.mockResolvedValueOnce(badResponse);

      const { result } = renderHook(() => useNewsFeed('MSFT'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.articles).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should handle empty articles array', async () => {
      mockGetNews.mockResolvedValueOnce(
        makeResponse([], { total_count: 0 }),
      );

      const { result } = renderHook(() => useNewsFeed('XYZ'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.articles).toEqual([]);
      expect(result.current.totalCount).toBe(0);
      expect(result.current.hasMore).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Cache behaviour
  // -------------------------------------------------------------------------

  describe('cache hit', () => {
    it('should serve cached data on re-mount within TTL', async () => {
      const rawArticles = [makeRawArticle({ id: 'cached', headline: 'Cached' })];
      mockGetNews.mockResolvedValueOnce(
        makeResponse(rawArticles, { total_count: 1 }),
      );

      // First mount -- triggers fetch
      const { result, unmount } = renderHook(() => useNewsFeed('AAPL'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.articles).toHaveLength(1);
      expect(mockGetNews).toHaveBeenCalledTimes(1);

      unmount();

      // Second mount within TTL -- cache hit, no new fetch
      const { result: result2 } = renderHook(() => useNewsFeed('AAPL'));

      expect(result2.current.loading).toBe(false);
      expect(result2.current.articles).toHaveLength(1);
      expect(result2.current.articles[0].headline).toBe('Cached');
      expect(result2.current.error).toBeNull();
      expect(mockGetNews).toHaveBeenCalledTimes(1); // still 1
    });

    it('should normalise symbol to uppercase for cache key', async () => {
      const rawArticles = [makeRawArticle({ id: 'c1', headline: 'A' })];
      mockGetNews.mockResolvedValueOnce(
        makeResponse(rawArticles, { total_count: 1 }),
      );

      // Fetch with lowercase
      const { result, unmount } = renderHook(() => useNewsFeed('aapl'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(mockGetNews).toHaveBeenCalledTimes(1);

      unmount();

      // Fetch with uppercase -- cache hit
      const { result: result2 } = renderHook(() => useNewsFeed('AAPL'));

      expect(result2.current.loading).toBe(false);
      expect(result2.current.articles).toHaveLength(1);
      expect(mockGetNews).toHaveBeenCalledTimes(1);
    });
  });

  describe('cache miss', () => {
    it('should fetch new data after TTL expires', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const rawArticles1 = [makeRawArticle({ id: 'v1', headline: 'Version 1' })];
      const rawArticles2 = [makeRawArticle({ id: 'v2', headline: 'Version 2' })];
      mockGetNews
        .mockResolvedValueOnce(makeResponse(rawArticles1, { total_count: 1 }))
        .mockResolvedValueOnce(makeResponse(rawArticles2, { total_count: 1 }));

      // First fetch
      const { result, unmount } = renderHook(() => useNewsFeed('AAPL'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.articles[0].headline).toBe('Version 1');
      expect(mockGetNews).toHaveBeenCalledTimes(1);

      unmount();

      // Advance time past TTL (5 minutes)
      vi.advanceTimersByTime(300_001);

      // Re-mount -- cache expired, should fetch again
      const { result: result2 } = renderHook(() => useNewsFeed('AAPL'));

      await waitFor(() => {
        expect(result2.current.loading).toBe(false);
      });
      expect(result2.current.articles[0].headline).toBe('Version 2');
      expect(mockGetNews).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should fetch separately for different symbols', async () => {
      const aaplArticles = [makeRawArticle({ id: 'a', headline: 'AAPL News' })];
      const msftArticles = [makeRawArticle({ id: 'm', headline: 'MSFT News' })];
      mockGetNews
        .mockResolvedValueOnce(makeResponse(aaplArticles, { total_count: 1 }))
        .mockResolvedValueOnce(makeResponse(msftArticles, { total_count: 1 }));

      const { result, unmount } = renderHook(() => useNewsFeed('AAPL'));
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.articles[0].headline).toBe('AAPL News');

      unmount();

      const { result: result2 } = renderHook(() => useNewsFeed('MSFT'));
      await waitFor(() => {
        expect(result2.current.loading).toBe(false);
      });
      expect(result2.current.articles[0].headline).toBe('MSFT News');
      expect(mockGetNews).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearNewsFeedCache', () => {
    it('should force a fresh fetch after cache is cleared', async () => {
      const rawArticles = [makeRawArticle({ id: 'c1', headline: 'Cached' })];
      mockGetNews.mockResolvedValue(
        makeResponse(rawArticles, { total_count: 1 }),
      );

      // First fetch
      const { result, unmount } = renderHook(() => useNewsFeed('NVDA'));
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(mockGetNews).toHaveBeenCalledTimes(1);

      unmount();

      // Clear cache
      clearNewsFeedCache();

      // Re-mount should trigger new fetch
      const { result: result2 } = renderHook(() => useNewsFeed('NVDA'));
      await waitFor(() => {
        expect(result2.current.loading).toBe(false);
      });
      expect(mockGetNews).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Error handling and retry
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('should set retrying error message on first failure', async () => {
      mockGetNews.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useNewsFeed('AAPL'));

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to load news. Retrying...');
      });

      expect(result.current.articles).toEqual([]);
    });

    it('should auto-retry after 5 seconds and succeed', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const rawArticles = [makeRawArticle({ id: 'retry', headline: 'After Retry' })];
      mockGetNews
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce(makeResponse(rawArticles, { total_count: 1 }));

      const { result } = renderHook(() => useNewsFeed('AAPL'));

      // Wait for initial failure
      await waitFor(() => {
        expect(result.current.error).toBe('Failed to load news. Retrying...');
      });

      // Advance past retry delay
      await act(async () => {
        vi.advanceTimersByTime(5_000);
      });

      // Wait for retry to complete
      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });

      expect(result.current.articles).toHaveLength(1);
      expect(result.current.articles[0].headline).toBe('After Retry');
      expect(mockGetNews).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should set final error message when retry also fails', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      mockGetNews
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'));

      const { result } = renderHook(() => useNewsFeed('AAPL'));

      // Wait for initial failure
      await waitFor(() => {
        expect(result.current.error).toBe('Failed to load news. Retrying...');
      });

      // Advance past retry delay
      await act(async () => {
        vi.advanceTimersByTime(5_000);
      });

      // Wait for retry failure
      await waitFor(() => {
        expect(result.current.error).toBe('Failed to load news. Please try again later.');
      });

      expect(result.current.articles).toEqual([]);
      expect(mockGetNews).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should use static error messages only (XSS prevention)', async () => {
      mockGetNews.mockRejectedValueOnce(
        new Error('<script>alert("xss")</script>'),
      );

      const { result } = renderHook(() => useNewsFeed('AAPL'));

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      // Error message does not contain any part of the thrown error
      expect(result.current.error).not.toContain('script');
      expect(result.current.error).not.toContain('xss');
      expect(result.current.error).toBe('Failed to load news. Retrying...');
    });
  });

  // -------------------------------------------------------------------------
  // 5. Race condition: symbol change during fetch
  // -------------------------------------------------------------------------

  describe('race condition handling', () => {
    it('should discard stale response when symbol changes during fetch', async () => {
      // First fetch hangs
      let resolveFirst: (value: NewsApiResponse) => void = () => {};
      const pendingFirst = new Promise<NewsApiResponse>((resolve) => {
        resolveFirst = resolve;
      });
      const secondArticles = [makeRawArticle({ id: 's', headline: 'Second Symbol' })];

      mockGetNews
        .mockReturnValueOnce(pendingFirst)
        .mockResolvedValueOnce(makeResponse(secondArticles, { total_count: 1 }));

      const { result, rerender } = renderHook(
        ({ symbol }: { symbol: string }) => useNewsFeed(symbol),
        { initialProps: { symbol: 'AAPL' } },
      );

      expect(result.current.loading).toBe(true);

      // Change symbol before first fetch resolves
      rerender({ symbol: 'MSFT' });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Resolve the stale first request
      await act(async () => {
        resolveFirst(
          makeResponse([makeRawArticle({ id: 'stale', headline: 'Stale' })], { total_count: 1 }),
        );
      });

      // Should show MSFT articles, not the stale AAPL response
      expect(result.current.articles[0].headline).toBe('Second Symbol');
    });

    it('should clear pending retry when symbol changes', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      mockGetNews
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(
          makeResponse([makeRawArticle({ id: 'ok', headline: 'OK' })], { total_count: 1 }),
        );

      const { result, rerender } = renderHook(
        ({ symbol }: { symbol: string }) => useNewsFeed(symbol),
        { initialProps: { symbol: 'AAPL' } },
      );

      // Wait for initial failure and retry message
      await waitFor(() => {
        expect(result.current.error).toBe('Failed to load news. Retrying...');
      });

      // Change symbol before retry fires
      rerender({ symbol: 'MSFT' });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // MSFT fetch should succeed
      expect(result.current.articles[0].headline).toBe('OK');
      expect(result.current.error).toBeNull();

      vi.useRealTimers();
    });
  });

  // -------------------------------------------------------------------------
  // 6. Cancelled flag on unmount
  // -------------------------------------------------------------------------

  describe('cleanup on unmount', () => {
    it('should not update state when unmounted during successful fetch', async () => {
      let resolvePromise: (value: NewsApiResponse) => void = () => {};
      const pendingPromise = new Promise<NewsApiResponse>((resolve) => {
        resolvePromise = resolve;
      });
      mockGetNews.mockReturnValueOnce(pendingPromise);

      const { result, unmount } = renderHook(() => useNewsFeed('AAPL'));

      expect(result.current.loading).toBe(true);

      // Unmount before fetch resolves
      unmount();

      // Resolve -- cancelled flag should prevent state updates
      await act(async () => {
        resolvePromise(
          makeResponse([makeRawArticle({ id: 'x', headline: 'X' })], { total_count: 1 }),
        );
      });

      // No errors means cancelled flag worked
      expect(mockGetNews).toHaveBeenCalledTimes(1);
    });

    it('should not update state when unmounted during failed fetch', async () => {
      let rejectPromise: (reason: Error) => void = () => {};
      const pendingPromise = new Promise<NewsApiResponse>((_, reject) => {
        rejectPromise = reject;
      });
      mockGetNews.mockReturnValueOnce(pendingPromise);

      const { result, unmount } = renderHook(() => useNewsFeed('AAPL'));

      expect(result.current.loading).toBe(true);

      unmount();

      // Reject -- cancelled flag should prevent error state update
      await act(async () => {
        rejectPromise(new Error('Server down'));
      });

      expect(mockGetNews).toHaveBeenCalledTimes(1);
    });

    it('should clear retry timer on unmount', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      mockGetNews.mockRejectedValueOnce(new Error('fail'));

      const { result, unmount } = renderHook(() => useNewsFeed('AAPL'));

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to load news. Retrying...');
      });

      // Unmount while retry is pending
      unmount();

      // Advance past retry delay -- should NOT trigger another fetch
      await act(async () => {
        vi.advanceTimersByTime(10_000);
      });

      // Only the initial fetch should have been made
      expect(mockGetNews).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  // -------------------------------------------------------------------------
  // 7. loadMore pagination
  // -------------------------------------------------------------------------

  describe('loadMore', () => {
    it('should append articles and update offset', async () => {
      const page1 = Array.from({ length: 5 }, (_, i) =>
        makeRawArticle({ id: `p1-${i}`, headline: `Page1-${i}` }),
      );
      const page2 = Array.from({ length: 3 }, (_, i) =>
        makeRawArticle({ id: `p2-${i}`, headline: `Page2-${i}` }),
      );
      mockGetNews
        .mockResolvedValueOnce(makeResponse(page1, { total_count: 8 }))
        .mockResolvedValueOnce(makeResponse(page2, { total_count: 8 }));

      const { result } = renderHook(() => useNewsFeed('AAPL'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.articles).toHaveLength(5);
      expect(result.current.hasMore).toBe(true);

      // Trigger load more
      await act(async () => {
        result.current.loadMore();
      });

      await waitFor(() => {
        expect(result.current.loadingMore).toBe(false);
      });

      expect(result.current.articles).toHaveLength(8);
      expect(mockGetNews).toHaveBeenCalledTimes(2);
      // Second call should use offset = 5
      expect(mockGetNews).toHaveBeenLastCalledWith('AAPL', { limit: 20, offset: 5 });
    });

    it('should set loadingMore=true during pagination fetch', async () => {
      const page1 = [makeRawArticle({ id: 'a1', headline: 'A1' })];
      let resolvePage2: (value: NewsApiResponse) => void = () => {};
      const pendingPage2 = new Promise<NewsApiResponse>((resolve) => {
        resolvePage2 = resolve;
      });

      mockGetNews
        .mockResolvedValueOnce(makeResponse(page1, { total_count: 5 }))
        .mockReturnValueOnce(pendingPage2);

      const { result } = renderHook(() => useNewsFeed('AAPL'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Trigger load more
      act(() => {
        result.current.loadMore();
      });

      expect(result.current.loadingMore).toBe(true);

      // Resolve page 2
      await act(async () => {
        resolvePage2(
          makeResponse([makeRawArticle({ id: 'a2', headline: 'A2' })], { total_count: 5 }),
        );
      });

      await waitFor(() => {
        expect(result.current.loadingMore).toBe(false);
      });
    });

    it('should not loadMore when already loading', async () => {
      let resolveInitial: (value: NewsApiResponse) => void = () => {};
      const pendingInitial = new Promise<NewsApiResponse>((resolve) => {
        resolveInitial = resolve;
      });
      mockGetNews.mockReturnValueOnce(pendingInitial);

      const { result } = renderHook(() => useNewsFeed('AAPL'));

      // During initial loading, loadMore should be a no-op
      expect(result.current.loading).toBe(true);
      act(() => {
        result.current.loadMore();
      });

      // Only the initial fetch mock should have been used
      expect(mockGetNews).toHaveBeenCalledTimes(1);

      // Cleanup: resolve pending promise
      await act(async () => {
        resolveInitial(makeResponse([makeRawArticle()], { total_count: 1 }));
      });
    });

    it('should not loadMore when all articles are loaded', async () => {
      const allArticles = [makeRawArticle({ id: 'a1', headline: 'Only One' })];
      mockGetNews.mockResolvedValueOnce(
        makeResponse(allArticles, { total_count: 1 }),
      );

      const { result } = renderHook(() => useNewsFeed('AAPL'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasMore).toBe(false);

      act(() => {
        result.current.loadMore();
      });

      // No additional fetch
      expect(mockGetNews).toHaveBeenCalledTimes(1);
    });

    it('should not loadMore when symbol is empty', () => {
      const { result } = renderHook(() => useNewsFeed(''));

      act(() => {
        result.current.loadMore();
      });

      expect(mockGetNews).not.toHaveBeenCalled();
    });

    it('should set error on loadMore failure', async () => {
      const page1 = [makeRawArticle({ id: 'a1', headline: 'A1' })];
      mockGetNews
        .mockResolvedValueOnce(makeResponse(page1, { total_count: 10 }))
        .mockRejectedValueOnce(new Error('load more failed'));

      const { result } = renderHook(() => useNewsFeed('AAPL'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        result.current.loadMore();
      });

      await waitFor(() => {
        expect(result.current.loadingMore).toBe(false);
      });

      expect(result.current.error).toBe(
        'Failed to load more articles. Please try again.',
      );
    });

    it('should discard loadMore response if symbol changed during fetch', async () => {
      const page1 = [makeRawArticle({ id: 'a1', headline: 'AAPL News' })];
      let resolveLoadMore: (value: NewsApiResponse) => void = () => {};
      const pendingLoadMore = new Promise<NewsApiResponse>((resolve) => {
        resolveLoadMore = resolve;
      });

      const msftArticles = [makeRawArticle({ id: 'm1', headline: 'MSFT News' })];

      mockGetNews
        .mockResolvedValueOnce(makeResponse(page1, { total_count: 10 }))
        .mockReturnValueOnce(pendingLoadMore) // loadMore for AAPL
        .mockResolvedValueOnce(makeResponse(msftArticles, { total_count: 1 })); // MSFT fetch

      const { result, rerender } = renderHook(
        ({ symbol }: { symbol: string }) => useNewsFeed(symbol),
        { initialProps: { symbol: 'AAPL' } },
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Trigger loadMore
      act(() => {
        result.current.loadMore();
      });

      // Change symbol while loadMore is in flight
      rerender({ symbol: 'MSFT' });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Resolve stale loadMore
      await act(async () => {
        resolveLoadMore(
          makeResponse(
            [makeRawArticle({ id: 'stale', headline: 'Stale Load' })],
            { total_count: 10 },
          ),
        );
      });

      // Should show MSFT, not the stale loadMore result
      expect(result.current.articles[0].headline).toBe('MSFT News');
    });
  });

  // -------------------------------------------------------------------------
  // 8. hasMore
  // -------------------------------------------------------------------------

  describe('hasMore', () => {
    it('should be true when articles.length < totalCount', async () => {
      const articles = [makeRawArticle({ id: 'a1', headline: 'A1' })];
      mockGetNews.mockResolvedValueOnce(
        makeResponse(articles, { total_count: 50 }),
      );

      const { result } = renderHook(() => useNewsFeed('AAPL'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasMore).toBe(true);
    });

    it('should be false when articles.length >= totalCount', async () => {
      const articles = [
        makeRawArticle({ id: 'a1', headline: 'A1' }),
        makeRawArticle({ id: 'a2', headline: 'A2' }),
      ];
      mockGetNews.mockResolvedValueOnce(
        makeResponse(articles, { total_count: 2 }),
      );

      const { result } = renderHook(() => useNewsFeed('AAPL'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasMore).toBe(false);
    });
  });
});
