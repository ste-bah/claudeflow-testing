/**
 * Tests for API client error handling.
 *
 * Validates:
 * - Network error parsing
 * - HTTP status code mapping
 * - ApiError structure
 * - Response parsing from various error scenarios
 *
 * Run with: `npm test -- src/__tests__/api/client-errors.test.ts`
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios, { AxiosError, type AxiosResponse } from 'axios';

// Test helper - simulates the parseApiError logic from client.ts
const parseApiError = (error: AxiosError) => {
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data as Record<string, unknown> | undefined;

    if (data?.code && typeof data.code === 'string') {
      return {
        code: data.code,
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
    return {
      code: 'NETWORK_ERROR',
      message: error.message || 'Network error - unable to reach server',
      status: 0,
    };
  }

  return {
    code: 'UNKNOWN',
    message: error.message || 'An unexpected error occurred',
    status: 0,
  };
};

const mapStatusToCode = (status: number): string => {
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
};

const getDefaultMessage = (status: number): string => {
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
      return 'An unexpected error occurred';
  }
};

// Helper to create mock AxiosError with proper structure
const createMockAxiosError = (
  message: string,
  options: {
    response?: Partial<AxiosResponse>;
    request?: XMLHttpRequest | null;
  } = {}
): AxiosError => {
  const error = new AxiosError(message) as AxiosError;
  if (options.response) {
    error.response = options.response as AxiosResponse;
  }
  if (options.request !== undefined) {
    (error as unknown as { request: XMLHttpRequest | null }).request = options.request;
  }
  return error;
};

describe('API Client Error Handling', () => {
  describe('parseApiError', () => {
    describe('server errors with response data', () => {
      it('should parse 400 error with code', () => {
        const error = createMockAxiosError('Bad Request', {
          response: {
            status: 400,
            data: { code: 'VALIDATION_ERROR', message: 'Invalid symbol' },
          },
        });

        const result = parseApiError(error);

        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.message).toBe('Invalid symbol');
        expect(result.status).toBe(400);
      });

      it('should parse 404 error with default message', () => {
        const error = createMockAxiosError('Not Found', {
          response: {
            status: 404,
            data: {},
          },
        });

        const result = parseApiError(error);

        expect(result.code).toBe('NOT_FOUND');
        // Message falls back to error.message if no data.message
        expect(result.message).toBe('Not Found');
        expect(result.status).toBe(404);
      });

      it('should parse 500 error', () => {
        const error = createMockAxiosError('Internal Server Error', {
          response: {
            status: 500,
            data: { message: 'Database connection failed' },
          },
        });

        const result = parseApiError(error);

        expect(result.code).toBe('INTERNAL_ERROR');
        expect(result.message).toBe('Database connection failed');
        expect(result.status).toBe(500);
      });

      it('should parse error with details', () => {
        const error = createMockAxiosError('Bad Request', {
          response: {
            status: 400,
            data: {
              code: 'VALIDATION_ERROR',
              message: 'Validation failed',
              details: { field: 'symbol', reason: 'required' },
            },
          },
        });

        const result = parseApiError(error);

        expect(result.details).toEqual({ field: 'symbol', reason: 'required' });
      });

      it('should handle 401 Unauthorized', () => {
        const error = createMockAxiosError('Unauthorized', {
          response: {
            status: 401,
            data: {},
          },
        });

        const result = parseApiError(error);

        expect(result.code).toBe('UNAUTHORIZED');
        expect(result.message).toBe('Unauthorized');
        expect(result.status).toBe(401);
      });

      it('should handle 403 Forbidden', () => {
        const error = createMockAxiosError('Forbidden', {
          response: {
            status: 403,
            data: {},
          },
        });

        const result = parseApiError(error);

        expect(result.code).toBe('FORBIDDEN');
        expect(result.status).toBe(403);
      });

      it('should handle 409 Conflict', () => {
        const error = createMockAxiosError('Conflict', {
          response: {
            status: 409,
            data: {},
          },
        });

        const result = parseApiError(error);

        expect(result.code).toBe('CONFLICT');
        expect(result.message).toBe('Conflict');
        expect(result.status).toBe(409);
      });

      it('should handle 429 Rate Limited', () => {
        const error = createMockAxiosError('Too Many Requests', {
          response: {
            status: 429,
            data: {},
          },
        });

        const result = parseApiError(error);

        expect(result.code).toBe('RATE_LIMITED');
        // Message falls back to error.message if no data.message
        expect(result.message).toBe('Too Many Requests');
        expect(result.status).toBe(429);
      });

      it('should handle 503 Service Unavailable', () => {
        const error = createMockAxiosError('Service Unavailable', {
          response: {
            status: 503,
            data: {},
          },
        });

        const result = parseApiError(error);

        expect(result.code).toBe('SERVICE_UNAVAILABLE');
        expect(result.status).toBe(503);
      });

      it('should map unknown status to UNKNOWN code', () => {
        const error = createMockAxiosError('Unknown Error', {
          response: {
            status: 418,
            data: {},
          },
        });

        const result = parseApiError(error);

        expect(result.code).toBe('UNKNOWN');
        expect(result.status).toBe(418);
      });
    });

    describe('network errors (no response)', () => {
      it('should parse network error', () => {
        // Create error with request but no response - simulates network error
        const error = createMockAxiosError('Network Error', {
          request: {} as XMLHttpRequest,
        });

        const result = parseApiError(error);

        expect(result.code).toBe('NETWORK_ERROR');
        expect(result.message).toBe('Network Error');
        expect(result.status).toBe(0);
      });

      it('should provide default message for empty network error', () => {
        const error = createMockAxiosError('', {
          request: {} as XMLHttpRequest,
        });

        const result = parseApiError(error);

        expect(result.code).toBe('NETWORK_ERROR');
        expect(result.message).toBe('Network error - unable to reach server');
        expect(result.status).toBe(0);
      });
    });

    describe('request setup errors', () => {
      it('should handle request setup errors (no request, no response)', () => {
        // This happens when the request was configured incorrectly
        const error = createMockAxiosError('Request canceled', {
          request: null,
        });

        const result = parseApiError(error);

        expect(result.code).toBe('UNKNOWN');
        expect(result.status).toBe(0);
      });

      it('should provide generic message for unknown errors', () => {
        const error = createMockAxiosError('', {
          request: null,
        });

        const result = parseApiError(error);

        expect(result.code).toBe('UNKNOWN');
        // Empty message should fall back to default
        expect(result.message).toBe('An unexpected error occurred');
      });
    });
  });

  describe('mapStatusToCode', () => {
    it.each([
      [400, 'VALIDATION_ERROR'],
      [401, 'UNAUTHORIZED'],
      [403, 'FORBIDDEN'],
      [404, 'NOT_FOUND'],
      [409, 'CONFLICT'],
      [429, 'RATE_LIMITED'],
      [500, 'INTERNAL_ERROR'],
      [503, 'SERVICE_UNAVAILABLE'],
    ])('should map status %d to %s', (status, expectedCode) => {
      expect(mapStatusToCode(status)).toBe(expectedCode);
    });

    it('should map unknown status codes to UNKNOWN', () => {
      expect(mapStatusToCode(418)).toBe('UNKNOWN');
      expect(mapStatusToCode(599)).toBe('UNKNOWN');
    });
  });

  describe('getDefaultMessage', () => {
    it.each([
      [400, 'Bad request'],
      [401, 'Unauthorized'],
      [403, 'Forbidden'],
      [404, 'Resource not found'],
      [409, 'Conflict'],
      [429, 'Too many requests'],
      [500, 'Internal server error'],
      [503, 'Service unavailable'],
    ])('should return correct message for status %d', (status, expectedMessage) => {
      expect(getDefaultMessage(status)).toBe(expectedMessage);
    });

    it('should return generic message for unknown status', () => {
      expect(getDefaultMessage(418)).toBe('An unexpected error occurred');
    });
  });
});
