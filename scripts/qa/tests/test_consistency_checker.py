#!/usr/bin/env python3
"""
Unit tests for ConsistencyChecker

Tests:
- Page range parsing (various formats)
- Chunk existence validation
- Page boundary verification
- Duplicate detection
- Confidence level checks
"""

import sys
from pathlib import Path
from unittest.mock import Mock, MagicMock, patch
from typing import Dict, List

import pytest

# Add scripts to path
scripts_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(scripts_dir))

from qa.core.consistency_checker import (
    ConsistencyChecker,
    ConsistencyIssue
)
from explore.core.artifact_loader import KnowledgeUnit, Source


# ========================
# Fixtures
# ========================

@pytest.fixture
def mock_ku():
    """Create a mock KnowledgeUnit for testing."""
    source = Source(
        chunk_id="test_chunk_001",
        path_rel="corpus/test.pdf",
        title="Test Document",
        author="Test Author",
        pages="42-44"
    )

    return KnowledgeUnit(
        id="ku_test001",
        claim="Test claim about phantasia",
        confidence="high",
        sources=[source],
        tags=[],
        created_from_query="test query"
    )


@pytest.fixture
def mock_kus_dict(mock_ku):
    """Create a dictionary of mock KUs."""
    # Create 3 KUs with different properties
    ku1 = mock_ku

    ku2 = KnowledgeUnit(
        id="ku_test002",
        claim="Another test claim about action",
        confidence="medium",
        sources=[Source(
            chunk_id="test_chunk_002",
            path_rel="corpus/test2.pdf",
            title="Test Document 2",
            author="Test Author 2",
            pages="10"
        ), Source(
            chunk_id="test_chunk_003",
            path_rel="corpus/test3.pdf",
            title="Test Document 3",
            author="Test Author 3",
            pages="20-22"
        )],
        tags=[],
        created_from_query="test query"
    )

    ku3 = KnowledgeUnit(
        id="ku_test003",
        claim="Third test claim very similar to first",  # Similar to ku1 for duplicate test
        confidence="low",
        sources=[Source(
            chunk_id="test_chunk_004",
            path_rel="corpus/test4.pdf",
            title="Test Document 4",
            author="Test Author 4",
            pages="100"
        )],
        tags=[],
        created_from_query="test query"
    )

    return {
        "ku_test001": ku1,
        "ku_test002": ku2,
        "ku_test003": ku3
    }


@pytest.fixture
def checker():
    """Create a ConsistencyChecker instance with mocked dependencies."""
    with patch('qa.core.consistency_checker.ArtifactLoader'):
        checker = ConsistencyChecker()
        return checker


# ========================
# Page Range Parsing Tests
# ========================

class TestPageRangeParsing:
    """Test the _parse_page_range method."""

    def test_single_page(self, checker):
        """Test parsing single page number."""
        start, end = checker._parse_page_range("42")
        assert start == 42
        assert end == 42

    def test_hyphen_range(self, checker):
        """Test parsing hyphen-separated range."""
        start, end = checker._parse_page_range("42-44")
        assert start == 42
        assert end == 44

    def test_en_dash_range(self, checker):
        """Test parsing en-dash-separated range."""
        start, end = checker._parse_page_range("42–44")
        assert start == 42
        assert end == 44

    def test_comma_range(self, checker):
        """Test parsing comma-separated range."""
        start, end = checker._parse_page_range("42, 44")
        assert start == 42
        assert end == 44

    def test_range_with_spaces(self, checker):
        """Test parsing range with various whitespace."""
        start, end = checker._parse_page_range("  42  -  44  ")
        assert start == 42
        assert end == 44

    def test_invalid_format(self, checker):
        """Test that invalid formats raise ValueError."""
        with pytest.raises(ValueError, match="Invalid page range format"):
            checker._parse_page_range("abc")

        with pytest.raises(ValueError, match="Invalid page range format"):
            checker._parse_page_range("42-44-46")

        with pytest.raises(ValueError, match="Invalid page range format"):
            checker._parse_page_range("42, 44, 46")


# ========================
# Chunk Existence Tests
# ========================

