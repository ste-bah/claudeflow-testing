"""
Test suite for graph_builder.py

Tests:
- KU graph construction
- Provenance graph construction
- Query graph construction
- Full graph construction
- Graph traversal operations
- Subgraph extraction
"""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.artifact_loader import ArtifactLoader
from core.graph_builder import GraphBuilder, KnowledgeGraph


class TestGraphBuilder:
    """Test graph builder functionality."""

    @pytest.fixture
    def loader(self):
        """Create artifact loader instance."""
        return ArtifactLoader()

    @pytest.fixture
    def builder(self, loader):
        """Create graph builder instance."""
        return GraphBuilder(loader)

    def test_build_ku_graph(self, builder):
        """Test KU graph construction."""
        graph = builder.build_ku_graph()

        assert isinstance(graph, KnowledgeGraph)
        assert len(graph.nodes) > 0

        # All nodes should be KUs
        ku_nodes = graph.filter_nodes(node_type='ku')
        assert len(ku_nodes) > 0

    def test_build_ku_graph_with_reasoning_nodes(self, builder):
        """Test KU graph with reasoning unit nodes."""
        graph = builder.build_ku_graph(include_reasoning_nodes=True)

        # Should have both KU and reasoning nodes
        ku_nodes = graph.filter_nodes(node_type='ku')
        reasoning_nodes = graph.filter_nodes(node_type='reasoning')

        assert len(ku_nodes) > 0

        # May or may not have reasoning nodes (depends on Phase 7)
        if len(reasoning_nodes) > 0:
            # Verify reasoning nodes connect to KUs
            for ru_node in reasoning_nodes:
                edges = graph.get_edges_for_node(ru_node.id)
                assert len(edges) > 0

    def test_build_provenance_graph(self, builder):
        """Test provenance graph construction."""
        graph = builder.build_provenance_graph()

        assert isinstance(graph, KnowledgeGraph)

        # Should have KUs, chunks, and documents
        ku_nodes = graph.filter_nodes(node_type='ku')
        chunk_nodes = graph.filter_nodes(node_type='chunk')
        doc_nodes = graph.filter_nodes(node_type='document')

        assert len(ku_nodes) > 0
        assert len(chunk_nodes) > 0
        assert len(doc_nodes) > 0

        # Verify edges exist
        cites_edges = graph.filter_edges(relation='cites')
        contained_edges = graph.filter_edges(relation='contained_in')

        assert len(cites_edges) > 0
        assert len(contained_edges) > 0

    def test_build_query_graph(self, builder):
        """Test query graph construction."""
        graph = builder.build_query_graph()

        assert isinstance(graph, KnowledgeGraph)

        # Should have query and KU nodes
        query_nodes = graph.filter_nodes(node_type='query')
        ku_nodes = graph.filter_nodes(node_type='ku')

        assert len(query_nodes) > 0
        assert len(ku_nodes) > 0

        # Verify query → KU edges
        created_edges = graph.filter_edges(relation='created')
        assert len(created_edges) > 0

    def test_build_full_graph(self, builder):
        """Test full graph construction."""
        graph = builder.build_full_graph()

        assert isinstance(graph, KnowledgeGraph)

        # Should have all node types
        node_types = {node.type for node in graph.nodes.values()}
        assert 'ku' in node_types
        assert 'document' in node_types
        assert 'chunk' in node_types
        assert 'query' in node_types

        # Should have various edge types
        relation_types = {edge.relation for edge in graph.edges}
        assert 'cites' in relation_types
        assert 'contained_in' in relation_types
        assert 'created' in relation_types

    def test_graph_stats(self, builder):
        """Test graph statistics."""
        graph = builder.build_full_graph()
        stats = graph.get_stats()

        assert 'nodes' in stats
        assert 'edges' in stats

        assert stats['nodes']['total'] > 0
        assert stats['edges']['total'] > 0

        assert 'by_type' in stats['nodes']
        assert 'by_relation' in stats['edges']

    def test_get_neighbors(self, builder):
        """Test neighbor retrieval."""
        graph = builder.build_full_graph()

        # Get a KU node
        ku_nodes = graph.filter_nodes(node_type='ku')
        if len(ku_nodes) > 0:
            ku_id = ku_nodes[0].id

            # Get outgoing neighbors
            out_neighbors = graph.get_neighbors(ku_id, direction='out')
            assert isinstance(out_neighbors, list)

            # Get incoming neighbors
            in_neighbors = graph.get_neighbors(ku_id, direction='in')
            assert isinstance(in_neighbors, list)

            # Get all neighbors
            all_neighbors = graph.get_neighbors(ku_id, direction='both')
            assert isinstance(all_neighbors, list)
            assert len(all_neighbors) >= len(out_neighbors)
            assert len(all_neighbors) >= len(in_neighbors)

    def test_subgraph_extraction(self, builder):
        """Test subgraph extraction."""
        graph = builder.build_full_graph()

        # Get a subset of nodes
        all_ku_nodes = graph.filter_nodes(node_type='ku')
        subset_ids = {node.id for node in all_ku_nodes[:5]} if len(all_ku_nodes) >= 5 else {node.id for node in all_ku_nodes}

        # Extract subgraph
        subgraph = graph.subgraph(subset_ids)

        assert isinstance(subgraph, KnowledgeGraph)
        assert len(subgraph.nodes) <= len(subset_ids)

        # All nodes in subgraph should be from original subset
        for node_id in subgraph.nodes.keys():
            assert node_id in subset_ids

    def test_connected_component(self, builder):
        """Test connected component extraction."""
        graph = builder.build_full_graph()

        # Get a KU node
        ku_nodes = graph.filter_nodes(node_type='ku')
        if len(ku_nodes) > 0:
            start_id = ku_nodes[0].id

            # Get component
            component = graph.get_connected_component(start_id, max_depth=2)

            assert isinstance(component, set)
            assert start_id in component
            assert len(component) >= 1

    def test_build_ego_graph(self, builder):
        """Test ego graph construction."""
        # Get a KU ID
        loader = builder.loader
        kus = loader.get_all_kus()
        ku_id = next(iter(kus.keys()))

        # Build ego graph
        ego_graph = builder.build_ego_graph(ku_id, radius=1)

        assert isinstance(ego_graph, KnowledgeGraph)
        assert ku_id in ego_graph.nodes
        assert len(ego_graph.nodes) >= 1

    def test_graph_to_dict(self, builder):
        """Test graph export to dictionary."""
        graph = builder.build_ku_graph()
        graph_dict = graph.to_dict()

        assert 'nodes' in graph_dict
        assert 'edges' in graph_dict

        assert isinstance(graph_dict['nodes'], list)
        assert isinstance(graph_dict['edges'], list)

        # Verify node structure
        if len(graph_dict['nodes']) > 0:
            node = graph_dict['nodes'][0]
            assert 'id' in node
            assert 'type' in node
            assert 'label' in node
            assert 'attributes' in node

        # Verify edge structure
        if len(graph_dict['edges']) > 0:
            edge = graph_dict['edges'][0]
            assert 'source' in edge
            assert 'target' in edge
            assert 'relation' in edge

    def test_filter_edges(self, builder):
        """Test edge filtering."""
        graph = builder.build_full_graph()

        # Filter by relation
        cites_edges = graph.filter_edges(relation='cites')
        assert all(edge.relation == 'cites' for edge in cites_edges)

        # Get all edges
        all_edges = graph.filter_edges()
        assert len(all_edges) == len(graph.edges)

    def test_graph_immutability(self, builder):
        """Test that graph operations don't mutate original artifacts."""
        loader = builder.loader

        # Get initial state
        initial_kus = loader.get_all_kus()
        initial_count = len(initial_kus)

        # Build various graphs
        builder.build_ku_graph()
        builder.build_provenance_graph()
        builder.build_query_graph()
        builder.build_full_graph()

        # Verify no mutations
        final_kus = loader.get_all_kus()
        assert len(final_kus) == initial_count


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
