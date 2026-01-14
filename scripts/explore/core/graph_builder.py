"""
Phase 11 Graph Builder - Construct knowledge graphs from artifacts

This module builds graph representations of:
- Knowledge Units (nodes)
- Reasoning Units (edges with typed relations)
- Document provenance (source nodes)
- Query provenance (query nodes)

Graph Types:
- KU Graph: KUs connected by reasoning relations
- Provenance Graph: KUs → Chunks → Documents
- Query Graph: Queries → KUs created from them
- Full Graph: Combined view with all node types

Performance: O(N + E) construction, O(1) node lookup
"""

from typing import Dict, List, Set, Optional, Tuple
from dataclasses import dataclass, field
from collections import defaultdict
import json

from .artifact_loader import ArtifactLoader, KnowledgeUnit, ReasoningUnit


@dataclass
class Node:
    """Graph node with type and attributes."""
    id: str
    type: str  # ku, reasoning, document, chunk, query
    label: str
    attributes: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.type,
            "label": self.label,
            "attributes": self.attributes
        }


@dataclass
class Edge:
    """Graph edge with typed relation."""
    source: str
    target: str
    relation: str  # conflict, support, elaboration, cites, created_from
    attributes: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "source": self.source,
            "target": self.target,
            "relation": self.relation,
            "attributes": self.attributes
        }


class KnowledgeGraph:
    """
    In-memory graph representation of knowledge artifacts.

    Node Types:
    - ku: Knowledge Unit
    - reasoning: Reasoning Unit (optional, can be represented as edges only)
    - document: PDF document
    - chunk: Text chunk from document
    - query: Research query

    Edge Types:
    - conflict: KU conflicts with KU (via RU)
    - support: KU supports KU (via RU)
    - elaboration: KU elaborates on KU (via RU)
    - cites: KU cites chunk
    - contains: Document contains chunk
    - created_from: KU created from query
    """

    def __init__(self):
        self.nodes: Dict[str, Node] = {}
        self.edges: List[Edge] = []

        # Adjacency lists for fast traversal
        self.outgoing: Dict[str, List[Edge]] = defaultdict(list)
        self.incoming: Dict[str, List[Edge]] = defaultdict(list)

    def add_node(self, node: Node):
        """Add a node to the graph."""
        self.nodes[node.id] = node

    def add_edge(self, edge: Edge):
        """Add an edge to the graph."""
        self.edges.append(edge)
        self.outgoing[edge.source].append(edge)
        self.incoming[edge.target].append(edge)

    def get_neighbors(self, node_id: str, direction: str = 'out') -> List[str]:
        """
        Get neighboring node IDs.

        Args:
            node_id: Node to get neighbors for
            direction: 'out' (outgoing), 'in' (incoming), or 'both'

        Returns:
            List of neighbor node IDs
        """
        neighbors = set()

        if direction in ['out', 'both']:
            neighbors.update(edge.target for edge in self.outgoing.get(node_id, []))

        if direction in ['in', 'both']:
            neighbors.update(edge.source for edge in self.incoming.get(node_id, []))

        return list(neighbors)

    def get_edges_for_node(self, node_id: str, direction: str = 'both') -> List[Edge]:
        """Get all edges connected to a node."""
        edges = []

        if direction in ['out', 'both']:
            edges.extend(self.outgoing.get(node_id, []))

        if direction in ['in', 'both']:
            edges.extend(self.incoming.get(node_id, []))

        return edges

    def filter_nodes(self, node_type: Optional[str] = None) -> List[Node]:
        """Filter nodes by type."""
        nodes = list(self.nodes.values())

        if node_type:
            nodes = [n for n in nodes if n.type == node_type]

        return nodes

    def filter_edges(self, relation: Optional[str] = None) -> List[Edge]:
        """Filter edges by relation type."""
        edges = self.edges

        if relation:
            edges = [e for e in edges if e.relation == relation]

        return edges

    def subgraph(self, node_ids: Set[str]) -> 'KnowledgeGraph':
        """Extract a subgraph containing only specified nodes."""
        subgraph = KnowledgeGraph()

        # Add nodes
        for node_id in node_ids:
            if node_id in self.nodes:
                subgraph.add_node(self.nodes[node_id])

        # Add edges between included nodes
        for edge in self.edges:
            if edge.source in node_ids and edge.target in node_ids:
                subgraph.add_edge(edge)

        return subgraph

    def get_connected_component(self, start_node_id: str, max_depth: Optional[int] = None) -> Set[str]:
        """
        Get all nodes in the connected component containing start_node_id.

        Args:
            start_node_id: Starting node
            max_depth: Maximum traversal depth (None = unlimited)

        Returns:
            Set of node IDs in the component
        """
        if start_node_id not in self.nodes:
            return set()

        visited = set()
        queue = [(start_node_id, 0)]

        while queue:
            node_id, depth = queue.pop(0)

            if node_id in visited:
                continue

            if max_depth is not None and depth > max_depth:
                continue

            visited.add(node_id)

            # Add neighbors
            neighbors = self.get_neighbors(node_id, direction='both')
            for neighbor_id in neighbors:
                if neighbor_id not in visited:
                    queue.append((neighbor_id, depth + 1))

        return visited

    def get_stats(self) -> dict:
        """Get graph statistics."""
        node_types = defaultdict(int)
        for node in self.nodes.values():
            node_types[node.type] += 1

        edge_types = defaultdict(int)
        for edge in self.edges:
            edge_types[edge.relation] += 1

        return {
            "nodes": {
                "total": len(self.nodes),
                "by_type": dict(node_types)
            },
            "edges": {
                "total": len(self.edges),
                "by_relation": dict(edge_types)
            }
        }

    def to_dict(self) -> dict:
        """Export graph to dictionary format."""
        return {
            "nodes": [node.to_dict() for node in self.nodes.values()],
            "edges": [edge.to_dict() for edge in self.edges]
        }