class TestChunkExistence:
    """Test chunk existence validation."""

    def test_all_chunks_exist(self, checker, mock_kus_dict):
        """Test when all chunks exist in ChromaDB."""
        # Mock ChromaDB collection
        mock_collection = Mock()
        mock_collection.get.return_value = {
            'ids': ['test_chunk_001']  # Chunk exists
        }

        checker.chroma_client = Mock()
        checker.collection = mock_collection

        issues = checker.check_chunk_existence(mock_kus_dict)

        assert len(issues) == 0

    def test_missing_chunk(self, checker, mock_kus_dict):
        """Test when a chunk is missing from ChromaDB."""
        # Mock ChromaDB collection - return empty for missing chunk
        mock_collection = Mock()
        mock_collection.get.side_effect = [
            {'ids': []},  # First chunk missing
            {'ids': ['test_chunk_002']},  # Second exists
            {'ids': ['test_chunk_003']},  # Third exists
            {'ids': ['test_chunk_004']}   # Fourth exists
        ]

        checker.chroma_client = Mock()
        checker.collection = mock_collection

        issues = checker.check_chunk_existence(mock_kus_dict)

        assert len(issues) == 1
        assert issues[0].issue_type == "missing_chunk"
        assert issues[0].severity == "critical"
        assert issues[0].ku_id == "ku_test001"
        assert issues[0].details['chunk_id'] == "test_chunk_001"

    def test_chromadb_error(self, checker, mock_kus_dict):
        """Test handling of ChromaDB errors."""
        # Mock ChromaDB collection to raise exception
        mock_collection = Mock()
        mock_collection.get.side_effect = Exception("Connection error")

        checker.chroma_client = Mock()
        checker.collection = mock_collection

        issues = checker.check_chunk_existence(mock_kus_dict)

        # Should have 4 issues (one per source across all KUs)
        assert len(issues) == 4
        assert all(i.issue_type == "missing_chunk" for i in issues)
        assert all(i.severity == "critical" for i in issues)
        assert "Connection error" in issues[0].details['error']


# ========================
# Page Boundary Tests
# ========================

