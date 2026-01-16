/**
 * Database Error Handling
 *
 * Custom error classes and handlers for database operations.
 * Provides user-friendly messages and recovery strategies.
 *
 * @module services/database/errors
 */

import { logError, type ErrorContext } from '@/utils/errorLogging';

/**
 * Error codes for categorizing database errors
 */
export enum DatabaseErrorCode {
  // Connection errors
  CONNECTION_FAILED = 'DB_CONNECTION_FAILED',
  CONNECTION_TIMEOUT = 'DB_CONNECTION_TIMEOUT',
  CONNECTION_CLOSED = 'DB_CONNECTION_CLOSED',
  NOT_INITIALIZED = 'DB_NOT_INITIALIZED',

  // File errors
  FILE_INVALID = 'DB_FILE_INVALID',
  FILE_CORRUPT = 'DB_FILE_CORRUPT',
  FILE_TOO_LARGE = 'DB_FILE_TOO_LARGE',
  FILE_READ_ERROR = 'DB_FILE_READ_ERROR',

  // Schema errors
  SCHEMA_INVALID = 'DB_SCHEMA_INVALID',
  SCHEMA_MISSING_TABLE = 'DB_SCHEMA_MISSING_TABLE',
  SCHEMA_VERSION_MISMATCH = 'DB_SCHEMA_VERSION_MISMATCH',

  // Query errors
  QUERY_FAILED = 'DB_QUERY_FAILED',
  QUERY_TIMEOUT = 'DB_QUERY_TIMEOUT',
  QUERY_SYNTAX_ERROR = 'DB_QUERY_SYNTAX_ERROR',

  // Data errors
  DATA_PARSE_ERROR = 'DB_DATA_PARSE_ERROR',
  DATA_VALIDATION_ERROR = 'DB_DATA_VALIDATION_ERROR',

  // General errors
  UNKNOWN = 'DB_UNKNOWN',
}

/**
 * User-friendly error messages for each error code
 */
const USER_FRIENDLY_MESSAGES: Record<DatabaseErrorCode, string> = {
  [DatabaseErrorCode.CONNECTION_FAILED]:
    'Failed to connect to the database. Please try again.',
  [DatabaseErrorCode.CONNECTION_TIMEOUT]:
    'Database connection timed out. The file may be too large or corrupted.',
  [DatabaseErrorCode.CONNECTION_CLOSED]:
    'Database connection was closed unexpectedly.',
  [DatabaseErrorCode.NOT_INITIALIZED]:
    'Please load a database file first.',
  [DatabaseErrorCode.FILE_INVALID]:
    'The selected file is not a valid SQLite database.',
  [DatabaseErrorCode.FILE_CORRUPT]:
    'The database file appears to be corrupted and cannot be read.',
  [DatabaseErrorCode.FILE_TOO_LARGE]:
    'The database file is too large. Maximum size is 100MB.',
  [DatabaseErrorCode.FILE_READ_ERROR]:
    'Failed to read the database file. Check file permissions.',
  [DatabaseErrorCode.SCHEMA_INVALID]:
    'The database schema is not compatible with this application.',
  [DatabaseErrorCode.SCHEMA_MISSING_TABLE]:
    'Required database tables are missing. This may not be a God Agent database.',
  [DatabaseErrorCode.SCHEMA_VERSION_MISMATCH]:
    'The database version is not compatible with this application.',
  [DatabaseErrorCode.QUERY_FAILED]:
    'A database query failed. Please try again.',
  [DatabaseErrorCode.QUERY_TIMEOUT]:
    'The query took too long to complete. Try filtering your data.',
  [DatabaseErrorCode.QUERY_SYNTAX_ERROR]:
    'An internal query error occurred. Please report this issue.',
  [DatabaseErrorCode.DATA_PARSE_ERROR]:
    'Failed to parse data from the database. Some records may be malformed.',
  [DatabaseErrorCode.DATA_VALIDATION_ERROR]:
    'Data validation failed. Some records contain invalid values.',
  [DatabaseErrorCode.UNKNOWN]:
    'An unexpected database error occurred. Please try again.',
};

/**
 * Recovery suggestions for each error code
 */
