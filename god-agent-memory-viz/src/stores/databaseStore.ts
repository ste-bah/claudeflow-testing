/**
 * Database Store
 *
 * Zustand store for managing database connection state,
 * loaded data, and database operations.
 *
 * @module stores/databaseStore
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { GodAgentEvent, MemoryEntry, Session } from '@/types/database';
import type { ConnectionState, ConnectionInfo, DatabaseStats } from '@/services/database/types';

/**
 * Database store state
 */
export interface DatabaseState {
  // Connection state
  connection: ConnectionInfo;

  // Loaded data
  events: GodAgentEvent[];
  memoryEntries: MemoryEntry[];
  sessions: Session[];

  // Statistics
  stats: DatabaseStats | null;

  // Loading states
  isLoading: boolean;
  isLoadingEvents: boolean;
  isLoadingMemory: boolean;

  // Error state
  error: string | null;
}

/**
 * Database store actions
 */
export interface DatabaseActions {
  // Connection actions
  setConnectionState: (state: ConnectionState) => void;
  setConnectionInfo: (info: Partial<ConnectionInfo>) => void;
  resetConnection: () => void;

  // Data actions
  setEvents: (events: GodAgentEvent[]) => void;
  appendEvents: (events: GodAgentEvent[]) => void;
  setMemoryEntries: (entries: MemoryEntry[]) => void;
  appendMemoryEntries: (entries: MemoryEntry[]) => void;
  setSessions: (sessions: Session[]) => void;
  clearData: () => void;

  // Stats actions
  setStats: (stats: DatabaseStats) => void;

  // Loading actions
  setLoading: (isLoading: boolean) => void;
  setLoadingEvents: (isLoading: boolean) => void;
  setLoadingMemory: (isLoading: boolean) => void;

  // Error actions
  setError: (error: string | null) => void;
  clearError: () => void;
}

/**
 * Initial connection info
 */
const initialConnection: ConnectionInfo = {
  state: 'uninitialized',
  fileName: null,
  fileSize: 0,
  loadedAt: null,
  error: null,
};

/**
 * Initial database state
 */
const initialState: DatabaseState = {
  connection: initialConnection,
  events: [],
  memoryEntries: [],
  sessions: [],
  stats: null,
  isLoading: false,
  isLoadingEvents: false,
  isLoadingMemory: false,
  error: null,
};

/**
 * Database store combining state and actions
 */
export const useDatabaseStore = create<DatabaseState & DatabaseActions>()(
  immer((set) => ({
    ...initialState,

    // Connection actions
    setConnectionState: (state) =>
      set((draft) => {
        draft.connection.state = state;
      }),

    setConnectionInfo: (info) =>
      set((draft) => {
        Object.assign(draft.connection, info);
      }),

    resetConnection: () =>
      set((draft) => {
        draft.connection = initialConnection;
        draft.events = [];
        draft.memoryEntries = [];
        draft.sessions = [];
        draft.stats = null;
        draft.error = null;
      }),

    // Data actions
    setEvents: (events) =>
      set((draft) => {
        draft.events = events;
      }),

    appendEvents: (events) =>
      set((draft) => {
        draft.events.push(...events);
      }),

    setMemoryEntries: (entries) =>
      set((draft) => {
        draft.memoryEntries = entries;
      }),

    appendMemoryEntries: (entries) =>
      set((draft) => {
        draft.memoryEntries.push(...entries);
      }),

    setSessions: (sessions) =>
      set((draft) => {
        draft.sessions = sessions;
      }),

    clearData: () =>
      set((draft) => {
        draft.events = [];
        draft.memoryEntries = [];
        draft.sessions = [];
        draft.stats = null;
      }),

    // Stats actions
    setStats: (stats) =>
      set((draft) => {
        draft.stats = stats;
      }),

    // Loading actions
    setLoading: (isLoading) =>
      set((draft) => {
        draft.isLoading = isLoading;
      }),

    setLoadingEvents: (isLoading) =>
      set((draft) => {
        draft.isLoadingEvents = isLoading;
      }),

    setLoadingMemory: (isLoading) =>
      set((draft) => {
        draft.isLoadingMemory = isLoading;
      }),

    // Error actions
    setError: (error) =>
      set((draft) => {
        draft.error = error;
        if (error) {
          draft.connection.error = error;
        }
      }),

    clearError: () =>
      set((draft) => {
        draft.error = null;
        draft.connection.error = null;
      }),
  }))
);

// Selectors
export const selectIsConnected = (state: DatabaseState) =>
  state.connection.state === 'connected' || state.connection.state === 'ready';

export const selectHasData = (state: DatabaseState) =>
  state.events.length > 0 || state.memoryEntries.length > 0;

export const selectEventCount = (state: DatabaseState) => state.events.length;

export const selectMemoryEntryCount = (state: DatabaseState) => state.memoryEntries.length;

export const selectSessionCount = (state: DatabaseState) => state.sessions.length;

export const selectUniqueAgents = (state: DatabaseState) => {
  const agentIds = new Set<string>();
  for (const event of state.events) {
    if (event.agentId) {
      agentIds.add(event.agentId);
    }
  }
  return agentIds.size;
};

export const selectUniqueNamespaces = (state: DatabaseState) => {
  const namespaces = new Set<string>();
  for (const entry of state.memoryEntries) {
    namespaces.add(entry.namespace);
  }
  return namespaces.size;
};

export const selectDateRange = (state: DatabaseState) => {
  if (state.events.length === 0) {
    return { earliest: null, latest: null };
  }

  let earliest = state.events[0].timestamp;
  let latest = state.events[0].timestamp;

  for (const event of state.events) {
    if (event.timestamp < earliest) {
      earliest = event.timestamp;
    }
    if (event.timestamp > latest) {
      latest = event.timestamp;
    }
  }

  return { earliest, latest };
};
