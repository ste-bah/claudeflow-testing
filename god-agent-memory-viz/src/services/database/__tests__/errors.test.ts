/**
 * Integration tests for database error handling
 *
 * @module services/database/__tests__/errors.test
 */

import { describe, it, expect } from 'vitest';
import {
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
} from '../errors';

describe('Database Error Classes', () => {
  describe('DatabaseError', () => {
    it('creates error with default values', () => {
      const error = new DatabaseError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe(DatabaseErrorCode.UNKNOWN);
      expect(error.userMessage).toBeDefined();
      expect(error.suggestions).toBeDefined();
      expect(error.suggestions.length).toBeGreaterThan(0);
      expect(error.recoverable).toBe(true);
    });

    it('creates error with specific code', () => {
      const error = new DatabaseError('File invalid', DatabaseErrorCode.FILE_INVALID);

      expect(error.code).toBe(DatabaseErrorCode.FILE_INVALID);
      expect(error.userMessage).toContain('not a valid SQLite');
    });

    it('preserves cause error', () => {
      const cause = new Error('Original error');
      const error = new DatabaseError('Wrapped error', DatabaseErrorCode.QUERY_FAILED, { cause });

      expect(error.cause).toBe(cause);
    });

    it('is an instance of Error', () => {
      const error = new DatabaseError('Test');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DatabaseError);
    });
  });

  describe('ConnectionError', () => {
    it('creates connection error with proper name', () => {
      const error = new ConnectionError(
        'Connection failed',
        DatabaseErrorCode.CONNECTION_FAILED
      );

      expect(error.name).toBe('ConnectionError');
      expect(error.recoverable).toBe(true);
    });
  });

  describe('FileError', () => {
    it('includes file information', () => {
      const error = new FileError(
        'Invalid file',
        DatabaseErrorCode.FILE_INVALID,
        { fileName: 'test.db', fileSize: 1024 }
      );

      expect(error.name).toBe('FileError');
      expect(error.fileName).toBe('test.db');
      expect(error.fileSize).toBe(1024);
    });
  });

  describe('SchemaError', () => {
    it('includes schema information', () => {
      const error = new SchemaError(
        'Missing tables',
        DatabaseErrorCode.SCHEMA_MISSING_TABLE,
        { missingTables: ['events', 'sessions'], foundTables: ['memory'] }
      );

      expect(error.name).toBe('SchemaError');
      expect(error.missingTables).toEqual(['events', 'sessions']);
      expect(error.foundTables).toEqual(['memory']);
      expect(error.recoverable).toBe(false);
    });
  });

  describe('QueryError', () => {
    it('includes query information', () => {
      const error = new QueryError(
        'Query failed',
        DatabaseErrorCode.QUERY_FAILED,
        { query: 'SELECT * FROM events' }
      );

      expect(error.name).toBe('QueryError');
      expect(error.query).toBe('SELECT * FROM events');
    });
  });

  describe('DataError', () => {
    it('includes data information', () => {
      const error = new DataError(
        'Parse failed',
        DatabaseErrorCode.DATA_PARSE_ERROR,
        { fieldName: 'data', rawValue: '{invalid}' }
      );

      expect(error.name).toBe('DataError');
      expect(error.fieldName).toBe('data');
      expect(error.rawValue).toBe('{invalid}');
    });
  });
});