const RECOVERY_SUGGESTIONS: Record<DatabaseErrorCode, string[]> = {
  [DatabaseErrorCode.CONNECTION_FAILED]: [
    'Refresh the page and try again',
    'Check if the file is accessible',
    'Try a different database file',
  ],
  [DatabaseErrorCode.CONNECTION_TIMEOUT]: [
    'Try with a smaller database file',
    'Close other browser tabs to free memory',
    'Refresh the page and try again',
  ],
  [DatabaseErrorCode.CONNECTION_CLOSED]: [
    'Reload the database file',
    'Refresh the page',
  ],
  [DatabaseErrorCode.NOT_INITIALIZED]: [
    'Drag and drop a .db, .sqlite, or .sqlite3 file',
    'Click the upload area to browse for a file',
  ],
  [DatabaseErrorCode.FILE_INVALID]: [
    'Ensure the file is a SQLite database',
    'Check the file extension (.db, .sqlite, .sqlite3)',
    'Try exporting the database again from the source',
  ],
  [DatabaseErrorCode.FILE_CORRUPT]: [
    'Try obtaining a fresh copy of the database',
    'Check if the file was completely downloaded',
    'Verify the source database is not corrupted',
  ],
  [DatabaseErrorCode.FILE_TOO_LARGE]: [
    'Export a subset of data from the original database',
    'Use date filters to reduce the data range',
    'Split the database into smaller files',
  ],
  [DatabaseErrorCode.FILE_READ_ERROR]: [
    'Check file permissions',
    'Close any programs that might be using the file',
    'Try copying the file to a different location',
  ],
  [DatabaseErrorCode.SCHEMA_INVALID]: [
    'Ensure this is a God Agent database file',
    'Check the database version compatibility',
  ],
  [DatabaseErrorCode.SCHEMA_MISSING_TABLE]: [
    'Verify this is a God Agent events database',
    'Check that the database was exported correctly',
  ],
  [DatabaseErrorCode.SCHEMA_VERSION_MISMATCH]: [
    'Update to the latest version of this application',
    'Export the database from a compatible God Agent version',
  ],
  [DatabaseErrorCode.QUERY_FAILED]: [
    'Try again with different filters',
    'Reload the database',
  ],
  [DatabaseErrorCode.QUERY_TIMEOUT]: [
    'Apply filters to reduce the data size',
    'Try a shorter time range',
    'Reduce the number of visible nodes',
  ],
  [DatabaseErrorCode.QUERY_SYNTAX_ERROR]: [
    'Report this issue to the developers',
    'Try refreshing the page',
  ],
  [DatabaseErrorCode.DATA_PARSE_ERROR]: [
    'Some data may be displayed incorrectly',
    'Check the source database for invalid JSON',
  ],
  [DatabaseErrorCode.DATA_VALIDATION_ERROR]: [
    'Review the data in the original database',
    'Some records may be skipped during visualization',
  ],
  [DatabaseErrorCode.UNKNOWN]: [
    'Refresh the page and try again',
    'Try a different database file',
    'Report the issue if it persists',
  ],
};

/**
 * Base class for database errors
 */
export class DatabaseError extends Error {
  /** Error code for categorization */
  readonly code: DatabaseErrorCode;
  /** User-friendly error message */
  readonly userMessage: string;
  /** Suggestions for recovery */
  readonly suggestions: string[];
  /** Whether the error is recoverable */
  readonly recoverable: boolean;
  /** Original error if this wraps another error */
  readonly cause?: Error;
  /** Additional context for debugging */
  readonly context?: ErrorContext;

  constructor(
    message: string,
    code: DatabaseErrorCode = DatabaseErrorCode.UNKNOWN,
    options?: {
      cause?: Error;
      recoverable?: boolean;
      context?: ErrorContext;
    }
  ) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.userMessage = USER_FRIENDLY_MESSAGES[code];
    this.suggestions = RECOVERY_SUGGESTIONS[code];
    this.recoverable = options?.recoverable ?? true;
    this.cause = options?.cause;
    this.context = options?.context;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DatabaseError);
    }
  }
}

/**
 * Error thrown when database connection fails
 */
export class ConnectionError extends DatabaseError {
  constructor(message: string, code: DatabaseErrorCode, cause?: Error) {
    super(message, code, { cause, recoverable: true });
    this.name = 'ConnectionError';
  }
}

/**
 * Error thrown when database file is invalid
 */
