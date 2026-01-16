/**
 * Event to Graph Node Transformer
 *
 * Transforms GodAgentEvent records into GraphNode structures for visualization.
 * Maps event types to constitution node types and applies consistent styling.
 *
 * @module services/database/transformers/eventTransformer
 */

import type { GodAgentEvent, EventType } from '@/types/database';
import type { GraphNode, GraphEdge, NodeType } from '@/types/graph';
import { createNodeId, createEdgeId } from '@/utils/ids';
import { EVENT_TYPE_COLORS, NODE_COLORS, EDGE_COLORS } from '@/constants/colors';
import { NODE_TYPE_SIZES } from '@/constants/nodeTypes';

/**
 * Maps event types to constitution node types for visualization
 */
const EVENT_TO_NODE_TYPE: Record<EventType, NodeType> = {
  task_start: 'trajectory',
  task_complete: 'trajectory',
  task_error: 'trajectory',
  agent_spawn: 'episode',
  agent_terminate: 'episode',
  memory_store: 'checkpoint',
  memory_retrieve: 'checkpoint',
  memory_delete: 'checkpoint',
  session_start: 'episode',
  session_end: 'episode',
  trajectory_start: 'trajectory',
  trajectory_step: 'reasoning_step',
  trajectory_end: 'trajectory',
  pattern_match: 'pattern',
  learning_update: 'feedback',
  custom: 'reasoning_step',
};

/**
 * Transforms a single GodAgentEvent into a GraphNode
 * @param event - The event to transform
 * @returns GraphNode representing the event
 */
export function eventToNode(event: GodAgentEvent): GraphNode {
  const nodeType = EVENT_TO_NODE_TYPE[event.eventType] ?? 'reasoning_step';
  const colors = NODE_COLORS[nodeType];
  const eventColor = EVENT_TYPE_COLORS[event.eventType];
  const size = NODE_TYPE_SIZES[nodeType];

  // Generate label from event data or type
  const label = event.data?.description
    ? String(event.data.description).slice(0, 50)
    : formatEventType(event.eventType);

  return {
    id: createNodeId('event', String(event.id)),
    type: nodeType,
    label,
    data: {
      timestamp: event.timestamp,
      eventType: event.eventType,
      eventId: event.id,
      sessionId: event.sessionId ?? undefined,
      agentId: event.agentId ?? undefined,
      raw: event.data,
    },
    style: {
      backgroundColor: eventColor,
      borderColor: colors.border,
      borderWidth: 2,
      width: size.width,
      height: size.height,
      opacity: 1,
    },
  };
}

/**
 * Transforms an array of GodAgentEvents into GraphNodes
 * @param events - Array of events to transform
 * @returns Array of GraphNodes
 */
export function eventsToNodes(events: GodAgentEvent[]): GraphNode[] {
  return events.map(eventToNode);
}

/**
 * Creates temporal edges between sequential events
 * @param events - Events sorted by timestamp
 * @returns Array of temporal edges
 */
export function createTemporalEdges(events: GodAgentEvent[]): GraphEdge[] {
  if (events.length < 2) return [];

  const edges: GraphEdge[] = [];
  const sortedEvents = [...events].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  for (let i = 0; i < sortedEvents.length - 1; i++) {
    const current = sortedEvents[i];
    const next = sortedEvents[i + 1];

    edges.push({
      id: createEdgeId(
        createNodeId('event', String(current.id)),
        createNodeId('event', String(next.id)),
        'linked_to'
      ),
      source: createNodeId('event', String(current.id)),
      target: createNodeId('event', String(next.id)),
      type: 'linked_to',
      label: 'follows',
      data: {
        weight: 1,
        timestamp: current.timestamp,
      },
      style: {
        lineColor: EDGE_COLORS.linked_to,
        lineStyle: 'solid',
        width: 1,
        opacity: 0.6,
        curveStyle: 'bezier',
        targetArrowShape: 'triangle',
      },
    });
  }

  return edges;
}

/**
 * Creates temporal edges within sessions
 * Groups events by session and creates edges within each group
 * @param events - All events
 * @returns Array of session-scoped temporal edges
 */
