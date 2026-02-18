import { describe, it, expect } from 'vitest';
import {
  WS_CHANNELS,
  WS_DEFAULTS,
  isServerMessage,
  isConnected,
  isHeartbeat,
  isError,
  isPriceUpdate,
  isAnalysisProgress,
  isAnalysisComplete,
  isNewsAlert,
} from '../../types/websocket';
import type {
  WsServerMessage,
  WsConnectedMessage,
  WsHeartbeatMessage,
  WsErrorMessage,
  WsPriceUpdateMessage,
  WsAnalysisProgressMessage,
  WsAnalysisCompleteMessage,
  WsNewsAlertMessage,
} from '../../types/websocket';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a valid connected message. */
function makeConnected(overrides: Partial<WsConnectedMessage> = {}): WsConnectedMessage {
  return {
    type: 'connected',
    client_id: 'abc-123',
    server_time: '2024-06-15T10:00:00Z',
    reconnect_hint: {
      strategy: 'exponential_backoff',
      initial_delay_ms: 1000,
      max_delay_ms: 30000,
      multiplier: 2,
    },
    ...overrides,
  } as WsConnectedMessage;
}

/** Build a valid price_update message. */
function makePriceUpdate(overrides: Partial<WsPriceUpdateMessage> = {}): WsPriceUpdateMessage {
  return {
    type: 'price_update',
    symbol: 'AAPL',
    price: 185.5,
    change_percent: 1.25,
    timestamp: '2024-06-15T10:00:00Z',
    ...overrides,
  } as WsPriceUpdateMessage;
}

/** Build a valid analysis_progress message. */
function makeProgress(overrides: Partial<WsAnalysisProgressMessage> = {}): WsAnalysisProgressMessage {
  return {
    type: 'analysis_progress',
    symbol: 'AAPL',
    agent: 'Wyckoff',
    agent_number: 2,
    total_agents: 7,
    status: 'running',
    message: 'Running Wyckoff analysis',
    ...overrides,
  } as WsAnalysisProgressMessage;
}

/** Build a valid analysis_complete message. */
function makeComplete(overrides: Partial<WsAnalysisCompleteMessage> = {}): WsAnalysisCompleteMessage {
  return {
    type: 'analysis_complete',
    symbol: 'AAPL',
    composite_signal: { direction: 'bullish', score: 0.75 },
    timestamp: '2024-06-15T10:05:00Z',
    ...overrides,
  } as WsAnalysisCompleteMessage;
}

/** Build a valid news_alert message. */
function makeNewsAlert(overrides: Partial<WsNewsAlertMessage> = {}): WsNewsAlertMessage {
  return {
    type: 'news_alert',
    symbol: 'AAPL',
    headline: 'Apple Q3 earnings beat expectations',
    sentiment: { score: 0.85, label: 'positive' },
    timestamp: '2024-06-15T10:00:00Z',
    ...overrides,
  } as WsNewsAlertMessage;
}

// ---------------------------------------------------------------------------
// WS_CHANNELS
// ---------------------------------------------------------------------------