class TestPageBoundaries:
    """Test page boundary validation."""

    def test_pages_within_chunk_boundaries(self, checker, mock_kus_dict):
        """Test when cited pages are within chunk boundaries."""
        # Mock ChromaDB collection with valid metadata
        def mock_get(ids, include=None):
            chunk_id = ids[0]

            metadata_map = {
                'test_chunk_001': {'page_start': 40, 'page_end': 50},
                'test_chunk_002': {'page_start': 10, 'page_end': 10},
                'test_chunk_003': {'page_start': 20, 'page_end': 25},
                'test_chunk_004': {'page_start': 100, 'page_end': 100}
            }

            return {
                'ids': [chunk_id],
                'metadatas': [metadata_map.get(chunk_id, {})]
            }

        mock_collection = Mock()
        mock_collection.get.side_effect = mock_get

        checker.chroma_client = Mock()
        checker.collection = mock_collection

        issues = checker.check_page_boundaries(mock_kus_dict)

        assert len(issues) == 0

    def test_pages_outside_chunk_boundaries(self, checker, mock_kus_dict):
        """Test when cited pages exceed chunk boundaries."""
        # Mock ChromaDB collection with metadata where pages are out of range
        def mock_get(ids, include=None):
            chunk_id = ids[0]

            # Set boundaries that don't contain the cited pages
            metadata_map = {
                'test_chunk_001': {'page_start': 50, 'page_end': 60},  # Cited: 42-44 (OUT OF RANGE)
                'test_chunk_002': {'page_start': 10, 'page_end': 10},  # Cited: 10 (OK)
                'test_chunk_003': {'page_start': 20, 'page_end': 25},  # Cited: 20-22 (OK)
                'test_chunk_004': {'page_start': 100, 'page_end': 100}  # Cited: 100 (OK)
            }

            return {
                'ids': [chunk_id],
                'metadatas': [metadata_map.get(chunk_id, {})]
            }

        mock_collection = Mock()
        mock_collection.get.side_effect = mock_get

        checker.chroma_client = Mock()
        checker.collection = mock_collection

        issues = checker.check_page_boundaries(mock_kus_dict)

        assert len(issues) == 1
        assert issues[0].issue_type == "page_mismatch"
        assert issues[0].severity == "high"
        assert issues[0].ku_id == "ku_test001"
        assert "42–44" in issues[0].details['cited_pages']
        assert "50–60" in issues[0].details['chunk_pages']

    def test_missing_page_metadata(self, checker, mock_kus_dict):
        """Test when chunk metadata is missing page info."""
        # Mock ChromaDB collection with incomplete metadata
        def mock_get(ids, include=None):
            return {
                'ids': [ids[0]],
                'metadatas': [{}]  # Missing page_start and page_end
            }

        mock_collection = Mock()
        mock_collection.get.side_effect = mock_get

        checker.chroma_client = Mock()
        checker.collection = mock_collection

        issues = checker.check_page_boundaries(mock_kus_dict)

        # Should have 4 issues (one per source)
        assert len(issues) == 4
        assert all(i.issue_type == "missing_page_metadata" for i in issues)
        assert all(i.severity == "high" for i in issues)

    def test_invalid_page_format(self, checker, mock_kus_dict):
        """Test handling of invalid page format in KU."""
        # Create KU with invalid page format
        bad_ku = KnowledgeUnit(
            id="ku_bad",
            claim="Bad page format",
            confidence="high",
            sources=[Source(
                chunk_id="test_chunk_bad",
                path_rel="corpus/bad.pdf",
                title="Bad Doc",
                author="Bad Author",
                pages="invalid-format-42a"
            )],
            tags=[],
            created_from_query="test"
        )

        kus = {"ku_bad": bad_ku}

        # Mock ChromaDB
        mock_collection = Mock()
        mock_collection.get.return_value = {
            'ids': ['test_chunk_bad'],
            'metadatas': [{'page_start': 40, 'page_end': 50}]
        }

        checker.chroma_client = Mock()
        checker.collection = mock_collection

        issues = checker.check_page_boundaries(kus)

        assert len(issues) == 1
        assert issues[0].issue_type == "page_parse_error"
        assert issues[0].severity == "high"


# ========================
# Duplicate Detection Tests
# ========================

class TestDuplicateDetection:
    """Test duplicate claim detection."""

    @patch('qa.core.consistency_checker.SentenceTransformer')
    @patch('qa.core.consistency_checker.cosine_similarity')
    def test_no_duplicates(self, mock_cosine, mock_transformer, checker, mock_kus_dict):
        """Test when no duplicates are found."""
        # Mock embedding model
        mock_model = Mock()
        mock_model.encode.return_value = [[0.1, 0.2], [0.5, 0.6], [0.9, 0.1]]
        mock_transformer.return_value = mock_model

        # Mock similarity matrix (all below threshold)
        mock_cosine.return_value = [
            [1.0, 0.3, 0.2],
            [0.3, 1.0, 0.4],
            [0.2, 0.4, 1.0]
        ]

        issues = checker.check_duplicates(mock_kus_dict, similarity_threshold=0.95)

        assert len(issues) == 0

    @patch('qa.core.consistency_checker.SentenceTransformer')
    @patch('qa.core.consistency_checker.cosine_similarity')
    def test_high_similarity_duplicate(self, mock_cosine, mock_transformer, checker, mock_kus_dict):
        """Test when duplicates are detected."""
        # Mock embedding model
        mock_model = Mock()
        mock_model.encode.return_value = [[0.1, 0.2], [0.5, 0.6], [0.1, 0.21]]
        mock_transformer.return_value = mock_model

        # Mock similarity matrix (KU 0 and 2 are similar)
        mock_cosine.return_value = [
            [1.0, 0.3, 0.97],
            [0.3, 1.0, 0.4],
            [0.97, 0.4, 1.0]
        ]

        issues = checker.check_duplicates(mock_kus_dict, similarity_threshold=0.95)

        assert len(issues) == 1
        assert issues[0].issue_type == "duplicate_claim"
        assert issues[0].severity == "medium"
        assert issues[0].details['similarity'] == "0.970"

    def test_single_ku_no_duplicates(self, checker):
        """Test that single KU returns no duplicates."""
        single_ku = {
            "ku_001": KnowledgeUnit(
                id="ku_001",
                claim="Single claim",
                confidence="high",
                sources=[],
                tags=[],
                created_from_query="test"
            )
        }

        issues = checker.check_duplicates(single_ku)

        assert len(issues) == 0