export class FileError extends DatabaseError {
  readonly fileName?: string;
  readonly fileSize?: number;

  constructor(
    message: string,
    code: DatabaseErrorCode,
    options?: { fileName?: string; fileSize?: number; cause?: Error }
  ) {
    super(message, code, { cause: options?.cause, recoverable: true });
    this.name = 'FileError';
    this.fileName = options?.fileName;
    this.fileSize = options?.fileSize;
  }
}

/**
 * Error thrown when database schema is invalid
 */
export class SchemaError extends DatabaseError {
  readonly missingTables?: string[];
  readonly foundTables?: string[];

  constructor(
    message: string,
    code: DatabaseErrorCode,
    options?: { missingTables?: string[]; foundTables?: string[] }
  ) {
    super(message, code, { recoverable: false });
    this.name = 'SchemaError';
    this.missingTables = options?.missingTables;
    this.foundTables = options?.foundTables;
  }
}

/**
 * Error thrown when a query fails
 */
export class QueryError extends DatabaseError {
  readonly query?: string;

  constructor(
    message: string,
    code: DatabaseErrorCode,
    options?: { query?: string; cause?: Error }
  ) {
    super(message, code, { cause: options?.cause, recoverable: true });
    this.name = 'QueryError';
    this.query = options?.query;
  }
}

/**
 * Error thrown when data parsing fails
 */
export class DataError extends DatabaseError {
  readonly fieldName?: string;
  readonly rawValue?: unknown;

  constructor(
    message: string,
    code: DatabaseErrorCode,
    options?: { fieldName?: string; rawValue?: unknown; cause?: Error }
  ) {
    super(message, code, { cause: options?.cause, recoverable: true });
    this.name = 'DataError';
    this.fieldName = options?.fieldName;
    this.rawValue = options?.rawValue;
  }
}

/**
 * Wraps an unknown error into a DatabaseError
 */
export function wrapError(
  error: unknown,
  defaultCode: DatabaseErrorCode = DatabaseErrorCode.UNKNOWN,
  context?: ErrorContext
): DatabaseError {
  if (error instanceof DatabaseError) {
    return error;
  }

  const cause = error instanceof Error ? error : new Error(String(error));
  const message = cause.message;

  // Try to detect specific error types from the message
  let code = defaultCode;

  if (message.includes('not a database') || message.includes('file is not a database')) {
    code = DatabaseErrorCode.FILE_INVALID;
  } else if (message.includes('database disk image is malformed')) {
    code = DatabaseErrorCode.FILE_CORRUPT;
  } else if (message.includes('no such table')) {
    code = DatabaseErrorCode.SCHEMA_MISSING_TABLE;
  } else if (message.includes('syntax error')) {
    code = DatabaseErrorCode.QUERY_SYNTAX_ERROR;
  } else if (message.includes('JSON')) {
    code = DatabaseErrorCode.DATA_PARSE_ERROR;
  }

  return new DatabaseError(message, code, { cause, context });
}

/**
 * Handles a database error with logging
 */
export function handleDatabaseError(
  error: unknown,
  context?: ErrorContext
): DatabaseError {
  const dbError = wrapError(error, DatabaseErrorCode.UNKNOWN, context);

  // Log the error
  logError(dbError, {
    ...context,
    component: context?.component ?? 'DatabaseService',
    metadata: {
      ...context?.metadata,
      errorCode: dbError.code,
      recoverable: dbError.recoverable,
    },
  });

  return dbError;
}

/**
 * Creates a user-friendly error summary for display
 */
export interface ErrorSummary {
  title: string;
  message: string;
  suggestions: string[];
  code: string;
  recoverable: boolean;
}

/**
 * Creates an error summary for UI display
 */
export function createErrorSummary(error: DatabaseError): ErrorSummary {
  return {
    title: error.name.replace('Error', ' Error'),
    message: error.userMessage,
    suggestions: error.suggestions,
    code: error.code,
    recoverable: error.recoverable,
  };
}

/**
 * Checks if an error is a specific type of database error
 */
export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof DatabaseError;
}

/**
 * Checks if an error is recoverable
 */
export function isRecoverableError(error: unknown): boolean {
  if (error instanceof DatabaseError) {
    return error.recoverable;
  }
  return true; // Assume unknown errors are recoverable
}