describe('Error Utilities', () => {
  describe('wrapError', () => {
    it('returns DatabaseError unchanged', () => {
      const original = new DatabaseError('Test', DatabaseErrorCode.FILE_INVALID);
      const wrapped = wrapError(original);

      expect(wrapped).toBe(original);
    });

    it('wraps regular Error into DatabaseError', () => {
      const original = new Error('Regular error');
      const wrapped = wrapError(original);

      expect(wrapped).toBeInstanceOf(DatabaseError);
      expect(wrapped.cause).toBe(original);
    });

    it('wraps string into DatabaseError', () => {
      const wrapped = wrapError('String error');

      expect(wrapped).toBeInstanceOf(DatabaseError);
      expect(wrapped.message).toBe('String error');
    });

    it('detects specific error types from message', () => {
      const fileError = wrapError(new Error('file is not a database'));
      expect(fileError.code).toBe(DatabaseErrorCode.FILE_INVALID);

      const corruptError = wrapError(new Error('database disk image is malformed'));
      expect(corruptError.code).toBe(DatabaseErrorCode.FILE_CORRUPT);

      const tableError = wrapError(new Error('no such table: events'));
      expect(tableError.code).toBe(DatabaseErrorCode.SCHEMA_MISSING_TABLE);

      const syntaxError = wrapError(new Error('syntax error near'));
      expect(syntaxError.code).toBe(DatabaseErrorCode.QUERY_SYNTAX_ERROR);

      const jsonError = wrapError(new Error('Unexpected token in JSON'));
      expect(jsonError.code).toBe(DatabaseErrorCode.DATA_PARSE_ERROR);
    });
  });

  describe('handleDatabaseError', () => {
    it('wraps and returns DatabaseError', () => {
      const error = new Error('Test error');
      const result = handleDatabaseError(error);

      expect(result).toBeInstanceOf(DatabaseError);
    });

    it('preserves context', () => {
      const error = new Error('Test error');
      const result = handleDatabaseError(error, {
        component: 'TestComponent',
        action: 'testAction',
      });

      expect(result).toBeInstanceOf(DatabaseError);
    });
  });

  describe('createErrorSummary', () => {
    it('creates user-friendly error summary', () => {
      const error = new DatabaseError('Test', DatabaseErrorCode.FILE_INVALID);
      const summary = createErrorSummary(error);

      expect(summary.title).toBe('Database Error');
      expect(summary.message).toBe(error.userMessage);
      expect(summary.suggestions).toEqual(error.suggestions);
      expect(summary.code).toBe(error.code);
      expect(summary.recoverable).toBe(error.recoverable);
    });
  });

  describe('isDatabaseError', () => {
    it('returns true for DatabaseError', () => {
      const dbError = new DatabaseError('Test');
      expect(isDatabaseError(dbError)).toBe(true);
    });

    it('returns true for subclasses', () => {
      const fileError = new FileError('Test', DatabaseErrorCode.FILE_INVALID);
      expect(isDatabaseError(fileError)).toBe(true);
    });

    it('returns false for regular Error', () => {
      const regularError = new Error('Test');
      expect(isDatabaseError(regularError)).toBe(false);
    });

    it('returns false for non-errors', () => {
      expect(isDatabaseError('string')).toBe(false);
      expect(isDatabaseError(null)).toBe(false);
      expect(isDatabaseError(undefined)).toBe(false);
    });
  });

  describe('isRecoverableError', () => {
    it('returns error.recoverable for DatabaseError', () => {
      const recoverable = new DatabaseError('Test', DatabaseErrorCode.QUERY_FAILED);
      expect(isRecoverableError(recoverable)).toBe(true);

      const nonRecoverable = new SchemaError('Test', DatabaseErrorCode.SCHEMA_INVALID);
      expect(isRecoverableError(nonRecoverable)).toBe(false);
    });

    it('returns true for unknown errors', () => {
      expect(isRecoverableError(new Error('Unknown'))).toBe(true);
      expect(isRecoverableError('string')).toBe(true);
    });
  });
});

describe('Error Codes', () => {
  it('has user-friendly messages for all codes', () => {
    const codes = Object.values(DatabaseErrorCode);

    for (const code of codes) {
      const error = new DatabaseError('Test', code);
      expect(error.userMessage).toBeDefined();
      expect(error.userMessage.length).toBeGreaterThan(0);
    }
  });

  it('has recovery suggestions for all codes', () => {
    const codes = Object.values(DatabaseErrorCode);

    for (const code of codes) {
      const error = new DatabaseError('Test', code);
      expect(error.suggestions).toBeDefined();
      expect(error.suggestions.length).toBeGreaterThan(0);
    }
  });
});
