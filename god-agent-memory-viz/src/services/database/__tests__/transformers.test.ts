/**
 * Integration tests for data transformers
 *
 * @module services/database/__tests__/transformers.test
 */

import { describe, it, expect } from 'vitest';
import type { GodAgentEvent, MemoryEntry } from '@/types/database';
import {
  eventToNode,
  eventsToNodes,
  createTemporalEdges,
  createSessionTemporalEdges,
  extractSessionNodes,
  extractAgentNodes,
  memoryEntryToNode,
  memoryEntriesToNodes,
  extractNamespaceNodes,
  createKeyReferenceEdges,
  createSimilarityEdges,
  transformToGraphData,
} from '../transformers';

// Test fixtures
const createMockEvent = (overrides: Partial<GodAgentEvent> = {}): GodAgentEvent => ({
  id: 1,
  eventType: 'task_start',
  timestamp: new Date('2024-01-01T10:00:00Z'),
  sessionId: 'session-1',
  agentId: 'agent-1',
  data: { description: 'Test event' },
  createdAt: new Date('2024-01-01T10:00:00Z'),
  ...overrides,
});

const createMockMemoryEntry = (overrides: Partial<MemoryEntry> = {}): MemoryEntry => ({
  id: 1,
  key: 'project/api/users',
  value: { data: 'test' },
  namespace: 'project',
  metadata: null,
  hasEmbedding: false,
  createdAt: new Date('2024-01-01T10:00:00Z'),
  updatedAt: new Date('2024-01-01T10:00:00Z'),
  accessedAt: new Date('2024-01-01T10:00:00Z'),
  accessCount: 5,
  ...overrides,
});