describe('WS_CHANNELS', () => {
  it('should have PriceUpdates channel', () => {
    expect(WS_CHANNELS.PriceUpdates).toBe('price_updates');
  });

  it('should have AnalysisProgress channel', () => {
    expect(WS_CHANNELS.AnalysisProgress).toBe('analysis_progress');
  });

  it('should have NewsAlerts channel', () => {
    expect(WS_CHANNELS.NewsAlerts).toBe('news_alerts');
  });

  it('should have exactly 3 channels', () => {
    expect(Object.keys(WS_CHANNELS)).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// WS_DEFAULTS
// ---------------------------------------------------------------------------

describe('WS_DEFAULTS', () => {
  it('should have reconnectDelayMs of 1000', () => {
    expect(WS_DEFAULTS.reconnectDelayMs).toBe(1_000);
  });

  it('should have maxReconnectDelayMs of 30000', () => {
    expect(WS_DEFAULTS.maxReconnectDelayMs).toBe(30_000);
  });

  it('should have reconnectMultiplier of 2', () => {
    expect(WS_DEFAULTS.reconnectMultiplier).toBe(2);
  });

  it('should have maxReconnectAttempts of 10', () => {
    expect(WS_DEFAULTS.maxReconnectAttempts).toBe(10);
  });

  it('should have pingIntervalMs of 25000', () => {
    expect(WS_DEFAULTS.pingIntervalMs).toBe(25_000);
  });

  it('should have exactly 5 default values', () => {
    expect(Object.keys(WS_DEFAULTS)).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// isServerMessage
// ---------------------------------------------------------------------------

describe('isServerMessage', () => {
  it('should return false for null', () => {
    expect(isServerMessage(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isServerMessage(undefined)).toBe(false);
  });

  it('should return false for a number', () => {
    expect(isServerMessage(42)).toBe(false);
  });

  it('should return false for a string', () => {
    expect(isServerMessage('hello')).toBe(false);
  });

  it('should return false for a boolean', () => {
    expect(isServerMessage(true)).toBe(false);
  });

  it('should return false for an empty object', () => {
    expect(isServerMessage({})).toBe(false);
  });

  it('should return false for an object with non-string type', () => {
    expect(isServerMessage({ type: 123 })).toBe(false);
  });

  it('should return false for an object with an unknown type string', () => {
    expect(isServerMessage({ type: 'unknown_message_type' })).toBe(false);
  });

  it('should return true for type "connected"', () => {
    expect(isServerMessage({ type: 'connected' })).toBe(true);
  });

  it('should return true for type "subscribed"', () => {
    expect(isServerMessage({ type: 'subscribed' })).toBe(true);
  });

  it('should return true for type "unsubscribed"', () => {
    expect(isServerMessage({ type: 'unsubscribed' })).toBe(true);
  });

  it('should return true for type "heartbeat"', () => {
    expect(isServerMessage({ type: 'heartbeat' })).toBe(true);
  });

  it('should return true for type "pong"', () => {
    expect(isServerMessage({ type: 'pong' })).toBe(true);
  });

  it('should return true for type "ack"', () => {
    expect(isServerMessage({ type: 'ack' })).toBe(true);
  });

  it('should return true for type "error"', () => {
    expect(isServerMessage({ type: 'error' })).toBe(true);
  });

  it('should return true for type "price_update"', () => {
    expect(isServerMessage({ type: 'price_update' })).toBe(true);
  });

  it('should return true for type "analysis_progress"', () => {
    expect(isServerMessage({ type: 'analysis_progress' })).toBe(true);
  });

  it('should return true for type "analysis_complete"', () => {
    expect(isServerMessage({ type: 'analysis_complete' })).toBe(true);
  });

  it('should return true for type "news_alert"', () => {
    expect(isServerMessage({ type: 'news_alert' })).toBe(true);
  });

  it('should return false for an array', () => {
    expect(isServerMessage([{ type: 'connected' }])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isPriceUpdate
// ---------------------------------------------------------------------------

describe('isPriceUpdate', () => {
  it('should return true for a valid price_update message', () => {
    expect(isPriceUpdate(makePriceUpdate())).toBe(true);
  });

  it('should return false when type is not price_update', () => {
    const msg = { ...makePriceUpdate(), type: 'heartbeat' } as unknown as WsServerMessage;
    expect(isPriceUpdate(msg)).toBe(false);
  });

  it('should return false when symbol is missing', () => {
    const msg = { type: 'price_update', price: 100, change_percent: 1, timestamp: 't' } as unknown as WsServerMessage;
    expect(isPriceUpdate(msg)).toBe(false);
  });

  it('should return false when price is NaN', () => {
    const msg = makePriceUpdate({ price: NaN } as unknown as Partial<WsPriceUpdateMessage>);
    expect(isPriceUpdate(msg)).toBe(false);
  });

  it('should return false when price is Infinity', () => {
    const msg = makePriceUpdate({ price: Infinity } as unknown as Partial<WsPriceUpdateMessage>);
    expect(isPriceUpdate(msg)).toBe(false);
  });

  it('should return false when change_percent is NaN', () => {
    const msg = makePriceUpdate({ change_percent: NaN } as unknown as Partial<WsPriceUpdateMessage>);
    expect(isPriceUpdate(msg)).toBe(false);
  });

  it('should return false when change_percent is -Infinity', () => {
    const msg = makePriceUpdate({ change_percent: -Infinity } as unknown as Partial<WsPriceUpdateMessage>);
    expect(isPriceUpdate(msg)).toBe(false);
  });

  it('should return false when timestamp is missing', () => {
    const msg = { type: 'price_update', symbol: 'AAPL', price: 100, change_percent: 1 } as unknown as WsServerMessage;
    expect(isPriceUpdate(msg)).toBe(false);
  });

  it('should accept price of 0 (finite number)', () => {
    const msg = makePriceUpdate({ price: 0 } as unknown as Partial<WsPriceUpdateMessage>);
    expect(isPriceUpdate(msg)).toBe(true);
  });

  it('should accept negative change_percent', () => {
    const msg = makePriceUpdate({ change_percent: -5.5 } as unknown as Partial<WsPriceUpdateMessage>);
    expect(isPriceUpdate(msg)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isAnalysisProgress
// ---------------------------------------------------------------------------

describe('isAnalysisProgress', () => {
  it('should return true for a valid analysis_progress message', () => {
    expect(isAnalysisProgress(makeProgress())).toBe(true);
  });

  it('should return false when type is not analysis_progress', () => {
    const msg = { ...makeProgress(), type: 'error' } as unknown as WsServerMessage;
    expect(isAnalysisProgress(msg)).toBe(false);
  });

  it('should return false when symbol is missing', () => {
    const { symbol, ...rest } = makeProgress() as unknown as Record<string, unknown>;
    expect(isAnalysisProgress(rest as unknown as WsServerMessage)).toBe(false);
  });

  it('should return false when agent is missing', () => {
    const { agent, ...rest } = makeProgress() as unknown as Record<string, unknown>;
    expect(isAnalysisProgress(rest as unknown as WsServerMessage)).toBe(false);
  });

  it('should return false when agent_number is NaN', () => {
    const msg = makeProgress({ agent_number: NaN } as unknown as Partial<WsAnalysisProgressMessage>);
    expect(isAnalysisProgress(msg)).toBe(false);
  });

  it('should return false when total_agents is Infinity', () => {
    const msg = makeProgress({ total_agents: Infinity } as unknown as Partial<WsAnalysisProgressMessage>);
    expect(isAnalysisProgress(msg)).toBe(false);
  });

  it('should return false when message field is missing', () => {
    const { message, ...rest } = makeProgress() as unknown as Record<string, unknown>;
    expect(isAnalysisProgress(rest as unknown as WsServerMessage)).toBe(false);
  });

  it('should return false when status is missing', () => {
    const { status, ...rest } = makeProgress() as unknown as Record<string, unknown>;
    expect(isAnalysisProgress(rest as unknown as WsServerMessage)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isAnalysisComplete
// ---------------------------------------------------------------------------

describe('isAnalysisComplete', () => {
  it('should return true for a valid analysis_complete message', () => {
    expect(isAnalysisComplete(makeComplete())).toBe(true);
  });

  it('should return false when type is not analysis_complete', () => {
    const msg = { ...makeComplete(), type: 'heartbeat' } as unknown as WsServerMessage;
    expect(isAnalysisComplete(msg)).toBe(false);
  });

  it('should return false when composite_signal is null', () => {
    const msg = { type: 'analysis_complete', symbol: 'AAPL', composite_signal: null, timestamp: 't' } as unknown as WsServerMessage;
    expect(isAnalysisComplete(msg)).toBe(false);
  });

  it('should return false when composite_signal is missing', () => {
    const msg = { type: 'analysis_complete', symbol: 'AAPL', timestamp: 't' } as unknown as WsServerMessage;
    expect(isAnalysisComplete(msg)).toBe(false);
  });

  it('should return false when composite_signal.direction is not a string', () => {
    const msg = { type: 'analysis_complete', symbol: 'AAPL', composite_signal: { direction: 123, score: 0.5 }, timestamp: 't' } as unknown as WsServerMessage;
    expect(isAnalysisComplete(msg)).toBe(false);
  });

  it('should return false when composite_signal.score is NaN', () => {
    const msg = { type: 'analysis_complete', symbol: 'AAPL', composite_signal: { direction: 'bullish', score: NaN }, timestamp: 't' } as unknown as WsServerMessage;
    expect(isAnalysisComplete(msg)).toBe(false);
  });

  it('should return false when timestamp is missing', () => {
    const msg = { type: 'analysis_complete', symbol: 'AAPL', composite_signal: { direction: 'bullish', score: 0.5 } } as unknown as WsServerMessage;
    expect(isAnalysisComplete(msg)).toBe(false);
  });

  it('should return false when symbol is missing', () => {
    const msg = { type: 'analysis_complete', composite_signal: { direction: 'bullish', score: 0.5 }, timestamp: 't' } as unknown as WsServerMessage;
    expect(isAnalysisComplete(msg)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isNewsAlert
// ---------------------------------------------------------------------------

describe('isNewsAlert', () => {
  it('should return true for a valid news_alert message', () => {
    expect(isNewsAlert(makeNewsAlert())).toBe(true);
  });

  it('should return false when type is not news_alert', () => {
    const msg = { ...makeNewsAlert(), type: 'error' } as unknown as WsServerMessage;
    expect(isNewsAlert(msg)).toBe(false);
  });

  it('should return false when sentiment is null', () => {
    const msg = { type: 'news_alert', symbol: 'AAPL', headline: 'H', sentiment: null, timestamp: 't' } as unknown as WsServerMessage;
    expect(isNewsAlert(msg)).toBe(false);
  });

  it('should return false when sentiment is missing', () => {
    const msg = { type: 'news_alert', symbol: 'AAPL', headline: 'H', timestamp: 't' } as unknown as WsServerMessage;
    expect(isNewsAlert(msg)).toBe(false);
  });

  it('should return false when sentiment.score is NaN', () => {
    const msg = { type: 'news_alert', symbol: 'AAPL', headline: 'H', sentiment: { score: NaN, label: 'positive' }, timestamp: 't' } as unknown as WsServerMessage;
    expect(isNewsAlert(msg)).toBe(false);
  });

  it('should return false when sentiment.label is not a string', () => {
    const msg = { type: 'news_alert', symbol: 'AAPL', headline: 'H', sentiment: { score: 0.5, label: 123 }, timestamp: 't' } as unknown as WsServerMessage;
    expect(isNewsAlert(msg)).toBe(false);
  });

  it('should return false when headline is missing', () => {
    const msg = { type: 'news_alert', symbol: 'AAPL', sentiment: { score: 0.5, label: 'positive' }, timestamp: 't' } as unknown as WsServerMessage;
    expect(isNewsAlert(msg)).toBe(false);
  });

  it('should return false when timestamp is missing', () => {
    const msg = { type: 'news_alert', symbol: 'AAPL', headline: 'H', sentiment: { score: 0.5, label: 'positive' } } as unknown as WsServerMessage;
    expect(isNewsAlert(msg)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isConnected
// ---------------------------------------------------------------------------

describe('isConnected', () => {
  it('should return true for a valid connected message', () => {
    expect(isConnected(makeConnected())).toBe(true);
  });

  it('should return false when type is not connected', () => {
    const msg = { ...makeConnected(), type: 'heartbeat' } as unknown as WsServerMessage;
    expect(isConnected(msg)).toBe(false);
  });

  it('should return false when client_id is missing', () => {
    const msg = { type: 'connected', server_time: 't' } as unknown as WsServerMessage;
    expect(isConnected(msg)).toBe(false);
  });

  it('should return false when server_time is missing', () => {
    const msg = { type: 'connected', client_id: 'abc' } as unknown as WsServerMessage;
    expect(isConnected(msg)).toBe(false);
  });

  it('should return false when client_id is not a string', () => {
    const msg = { type: 'connected', client_id: 42, server_time: 't' } as unknown as WsServerMessage;
    expect(isConnected(msg)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isHeartbeat
// ---------------------------------------------------------------------------

describe('isHeartbeat', () => {
  it('should return true for a valid heartbeat message', () => {
    const msg: WsHeartbeatMessage = { type: 'heartbeat', server_time: '2024-06-15T10:00:00Z' };
    expect(isHeartbeat(msg)).toBe(true);
  });

  it('should return false when type is not heartbeat', () => {
    const msg = { type: 'pong', server_time: 't' } as unknown as WsServerMessage;
    expect(isHeartbeat(msg)).toBe(false);
  });

  it('should return false when server_time is missing', () => {
    const msg = { type: 'heartbeat' } as unknown as WsServerMessage;
    expect(isHeartbeat(msg)).toBe(false);
  });

  it('should return false when server_time is not a string', () => {
    const msg = { type: 'heartbeat', server_time: 123 } as unknown as WsServerMessage;
    expect(isHeartbeat(msg)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isError
// ---------------------------------------------------------------------------

describe('isError', () => {
  it('should return true for a valid error message', () => {
    const msg: WsErrorMessage = { type: 'error', source: 'server', message: 'Bad request', severity: 'error' };
    expect(isError(msg)).toBe(true);
  });

  it('should return false when type is not error', () => {
    const msg = { type: 'ack', source: 's', message: 'm' } as unknown as WsServerMessage;
    expect(isError(msg)).toBe(false);
  });

  it('should return false when source is missing', () => {
    const msg = { type: 'error', message: 'm' } as unknown as WsServerMessage;
    expect(isError(msg)).toBe(false);
  });

  it('should return false when message field is missing', () => {
    const msg = { type: 'error', source: 's' } as unknown as WsServerMessage;
    expect(isError(msg)).toBe(false);
  });

  it('should return false when source is not a string', () => {
    const msg = { type: 'error', source: 42, message: 'm' } as unknown as WsServerMessage;
    expect(isError(msg)).toBe(false);
  });

  it('should accept both severity levels', () => {
    const warning: WsErrorMessage = { type: 'error', source: 's', message: 'm', severity: 'warning' };
    const error: WsErrorMessage = { type: 'error', source: 's', message: 'm', severity: 'error' };
    expect(isError(warning)).toBe(true);
    expect(isError(error)).toBe(true);
  });
});
