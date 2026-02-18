import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NewsFeed from '../../components/NewsFeed';
import type { UseNewsFeedResult } from '../../hooks/useNewsFeed';
import type { NewsArticle } from '../../types/news';

// ---------------------------------------------------------------------------
// Mock the useNewsFeed hook
// ---------------------------------------------------------------------------

const defaultHookResult: UseNewsFeedResult = {
  articles: [],
  totalCount: 0,
  hasMore: false,
  loading: false,
  loadingMore: false,
  error: null,
  loadMore: vi.fn(),
};

let mockHookResult: UseNewsFeedResult = { ...defaultHookResult };

vi.mock('../../hooks/useNewsFeed', () => ({
  useNewsFeed: (_symbol: string) => mockHookResult,
}));

// Mock WebSocketContext (NewsFeed now uses useWebSocketContext for live news alerts)
vi.mock('../../contexts/WebSocketContext', () => ({
  useWebSocketContext: () => ({
    status: 'connected' as const,
    clientId: 'test-client',
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    onMessage: vi.fn(() => vi.fn()),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a normalised article for rendering tests. */
function makeArticle(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: 'art-1',
    headline: 'Test Article Headline',
    summary: 'Article summary text.',
    source: 'Reuters',
    url: 'https://example.com/article',
    imageUrl: null,
    publishedAt: new Date('2024-06-15T10:00:00Z'),
    category: 'technology',
    relatedTickers: ['AAPL'],
    sentiment: 'neutral',
    sentimentScore: 0.5,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NewsFeed Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookResult = { ...defaultHookResult, loadMore: vi.fn() };
  });

  // -----------------------------------------------------------------------
  // Header rendering
  // -----------------------------------------------------------------------

  describe('heading', () => {
    it('should render the News heading', () => {
      render(<NewsFeed symbol="" />);
      expect(screen.getByRole('heading', { name: /News/i })).toBeInTheDocument();
    });

    it('should show "News" without em-dash when symbol is empty', () => {
      render(<NewsFeed symbol="" />);
      const heading = screen.getByRole('heading', { name: /News/i });
      expect(heading).toHaveTextContent('News');
      expect(heading.textContent).not.toContain('\u2014');
    });

    it('should show "News \u2014 AAPL" with em-dash when symbol is provided', () => {
      render(<NewsFeed symbol="AAPL" />);
      const heading = screen.getByRole('heading', { name: /News/i });
      expect(heading.textContent).toContain('\u2014');
      expect(heading.textContent).toContain('AAPL');
    });

    it('should update heading when symbol changes', () => {
      const { rerender } = render(<NewsFeed symbol="AAPL" />);
      const heading = screen.getByRole('heading', { name: /News/i });
      expect(heading.textContent).toContain('AAPL');

      rerender(<NewsFeed symbol="MSFT" />);
      expect(heading.textContent).toContain('MSFT');
      expect(heading.textContent).not.toContain('AAPL');
    });
  });

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

  describe('loading state', () => {
    it('should render loading skeleton when loading=true', () => {
      mockHookResult = { ...defaultHookResult, loading: true, loadMore: vi.fn() };
      const { container } = render(<NewsFeed symbol="AAPL" />);

      // LoadingSkeleton renders 3 animated pulse placeholders
      const pulseElements = container.querySelectorAll('.animate-pulse');
      expect(pulseElements).toHaveLength(3);
    });

    it('should not show articles while loading', () => {
      mockHookResult = {
        ...defaultHookResult,
        loading: true,
        articles: [makeArticle()],
        loadMore: vi.fn(),
      };
      render(<NewsFeed symbol="AAPL" />);

      expect(screen.queryByText('Test Article Headline')).not.toBeInTheDocument();
    });

    it('should not show error state while loading even if error is set', () => {
      mockHookResult = {
        ...defaultHookResult,
        loading: true,
        error: 'Failed to load news. Retrying...',
        loadMore: vi.fn(),
      };
      render(<NewsFeed symbol="AAPL" />);

      expect(screen.queryByText('Failed to load news. Retrying...')).not.toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------

  describe('error state', () => {
    it('should render error message when error is set and not loading', () => {
      mockHookResult = {
        ...defaultHookResult,
        error: 'Failed to load news. Retrying...',
        loadMore: vi.fn(),
      };
      render(<NewsFeed symbol="AAPL" />);

      expect(screen.getByText('Failed to load news. Retrying...')).toBeInTheDocument();
    });

    it('should show retrying indicator when error contains "Retrying"', () => {
      mockHookResult = {
        ...defaultHookResult,
        error: 'Failed to load news. Retrying...',
        loadMore: vi.fn(),
      };
      render(<NewsFeed symbol="AAPL" />);

      expect(screen.getByText('Retrying...')).toBeInTheDocument();
    });

    it('should not show retrying indicator for final error message', () => {
      mockHookResult = {
        ...defaultHookResult,
        error: 'Failed to load news. Please try again later.',
        loadMore: vi.fn(),
      };
      render(<NewsFeed symbol="AAPL" />);

      expect(screen.getByText('Failed to load news. Please try again later.')).toBeInTheDocument();
      expect(screen.queryByText('Retrying...')).not.toBeInTheDocument();
    });

    it('should apply accent-red class to error message', () => {
      mockHookResult = {
        ...defaultHookResult,
        error: 'Failed to load news. Please try again later.',
        loadMore: vi.fn(),
      };
      render(<NewsFeed symbol="AAPL" />);

      const errorEl = screen.getByText('Failed to load news. Please try again later.');
      expect(errorEl).toHaveClass('text-accent-red');
    });
  });

  // -----------------------------------------------------------------------
  // Empty state
  // -----------------------------------------------------------------------

  describe('empty state', () => {
    it('should show empty state when no articles, not loading, no error', () => {
      mockHookResult = { ...defaultHookResult, loadMore: vi.fn() };
      render(<NewsFeed symbol="TSLA" />);

      expect(screen.getByText(/No news articles found for TSLA/)).toBeInTheDocument();
    });

    it('should not show empty state when loading', () => {
      mockHookResult = { ...defaultHookResult, loading: true, loadMore: vi.fn() };
      render(<NewsFeed symbol="TSLA" />);

      expect(screen.queryByText(/No news articles found/)).not.toBeInTheDocument();
    });

    it('should not show empty state when error is set', () => {
      mockHookResult = {
        ...defaultHookResult,
        error: 'Failed to load news. Retrying...',
        loadMore: vi.fn(),
      };
      render(<NewsFeed symbol="TSLA" />);

      expect(screen.queryByText(/No news articles found/)).not.toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Article cards
  // -----------------------------------------------------------------------

  describe('ArticleCard rendering', () => {
    it('should render article headline', () => {
      mockHookResult = {
        ...defaultHookResult,
        articles: [makeArticle({ headline: 'Breaking News Story' })],
        totalCount: 1,
        loadMore: vi.fn(),
      };
      render(<NewsFeed symbol="AAPL" />);

      expect(screen.getByText('Breaking News Story')).toBeInTheDocument();
    });

    it('should render headline as link when url is provided', () => {
      mockHookResult = {
        ...defaultHookResult,
        articles: [
          makeArticle({
            headline: 'Linked Article',
            url: 'https://example.com/story',
          }),
        ],
        totalCount: 1,
        loadMore: vi.fn(),
      };
      render(<NewsFeed symbol="AAPL" />);

      const link = screen.getByText('Linked Article');
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', 'https://example.com/story');
    });

    it('should set target="_blank" and rel="noopener noreferrer" on article link', () => {
      mockHookResult = {
        ...defaultHookResult,
        articles: [
          makeArticle({
            headline: 'External Link',
            url: 'https://example.com',
          }),
        ],
        totalCount: 1,
        loadMore: vi.fn(),
      };
      render(<NewsFeed symbol="AAPL" />);

      const link = screen.getByText('External Link');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should render headline as span when url is null', () => {
      mockHookResult = {
        ...defaultHookResult,
        articles: [makeArticle({ headline: 'No Link', url: null })],
        totalCount: 1,
        loadMore: vi.fn(),
      };
      render(<NewsFeed symbol="AAPL" />);

      const element = screen.getByText('No Link');
      expect(element.tagName).toBe('SPAN');
    });

    it('should render article source', () => {
      mockHookResult = {
        ...defaultHookResult,
        articles: [makeArticle({ source: 'Bloomberg' })],
        totalCount: 1,
        loadMore: vi.fn(),
      };
      render(<NewsFeed symbol="AAPL" />);

      expect(screen.getByText('Bloomberg')).toBeInTheDocument();
    });

    it('should render relative time for article', () => {
      // Mock Date.now() for formatRelativeTime
      const fixedNow = new Date('2024-06-15T12:00:00Z').getTime();
      vi.spyOn(Date, 'now').mockReturnValue(fixedNow);

      mockHookResult = {
        ...defaultHookResult,
        articles: [
          makeArticle({
            // 2 hours before fixedNow
            publishedAt: new Date('2024-06-15T10:00:00Z'),
          }),
        ],
        totalCount: 1,
        loadMore: vi.fn(),
      };
      render(<NewsFeed symbol="AAPL" />);

      expect(screen.getByText('2h ago')).toBeInTheDocument();

      vi.restoreAllMocks();
    });

    it('should render multiple articles', () => {
      mockHookResult = {
        ...defaultHookResult,
        articles: [
          makeArticle({ id: 'a1', headline: 'First Article' }),
          makeArticle({ id: 'a2', headline: 'Second Article' }),
          makeArticle({ id: 'a3', headline: 'Third Article' }),
        ],
        totalCount: 3,
        loadMore: vi.fn(),
      };
      render(<NewsFeed symbol="AAPL" />);

      expect(screen.getByText('First Article')).toBeInTheDocument();
      expect(screen.getByText('Second Article')).toBeInTheDocument();
      expect(screen.getByText('Third Article')).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Sentiment badge
  // -----------------------------------------------------------------------

  describe('SentimentBadge', () => {
    it('should render neutral badge with bg-gray-600 class', () => {
      mockHookResult = {
        ...defaultHookResult,
        articles: [makeArticle({ sentiment: 'neutral', sentimentScore: 0.5 })],
        totalCount: 1,
        loadMore: vi.fn(),
      };
      render(<NewsFeed symbol="AAPL" />);

      const badge = screen.getByText(/Neutral/);
      expect(badge).toHaveClass('bg-gray-600');
    });

    it('should render bullish badge with bg-accent-green class', () => {
      mockHookResult = {
        ...defaultHookResult,
        articles: [makeArticle({ sentiment: 'bullish', sentimentScore: 0.8 })],
        totalCount: 1,
        loadMore: vi.fn(),
      };
      render(<NewsFeed symbol="AAPL" />);

      const badge = screen.getByText(/Bullish/);
      expect(badge).toHaveClass('bg-accent-green');
    });

    it('should render bearish badge with bg-accent-red class', () => {
      mockHookResult = {
        ...defaultHookResult,
        articles: [makeArticle({ sentiment: 'bearish', sentimentScore: 0.3 })],
        totalCount: 1,
        loadMore: vi.fn(),
      };
      render(<NewsFeed symbol="AAPL" />);

      const badge = screen.getByText(/Bearish/);
      expect(badge).toHaveClass('bg-accent-red');
    });

    it('should display sentiment score with 2 decimal places', () => {
      mockHookResult = {
        ...defaultHookResult,
        articles: [makeArticle({ sentiment: 'neutral', sentimentScore: 0.5 })],
        totalCount: 1,
        loadMore: vi.fn(),
      };
      render(<NewsFeed symbol="AAPL" />);

      expect(screen.getByText(/0\.50/)).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // LoadMore button
  // -----------------------------------------------------------------------

  describe('LoadMoreButton', () => {
    it('should show Load More button when hasMore=true and not loading', () => {
      mockHookResult = {
        ...defaultHookResult,
        articles: [makeArticle()],
        totalCount: 50,
        hasMore: true,
        loadMore: vi.fn(),
      };
      render(<NewsFeed symbol="AAPL" />);

      expect(screen.getByRole('button', { name: /Load More/i })).toBeInTheDocument();
    });

    it('should not show Load More button when hasMore=false', () => {
      mockHookResult = {
        ...defaultHookResult,
        articles: [makeArticle()],
        totalCount: 1,
        hasMore: false,
        loadMore: vi.fn(),
      };
      render(<NewsFeed symbol="AAPL" />);

      expect(screen.queryByRole('button', { name: /Load More/i })).not.toBeInTheDocument();
    });

    it('should not show Load More button while initial loading', () => {
      mockHookResult = {
        ...defaultHookResult,
        loading: true,
        hasMore: true,
        loadMore: vi.fn(),
      };
      render(<NewsFeed symbol="AAPL" />);

      expect(screen.queryByRole('button', { name: /Load More/i })).not.toBeInTheDocument();
    });

    it('should call loadMore when button is clicked', () => {
      const mockLoadMore = vi.fn();
      mockHookResult = {
        ...defaultHookResult,
        articles: [makeArticle()],
        totalCount: 50,
        hasMore: true,
        loadMore: mockLoadMore,
      };
      render(<NewsFeed symbol="AAPL" />);

      fireEvent.click(screen.getByRole('button', { name: /Load More/i }));

      expect(mockLoadMore).toHaveBeenCalledTimes(1);
    });

    it('should show "Loading..." text when loadingMore=true', () => {
      mockHookResult = {
        ...defaultHookResult,
        articles: [makeArticle()],
        totalCount: 50,
        hasMore: true,
        loadingMore: true,
        loadMore: vi.fn(),
      };
      render(<NewsFeed symbol="AAPL" />);

      expect(screen.getByRole('button', { name: /Loading\.\.\./i })).toBeInTheDocument();
    });

    it('should disable button when loadingMore=true', () => {
      mockHookResult = {
        ...defaultHookResult,
        articles: [makeArticle()],
        totalCount: 50,
        hasMore: true,
        loadingMore: true,
        loadMore: vi.fn(),
      };
      render(<NewsFeed symbol="AAPL" />);

      expect(screen.getByRole('button', { name: /Loading\.\.\./i })).toBeDisabled();
    });
  });

  // -----------------------------------------------------------------------
  // Styling
  // -----------------------------------------------------------------------

  describe('styling', () => {
    it('should have proper terminal panel styling classes on wrapper', () => {
      const { container } = render(<NewsFeed symbol="" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('bg-terminal-panel', 'border', 'border-terminal-border', 'rounded');
    });

    it('should apply overflow-hidden to main container', () => {
      const { container } = render(<NewsFeed symbol="" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('overflow-hidden');
    });
  });
});
