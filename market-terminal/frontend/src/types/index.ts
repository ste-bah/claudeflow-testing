export interface TickerData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
}

export interface MethodologySignal {
  ticker: string;
  methodology: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  timeframe: 'short' | 'medium' | 'long';
  reasoning: string;
  keyLevels: Record<string, number>;
  timestamp: string;
}

export interface CompositeSignal {
  ticker: string;
  overallDirection: string;
  overallConfidence: number;
  methodologySignals: MethodologySignal[];
  confluenceCount: number;
  timeframeBreakdown: Record<string, unknown>;
  tradeThesis: string;
}

export interface NewsArticle {
  id: string;
  ticker: string;
  headline: string;
  source: string;
  url: string;
  publishedAt: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  sentimentScore: number;
}

export interface MacroEvent {
  id: string;
  name: string;
  date: string;
  expected: number | null;
  actual: number | null;
  previous: number | null;
  impact: 'high' | 'medium' | 'low';
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  addedAt: string;
  group?: string;
}
