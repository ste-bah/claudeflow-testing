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

/**
 * @deprecated Use NewsArticle from './news' instead. Kept for backward
 * compatibility with components that have not yet migrated.
 */
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

/**
 * @deprecated Use MacroCalendarEvent from './macro' instead. Kept for backward
 * compatibility with components that have not yet migrated.
 */
export interface MacroEvent {
  id: string;
  name: string;
  date: string;
  expected: number | null;
  actual: number | null;
  previous: number | null;
  impact: 'high' | 'medium' | 'low';
}

export type { WatchlistEntry, WatchlistResponse } from './watchlist';
export { SYMBOL_REGEX, MAX_WATCHLIST_SIZE } from './watchlist';

export type {
  NewsArticleRaw,
  NewsApiResponse,
  NewsArticle as NewsArticleDisplay,
  SentimentDirection,
} from './news';
export {
  NEWS_PAGE_SIZE,
  NEWS_CACHE_TTL_MS,
  NEWS_RETRY_DELAY_MS,
  RELATIVE_TIME_UPDATE_INTERVAL_MS,
  normalizeArticle,
  sortArticlesByDate,
  formatRelativeTime,
} from './news';

export type {
  FundamentalsTtmRaw,
  FundamentalsQuarterRaw,
  FundamentalsApiResponse,
  FundamentalsTtm,
  FundamentalsQuarter,
  FundamentalsData,
} from './fundamentals';
export {
  FUNDAMENTALS_CACHE_TTL_MS,
  isDisplayable,
  formatCurrency,
  formatPercent,
  formatRatio,
  formatEps,
  normalizeQuarter,
  normalizeFundamentals,
} from './fundamentals';

export type {
  OwnershipHolderRaw,
  OwnershipQoQRaw,
  OwnershipApiResponse,
  InsiderTransactionRaw,
  InsiderSummaryRaw,
  InsiderApiResponse,
  OwnershipHolder,
  OwnershipQoQ,
  OwnershipData,
  InsiderTransaction,
  InsiderSummary,
  InsiderData,
} from './ownership';
export {
  OWNERSHIP_CACHE_TTL_MS,
  INSIDER_CACHE_TTL_MS,
  TRANSACTION_BADGE_MAP,
  formatShares,
  formatChangePercent,
  normalizeHolder,
  normalizeOwnership,
  normalizeInsiderTransaction,
  normalizeInsider,
} from './ownership';

export type {
  OverallDirection,
  SignalDirection,
  SignalTimeframe,
  AnalysisSignalRaw,
  TimeframeBreakdownRaw,
  AnalysisCompositeRaw,
  AnalysisMetadataRaw,
  AnalysisApiResponse,
  AnalysisSignal,
  TimeframeBreakdown,
  AnalysisComposite,
  AnalysisMetadata,
  AnalysisData,
  DirectionConfig,
} from './analysis';
export {
  ANALYSIS_CACHE_TTL_MS,
  METHODOLOGY_DISPLAY_NAMES,
  DIRECTION_CONFIG,
  TIMEFRAME_LABELS,
  normalizeDirection,
  normalizeOverallDirection,
  normalizeTimeframe,
  normalizeSignal,
  normalizeTimeframeBreakdown,
  normalizeAnalysis,
} from './analysis';

export type {
  ImportanceLevel,
  SurpriseDirection,
  MacroEventType,
  MacroCalendarEventRaw,
  MacroCalendarApiResponse,
  MacroReactionRaw,
  MacroReactionAveragesRaw,
  MacroReactionApiResponse,
  MacroCalendarEvent,
  MacroCalendarData,
  MacroReaction,
  MacroReactionAverages,
  MacroReactionData,
  ImportanceConfig,
} from './macro';
export {
  MACRO_CALENDAR_CACHE_TTL_MS,
  MACRO_REACTION_CACHE_TTL_MS,
  MACRO_CALENDAR_PAST_DAYS,
  MACRO_CALENDAR_FUTURE_DAYS,
  EVENT_TYPE_COLORS,
  EVENT_TYPE_DISPLAY_NAMES,
  VALID_EVENT_TYPES,
  IMPORTANCE_CONFIG,
  normalizeImportance,
  normalizeSurprise,
  normalizeCalendarEvent,
  normalizeCalendar,
  normalizeReactionEntry,
  normalizeReaction,
  formatEventValue,
  formatSurprise,
} from './macro';

export type {
  CommandType,
  SymbolCommand,
  ScanCommand,
  MacroCommand,
  QueryCommand,
  ParsedCommand,
  CommandResult,
  CommandSuggestion,
  ScanApiResponse,
  UseCommandResult,
} from './command';
export {
  COMMAND_SYMBOL_REGEX,
  MAX_HISTORY,
  MAX_INPUT_LENGTH,
  COMMAND_SUGGESTIONS,
  sanitize,
  parseCommand,
  filterSuggestions,
  commandTypeColor,
  isSymbolCommand,
  isScanCommand,
  isMacroCommand,
  isQueryCommand,
} from './command';

export type {
  WsChannel,
  WsConnectionStatus,
  WsServerMessage,
  WsServerMessageType,
  WsMessageMap,
  WsClientAction,
  WsConnectedMessage,
  WsSubscribedMessage,
  WsUnsubscribedMessage,
  WsHeartbeatMessage,
  WsPongMessage,
  WsAckMessage,
  WsErrorMessage,
  WsPriceUpdateMessage,
  WsAnalysisProgressMessage,
  WsAnalysisCompleteMessage,
  WsNewsAlertMessage,
  WsGodAgentProgressMessage,
  WsGodAgentCompleteMessage,
  CancelQueryResponse,
  WsSubscribeAction,
  WsUnsubscribeAction,
  WsPingAction,
} from './websocket';
export {
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
  isGodAgentProgress,
  isGodAgentComplete,
} from './websocket';
export type {
  AppEnvConfig,
  ServerConfig,
  DatabaseConfig,
  CacheConfig,
  CircuitBreakerConfig,
  FinBertConfig,
  LogConfig,
  createConfigFromEnv,
  parseIntEnv,
  parseBoolEnv,
} from './env';
export { DEFAULT_CONFIG } from './env';

export type {
  ServiceStatus,
  ServiceInfo,
  SystemHealth,
  DatabaseHealth,
  ApiHealth,
  StartupConfig,
  BackendStartupConfig,
  FrontendStartupConfig,
  StartupProgress,
  StopProgress,
  BackendHealthResponse,
  PidFileInfo,
  ProcessInfo,
} from './startup';
export { DEFAULT_STARTUP_PROGRESS, STARTUP_PHASE_PROGRESS } from './startup';