describe('Event Transformers', () => {
  describe('eventToNode', () => {
    it('transforms a single event to a graph node', () => {
      const event = createMockEvent();
      const node = eventToNode(event);

      expect(node.id).toBe('node_event_1');
      expect(node.type).toBe('trajectory');
      expect(node.label).toBe('Test event');
      expect(node.data.eventType).toBe('task_start');
      expect(node.data.sessionId).toBe('session-1');
      expect(node.data.agentId).toBe('agent-1');
    });

    it('maps different event types to correct node types', () => {
      const testCases: Array<{ eventType: GodAgentEvent['eventType']; expectedNodeType: string }> = [
        { eventType: 'task_start', expectedNodeType: 'trajectory' },
        { eventType: 'task_complete', expectedNodeType: 'trajectory' },
        { eventType: 'agent_spawn', expectedNodeType: 'episode' },
        { eventType: 'memory_store', expectedNodeType: 'checkpoint' },
        { eventType: 'trajectory_step', expectedNodeType: 'reasoning_step' },
        { eventType: 'pattern_match', expectedNodeType: 'pattern' },
        { eventType: 'learning_update', expectedNodeType: 'feedback' },
      ];

      for (const { eventType, expectedNodeType } of testCases) {
        const event = createMockEvent({ eventType });
        const node = eventToNode(event);
        expect(node.type).toBe(expectedNodeType);
      }
    });

    it('truncates long labels', () => {
      const event = createMockEvent({
        data: { description: 'A'.repeat(100) },
      });
      const node = eventToNode(event);

      expect(node.label.length).toBeLessThanOrEqual(50);
    });
  });

  describe('eventsToNodes', () => {
    it('transforms multiple events to nodes', () => {
      const events = [
        createMockEvent({ id: 1 }),
        createMockEvent({ id: 2 }),
        createMockEvent({ id: 3 }),
      ];

      const nodes = eventsToNodes(events);

      expect(nodes).toHaveLength(3);
      expect(nodes[0].id).toBe('node_event_1');
      expect(nodes[1].id).toBe('node_event_2');
      expect(nodes[2].id).toBe('node_event_3');
    });
  });

  describe('createTemporalEdges', () => {
    it('creates edges between sequential events', () => {
      const events = [
        createMockEvent({ id: 1, timestamp: new Date('2024-01-01T10:00:00Z') }),
        createMockEvent({ id: 2, timestamp: new Date('2024-01-01T10:01:00Z') }),
        createMockEvent({ id: 3, timestamp: new Date('2024-01-01T10:02:00Z') }),
      ];

      const edges = createTemporalEdges(events);

      expect(edges).toHaveLength(2);
      expect(edges[0].source).toBe('node_event_1');
      expect(edges[0].target).toBe('node_event_2');
      expect(edges[1].source).toBe('node_event_2');
      expect(edges[1].target).toBe('node_event_3');
    });

    it('returns empty array for single event', () => {
      const events = [createMockEvent()];
      const edges = createTemporalEdges(events);

      expect(edges).toHaveLength(0);
    });

    it('sorts events by timestamp before creating edges', () => {
      const events = [
        createMockEvent({ id: 3, timestamp: new Date('2024-01-01T10:02:00Z') }),
        createMockEvent({ id: 1, timestamp: new Date('2024-01-01T10:00:00Z') }),
        createMockEvent({ id: 2, timestamp: new Date('2024-01-01T10:01:00Z') }),
      ];

      const edges = createTemporalEdges(events);

      expect(edges[0].source).toBe('node_event_1');
      expect(edges[0].target).toBe('node_event_2');
    });
  });

  describe('createSessionTemporalEdges', () => {
    it('creates edges only within the same session', () => {
      const events = [
        createMockEvent({ id: 1, sessionId: 'session-1', timestamp: new Date('2024-01-01T10:00:00Z') }),
        createMockEvent({ id: 2, sessionId: 'session-1', timestamp: new Date('2024-01-01T10:01:00Z') }),
        createMockEvent({ id: 3, sessionId: 'session-2', timestamp: new Date('2024-01-01T10:00:30Z') }),
        createMockEvent({ id: 4, sessionId: 'session-2', timestamp: new Date('2024-01-01T10:01:30Z') }),
      ];

      const edges = createSessionTemporalEdges(events);

      expect(edges).toHaveLength(2);
      // Session 1 edge
      expect(edges.some((e) => e.source === 'node_event_1' && e.target === 'node_event_2')).toBe(true);
      // Session 2 edge
      expect(edges.some((e) => e.source === 'node_event_3' && e.target === 'node_event_4')).toBe(true);
    });
  });

  describe('extractSessionNodes', () => {
    it('extracts unique session nodes from events', () => {
      const events = [
        createMockEvent({ id: 1, sessionId: 'session-1' }),
        createMockEvent({ id: 2, sessionId: 'session-1' }),
        createMockEvent({ id: 3, sessionId: 'session-2' }),
      ];

      const sessionNodes = extractSessionNodes(events);

      expect(sessionNodes).toHaveLength(2);
      expect(sessionNodes.find((n) => n.data.sessionId === 'session-1')).toBeDefined();
      expect(sessionNodes.find((n) => n.data.sessionId === 'session-2')).toBeDefined();
    });

    it('counts events per session', () => {
      const events = [
        createMockEvent({ id: 1, sessionId: 'session-1' }),
        createMockEvent({ id: 2, sessionId: 'session-1' }),
        createMockEvent({ id: 3, sessionId: 'session-1' }),
        createMockEvent({ id: 4, sessionId: 'session-2' }),
      ];

      const sessionNodes = extractSessionNodes(events);
      const session1 = sessionNodes.find((n) => n.data.sessionId === 'session-1');
      const session2 = sessionNodes.find((n) => n.data.sessionId === 'session-2');

      expect(session1?.data.eventCount).toBe(3);
      expect(session2?.data.eventCount).toBe(1);
    });
  });

  describe('extractAgentNodes', () => {
    it('extracts unique agent nodes from events', () => {
      const events = [
        createMockEvent({ id: 1, agentId: 'agent-1' }),
        createMockEvent({ id: 2, agentId: 'agent-1' }),
        createMockEvent({ id: 3, agentId: 'agent-2' }),
      ];

      const agentNodes = extractAgentNodes(events);

      expect(agentNodes).toHaveLength(2);
      expect(agentNodes.find((n) => n.data.agentId === 'agent-1')).toBeDefined();
      expect(agentNodes.find((n) => n.data.agentId === 'agent-2')).toBeDefined();
    });
  });
});

