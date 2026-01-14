"""
Test suite for artifact_loader.py

Tests:
- Loading knowledge units from JSONL
- Loading reasoning units from JSONL
- Index building and lookups
- Filtering and querying
- Provenance tracing
- Error handling
"""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.artifact_loader import (
    ArtifactLoader,
    KnowledgeUnit,
    ReasoningUnit,
    Source
)


class TestArtifactLoader:
    """Test artifact loader functionality."""

    @pytest.fixture
    def loader(self):
        """Create artifact loader instance."""
        return ArtifactLoader()

    def test_load_knowledge_units(self, loader):
        """Test that knowledge units can be loaded."""
        kus = loader.get_all_kus()

        assert kus is not None
        assert isinstance(kus, dict)
        assert len(kus) > 0

        # Check first KU structure
        first_ku = next(iter(kus.values()))
        assert isinstance(first_ku, KnowledgeUnit)
        assert first_ku.id.startswith('ku_')
        assert len(first_ku.claim) > 0
        assert len(first_ku.sources) > 0
        assert first_ku.confidence in ['high', 'medium', 'low']

    def test_load_reasoning_units(self, loader):
        """Test that reasoning units can be loaded."""
        rus = loader.get_all_rus()

        assert rus is not None
        assert isinstance(rus, dict)

        if len(rus) > 0:
            # Check first RU structure
            first_ru = next(iter(rus.values()))
            assert isinstance(first_ru, ReasoningUnit)
            assert first_ru.reason_id.startswith('ru_')
            assert first_ru.relation in ['conflict', 'support', 'elaboration']
            assert len(first_ru.knowledge_ids) >= 2

    def test_get_ku_by_id(self, loader):
        """Test getting a specific KU by ID."""
        kus = loader.get_all_kus()
        first_id = next(iter(kus.keys()))

        ku = loader.get_ku(first_id)

        assert ku is not None
        assert ku.id == first_id

        # Test non-existent ID
        ku = loader.get_ku('ku_nonexistent')
        assert ku is None

    def test_get_kus_by_query(self, loader):
        """Test filtering KUs by query."""
        kus = loader.get_all_kus()
        first_ku = next(iter(kus.values()))
        query = first_ku.created_from_query

        results = loader.get_kus_by_query(query)

        assert len(results) > 0
        assert all(ku.created_from_query.lower() == query.lower() for ku in results)

    def test_filter_kus(self, loader):
        """Test filtering KUs with multiple criteria."""
        # Filter by confidence
        high_conf_kus = loader.filter_kus(confidence='high')
        assert all(ku.confidence == 'high' for ku in high_conf_kus)

        # Filter by minimum sources
        multi_source_kus = loader.filter_kus(min_sources=2)
        assert all(len(ku.sources) >= 2 for ku in multi_source_kus)

    def test_get_stats(self, loader):
        """Test statistics generation."""
        stats = loader.get_stats()

        assert 'knowledge_units' in stats
        assert 'reasoning_units' in stats

        ku_stats = stats['knowledge_units']
        assert ku_stats['total'] > 0
        assert ku_stats['total_sources'] > 0
        assert ku_stats['unique_queries'] > 0
        assert ku_stats['unique_documents'] > 0

    def test_trace_provenance(self, loader):
        """Test provenance tracing."""
        kus = loader.get_all_kus()
        first_id = next(iter(kus.keys()))

        provenance = loader.trace_provenance(first_id)

        assert 'ku' in provenance
        assert 'sources' in provenance
        assert 'reasoning_units' in provenance
        assert 'related_kus' in provenance
        assert 'documents' in provenance
        assert 'chunk_ids' in provenance

        # Verify provenance completeness
        ku = provenance['ku']
        assert len(provenance['sources']) == len(ku.sources)
        assert len(provenance['chunk_ids']) == len(ku.get_chunk_ids())

    def test_source_structure(self, loader):
        """Test that sources have complete information."""
        kus = loader.get_all_kus()
        first_ku = next(iter(kus.values()))

        for source in first_ku.sources:
            assert isinstance(source, Source)
            assert len(source.author) > 0
            assert len(source.title) > 0
            assert len(source.path_rel) > 0
            assert len(source.pages) > 0
            assert len(source.chunk_id) > 0

    def test_index_building(self, loader):
        """Test that indexes are built correctly."""
        # Force index building
        loader._build_indexes()

        assert loader._ku_by_query is not None
        assert loader._ku_by_document is not None
        assert loader._ku_by_chunk is not None

        # Verify indexes contain data
        assert len(loader._ku_by_query) > 0
        assert len(loader._ku_by_document) > 0
        assert len(loader._ku_by_chunk) > 0

    def test_get_rus_for_ku(self, loader):
        """Test getting reasoning units for a specific KU."""
        rus = loader.get_all_rus()

        if len(rus) > 0:
            # Get a KU that participates in reasoning
            first_ru = next(iter(rus.values()))
            ku_id = first_ru.knowledge_ids[0]

            related_rus = loader.get_rus_for_ku(ku_id)

            assert len(related_rus) > 0
            assert all(ku_id in ru.knowledge_ids for ru in related_rus)

    def test_filter_rus(self, loader):
        """Test filtering reasoning units."""
        rus = loader.get_all_rus()

        if len(rus) > 0:
            # Filter by relation
            conflict_rus = loader.filter_rus(relation='conflict')
            assert all(ru.relation == 'conflict' for ru in conflict_rus)

            # Filter by minimum score
            high_score_rus = loader.filter_rus(min_score=0.5)
            assert all(ru.score >= 0.5 for ru in high_score_rus)

    def test_immutability(self, loader):
        """Test that loader operations are read-only."""
        # Get initial state
        initial_kus = loader.get_all_kus()
        initial_count = len(initial_kus)

        # Perform various operations
        loader.get_ku(next(iter(initial_kus.keys())))
        loader.filter_kus(confidence='high')
        loader.get_stats()

        # Verify no mutations
        final_kus = loader.get_all_kus()
        assert len(final_kus) == initial_count


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