# ========================
# Confidence Level Tests
# ========================

class TestConfidenceLevels:
    """Test confidence level heuristic validation."""

    def test_correct_confidence_levels(self, checker):
        """Test when confidence levels match heuristics."""
        kus = {
            "ku_high": KnowledgeUnit(
                id="ku_high",
                claim="High confidence claim",
                confidence="high",
                sources=[Mock(), Mock(), Mock()],  # 3 sources = high
                tags=[],
                created_from_query="test"
            ),
            "ku_medium": KnowledgeUnit(
                id="ku_medium",
                claim="Medium confidence claim",
                confidence="medium",
                sources=[Mock(), Mock()],  # 2 sources = medium
                tags=[],
                created_from_query="test"
            ),
            "ku_low": KnowledgeUnit(
                id="ku_low",
                claim="Low confidence claim",
                confidence="low",
                sources=[Mock()],  # 1 source = low
                tags=[],
                created_from_query="test"
            )
        }

        issues = checker.check_confidence_levels(kus)

        assert len(issues) == 0

    def test_incorrect_confidence_levels(self, checker):
        """Test when confidence levels don't match heuristics."""
        kus = {
            "ku_wrong1": KnowledgeUnit(
                id="ku_wrong1",
                claim="Wrong confidence",
                confidence="high",
                sources=[Mock()],  # 1 source should be low, not high
                tags=[],
                created_from_query="test"
            ),
            "ku_wrong2": KnowledgeUnit(
                id="ku_wrong2",
                claim="Wrong confidence 2",
                confidence="low",
                sources=[Mock(), Mock(), Mock()],  # 3 sources should be high, not low
                tags=[],
                created_from_query="test"
            )
        }

        issues = checker.check_confidence_levels(kus)

        assert len(issues) == 2
        assert all(i.issue_type == "confidence_mismatch" for i in issues)
        assert all(i.severity == "low" for i in issues)

        # Check first issue
        issue1 = next(i for i in issues if i.ku_id == "ku_wrong1")
        assert issue1.details['actual_confidence'] == "high"
        assert issue1.details['expected_confidence'] == "low"
        assert issue1.details['source_count'] == 1

        # Check second issue
        issue2 = next(i for i in issues if i.ku_id == "ku_wrong2")
        assert issue2.details['actual_confidence'] == "low"
        assert issue2.details['expected_confidence'] == "high"
        assert issue2.details['source_count'] == 3


# ========================
# Full Check Integration Tests
# ========================

