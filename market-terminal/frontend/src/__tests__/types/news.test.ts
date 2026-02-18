import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizeArticle,
  sortArticlesByDate,
  formatRelativeTime,
  NEWS_PAGE_SIZE,
  NEWS_CACHE_TTL_MS,
  NEWS_RETRY_DELAY_MS,
  RELATIVE_TIME_UPDATE_INTERVAL_MS,
} from '../../types/news';
import type { NewsArticleRaw, NewsArticle } from '../../types/news';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a valid raw backend article. */
function makeRawArticle(overrides: Partial<NewsArticleRaw> = {}): NewsArticleRaw {
  return {
    id: 'article-1',
    headline: 'Test Headline',
    summary: 'Test summary text.',
    source: 'Reuters',
    url: 'https://example.com/article',
    image_url: 'https://example.com/image.jpg',
    published_at: '2024-06-15T10:30:00Z',
    category: 'technology',
    related_tickers: ['AAPL', 'MSFT'],
    sentiment: null,
    ...overrides,
  };
}

/** Build a normalised display article. */
function makeArticle(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: 'article-1',
    headline: 'Test Headline',
    summary: 'Test summary text.',
    source: 'Reuters',
    url: 'https://example.com/article',
    imageUrl: 'https://example.com/image.jpg',
    publishedAt: new Date('2024-06-15T10:30:00Z'),
    category: 'technology',
    relatedTickers: ['AAPL', 'MSFT'],
    sentiment: 'neutral',
    sentimentScore: 0.5,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('News Constants', () => {
  it('should export NEWS_PAGE_SIZE as 20', () => {
    expect(NEWS_PAGE_SIZE).toBe(20);
  });

  it('should export NEWS_CACHE_TTL_MS as 300000 (5 minutes)', () => {
    expect(NEWS_CACHE_TTL_MS).toBe(300_000);
  });

  it('should export NEWS_RETRY_DELAY_MS as 5000 (5 seconds)', () => {
    expect(NEWS_RETRY_DELAY_MS).toBe(5_000);
  });

  it('should export RELATIVE_TIME_UPDATE_INTERVAL_MS as 60000 (1 minute)', () => {
    expect(RELATIVE_TIME_UPDATE_INTERVAL_MS).toBe(60_000);
  });
});

// ---------------------------------------------------------------------------
// normalizeArticle
// ---------------------------------------------------------------------------

describe('normalizeArticle', () => {
  it('should normalise a fully-populated raw article', () => {
    const raw = makeRawArticle();
    const result = normalizeArticle(raw);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('article-1');
    expect(result!.headline).toBe('Test Headline');
    expect(result!.summary).toBe('Test summary text.');
    expect(result!.source).toBe('Reuters');
    expect(result!.url).toBe('https://example.com/article');
    expect(result!.imageUrl).toBe('https://example.com/image.jpg');
    expect(result!.publishedAt).toEqual(new Date('2024-06-15T10:30:00Z'));
    expect(result!.category).toBe('technology');
    expect(result!.relatedTickers).toEqual(['AAPL', 'MSFT']);
    expect(result!.sentiment).toBe('neutral');
    expect(result!.sentimentScore).toBe(0.5);
  });

  it('should return null when headline is null', () => {
    const raw = makeRawArticle({ headline: null });
    expect(normalizeArticle(raw)).toBeNull();
  });

  it('should return null when headline is an empty string', () => {
    const raw = makeRawArticle({ headline: '' as unknown as null });
    // empty string is falsy so normalizeArticle returns null
    expect(normalizeArticle(raw)).toBeNull();
  });

  it('should default source to "Unknown" when source is null', () => {
    const raw = makeRawArticle({ source: null });
    const result = normalizeArticle(raw);

    expect(result).not.toBeNull();
    expect(result!.source).toBe('Unknown');
  });

  it('should default summary to empty string when summary is falsy', () => {
    const raw = makeRawArticle({ summary: '' });
    const result = normalizeArticle(raw);

    expect(result).not.toBeNull();
    expect(result!.summary).toBe('');
  });

  it('should preserve null url as null', () => {
    const raw = makeRawArticle({ url: null });
    const result = normalizeArticle(raw);

    expect(result).not.toBeNull();
    expect(result!.url).toBeNull();
  });

  it('should preserve null image_url as null imageUrl', () => {
    const raw = makeRawArticle({ image_url: null });
    const result = normalizeArticle(raw);

    expect(result).not.toBeNull();
    expect(result!.imageUrl).toBeNull();
  });

  it('should parse valid published_at string into Date', () => {
    const raw = makeRawArticle({ published_at: '2025-01-01T00:00:00Z' });
    const result = normalizeArticle(raw);

    expect(result).not.toBeNull();
    expect(result!.publishedAt).toEqual(new Date('2025-01-01T00:00:00Z'));
  });

  it('should return epoch-zero Date when published_at is null', () => {
    const raw = makeRawArticle({ published_at: null });
    const result = normalizeArticle(raw);

    expect(result).not.toBeNull();
    expect(result!.publishedAt).toEqual(new Date(0));
  });

  it('should return epoch-zero Date when published_at is an invalid date string', () => {
    const raw = makeRawArticle({ published_at: 'not-a-date' });
    const result = normalizeArticle(raw);

    expect(result).not.toBeNull();
    expect(result!.publishedAt).toEqual(new Date(0));
  });

  it('should preserve null category', () => {
    const raw = makeRawArticle({ category: null });
    const result = normalizeArticle(raw);

    expect(result).not.toBeNull();
    expect(result!.category).toBeNull();
  });

  it('should default related_tickers to empty array when not an array', () => {
    const raw = makeRawArticle({
      related_tickers: 'AAPL' as unknown as string[],
    });
    const result = normalizeArticle(raw);

    expect(result).not.toBeNull();
    expect(result!.relatedTickers).toEqual([]);
  });

  it('should pass through related_tickers when it is a valid array', () => {
    const raw = makeRawArticle({ related_tickers: ['GOOG', 'AMZN'] });
    const result = normalizeArticle(raw);

    expect(result).not.toBeNull();
    expect(result!.relatedTickers).toEqual(['GOOG', 'AMZN']);
  });

  it('should handle empty related_tickers array', () => {
    const raw = makeRawArticle({ related_tickers: [] });
    const result = normalizeArticle(raw);

    expect(result).not.toBeNull();
    expect(result!.relatedTickers).toEqual([]);
  });

  it('should always set sentiment to neutral', () => {
    const raw = makeRawArticle();
    const result = normalizeArticle(raw);

    expect(result).not.toBeNull();
    expect(result!.sentiment).toBe('neutral');
  });

  it('should always set sentimentScore to 0.5', () => {
    const raw = makeRawArticle();
    const result = normalizeArticle(raw);

    expect(result).not.toBeNull();
    expect(result!.sentimentScore).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// sortArticlesByDate
// ---------------------------------------------------------------------------

describe('sortArticlesByDate', () => {
  it('should sort articles by publishedAt descending (most recent first)', () => {
    const older = makeArticle({
      id: 'old',
      publishedAt: new Date('2024-01-01T00:00:00Z'),
    });
    const middle = makeArticle({
      id: 'mid',
      publishedAt: new Date('2024-06-01T00:00:00Z'),
    });
    const newest = makeArticle({
      id: 'new',
      publishedAt: new Date('2024-12-01T00:00:00Z'),
    });

    const result = sortArticlesByDate([older, newest, middle]);

    expect(result[0].id).toBe('new');
    expect(result[1].id).toBe('mid');
    expect(result[2].id).toBe('old');
  });

  it('should return a new array (not mutate input)', () => {
    const articles = [
      makeArticle({ id: 'a', publishedAt: new Date('2024-01-01') }),
      makeArticle({ id: 'b', publishedAt: new Date('2024-06-01') }),
    ];
    const originalOrder = articles.map((a) => a.id);

    const sorted = sortArticlesByDate(articles);

    // Original unchanged
    expect(articles.map((a) => a.id)).toEqual(originalOrder);
    // Sorted is a different array reference
    expect(sorted).not.toBe(articles);
  });

  it('should handle empty array', () => {
    const result = sortArticlesByDate([]);
    expect(result).toEqual([]);
  });

  it('should handle single article', () => {
    const article = makeArticle({ id: 'single' });
    const result = sortArticlesByDate([article]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('single');
  });

  it('should handle articles with identical dates', () => {
    const sameDate = new Date('2024-06-15T10:00:00Z');
    const a = makeArticle({ id: 'a', publishedAt: sameDate });
    const b = makeArticle({ id: 'b', publishedAt: sameDate });

    const result = sortArticlesByDate([a, b]);

    expect(result).toHaveLength(2);
    // Both should be present; order is stable
    expect(result.map((r) => r.id)).toContain('a');
    expect(result.map((r) => r.id)).toContain('b');
  });

  it('should handle articles with epoch-zero dates', () => {
    const epochZero = makeArticle({
      id: 'epoch',
      publishedAt: new Date(0),
    });
    const recent = makeArticle({
      id: 'recent',
      publishedAt: new Date('2024-12-01'),
    });

    const result = sortArticlesByDate([epochZero, recent]);

    expect(result[0].id).toBe('recent');
    expect(result[1].id).toBe('epoch');
  });
});

// ---------------------------------------------------------------------------
// formatRelativeTime
// ---------------------------------------------------------------------------

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "just now" for dates less than 60 seconds ago', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    vi.setSystemTime(now);

    // 30 seconds ago
    const date = new Date('2024-06-15T11:59:30Z');
    expect(formatRelativeTime(date)).toBe('just now');
  });

  it('should return "just now" for a date exactly now (0 diff)', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    vi.setSystemTime(now);

    expect(formatRelativeTime(now)).toBe('just now');
  });

  it('should return "just now" for future dates (negative diff)', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    vi.setSystemTime(now);

    const future = new Date('2024-06-15T12:05:00Z');
    expect(formatRelativeTime(future)).toBe('just now');
  });

  it('should return "1m ago" for 60 seconds ago', () => {
    const now = new Date('2024-06-15T12:01:00Z');
    vi.setSystemTime(now);

    const date = new Date('2024-06-15T12:00:00Z');
    expect(formatRelativeTime(date)).toBe('1m ago');
  });

  it('should return "Xm ago" for minutes between 1 and 59', () => {
    const now = new Date('2024-06-15T12:45:00Z');
    vi.setSystemTime(now);

    const date = new Date('2024-06-15T12:00:00Z');
    expect(formatRelativeTime(date)).toBe('45m ago');
  });

  it('should return "59m ago" for 59 minutes', () => {
    const now = new Date('2024-06-15T12:59:00Z');
    vi.setSystemTime(now);

    const date = new Date('2024-06-15T12:00:00Z');
    expect(formatRelativeTime(date)).toBe('59m ago');
  });

  it('should return "1h ago" for exactly 1 hour', () => {
    const now = new Date('2024-06-15T13:00:00Z');
    vi.setSystemTime(now);

    const date = new Date('2024-06-15T12:00:00Z');
    expect(formatRelativeTime(date)).toBe('1h ago');
  });

  it('should return "Xh ago" for hours between 1 and 23', () => {
    const now = new Date('2024-06-15T22:00:00Z');
    vi.setSystemTime(now);

    const date = new Date('2024-06-15T12:00:00Z');
    expect(formatRelativeTime(date)).toBe('10h ago');
  });

  it('should return "23h ago" for 23 hours', () => {
    const now = new Date('2024-06-16T11:00:00Z');
    vi.setSystemTime(now);

    const date = new Date('2024-06-15T12:00:00Z');
    expect(formatRelativeTime(date)).toBe('23h ago');
  });

  it('should return "1d ago" for exactly 24 hours', () => {
    const now = new Date('2024-06-16T12:00:00Z');
    vi.setSystemTime(now);

    const date = new Date('2024-06-15T12:00:00Z');
    expect(formatRelativeTime(date)).toBe('1d ago');
  });

  it('should return "Xd ago" for days between 1 and 13', () => {
    const now = new Date('2024-06-22T12:00:00Z');
    vi.setSystemTime(now);

    const date = new Date('2024-06-15T12:00:00Z');
    expect(formatRelativeTime(date)).toBe('7d ago');
  });

  it('should return "13d ago" for 13 days', () => {
    const now = new Date('2024-06-28T12:00:00Z');
    vi.setSystemTime(now);

    const date = new Date('2024-06-15T12:00:00Z');
    expect(formatRelativeTime(date)).toBe('13d ago');
  });

  it('should return "2w ago" for exactly 14 days', () => {
    const now = new Date('2024-06-29T12:00:00Z');
    vi.setSystemTime(now);

    const date = new Date('2024-06-15T12:00:00Z');
    expect(formatRelativeTime(date)).toBe('2w ago');
  });

  it('should return "Xw ago" for weeks (14+ days)', () => {
    const now = new Date('2024-07-20T12:00:00Z');
    vi.setSystemTime(now);

    const date = new Date('2024-06-15T12:00:00Z');
    // 35 days = 5 weeks
    expect(formatRelativeTime(date)).toBe('5w ago');
  });

  it('should handle epoch-zero date as a very old date', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    vi.setSystemTime(now);

    const epochZero = new Date(0);
    const result = formatRelativeTime(epochZero);

    // Epoch zero is ~54 years ago, should be many weeks
    expect(result).toMatch(/^\d+w ago$/);
  });

  it('should floor partial minutes/hours/days correctly', () => {
    const now = new Date('2024-06-15T12:02:30Z');
    vi.setSystemTime(now);

    // 2 minutes and 30 seconds ago => should be "2m ago" (floors seconds within minute)
    const date = new Date('2024-06-15T12:00:00Z');
    expect(formatRelativeTime(date)).toBe('2m ago');
  });
});
