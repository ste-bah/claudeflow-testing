/**
 * Command Service
 *
 * Provides methods for parsing and executing command bar commands.
 * Supports: analyze, watch add/remove, news, fundamentals, insider, macro, scan
 */

import type {
  ParsedCommand,
  CommandResult,
  CommandSuggestion,
  ScanApiResponse,
} from '../types';
import {
  parseCommand,
  filterSuggestions,
  isSymbolCommand,
  isScanCommand,
  isMacroCommand,
  isQueryCommand,
} from '../types';
import type { Timeframe } from '../types/ticker';
import { getApiUrl } from './config';
import { healthService } from './health';
import { analysisService } from './analysis';
import { watchlistService } from './watchlist';

/**
 * Request timeout in milliseconds
 */
const REQUEST_TIMEOUT = 30000;

/**
 * Command Service errors
 */
export class CommandError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly commandType?: string
  ) {
    super(message);
    this.name = 'CommandError';
  }
}

/**
 * Check if backend is available before making requests
 */
async function ensureBackendAvailable(): Promise<void> {
  const health = healthService.getHealth();
  if (!health?.api?.reachable) {
    throw new CommandError(
      'Backend is not available. Please ensure the server is running.',
      'BACKEND_UNAVAILABLE'
    );
  }
}

/**
 * Build URL with query parameters
 */