class TestCheckAll:
    """Test the check_all() method."""

    @patch.object(ConsistencyChecker, 'check_chunk_existence')
    @patch.object(ConsistencyChecker, 'check_page_boundaries')
    @patch.object(ConsistencyChecker, 'check_duplicates')
    @patch.object(ConsistencyChecker, 'check_confidence_levels')
    def test_check_all_calls_all_checks(self, mock_conf, mock_dup, mock_page, mock_chunk, checker, mock_kus_dict):
        """Test that check_all() calls all individual check methods."""
        # Mock all methods to return empty lists
        mock_chunk.return_value = []
        mock_page.return_value = []
        mock_dup.return_value = []
        mock_conf.return_value = []

        # Mock loader
        checker.loader = Mock()
        checker.loader.get_all_kus.return_value = mock_kus_dict

        results = checker.check_all()

        # Verify all checks were called
        mock_chunk.assert_called_once()
        mock_page.assert_called_once()
        mock_dup.assert_called_once()
        mock_conf.assert_called_once()

        # Verify result structure
        assert 'missing_chunks' in results
        assert 'page_mismatches' in results
        assert 'duplicates' in results
        assert 'confidence_issues' in results

    @patch.object(ConsistencyChecker, 'check_chunk_existence')
    @patch.object(ConsistencyChecker, 'check_page_boundaries')
    @patch.object(ConsistencyChecker, 'check_duplicates')
    @patch.object(ConsistencyChecker, 'check_confidence_levels')
    def test_check_all_with_issues(self, mock_conf, mock_dup, mock_page, mock_chunk, checker, mock_kus_dict):
        """Test check_all() when issues are found."""
        # Mock methods to return issues
        mock_chunk.return_value = [
            ConsistencyIssue(
                issue_type="missing_chunk",
                severity="critical",
                ku_id="ku_001",
                details={}
            )
        ]
        mock_page.return_value = [
            ConsistencyIssue(
                issue_type="page_mismatch",
                severity="high",
                ku_id="ku_002",
                details={}
            )
        ]
        mock_dup.return_value = []
        mock_conf.return_value = [
            ConsistencyIssue(
                issue_type="confidence_mismatch",
                severity="low",
                ku_id="ku_003",
                details={}
            )
        ]

        # Mock loader
        checker.loader = Mock()
        checker.loader.get_all_kus.return_value = mock_kus_dict

        results = checker.check_all()

        assert len(results['missing_chunks']) == 1
        assert len(results['page_mismatches']) == 1
        assert len(results['duplicates']) == 0
        assert len(results['confidence_issues']) == 1


# ========================
# Reporting Tests
# ========================

class TestReporting:
    """Test report formatting and summary generation."""

    def test_format_report_no_issues(self, checker):
        """Test report formatting when no issues exist."""
        results = {
            'missing_chunks': [],
            'page_mismatches': [],
            'duplicates': [],
            'confidence_issues': []
        }

        report = checker.format_consistency_report(results)

        assert "✅ All consistency checks passed" in report

    def test_format_report_with_issues(self, checker):
        """Test report formatting with various issues."""
        results = {
            'missing_chunks': [
                ConsistencyIssue(
                    issue_type="missing_chunk",
                    severity="critical",
                    ku_id="ku_001",
                    details={'chunk_id': 'chunk_123'}
                )
            ],
            'page_mismatches': [
                ConsistencyIssue(
                    issue_type="page_mismatch",
                    severity="high",
                    ku_id="ku_002",
                    details={'cited_pages': '42-44', 'chunk_pages': '50-60'}
                )
            ],
            'duplicates': [],
            'confidence_issues': []
        }

        report = checker.format_consistency_report(results, show_low_severity=False)

        assert "Missing Chunks: 1 issues" in report
        assert "Page Boundary Violations: 1 issues" in report
        assert "🔴" in report  # Critical emoji
        assert "🟠" in report  # High emoji
        assert "ku_001" in report
        assert "ku_002" in report

    def test_get_summary(self, checker):
        """Test summary statistics generation."""
        results = {
            'missing_chunks': [
                ConsistencyIssue("missing_chunk", "critical", "ku_001", {})
            ],
            'page_mismatches': [
                ConsistencyIssue("page_mismatch", "high", "ku_002", {}),
                ConsistencyIssue("page_mismatch", "high", "ku_003", {})
            ],
            'duplicates': [
                ConsistencyIssue("duplicate_claim", "medium", "ku_004", {})
            ],
            'confidence_issues': [
                ConsistencyIssue("confidence_mismatch", "low", "ku_005", {}),
                ConsistencyIssue("confidence_mismatch", "low", "ku_006", {})
            ]
        }

        summary = checker.get_summary(results)

        assert summary['total_issues'] == 6
        assert summary['by_check']['missing_chunks'] == 1
        assert summary['by_check']['page_mismatches'] == 2
        assert summary['by_check']['duplicates'] == 1
        assert summary['by_check']['confidence_issues'] == 2
        assert summary['by_severity']['critical'] == 1
        assert summary['by_severity']['high'] == 2
        assert summary['by_severity']['medium'] == 1
        assert summary['by_severity']['low'] == 2
        assert summary['has_critical'] is True
        assert summary['has_high'] is True


# ========================
# Run Tests
# ========================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