export function createSessionTemporalEdges(events: GodAgentEvent[]): GraphEdge[] {
  const sessionGroups = new Map<string, GodAgentEvent[]>();

  // Group events by session
  for (const event of events) {
    if (event.sessionId) {
      const existing = sessionGroups.get(event.sessionId) ?? [];
      existing.push(event);
      sessionGroups.set(event.sessionId, existing);
    }
  }

  // Create temporal edges within each session
  const edges: GraphEdge[] = [];
  for (const sessionEvents of sessionGroups.values()) {
    edges.push(...createTemporalEdges(sessionEvents));
  }

  return edges;
}

/**
 * Creates membership edges connecting events to their sessions
 * @param events - Events with sessionId
 * @param sessionNodes - Session node IDs
 * @returns Array of membership edges
 */
export function createMembershipEdges(
  events: GodAgentEvent[],
  sessionNodes: Map<string, string>
): GraphEdge[] {
  const edges: GraphEdge[] = [];

  for (const event of events) {
    if (event.sessionId && sessionNodes.has(event.sessionId)) {
      const sessionNodeId = sessionNodes.get(event.sessionId)!;
      const eventNodeId = createNodeId('event', String(event.id));

      edges.push({
        id: createEdgeId(sessionNodeId, eventNodeId, 'has_step'),
        source: sessionNodeId,
        target: eventNodeId,
        type: 'has_step',
        data: { weight: 0.5 },
        style: {
          lineColor: EDGE_COLORS.has_step,
          lineStyle: 'dashed',
          width: 1,
          opacity: 0.4,
          curveStyle: 'bezier',
          targetArrowShape: 'triangle',
        },
      });
    }
  }

  return edges;
}

/**
 * Extracts unique sessions from events and creates session nodes
 * @param events - Events to extract sessions from
 * @returns Array of session GraphNodes
 */
export function extractSessionNodes(events: GodAgentEvent[]): GraphNode[] {
  const sessions = new Map<string, { count: number; firstTimestamp: Date }>();

  for (const event of events) {
    if (event.sessionId) {
      const existing = sessions.get(event.sessionId);
      if (existing) {
        existing.count++;
        if (event.timestamp < existing.firstTimestamp) {
          existing.firstTimestamp = event.timestamp;
        }
      } else {
        sessions.set(event.sessionId, {
          count: 1,
          firstTimestamp: event.timestamp,
        });
      }
    }
  }

  const nodes: GraphNode[] = [];
  const colors = NODE_COLORS.episode;
  const size = NODE_TYPE_SIZES.session;

  for (const [sessionId, info] of sessions) {
    nodes.push({
      id: createNodeId('session', sessionId),
      type: 'episode',
      label: `Session ${sessionId.slice(0, 8)}`,
      data: {
        sessionId,
        eventCount: info.count,
        timestamp: info.firstTimestamp,
      },
      style: {
        backgroundColor: colors.primary,
        borderColor: colors.border,
        borderWidth: 2,
        width: size.width,
        height: size.height,
        opacity: 1,
      },
    });
  }

  return nodes;
}

/**
 * Extracts unique agents from events and creates agent nodes
 * @param events - Events to extract agents from
 * @returns Array of agent GraphNodes
 */
export function extractAgentNodes(events: GodAgentEvent[]): GraphNode[] {
  const agents = new Map<string, { count: number; firstTimestamp: Date; type?: string }>();

  for (const event of events) {
    if (event.agentId) {
      const existing = agents.get(event.agentId);
      const agentType = event.data?.agentType as string | undefined;

      if (existing) {
        existing.count++;
        if (event.timestamp < existing.firstTimestamp) {
          existing.firstTimestamp = event.timestamp;
        }
        if (agentType && !existing.type) {
          existing.type = agentType;
        }
      } else {
        agents.set(event.agentId, {
          count: 1,
          firstTimestamp: event.timestamp,
          type: agentType,
        });
      }
    }
  }

  const nodes: GraphNode[] = [];
  const colors = NODE_COLORS.pattern;
  const size = NODE_TYPE_SIZES.agent;

  for (const [agentId, info] of agents) {
    nodes.push({
      id: createNodeId('agent', agentId),
      type: 'pattern',
      label: info.type ?? `Agent ${agentId.slice(0, 8)}`,
      data: {
        agentId,
        agentType: info.type,
        eventCount: info.count,
        timestamp: info.firstTimestamp,
      },
      style: {
        backgroundColor: colors.primary,
        borderColor: colors.border,
        borderWidth: 2,
        width: size.width,
        height: size.height,
        opacity: 1,
      },
    });
  }

  return nodes;
}

/**
 * Formats event type string for display
 */
function formatEventType(eventType: EventType): string {
  return eventType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