function buildUrl(baseUrl: string, endpoint: string, params?: Record<string, unknown>): string {
  const url = new URL(`${baseUrl}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }
  return url.toString();
}

/**
 * Command Service
 *
 * Provides methods for parsing and executing command bar commands.
 */
class CommandService {
  private history: string[] = [];
  private historyIndex: number = -1;
  private lastResult: CommandResult | null = null;

  /**
   * Parse a raw command string into a typed command
   */
  parse(raw: string): ParsedCommand {
    return parseCommand(raw);
  }

  /**
   * Execute a parsed command and return the result
   */
  async execute(parsed: ParsedCommand): Promise<CommandResult> {
    const result: CommandResult = {
      command: parsed,
      data: null,
      error: null,
      timestamp: Date.now(),
    };

    try {
      switch (parsed.type) {
        case 'ticker':
          result.data = await this.executeTicker(parsed.symbol);
          break;

        case 'analyze':
          result.data = await this.executeAnalyze(parsed.symbol);
          break;

        case 'watch_add':
          result.data = await this.executeWatchAdd(parsed.symbol);
          break;

        case 'watch_remove':
          result.data = await this.executeWatchRemove(parsed.symbol);
          break;

        case 'news':
          result.data = await this.executeNews(parsed.symbol);
          break;

        case 'fundamentals':
          result.data = await this.executeFundamentals(parsed.symbol);
          break;

        case 'insider':
          result.data = await this.executeInsider(parsed.symbol);
          break;

        case 'scan':
          result.data = await this.executeScan(parsed.preset);
          break;

        case 'macro':
          result.data = await this.executeMacro();
          break;

        case 'query':
          result.data = await this.executeQuery(parsed.text);
          break;

        default:
          result.error = `Unknown command type: ${(parsed as ParsedCommand).type}`;
      }
    } catch (error) {
      result.error =
        error instanceof Error ? error.message : 'An unexpected error occurred';
    }

    // Update history
    if (parsed.raw && this.history[0] !== parsed.raw) {
      this.history.unshift(parsed.raw);
      if (this.history.length > 50) {
        this.history.pop();
      }
    }
    this.historyIndex = -1;
    this.lastResult = result;

    return result;
  }

  /**
   * Execute a raw command string (parse + execute)
   */
  async executeRaw(raw: string): Promise<CommandResult> {
    const parsed = this.parse(raw);
    return this.execute(parsed);
  }

  /**
   * Execute ticker command - get quote data
   */
  private async executeTicker(symbol: string): Promise<unknown> {
    await ensureBackendAvailable();

    const apiUrl = getApiUrl();
    const url = `${apiUrl}/ticker/${encodeURIComponent(symbol)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new CommandError(
          `Symbol "${symbol}" not found`,
          'SYMBOL_NOT_FOUND',
          404,
          'ticker'
        );
      }
      throw new CommandError(
        `Failed to fetch ticker data for ${symbol}`,
        'TICKER_REQUEST_FAILED',
        response.status,
        'ticker'
      );
    }

    return response.json();
  }

  /**
   * Execute analyze command - trigger/get analysis
   */
  private async executeAnalyze(symbol: string): Promise<unknown> {
    await ensureBackendAvailable();

    const apiUrl = getApiUrl();
    const url = `${apiUrl}/analyze/${encodeURIComponent(symbol)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(120000), // 2 minutes for analysis
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new CommandError(
          `Symbol "${symbol}" not found`,
          'SYMBOL_NOT_FOUND',
          404,
          'analyze'
        );
      }
      if (response.status === 503) {
        throw new CommandError(
          'Analysis service is temporarily unavailable',
          'SERVICE_UNAVAILABLE',
          503,
          'analyze'
        );
      }
      throw new CommandError(
        `Failed to analyze ${symbol}`,
        'ANALYSIS_REQUEST_FAILED',
        response.status,
        'analyze'
      );
    }

    return response.json();
  }

  /**
   * Execute watch add command
   */
  private async executeWatchAdd(symbol: string): Promise<unknown> {
    await ensureBackendAvailable();

    const apiUrl = getApiUrl();
    const url = `${apiUrl}/watchlist`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new CommandError(
          `Symbol "${symbol}" not found`,
          'SYMBOL_NOT_FOUND',
          404,
          'watch_add'
        );
      }
      if (response.status === 409) {
        throw new CommandError(
          `Symbol "${symbol}" is already in the watchlist`,
          'SYMBOL_ALREADY_EXISTS',
          409,
          'watch_add'
        );
      }
      throw new CommandError(
        `Failed to add ${symbol} to watchlist`,
        'ADD_WATCHLIST_FAILED',
        response.status,
        'watch_add'
      );
    }

    return response.json();
  }

  /**
   * Execute watch remove command
   */
  private async executeWatchRemove(symbol: string): Promise<unknown> {
    await ensureBackendAvailable();

    const apiUrl = getApiUrl();
    const url = `${apiUrl}/watchlist/${encodeURIComponent(symbol)}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new CommandError(
          `Symbol "${symbol}" is not in the watchlist`,
          'SYMBOL_NOT_IN_WATCHLIST',
          404,
          'watch_remove'
        );
      }
      throw new CommandError(
        `Failed to remove ${symbol} from watchlist`,
        'REMOVE_WATCHLIST_FAILED',
        response.status,
        'watch_remove'
      );
    }

    return { success: true, symbol };
  }

  /**
   * Execute news command - get news for symbol
   */
  private async executeNews(symbol: string): Promise<unknown> {
    await ensureBackendAvailable();

    const apiUrl = getApiUrl();
    const url = buildUrl(apiUrl, `/news/${encodeURIComponent(symbol)}`, { limit: 20 });

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new CommandError(
          `No news found for "${symbol}"`,
          'NEWS_NOT_FOUND',
          404,
          'news'
        );
      }
      throw new CommandError(
        `Failed to fetch news for ${symbol}`,
        'NEWS_REQUEST_FAILED',
        response.status,
        'news'
      );
    }

    return response.json();
  }

  /**
   * Execute fundamentals command - get fundamentals for symbol
   */
  private async executeFundamentals(symbol: string): Promise<unknown> {
    await ensureBackendAvailable();

    const apiUrl = getApiUrl();
    const url = `${apiUrl}/fundamentals/${encodeURIComponent(symbol)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new CommandError(
          `No fundamentals found for "${symbol}"`,
          'FUNDAMENTALS_NOT_FOUND',
          404,
          'fundamentals'
        );
      }
      throw new CommandError(
        `Failed to fetch fundamentals for ${symbol}`,
        'FUNDAMENTALS_REQUEST_FAILED',
        response.status,
        'fundamentals'
      );
    }

    return response.json();
  }

  /**
   * Execute insider command - get insider activity for symbol
   */
  private async executeInsider(symbol: string): Promise<unknown> {
    await ensureBackendAvailable();

    const apiUrl = getApiUrl();
    const url = `${apiUrl}/insider/${encodeURIComponent(symbol)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new CommandError(
          `No insider data found for "${symbol}"`,
          'INSIDER_NOT_FOUND',
          404,
          'insider'
        );
      }
      throw new CommandError(
        `Failed to fetch insider data for ${symbol}`,
        'INSIDER_REQUEST_FAILED',
        response.status,
        'insider'
      );
    }

    return response.json();
  }

  /**
   * Execute scan command - run stock screen
   */
  private async executeScan(
    preset: 'bullish' | 'bearish' | 'strong' | null
  ): Promise<ScanApiResponse> {
    await ensureBackendAvailable();

    const apiUrl = getApiUrl();
    const url = preset
      ? `${apiUrl}/scan/${preset}`
      : `${apiUrl}/scan`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) {
      throw new CommandError(
        'Failed to execute stock scan',
        'SCAN_REQUEST_FAILED',
        response.status,
        'scan'
      );
    }

    return response.json();
  }

  /**
   * Execute macro command - get macro calendar
   */
  private async executeMacro(): Promise<unknown> {
    await ensureBackendAvailable();

    const apiUrl = getApiUrl();
    const url = buildUrl(apiUrl, '/macro/calendar', {
      from_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      to_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
    });

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) {
      throw new CommandError(
        'Failed to fetch macro calendar',
        'MACRO_REQUEST_FAILED',
        response.status,
        'macro'
      );
    }

    return response.json();
  }

  /**
   * Execute query command - natural language query
   */
  private async executeQuery(text: string): Promise<unknown> {
    await ensureBackendAvailable();

    const apiUrl = getApiUrl();
    const url = `${apiUrl}/query`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) {
      throw new CommandError(
        'Failed to process query',
        'QUERY_REQUEST_FAILED',
        response.status,
        'query'
      );
    }

    return response.json();
  }

  /**
   * Get command suggestions based on input
   */
  getSuggestions(input: string, activeTicker: string = ''): CommandSuggestion[] {
    return filterSuggestions(input, activeTicker, 8);
  }

  /**
   * Get command history
   */
  getHistory(): string[] {
    return [...this.history];
  }

  /**
   * Navigate back in command history
   */
  historyBack(): string | null {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      return this.history[this.historyIndex];
    }
    return null;
  }

  /**
   * Navigate forward in command history
   */
  historyForward(): string | null {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      return this.history[this.historyIndex];
    }
    // If at the end, return empty string for current input
    this.historyIndex = -1;
    return '';
  }

  /**
   * Get the last command result
   */
  getLastResult(): CommandResult | null {
    return this.lastResult;
  }

  /**
   * Clear command history
   */
  clearHistory(): void {
    this.history = [];
    this.historyIndex = -1;
    this.lastResult = null;
  }

  /**
   * Clear the last result
   */
  clearResult(): void {
    this.lastResult = null;
  }
}

// Export singleton instance
export const commandService = new CommandService();

// Export convenience functions
export const parseCommandInput = (raw: string) => commandService.parse(raw);
export const executeCommand = (parsed: ParsedCommand) => commandService.execute(parsed);
export const executeCommandRaw = (raw: string) => commandService.executeRaw(raw);
export const getCommandSuggestions = (input: string, activeTicker?: string) =>
  commandService.getSuggestions(input, activeTicker);
export const getCommandHistory = () => commandService.getHistory();
export const historyBack = () => commandService.historyBack();
export const historyForward = () => commandService.historyForward();
export const clearCommandHistory = () => commandService.clearHistory();
export const clearCommandResult = () => commandService.clearResult();

// Export error class for type checking
export { CommandError };