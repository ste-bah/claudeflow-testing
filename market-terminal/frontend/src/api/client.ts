import axios from 'axios';
import type {
  TickerData,
  NewsArticle,
  MacroEvent,
  CompositeSignal,
  WatchlistItem,
} from '../types';

const client = axios.create({
  baseURL: '/api',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

export async function getTicker(symbol: string): Promise<TickerData> {
  const { data } = await client.get<TickerData>(`/ticker/${symbol}`);
  return data;
}

export async function getNews(symbol: string): Promise<NewsArticle[]> {
  const { data } = await client.get<NewsArticle[]>(`/news/${symbol}`);
  return data;
}

export async function getFundamentals(
  symbol: string,
): Promise<Record<string, unknown>> {
  const { data } = await client.get<Record<string, unknown>>(
    `/fundamentals/${symbol}`,
  );
  return data;
}

export async function getMacroCalendar(): Promise<MacroEvent[]> {
  const { data } = await client.get<MacroEvent[]>('/macro/calendar');
  return data;
}

export async function getMacroEvent(
  type: string,
): Promise<MacroEvent> {
  const { data } = await client.get<MacroEvent>(`/macro/${type}`);
  return data;
}

export async function analyzeSymbol(
  symbol: string,
): Promise<CompositeSignal> {
  const { data } = await client.post<CompositeSignal>(`/analyze/${symbol}`);
  return data;
}

export async function postQuery(
  text: string,
): Promise<Record<string, unknown>> {
  const { data } = await client.post<Record<string, unknown>>('/query', {
    text,
  });
  return data;
}

export async function getWatchlist(): Promise<WatchlistItem[]> {
  const { data } = await client.get<WatchlistItem[]>('/watchlist');
  return data;
}

export async function addToWatchlist(
  symbol: string,
  group?: string,
): Promise<WatchlistItem> {
  const { data } = await client.post<WatchlistItem>('/watchlist', {
    symbol,
    group,
  });
  return data;
}

export async function removeFromWatchlist(symbol: string): Promise<void> {
  await client.delete(`/watchlist/${symbol}`);
}
