/**
 * useDatabase - React hook for database operations
 *
 * Provides a reactive interface to the DatabaseService with
 * automatic state management and cleanup.
 *
 * @module hooks/useDatabase
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DatabaseService,
  getDatabaseService,
  type ConnectionInfo,
  type SchemaValidation,
  type DatabaseStats,
} from '../services/database';

/**
 * Return type for the useDatabase hook
 */
export interface UseDatabaseReturn {
  /** Current connection information */
  connectionInfo: ConnectionInfo;
  /** Whether a database is connected */
  isConnected: boolean;
  /** Whether the database is currently connecting/loading */
  isConnecting: boolean;
  /** Whether sql.js is initializing */
  isInitializing: boolean;
  /** Database statistics (null if not connected) */
  stats: DatabaseStats | null;
  /** Load database from a File object */
  loadFromFile: (file: File) => Promise<SchemaValidation>;
  /** Load database from a URL */
  loadFromURL: (url: string) => Promise<SchemaValidation>;
  /** Disconnect from the current database */
  disconnect: () => void;
  /** Re-fetch database statistics */
  refreshStats: () => void;
  /** Last error message */
  error: string | null;
}

/**
 * React hook for database operations
 *
 * @example
 * ```tsx
 * function DatabaseLoader() {
 *   const { isConnected, isConnecting, loadFromFile, error } = useDatabase();
 *
 *   const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
 *     const file = e.target.files?.[0];
 *     if (file) {
 *       const result = await loadFromFile(file);
 *       if (!result.isValid) {
 *         console.error('Invalid schema:', result.error);
 *       }
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <input type="file" onChange={handleFileChange} disabled={isConnecting} />
 *       {error && <p className="error">{error}</p>}
 *       {isConnected && <p>Database connected!</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useDatabase(): UseDatabaseReturn {
  const serviceRef = useRef<DatabaseService | null>(null);

  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>({
    state: 'uninitialized',
    fileName: null,
    fileSize: 0,
    loadedAt: null,
    error: null,
  });

  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize service and subscribe to state changes
  useEffect(() => {
    const service = getDatabaseService();
    serviceRef.current = service;

    // Subscribe to connection state changes
    const unsubscribe = service.subscribe((info) => {
      setConnectionInfo(info);

      // Update stats when connected
      if (info.state === 'connected') {
        try {
          const newStats = service.getStats();
          setStats(newStats);
        } catch {
          setStats(null);
        }
      } else {
        // Clear stats when not connected
        setStats(null);
      }

      // Update error state
      setError(info.error);
    });

    // Initialize sql.js if not already done
    if (!service.isInitialized()) {
      service.initialize().catch((err) => {
        const message = err instanceof Error ? err.message : 'Initialization failed';
        setError(message);
      });
    }

    return () => {
      unsubscribe();
    };
  }, []);

  // Load from file
  const loadFromFile = useCallback(async (file: File): Promise<SchemaValidation> => {
    const service = serviceRef.current;
    if (!service) {
      return {
        isValid: false,
        missingTables: [],
        foundTables: [],
        error: 'Database service not available',
      };
    }

    setIsConnecting(true);
    setError(null);

    try {
      const result = await service.loadFromFile(file);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load file';
      setError(message);
      return {
        isValid: false,
        missingTables: [],
        foundTables: [],
        error: message,
      };
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Load from URL
  const loadFromURL = useCallback(async (url: string): Promise<SchemaValidation> => {
    const service = serviceRef.current;
    if (!service) {
      return {
        isValid: false,
        missingTables: [],
        foundTables: [],
        error: 'Database service not available',
      };
    }

    setIsConnecting(true);
    setError(null);

    try {
      const result = await service.loadFromURL(url);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load from URL';
      setError(message);
      return {
        isValid: false,
        missingTables: [],
        foundTables: [],
        error: message,
      };
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    const service = serviceRef.current;
    if (service) {
      service.close();
    }
    setStats(null);
    setError(null);
  }, []);

  // Refresh stats
  const refreshStats = useCallback(() => {
    const service = serviceRef.current;
    if (service && service.isConnected()) {
      try {
        const newStats = service.getStats();
        setStats(newStats);
      } catch {
        setStats(null);
      }
    }
  }, []);

  // Computed states
  const isConnected = connectionInfo.state === 'connected';
  const isInitializing = connectionInfo.state === 'initializing';

  return {
    connectionInfo,
    isConnected,
    isConnecting,
    isInitializing,
    stats,
    loadFromFile,
    loadFromURL,
    disconnect,
    refreshStats,
    error,
  };
}

export default useDatabase;
