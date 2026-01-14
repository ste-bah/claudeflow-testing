"""
Consistency Checker - Validate provenance chains and detect duplicates

Validates:
- Chunk existence in ChromaDB
- Page citations within chunk boundaries
- Duplicate claims (semantic similarity)
- Confidence level heuristics
"""

import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, Set

import chromadb
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

# Add scripts to path for imports
scripts_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(scripts_dir))

from explore.core.artifact_loader import ArtifactLoader, KnowledgeUnit


@dataclass
class ConsistencyIssue:
    """Represents a single consistency issue."""
    issue_type: str  # "missing_chunk", "page_mismatch", "duplicate_claim", "confidence_error"
    severity: str  # "critical", "high", "medium", "low"
    ku_id: str
    details: Dict[str, Any]


class ConsistencyChecker:
    """
    Validates provenance chains and detects consistency issues.

    Checks:
    - Chunk existence in ChromaDB
    - Page citations within chunk boundaries
    - Duplicate claims (semantic similarity >0.95)
    - Confidence level heuristics
    """

    def __init__(
        self,
        project_root: Optional[Path] = None,
        chroma_path: Optional[Path] = None,
        embedding_model: str = "all-MiniLM-L6-v2"
    ):
        """
        Initialize consistency checker.

        Args:
            project_root: Project root directory (default: auto-detect)
            chroma_path: Path to ChromaDB database (default: vector_db_1536)
            embedding_model: Sentence transformer model for embeddings
        """
        if project_root is None:
            project_root = Path(__file__).parent.parent.parent.parent

        self.project_root = Path(project_root)
        self.loader = ArtifactLoader(self.project_root)

        # ChromaDB setup
        if chroma_path is None:
            chroma_path = self.project_root / "vector_db_1536"

        self.chroma_path = Path(chroma_path)
        self.chroma_client: Optional[chromadb.Client] = None
        self.collection: Optional[chromadb.Collection] = None

        # Embedding model for duplicate detection
        self.embedding_model_name = embedding_model
        self.embedding_model: Optional[SentenceTransformer] = None

    def _init_chromadb(self) -> None:
        """Initialize ChromaDB client (lazy loading)."""
        if self.chroma_client is None:
            self.chroma_client = chromadb.PersistentClient(path=str(self.chroma_path))
            self.collection = self.chroma_client.get_collection("knowledge_chunks")

    def _init_embedding_model(self) -> None:
        """Initialize sentence transformer model (lazy loading)."""
        if self.embedding_model is None:
            self.embedding_model = SentenceTransformer(self.embedding_model_name)

    # ========================
    # Page Range Parsing
    # ========================

    def _parse_page_range(self, pages: str) -> Tuple[int, int]:
        """
        Parse page range string to start and end page numbers.

        Handles formats: "42", "42-44", "42–44" (en-dash), "42, 44"

        Args:
            pages: Page range string

        Returns:
            Tuple of (start_page, end_page)

        Raises:
            ValueError: If page range format is invalid
        """
        # Clean whitespace
        pages = pages.strip()

        # Single page: "42"
        if pages.isdigit():
            page = int(pages)
            return (page, page)

        # Range with hyphen or en-dash: "42-44" or "42–44"
        range_match = re.match(r'^(\d+)\s*[–-]\s*(\d+)$', pages)
        if range_match:
            start = int(range_match.group(1))
            end = int(range_match.group(2))
            return (start, end)

        # Comma-separated (treat as range): "42, 44"
        comma_match = re.match(r'^(\d+)\s*,\s*(\d+)$', pages)
        if comma_match:
            start = int(comma_match.group(1))
            end = int(comma_match.group(2))
            return (start, end)

        # If we get here, format is unrecognized
        raise ValueError(f"Invalid page range format: {pages}")

    # ========================
    # Chunk Existence Validation
    # ========================

    def check_chunk_existence(
        self,
        kus: Optional[Dict[str, KnowledgeUnit]] = None
    ) -> List[ConsistencyIssue]:
        """
        Verify all chunk_ids exist in ChromaDB.

        Args:
            kus: Knowledge units to check (default: all KUs)

        Returns:
            List of missing chunk issues
        """
        self._init_chromadb()
        issues = []

        if kus is None:
            kus = self.loader.get_all_kus()

        for ku in kus.values():
            for source in ku.sources:
                # Query ChromaDB for this chunk
                try:
                    result = self.collection.get(ids=[source.chunk_id])

                    if not result['ids']:
                        issues.append(ConsistencyIssue(
                            issue_type="missing_chunk",
                            severity="critical",
                            ku_id=ku.id,
                            details={
                                "chunk_id": source.chunk_id,
                                "path_rel": source.path_rel,
                                "pages": source.pages
                            }
                        ))
                except Exception as e:
                    issues.append(ConsistencyIssue(
                        issue_type="missing_chunk",
                        severity="critical",
                        ku_id=ku.id,
                        details={
                            "chunk_id": source.chunk_id,
                            "error": str(e)
                        }
                    ))

        return issues

    # ========================
    # Page Boundary Validation
    # ========================

    def check_page_boundaries(
        self,
        kus: Optional[Dict[str, KnowledgeUnit]] = None
    ) -> List[ConsistencyIssue]:
        """
        Verify cited pages are within chunk boundaries.

        Args:
            kus: Knowledge units to check (default: all KUs)

        Returns:
            List of page mismatch issues
        """
        self._init_chromadb()
        issues = []

        if kus is None:
            kus = self.loader.get_all_kus()

        for ku in kus.values():
            for source in ku.sources:
                try:
                    # Get chunk metadata
                    result = self.collection.get(
                        ids=[source.chunk_id],
                        include=["metadatas"]
                    )

                    if not result['ids']:
                        # Chunk missing - already caught by check_chunk_existence
                        continue

                    metadata = result['metadatas'][0]

                    # Parse cited pages
                    try:
                        cited_start, cited_end = self._parse_page_range(source.pages)
                    except ValueError as e:
                        issues.append(ConsistencyIssue(
                            issue_type="page_parse_error",
                            severity="high",
                            ku_id=ku.id,
                            details={
                                "chunk_id": source.chunk_id,
                                "cited_pages": source.pages,
                                "error": str(e)
                            }
                        ))
                        continue

                    # Get chunk page boundaries
                    chunk_start = metadata.get('page_start')
                    chunk_end = metadata.get('page_end')

                    if chunk_start is None or chunk_end is None:
                        issues.append(ConsistencyIssue(
                            issue_type="missing_page_metadata",
                            severity="high",
                            ku_id=ku.id,
                            details={
                                "chunk_id": source.chunk_id,
                                "metadata": metadata
                            }
                        ))
                        continue

                    # Validate cited pages are within chunk boundaries
                    if not (chunk_start <= cited_start <= chunk_end and
                            chunk_start <= cited_end <= chunk_end):
                        issues.append(ConsistencyIssue(
                            issue_type="page_mismatch",
                            severity="high",
                            ku_id=ku.id,
                            details={
                                "chunk_id": source.chunk_id,
                                "cited_pages": f"{cited_start}–{cited_end}",
                                "chunk_pages": f"{chunk_start}–{chunk_end}",
                                "path_rel": source.path_rel
                            }
                        ))

                except Exception as e:
                    issues.append(ConsistencyIssue(
                        issue_type="page_validation_error",
                        severity="medium",
                        ku_id=ku.id,
                        details={
                            "chunk_id": source.chunk_id,
                            "error": str(e)
                        }
                    ))

        return issues

    # ========================
    # Duplicate Detection
    # ========================

    def check_duplicates(
        self,
        kus: Optional[Dict[str, KnowledgeUnit]] = None,
        similarity_threshold: float = 0.95
    ) -> List[ConsistencyIssue]:
        """
        Detect duplicate claims using semantic similarity.

        Args:
            kus: Knowledge units to check (default: all KUs)
            similarity_threshold: Cosine similarity threshold (default: 0.95)

        Returns:
            List of duplicate claim issues
        """
        self._init_embedding_model()
        issues = []

        if kus is None:
            kus = self.loader.get_all_kus()

        # Skip if only 1 KU
        if len(kus) < 2:
            return issues

        # Extract claims and IDs
        ku_list = list(kus.values())
        claims = [ku.claim for ku in ku_list]
        ku_ids = [ku.id for ku in ku_list]

        # Generate embeddings
        embeddings = self.embedding_model.encode(claims, show_progress_bar=False)

        # Compute cosine similarity matrix
        similarity_matrix = cosine_similarity(embeddings)

        # Find high-similarity pairs (excluding diagonal)
        n = len(ku_list)
        for i in range(n):
            for j in range(i + 1, n):
                similarity = similarity_matrix[i][j]

                if similarity >= similarity_threshold:
                    issues.append(ConsistencyIssue(
                        issue_type="duplicate_claim",
                        severity="medium",
                        ku_id=ku_ids[i],
                        details={
                            "duplicate_of": ku_ids[j],
                            "similarity": f"{similarity:.3f}",
                            "claim1": claims[i][:100] + "..." if len(claims[i]) > 100 else claims[i],
                            "claim2": claims[j][:100] + "..." if len(claims[j]) > 100 else claims[j]
                        }
                    ))

        return issues

    # ========================
    # Confidence Level Validation
    # ========================

    def check_confidence_levels(
        self,
        kus: Optional[Dict[str, KnowledgeUnit]] = None
    ) -> List[ConsistencyIssue]:
        """
        Check if confidence levels follow heuristics.

        Heuristic:
        - 3+ sources → high confidence
        - 2 sources → medium confidence
        - 1 source → low confidence

        Args:
            kus: Knowledge units to check (default: all KUs)

        Returns:
            List of confidence level issues
        """
        issues = []

        if kus is None:
            kus = self.loader.get_all_kus()

        for ku in kus.values():
            source_count = len(ku.sources)
            expected_confidence = self._compute_expected_confidence(source_count)

            if ku.confidence != expected_confidence:
                issues.append(ConsistencyIssue(
                    issue_type="confidence_mismatch",
                    severity="low",  # Informational
                    ku_id=ku.id,
                    details={
                        "actual_confidence": ku.confidence,
                        "expected_confidence": expected_confidence,
                        "source_count": source_count
                    }
                ))

        return issues

    def _compute_expected_confidence(self, source_count: int) -> str:
        """Compute expected confidence level based on source count."""
        if source_count >= 3:
            return "high"
        elif source_count == 2:
            return "medium"
        else:
            return "low"

    # ========================
    # Full Consistency Check
    # ========================

    def check_all(
        self,
        kus: Optional[Dict[str, KnowledgeUnit]] = None,
        similarity_threshold: float = 0.95
    ) -> Dict[str, List[ConsistencyIssue]]:
        """
        Run all consistency checks.

        Args:
            kus: Knowledge units to check (default: all KUs)
            similarity_threshold: Duplicate detection threshold

        Returns:
            Dictionary mapping check type to list of issues
        """
        if kus is None:
            kus = self.loader.get_all_kus()

        print(f"Running consistency checks on {len(kus)} knowledge units...")

        results = {}

        # 1. Chunk existence
        print("  [1/4] Checking chunk existence...")
        results['missing_chunks'] = self.check_chunk_existence(kus)

        # 2. Page boundaries
        print("  [2/4] Validating page boundaries...")
        results['page_mismatches'] = self.check_page_boundaries(kus)

        # 3. Duplicates
        print("  [3/4] Detecting duplicates...")
        results['duplicates'] = self.check_duplicates(kus, similarity_threshold)

        # 4. Confidence levels
        print("  [4/4] Checking confidence levels...")
        results['confidence_issues'] = self.check_confidence_levels(kus)

        return results

    # ========================
    # Reporting
    # ========================

    def format_consistency_report(
        self,
        results: Dict[str, List[ConsistencyIssue]],
        show_low_severity: bool = False
    ) -> str:
        """
        Format consistency check results as human-readable report.

        Args:
            results: Dictionary of check results
            show_low_severity: Include low-severity issues

        Returns:
            Formatted report string
        """
        report_lines = ["Consistency Check Report", "=" * 60, ""]

        total_issues = sum(len(issues) for issues in results.values())

        if total_issues == 0:
            return "✅ All consistency checks passed"

        # Filter by severity if needed
        if not show_low_severity:
            results = {
                check: [i for i in issues if i.severity != "low"]
                for check, issues in results.items()
            }

        total_issues = sum(len(issues) for issues in results.values())

        if total_issues == 0:
            return "✅ No significant consistency issues detected"

        # Report each check type
        check_labels = {
            'missing_chunks': 'Missing Chunks',
            'page_mismatches': 'Page Boundary Violations',
            'duplicates': 'Duplicate Claims',
            'confidence_issues': 'Confidence Level Mismatches'
        }

        for check_type, label in check_labels.items():
            issues = results.get(check_type, [])

            if not issues:
                report_lines.append(f"✅ {label}: 0 issues")
                continue

            # Group by severity
            by_severity = {}
            for issue in issues:
                by_severity.setdefault(issue.severity, []).append(issue)

            severity_emoji = {
                "critical": "🔴",
                "high": "🟠",
                "medium": "🟡",
                "low": "⚪"
            }

            report_lines.append(f"\n{label}: {len(issues)} issues")
            report_lines.append("-" * 60)

            for severity in ["critical", "high", "medium", "low"]:
                if severity not in by_severity:
                    continue

                emoji = severity_emoji[severity]
                count = len(by_severity[severity])
                report_lines.append(f"{emoji} {severity.upper()} ({count})")

                for issue in by_severity[severity][:5]:  # Show first 5
                    report_lines.append(f"  KU: {issue.ku_id}")
                    for key, value in issue.details.items():
                        report_lines.append(f"    {key}: {value}")

                if count > 5:
                    report_lines.append(f"  ... and {count - 5} more")

        report_lines.append("")
        return "\n".join(report_lines)

    def get_summary(
        self,
        results: Dict[str, List[ConsistencyIssue]]
    ) -> Dict[str, Any]:
        """
        Get summary statistics from consistency check results.

        Args:
            results: Dictionary of check results

        Returns:
            Summary dictionary
        """
        total_issues = sum(len(issues) for issues in results.values())

        # Count by severity
        by_severity = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for issues in results.values():
            for issue in issues:
                by_severity[issue.severity] += 1

        return {
            "total_issues": total_issues,
            "by_check": {check: len(issues) for check, issues in results.items()},
            "by_severity": by_severity,
            "has_critical": by_severity["critical"] > 0,
            "has_high": by_severity["high"] > 0
        }
