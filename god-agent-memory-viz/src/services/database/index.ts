/**
 * Database service exports
 *
 * @module services/database
 */

// Main service
export { DatabaseService, getDatabaseService } from './DatabaseService';

// Stats service
export { StatsService, getStatsService } from './StatsService';

// Types
export type {
  RawEventRow,
  RawMemoryEntryRow,
  RawSessionRow,
  ConnectionState,
  ConnectionInfo,
  DatabaseStats,
  SchemaValidation,
  QueryResult,
  ConnectionStateListener,
} from './types';

// Stats types
export type {
  ComprehensiveStats,
  EventStats,
  MemoryStats,
  SessionStatsAggregated,
  AgentStats,
  TimelineDataPoint,
  TimelineBucketSize,
} from './StatsService';

// Query modules
export * from './queries';

// Transformers
export * from './transformers';

// Errors
export {
  DatabaseError,
  ConnectionError,
  FileError,
  SchemaError,
  QueryError,
  DataError,
  DatabaseErrorCode,
  wrapError,
  handleDatabaseError,
  createErrorSummary,
  isDatabaseError,
  isRecoverableError,
} from './errors';
export type { ErrorSummary } from './errors';

// Pagination
export {
  createPaginationState,
  calculateOffset,
  paginateArray,
  createCursor,
  applyCursorPagination,
  chunkArray,
  processInChunks,
  loadProgressively,
  paginatedIterator,
  cursorIterator,
  validatePageSize,
  validatePageNumber,
  getVisiblePageNumbers,
} from './pagination';
export type {
  PaginationState,
  PaginatedResult,
  Cursor,
  CursorResult,
  ChunkProgress,
  ChunkProgressCallback,
} from './pagination';