describe('Memory Transformers', () => {
  describe('memoryEntryToNode', () => {
    it('transforms a memory entry to a graph node', () => {
      const entry = createMockMemoryEntry();
      const node = memoryEntryToNode(entry);

      expect(node.id).toBe('node_memory_1');
      expect(node.type).toBe('checkpoint');
      expect(node.label).toBe('users');
      expect(node.data.memoryKey).toBe('project/api/users');
      expect(node.data.namespace).toBe('project');
      expect(node.data.accessCount).toBe(5);
    });

    it('adjusts opacity based on access count', () => {
      const lowAccess = createMockMemoryEntry({ accessCount: 1 });
      const highAccess = createMockMemoryEntry({ accessCount: 20 });

      const lowNode = memoryEntryToNode(lowAccess);
      const highNode = memoryEntryToNode(highAccess);

      expect(highNode.style?.opacity).toBeGreaterThan(lowNode.style?.opacity ?? 0);
    });
  });

  describe('memoryEntriesToNodes', () => {
    it('transforms multiple entries to nodes', () => {
      const entries = [
        createMockMemoryEntry({ id: 1 }),
        createMockMemoryEntry({ id: 2 }),
      ];

      const nodes = memoryEntriesToNodes(entries);

      expect(nodes).toHaveLength(2);
    });
  });

  describe('extractNamespaceNodes', () => {
    it('extracts unique namespace nodes', () => {
      const entries = [
        createMockMemoryEntry({ id: 1, namespace: 'project' }),
        createMockMemoryEntry({ id: 2, namespace: 'project' }),
        createMockMemoryEntry({ id: 3, namespace: 'config' }),
      ];

      const namespaceNodes = extractNamespaceNodes(entries);

      expect(namespaceNodes).toHaveLength(2);
      expect(namespaceNodes.find((n) => n.data.namespace === 'project')).toBeDefined();
      expect(namespaceNodes.find((n) => n.data.namespace === 'config')).toBeDefined();
    });
  });

  describe('createKeyReferenceEdges', () => {
    it('creates edges when one entry references another by key', () => {
      const entries = [
        createMockMemoryEntry({ id: 1, key: 'project/api/users', value: { ref: 'project/api/auth' } }),
        createMockMemoryEntry({ id: 2, key: 'project/api/auth', value: { data: 'auth' } }),
      ];

      const edges = createKeyReferenceEdges(entries);

      expect(edges).toHaveLength(1);
      expect(edges[0].source).toBe('node_memory_1');
      expect(edges[0].target).toBe('node_memory_2');
    });
  });

  describe('createSimilarityEdges', () => {
    it('creates edges between entries with shared key prefixes', () => {
      const entries = [
        createMockMemoryEntry({ id: 1, key: 'project/api/users', namespace: 'project' }),
        createMockMemoryEntry({ id: 2, key: 'project/api/auth', namespace: 'project' }),
        createMockMemoryEntry({ id: 3, key: 'config/settings', namespace: 'config' }),
      ];

      const edges = createSimilarityEdges(entries, 2);

      // Only entries with 2+ shared prefix segments should have edges
      expect(edges.length).toBeGreaterThan(0);
      expect(edges.some((e) =>
        (e.source === 'node_memory_1' && e.target === 'node_memory_2') ||
        (e.source === 'node_memory_2' && e.target === 'node_memory_1')
      )).toBe(true);
    });
  });
});

describe('transformToGraphData', () => {
  it('transforms events and memory entries to complete graph data', () => {
    const events = [
      createMockEvent({ id: 1 }),
      createMockEvent({ id: 2 }),
    ];
    const memoryEntries = [
      createMockMemoryEntry({ id: 1 }),
    ];

    const graphData = transformToGraphData(events, memoryEntries);

    expect(graphData.nodes.length).toBeGreaterThan(0);
    expect(graphData.metadata?.nodeCount).toBe(graphData.nodes.length);
    expect(graphData.metadata?.edgeCount).toBe(graphData.edges.length);
    expect(graphData.metadata?.generatedAt).toBeInstanceOf(Date);
  });

  it('respects transform options', () => {
    const events = [
      createMockEvent({ id: 1 }),
      createMockEvent({ id: 2 }),
    ];
    const memoryEntries: MemoryEntry[] = [];

    const withTemporal = transformToGraphData(events, memoryEntries, {
      includeTemporalEdges: true,
    });

    const withoutTemporal = transformToGraphData(events, memoryEntries, {
      includeTemporalEdges: false,
    });

    expect(withTemporal.edges.length).toBeGreaterThan(withoutTemporal.edges.length);
  });
});