class GraphBuilder:
    """
    Build knowledge graphs from artifacts.

    Graph Construction Modes:
    - ku_graph: Only KUs and reasoning relations
    - provenance_graph: KUs → Chunks → Documents
    - query_graph: Queries → KUs
    - full_graph: All of the above
    """

    def __init__(self, loader: ArtifactLoader):
        self.loader = loader

    def build_ku_graph(
        self,
        ku_ids: Optional[List[str]] = None,
        include_reasoning_nodes: bool = False
    ) -> KnowledgeGraph:
        """
        Build graph of knowledge units connected by reasoning relations.

        Args:
            ku_ids: Specific KUs to include (None = all KUs)
            include_reasoning_nodes: If True, RUs are nodes; if False, RUs are just edge labels

        Returns:
            KnowledgeGraph with KUs as nodes, reasoning relations as edges
        """
        graph = KnowledgeGraph()

        # Get KUs to include
        if ku_ids is None:
            kus = self.loader.get_all_kus()
        else:
            kus = {ku_id: self.loader.get_ku(ku_id) for ku_id in ku_ids}
            kus = {k: v for k, v in kus.items() if v is not None}

        # Add KU nodes
        for ku_id, ku in kus.items():
            node = Node(
                id=ku_id,
                type='ku',
                label=ku.claim[:100] + '...' if len(ku.claim) > 100 else ku.claim,
                attributes={
                    'claim': ku.claim,
                    'confidence': ku.confidence,
                    'query': ku.created_from_query,
                    'source_count': len(ku.sources)
                }
            )
            graph.add_node(node)

        # Add reasoning relations
        rus = self.loader.get_all_rus()
        for ru_id, ru in rus.items():
            # Only include RUs that connect KUs in our graph
            ku_ids_in_graph = [kid for kid in ru.knowledge_ids if kid in graph.nodes]

            if len(ku_ids_in_graph) < 2:
                continue  # Need at least 2 KUs to form an edge

            # Add reasoning node (optional)
            if include_reasoning_nodes:
                ru_node = Node(
                    id=ru_id,
                    type='reasoning',
                    label=f"{ru.relation}: {ru.llm.get('rationale', '')[:50]}...",
                    attributes={
                        'relation': ru.relation,
                        'score': ru.score,
                        'rationale': ru.llm.get('rationale', ''),
                        'topic': ru.topic
                    }
                )
                graph.add_node(ru_node)

                # Connect KUs to reasoning node
                for ku_id in ku_ids_in_graph:
                    edge = Edge(
                        source=ku_id,
                        target=ru_id,
                        relation='participates_in',
                        attributes={'score': ru.score}
                    )
                    graph.add_edge(edge)
            else:
                # Direct edges between KUs (pairwise)
                for i, source_id in enumerate(ku_ids_in_graph):
                    for target_id in ku_ids_in_graph[i+1:]:
                        edge = Edge(
                            source=source_id,
                            target=target_id,
                            relation=ru.relation,
                            attributes={
                                'reasoning_id': ru_id,
                                'score': ru.score,
                                'rationale': ru.llm.get('rationale', '')
                            }
                        )
                        graph.add_edge(edge)

        return graph

    def build_provenance_graph(self, ku_ids: Optional[List[str]] = None) -> KnowledgeGraph:
        """
        Build provenance graph: KUs → Chunks → Documents.

        Args:
            ku_ids: Specific KUs to include (None = all KUs)

        Returns:
            KnowledgeGraph with provenance chains
        """
        graph = KnowledgeGraph()

        # Get KUs to include
        if ku_ids is None:
            kus = self.loader.get_all_kus()
        else:
            kus = {ku_id: self.loader.get_ku(ku_id) for ku_id in ku_ids}
            kus = {k: v for k, v in kus.items() if v is not None}

        # Track unique chunks and documents
        chunks_added = set()
        docs_added = set()

        for ku_id, ku in kus.items():
            # Add KU node
            ku_node = Node(
                id=ku_id,
                type='ku',
                label=ku.claim[:100] + '...' if len(ku.claim) > 100 else ku.claim,
                attributes={
                    'claim': ku.claim,
                    'confidence': ku.confidence,
                    'query': ku.created_from_query
                }
            )
            graph.add_node(ku_node)

            # Add sources (chunks and documents)
            for source in ku.sources:
                chunk_id = source.chunk_id
                doc_path = source.path_rel

                # Add chunk node (if not already added)
                if chunk_id not in chunks_added:
                    chunk_node = Node(
                        id=chunk_id,
                        type='chunk',
                        label=f"Chunk {chunk_id[:8]}... (pages {source.pages})",
                        attributes={
                            'pages': source.pages,
                            'document': doc_path
                        }
                    )
                    graph.add_node(chunk_node)
                    chunks_added.add(chunk_id)

                # Add document node (if not already added)
                if doc_path not in docs_added:
                    doc_node = Node(
                        id=doc_path,
                        type='document',
                        label=f"{source.author} - {source.title}",
                        attributes={
                            'author': source.author,
                            'title': source.title,
                            'path': doc_path
                        }
                    )
                    graph.add_node(doc_node)
                    docs_added.add(doc_path)

                # Add edges: KU → Chunk
                ku_chunk_edge = Edge(
                    source=ku_id,
                    target=chunk_id,
                    relation='cites',
                    attributes={'pages': source.pages}
                )
                graph.add_edge(ku_chunk_edge)

                # Add edge: Chunk → Document
                chunk_doc_edge = Edge(
                    source=chunk_id,
                    target=doc_path,
                    relation='contained_in',
                    attributes={}
                )
                graph.add_edge(chunk_doc_edge)

        return graph

    def build_query_graph(self, queries: Optional[List[str]] = None) -> KnowledgeGraph:
        """
        Build query graph: Queries → KUs created from them.

        Args:
            queries: Specific queries to include (None = all queries)

        Returns:
            KnowledgeGraph with query → KU edges
        """
        graph = KnowledgeGraph()

        # Get all KUs
        all_kus = self.loader.get_all_kus()

        # Group KUs by query
        kus_by_query = defaultdict(list)
        for ku in all_kus.values():
            kus_by_query[ku.created_from_query].append(ku)

        # Filter queries if specified
        if queries is not None:
            queries_lower = {q.lower() for q in queries}
            kus_by_query = {
                q: kus for q, kus in kus_by_query.items()
                if q.lower() in queries_lower
            }

        # Build graph
        for query, kus in kus_by_query.items():
            # Add query node
            query_id = f"query:{query}"
            query_node = Node(
                id=query_id,
                type='query',
                label=query,
                attributes={'ku_count': len(kus)}
            )
            graph.add_node(query_node)

            # Add KU nodes and edges
            for ku in kus:
                ku_node = Node(
                    id=ku.id,
                    type='ku',
                    label=ku.claim[:100] + '...' if len(ku.claim) > 100 else ku.claim,
                    attributes={
                        'claim': ku.claim,
                        'confidence': ku.confidence
                    }
                )
                graph.add_node(ku_node)

                # Query → KU edge
                edge = Edge(
                    source=query_id,
                    target=ku.id,
                    relation='created',
                    attributes={}
                )
                graph.add_edge(edge)

        return graph

    def build_full_graph(self, ku_ids: Optional[List[str]] = None) -> KnowledgeGraph:
        """
        Build comprehensive graph with all node types and relations.

        Args:
            ku_ids: Specific KUs to include (None = all KUs)

        Returns:
            KnowledgeGraph with KUs, reasoning, documents, chunks, and queries
        """
        # Build individual graphs
        ku_graph = self.build_ku_graph(ku_ids=ku_ids, include_reasoning_nodes=True)
        prov_graph = self.build_provenance_graph(ku_ids=ku_ids)
        query_graph = self.build_query_graph()

        # Merge into full graph
        full_graph = KnowledgeGraph()

        # Add all nodes
        for graph in [ku_graph, prov_graph, query_graph]:
            for node in graph.nodes.values():
                if node.id not in full_graph.nodes:
                    full_graph.add_node(node)

        # Add all edges
        for graph in [ku_graph, prov_graph, query_graph]:
            for edge in graph.edges:
                full_graph.add_edge(edge)

        return full_graph

    def build_ego_graph(
        self,
        center_node_id: str,
        radius: int = 1,
        include_reasoning: bool = True
    ) -> KnowledgeGraph:
        """
        Build ego graph centered on a specific node.

        Args:
            center_node_id: Center node (typically a KU ID)
            radius: How many hops to include (1 = immediate neighbors)
            include_reasoning: Include reasoning relations

        Returns:
            KnowledgeGraph containing ego network
        """
        # Build full graph
        full_graph = self.build_full_graph()

        # Get connected component with depth limit
        node_ids = full_graph.get_connected_component(center_node_id, max_depth=radius)

        # Extract subgraph
        return full_graph.subgraph(node_ids)
