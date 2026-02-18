import axios, { type AxiosError } from 'axios';
import type {
  TickerData,
  CompositeSignal,
  BackendHealthResponse,
} from '../types';
import type { Timeframe, TickerHistoryResponse } from '../types/ticker';
import type { WatchlistEntry, WatchlistResponse } from '../types/watchlist';
import type { NewsApiResponse } from '../types/news';
import type { FundamentalsApiResponse } from '../types/fundamentals';
import type { OwnershipApiResponse, InsiderApiResponse } from '../types/ownership';
import type { AnalysisApiResponse } from '../types/analysis';
import type { MacroCalendarApiResponse, MacroReactionApiResponse } from '../types/macro';
import type { ScanApiResponse } from '../types/command';
import { isApiError, type ApiError, type ApiErrorCode } from './errors';

const client = axios.create({
  baseURL: '/api',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// Response interceptor for consistent error handling
client.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (axios.isAxiosError(error)) {
      const apiError = parseApiError(error);
      return Promise.reject(apiError);
    }
    return Promise.reject(error);
  }
);

/**
 * Parse an AxiosError into a structured ApiError.
 */
function parseApiError(error: AxiosError): ApiError {
  if (error.response) {
    // Server responded with error status
    const status = error.response.status;
    const data = error.response.data as Record<string, unknown> | undefined;

    if (data?.code && typeof data.code === 'string') {
      return {
        code: data.code as ApiErrorCode,
        message: (data.message as string) || getDefaultMessage(status),
        status,
        details: data.details as Record<string, unknown> | undefined,
      };
    }

    return {
      code: mapStatusToCode(status),
      message: (data?.message as string) || error.message || getDefaultMessage(status),
      status,
    };
  }

  if (error.request) {
    // No response received (network error)
    return {
      code: 'NETWORK_ERROR',
      message: error.message || 'Network error - unable to reach server',
      status: 0,
    };
  }

  // Request setup error
  return {
    code: 'UNKNOWN',
    message: error.message || 'An unexpected error occurred',
    status: 0,
  };
}

function mapStatusToCode(status: number): ApiErrorCode {
  switch (status) {
    case 400:
      return 'VALIDATION_ERROR';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 429:
      return 'RATE_LIMITED';
    case 500:
      return 'INTERNAL_ERROR';
    case 503:
      return 'SERVICE_UNAVAILABLE';
    default:
      return 'UNKNOWN';
  }
}

function getDefaultMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Bad request';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Resource not found';
    case 409:
      return 'Conflict';
    case 429:
      return 'Too many requests';
    case 500:
      return 'Internal server error';
    case 503:
      return 'Service unavailable';
    default:
      return 'An error occurred';
  }
}

export async function getTicker(symbol: string): Promise<TickerData> {
  const { data } = await client.get<TickerData>(`/ticker/${symbol}`);
  return data;
}

export async function getNews(
  symbol: string,
  params?: { limit?: number; offset?: number },
): Promise<NewsApiResponse> {
  const { data } = await client.get<NewsApiResponse>(`/news/${symbol}`, {
    params,
  });
  return data;
}

export async function getFundamentals(
  symbol: string,
): Promise<FundamentalsApiResponse> {
  const { data } = await client.get<FundamentalsApiResponse>(
    `/fundamentals/${symbol}`,
  );
  return data;
}

export async function getOwnership(
  symbol: string,
): Promise<OwnershipApiResponse> {
  const { data } = await client.get<OwnershipApiResponse>(
    `/ownership/${symbol}`,
  );
  return data;
}

export async function getInsider(
  symbol: string,
): Promise<InsiderApiResponse> {
  const { data } = await client.get<InsiderApiResponse>(
    `/insider/${symbol}`,
  );
  return data;
}

export async function getMacroCalendar(
  params?: { from_date?: string; to_date?: string; importance?: string; event_type?: string },
  options?: { signal?: AbortSignal },
): Promise<MacroCalendarApiResponse> {
  const { data } = await client.get<MacroCalendarApiResponse>('/macro/calendar', {
    params,
    signal: options?.signal,
  });
  return data;
}

export async function getMacroReaction(
  symbol: string,
  eventType: string,
  options?: { signal?: AbortSignal; periods?: number },
): Promise<MacroReactionApiResponse> {
  const { data } = await client.get<MacroReactionApiResponse>(
    `/macro/reaction/${symbol}/${eventType}`,
    {
      signal: options?.signal,
      params: options?.periods != null ? { periods: options.periods } : undefined,
    },
  );
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

export async function getWatchlist(): Promise<WatchlistResponse> {
  const { data } = await client.get<WatchlistResponse>('/watchlist');
  return data;
}

export async function addToWatchlist(
  symbol: string,
  group?: string,
): Promise<WatchlistEntry> {
  const { data } = await client.post<WatchlistEntry>('/watchlist', {
    symbol,
    group,
  });
  return data;
}

export async function removeFromWatchlist(symbol: string): Promise<void> {
  await client.delete(`/watchlist/${symbol}`);
}

/**
 * Fetch ticker data with OHLCV history for chart rendering.
 *
 * @param symbol - Ticker symbol (e.g. "AAPL")
 * @param timeframe - Period for historical data
 * @returns Ticker data including OHLCV bars
 */
export async function getTickerHistory(
  symbol: string,
  timeframe: Timeframe,
): Promise<TickerHistoryResponse> {
  const { data } = await client.get<TickerHistoryResponse>(
    `/ticker/${symbol}`,
    { params: { period: timeframe, include_history: true } },
  );
  return data;
}

export async function getAnalysis(
  symbol: string,
  options?: { signal?: AbortSignal },
): Promise<AnalysisApiResponse> {
  const { data } = await client.get<AnalysisApiResponse>(
    `/analyze/${symbol}`,
    { signal: options?.signal },
  );
  return data;
}

export async function getScan(
  preset?: 'bullish' | 'bearish' | 'strong' | null,
  options?: { signal?: AbortSignal },
): Promise<ScanApiResponse> {
  const url = preset ? `/scan/${preset}` : '/scan';
  const { data } = await client.get<ScanApiResponse>(url, {
    signal: options?.signal,
  });
  return data;
}

/**
 * Health check endpoint to verify backend connectivity.
 * Returns backend service status without authentication.
 */
export async function getHealth(
  options?: { signal?: AbortSignal },
): Promise<BackendHealthResponse> {
  const { data } = await client.get<BackendHealthResponse>('/health', {
    signal: options?.signal,
  });
  return data;
}
