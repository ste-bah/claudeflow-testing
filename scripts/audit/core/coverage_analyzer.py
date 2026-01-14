#!/usr/bin/env python3
"""
Phase 16 Week 2: Coverage Analyzer

Measures source document utilization:
- PDF page coverage (how many pages are represented in chunks)
- Source document utilization rate
- Knowledge coverage by topic/tag
- Reasoning coverage of KUs

Usage:
    python scripts/audit/core/coverage_analyzer.py --all --json
    python scripts/audit/core/coverage_analyzer.py --pdf "corpus/document.pdf"
    python scripts/audit/core/coverage_analyzer.py --by-topic
    python scripts/audit/core/coverage_analyzer.py --by-document
"""

import json
import sys
import argparse
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Set, Any, Optional, Tuple
from collections import defaultdict
from datetime import datetime

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT_ROOT))

try:
    import chromadb
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False

try:
    import fitz  # PyMuPDF for page counting
    PYMUPDF_AVAILABLE = True
except ImportError:
    PYMUPDF_AVAILABLE = False

from explore.core.artifact_loader import ArtifactLoader


@dataclass
class PageCoverage:
    """Coverage information for a document's pages."""
    document_path: str
    total_pages: int
    covered_pages: int
    covered_page_numbers: List[int] = field(default_factory=list)
    uncovered_page_numbers: List[int] = field(default_factory=list)
    coverage_pct: float = 0.0
    chunk_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "document_path": self.document_path,
            "total_pages": self.total_pages,
            "covered_pages": self.covered_pages,
            "covered_page_numbers": self.covered_page_numbers[:20],  # Limit output
            "uncovered_page_numbers": self.uncovered_page_numbers[:20],
            "coverage_pct": self.coverage_pct,
            "chunk_count": self.chunk_count
        }


@dataclass
class DocumentCoverage:
    """Coverage information for a single document."""
    document_path: str
    document_name: str
    page_coverage: PageCoverage
    chunk_count: int
    ku_count: int
    ru_count: int
    overall_score: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "document_path": self.document_path,
            "document_name": self.document_name,
            "page_coverage": self.page_coverage.to_dict(),
            "chunk_count": self.chunk_count,
            "ku_count": self.ku_count,
            "ru_count": self.ru_count,
            "overall_score": self.overall_score,
            "metadata": self.metadata
        }


@dataclass
class TopicCoverage:
    """Coverage information for a topic/tag."""
    topic: str
    ku_count: int
    ru_count: int
    source_documents: List[str] = field(default_factory=list)
    avg_confidence: float = 0.0
    depth_score: float = 0.0  # How deeply the topic is covered

    def to_dict(self) -> Dict[str, Any]:
        return {
            "topic": self.topic,
            "ku_count": self.ku_count,
            "ru_count": self.ru_count,
            "source_documents": self.source_documents[:10],
            "avg_confidence": self.avg_confidence,
            "depth_score": self.depth_score
        }


@dataclass
class CoverageSummary:
    """Overall coverage summary."""
    total_documents: int
    total_pages: int
    covered_pages: int
    page_coverage_pct: float
    total_chunks: int
    total_kus: int
    kus_with_reasoning: int
    ku_coverage_pct: float
    total_rus: int
    by_document: Dict[str, DocumentCoverage] = field(default_factory=dict)
    by_topic: Dict[str, TopicCoverage] = field(default_factory=dict)
    coverage_grade: str = "A"
    analyzed_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_documents": self.total_documents,
            "total_pages": self.total_pages,
            "covered_pages": self.covered_pages,
            "page_coverage_pct": self.page_coverage_pct,
            "total_chunks": self.total_chunks,
            "total_kus": self.total_kus,
            "kus_with_reasoning": self.kus_with_reasoning,
            "ku_coverage_pct": self.ku_coverage_pct,
            "total_rus": self.total_rus,
            "coverage_grade": self.coverage_grade,
            "document_count": len(self.by_document),
            "topic_count": len(self.by_topic),
            "analyzed_at": self.analyzed_at
        }


class CoverageAnalyzer:
    """
    Analyzes source document coverage and utilization.

    Measures:
    - Page-level coverage for each PDF
    - Document utilization in knowledge base
    - Topic/tag distribution
    - KU to RU coverage
    """

    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.loader = ArtifactLoader()

        # Load artifacts
        self.kus = {ku.id: ku for ku in self.loader.get_all_kus().values()}
        self.rus = {ru.reason_id: ru for ru in self.loader.get_all_rus().values()}

        # Initialize ChromaDB
        self.chroma_client = None
        self.collection = None
        self._init_chroma()

        # Build reference maps
        self.doc_to_chunks: Dict[str, List[Dict]] = defaultdict(list)
        self.doc_to_kus: Dict[str, Set[str]] = defaultdict(set)
        self.ku_to_rus: Dict[str, Set[str]] = defaultdict(set)
        self.topic_kus: Dict[str, Set[str]] = defaultdict(set)
        self._build_maps()

    def _init_chroma(self):
        """Initialize ChromaDB connection."""
        if not CHROMA_AVAILABLE:
            return

        chroma_path = PROJECT_ROOT / "vector_db_1536"
        if chroma_path.exists():
            try:
                self.chroma_client = chromadb.PersistentClient(path=str(chroma_path))
                collections = self.chroma_client.list_collections()
                if collections:
                    self.collection = self.chroma_client.get_collection(collections[0].name)
            except Exception as e:
                if self.verbose:
                    print(f"ChromaDB init warning: {e}", file=sys.stderr)

    def _build_maps(self):
        """Build reference maps for coverage analysis."""
        # Map chunks to documents
        if self.collection:
            try:
                result = self.collection.get(include=["metadatas"])
                for chunk_id, meta in zip(result.get("ids", []), result.get("metadatas", [])):
                    if meta:
                        path_rel = meta.get("path_rel", "")
                        if path_rel:
                            self.doc_to_chunks[path_rel].append({
                                "chunk_id": chunk_id,
                                "page_start": meta.get("page_start"),
                                "page_end": meta.get("page_end"),
                                "metadata": meta
                            })
            except Exception:
                pass

        # Map KUs to documents and topics
        for ku_id, ku in self.kus.items():
            for source in ku.sources:
                path_rel = source.path_rel
                if path_rel:
                    self.doc_to_kus[path_rel].add(ku_id)

            # Map to topics
            for tag in (ku.tags or []):
                self.topic_kus[tag].add(ku_id)

        # Map KUs to RUs
        for ru_id, ru in self.rus.items():
            for ku_id in (ru.knowledge_ids or []):
                self.ku_to_rus[ku_id].add(ru_id)

    def analyze_page_coverage(self, document_path: str) -> PageCoverage:
        """
        Analyze page-level coverage for a specific document.

        Returns which pages are covered by chunks and which are missing.
        """
        # Normalize path
        path_variants = [
            document_path,
            f"corpus/{document_path}",
            document_path.replace("corpus/", "")
        ]

        chunks = []
        for variant in path_variants:
            if variant in self.doc_to_chunks:
                chunks = self.doc_to_chunks[variant]
                break

        # Get total pages
        total_pages = self._get_pdf_page_count(document_path)

        if total_pages == 0:
            return PageCoverage(
                document_path=document_path,
                total_pages=0,
                covered_pages=0,
                coverage_pct=0.0,
                chunk_count=len(chunks)
            )

        # Calculate covered pages
        covered: Set[int] = set()
        for chunk in chunks:
            start = chunk.get("page_start")
            end = chunk.get("page_end")

            if start is not None:
                try:
                    start_int = int(start)
                    end_int = int(end) if end else start_int
                    for page in range(start_int, end_int + 1):
                        if 1 <= page <= total_pages:
                            covered.add(page)
                except (ValueError, TypeError):
                    pass

        all_pages = set(range(1, total_pages + 1))
        uncovered = all_pages - covered

        coverage_pct = (len(covered) / total_pages * 100) if total_pages > 0 else 0.0

        return PageCoverage(
            document_path=document_path,
            total_pages=total_pages,
            covered_pages=len(covered),
            covered_page_numbers=sorted(covered),
            uncovered_page_numbers=sorted(uncovered),
            coverage_pct=round(coverage_pct, 2),
            chunk_count=len(chunks)
        )

    def analyze_document_coverage(self, document_path: str) -> DocumentCoverage:
        """
        Analyze comprehensive coverage for a single document.

        Includes page coverage, KU count, RU count, and overall score.
        """
        page_cov = self.analyze_page_coverage(document_path)

        # Normalize path for lookups
        path_variants = [
            document_path,
            f"corpus/{document_path}",
            document_path.replace("corpus/", "")
        ]

        ku_ids: Set[str] = set()
        chunks = []
        for variant in path_variants:
            ku_ids.update(self.doc_to_kus.get(variant, set()))
            chunks.extend(self.doc_to_chunks.get(variant, []))

        # Count RUs connected to this document's KUs
        ru_ids: Set[str] = set()
        for ku_id in ku_ids:
            ru_ids.update(self.ku_to_rus.get(ku_id, set()))

        # Calculate overall score (weighted)
        # 40% page coverage, 30% KU presence, 30% reasoning coverage
        ku_score = min(len(ku_ids) * 10, 100)  # 10 KUs = 100%
        ru_ratio = (len(ru_ids) / len(ku_ids) * 100) if ku_ids else 0
        overall = (
            page_cov.coverage_pct * 0.4 +
            ku_score * 0.3 +
            min(ru_ratio, 100) * 0.3
        )

        return DocumentCoverage(
            document_path=document_path,
            document_name=Path(document_path).name,
            page_coverage=page_cov,
            chunk_count=len(chunks),
            ku_count=len(ku_ids),
            ru_count=len(ru_ids),
            overall_score=round(overall, 2),
            metadata={
                "ku_ids": list(ku_ids)[:10],
                "ru_ids": list(ru_ids)[:10]
            }
        )

    def analyze_topic_coverage(self, topic: str) -> TopicCoverage:
        """
        Analyze coverage for a specific topic/tag.

        Returns depth of coverage including sources and reasoning.
        """
        ku_ids = self.topic_kus.get(topic, set())

        if not ku_ids:
            return TopicCoverage(
                topic=topic,
                ku_count=0,
                ru_count=0
            )

        # Gather stats
        source_docs: Set[str] = set()
        confidences: List[float] = []

        for ku_id in ku_ids:
            if ku_id in self.kus:
                ku = self.kus[ku_id]
                confidences.append(ku.confidence or 0.0)
                for source in ku.sources:
                    path_rel = source.path_rel
                    if path_rel:
                        source_docs.add(path_rel)

        # Count RUs
        ru_ids: Set[str] = set()
        for ku_id in ku_ids:
            ru_ids.update(self.ku_to_rus.get(ku_id, set()))

        # Calculate depth score
        # Based on: KU count, RU ratio, source diversity, avg confidence
        ku_factor = min(len(ku_ids) / 10, 1.0)  # 10 KUs = full score
        ru_ratio = len(ru_ids) / len(ku_ids) if ku_ids else 0
        source_factor = min(len(source_docs) / 5, 1.0)  # 5 sources = full
        avg_conf = sum(confidences) / len(confidences) if confidences else 0

        depth_score = (
            ku_factor * 30 +
            min(ru_ratio, 1) * 30 +
            source_factor * 20 +
            avg_conf * 20
        )

        return TopicCoverage(
            topic=topic,
            ku_count=len(ku_ids),
            ru_count=len(ru_ids),
            source_documents=sorted(source_docs),
            avg_confidence=round(sum(confidences) / len(confidences), 2) if confidences else 0,
            depth_score=round(depth_score, 2)
        )

    def analyze_all_topics(self) -> Dict[str, TopicCoverage]:
        """Analyze coverage for all topics."""
        return {topic: self.analyze_topic_coverage(topic) for topic in self.topic_kus}

    def analyze_all_documents(self) -> Dict[str, DocumentCoverage]:
        """Analyze coverage for all documents."""
        all_docs: Set[str] = set()
        all_docs.update(self.doc_to_chunks.keys())
        all_docs.update(self.doc_to_kus.keys())

        return {doc: self.analyze_document_coverage(doc) for doc in all_docs}

    def analyze_all(self) -> CoverageSummary:
        """Run comprehensive coverage analysis."""
        doc_coverage = self.analyze_all_documents()
        topic_coverage = self.analyze_all_topics()

        # Aggregate stats
        total_pages = 0
        covered_pages = 0
        total_chunks = 0

        for doc_cov in doc_coverage.values():
            total_pages += doc_cov.page_coverage.total_pages
            covered_pages += doc_cov.page_coverage.covered_pages
            total_chunks += doc_cov.chunk_count

        page_coverage_pct = (covered_pages / total_pages * 100) if total_pages > 0 else 0

        # KU coverage
        kus_with_reasoning = len([ku for ku in self.kus if ku in self.ku_to_rus])
        ku_coverage_pct = (kus_with_reasoning / len(self.kus) * 100) if self.kus else 0

        # Calculate grade
        avg_score = (page_coverage_pct + ku_coverage_pct) / 2
        grade = self._calculate_grade(avg_score)

        return CoverageSummary(
            total_documents=len(doc_coverage),
            total_pages=total_pages,
            covered_pages=covered_pages,
            page_coverage_pct=round(page_coverage_pct, 2),
            total_chunks=total_chunks,
            total_kus=len(self.kus),
            kus_with_reasoning=kus_with_reasoning,
            ku_coverage_pct=round(ku_coverage_pct, 2),
            total_rus=len(self.rus),
            by_document=doc_coverage,
            by_topic=topic_coverage,
            coverage_grade=grade
        )

    def _get_pdf_page_count(self, document_path: str) -> int:
        """Get total page count for a PDF."""
        if not PYMUPDF_AVAILABLE:
            # Fallback: estimate from chunks
            chunks = self.doc_to_chunks.get(document_path, [])
            max_page = 0
            for chunk in chunks:
                end = chunk.get("page_end")
                if end:
                    try:
                        max_page = max(max_page, int(end))
                    except (ValueError, TypeError):
                        pass
            return max_page

        # Try various path formats
        paths_to_try = [
            PROJECT_ROOT / document_path,
            PROJECT_ROOT / "corpus" / document_path,
            PROJECT_ROOT / document_path.replace("corpus/", "")
        ]

        for path in paths_to_try:
            if path.exists():
                try:
                    doc = fitz.open(str(path))
                    count = doc.page_count
                    doc.close()
                    return count
                except Exception:
                    continue

        return 0

    def _calculate_grade(self, score: float) -> str:
        """Calculate letter grade from numeric score."""
        if score >= 90:
            return "A"
        elif score >= 80:
            return "B"
        elif score >= 70:
            return "C"
        elif score >= 60:
            return "D"
        else:
            return "F"

    def get_coverage_gaps(self) -> List[Dict[str, Any]]:
        """Get list of documents with low coverage for remediation."""
        gaps = []

        for doc_path, doc_cov in self.analyze_all_documents().items():
            if doc_cov.overall_score < 50:
                gaps.append({
                    "document": doc_path,
                    "overall_score": doc_cov.overall_score,
                    "page_coverage": doc_cov.page_coverage.coverage_pct,
                    "ku_count": doc_cov.ku_count,
                    "uncovered_pages": doc_cov.page_coverage.uncovered_page_numbers[:10],
                    "recommendation": self._get_recommendation(doc_cov)
                })

        return sorted(gaps, key=lambda x: x["overall_score"])

    def _get_recommendation(self, doc_cov: DocumentCoverage) -> str:
        """Generate recommendation for improving document coverage."""
        issues = []

        if doc_cov.page_coverage.coverage_pct < 50:
            issues.append("re-ingest with finer chunking")
        if doc_cov.ku_count == 0:
            issues.append("create knowledge units from chunks")
        if doc_cov.ru_count == 0 and doc_cov.ku_count > 0:
            issues.append("create reasoning units to connect KUs")

        return "; ".join(issues) if issues else "coverage adequate"


def main():
    parser = argparse.ArgumentParser(description="Analyze source document coverage")
    parser.add_argument("--pdf", help="Analyze specific PDF document")
    parser.add_argument("--topic", help="Analyze specific topic")
    parser.add_argument("--by-document", action="store_true", help="Coverage by document")
    parser.add_argument("--by-topic", action="store_true", help="Coverage by topic")
    parser.add_argument("--gaps", action="store_true", help="Show coverage gaps")
    parser.add_argument("--all", action="store_true", help="Full coverage analysis")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    args = parser.parse_args()

    analyzer = CoverageAnalyzer(verbose=args.verbose)

    if args.pdf:
        doc_cov = analyzer.analyze_document_coverage(args.pdf)
        if args.json:
            print(json.dumps(doc_cov.to_dict(), indent=2))
        else:
            print(f"Document Coverage: {args.pdf}")
            print("=" * 50)
            print(f"Pages: {doc_cov.page_coverage.covered_pages}/{doc_cov.page_coverage.total_pages} ({doc_cov.page_coverage.coverage_pct}%)")
            print(f"Chunks: {doc_cov.chunk_count}")
            print(f"KUs: {doc_cov.ku_count}")
            print(f"RUs: {doc_cov.ru_count}")
            print(f"Overall Score: {doc_cov.overall_score}")
            if doc_cov.page_coverage.uncovered_page_numbers:
                pages = doc_cov.page_coverage.uncovered_page_numbers[:10]
                print(f"Uncovered Pages: {pages}{'...' if len(doc_cov.page_coverage.uncovered_page_numbers) > 10 else ''}")

    elif args.topic:
        topic_cov = analyzer.analyze_topic_coverage(args.topic)
        if args.json:
            print(json.dumps(topic_cov.to_dict(), indent=2))
        else:
            print(f"Topic Coverage: {args.topic}")
            print("=" * 40)
            print(f"KU Count: {topic_cov.ku_count}")
            print(f"RU Count: {topic_cov.ru_count}")
            print(f"Avg Confidence: {topic_cov.avg_confidence}")
            print(f"Depth Score: {topic_cov.depth_score}")
            if topic_cov.source_documents:
                print(f"Sources: {len(topic_cov.source_documents)}")

    elif args.by_document:
        doc_coverage = analyzer.analyze_all_documents()
        if args.json:
            print(json.dumps({k: v.to_dict() for k, v in doc_coverage.items()}, indent=2))
        else:
            print("Coverage by Document")
            print("=" * 60)
            for doc_path, doc_cov in sorted(doc_coverage.items(), key=lambda x: x[1].overall_score):
                print(f"{doc_cov.document_name[:40]:<40} {doc_cov.overall_score:>6.1f}% ({doc_cov.ku_count} KUs)")

    elif args.by_topic:
        topic_coverage = analyzer.analyze_all_topics()
        if args.json:
            print(json.dumps({k: v.to_dict() for k, v in topic_coverage.items()}, indent=2))
        else:
            print("Coverage by Topic")
            print("=" * 50)
            for topic, topic_cov in sorted(topic_coverage.items(), key=lambda x: x[1].depth_score, reverse=True):
                print(f"{topic:<30} {topic_cov.depth_score:>6.1f} depth ({topic_cov.ku_count} KUs, {topic_cov.ru_count} RUs)")

    elif args.gaps:
        gaps = analyzer.get_coverage_gaps()
        if args.json:
            print(json.dumps(gaps, indent=2))
        else:
            print(f"Coverage Gaps ({len(gaps)} documents below 50%)")
            print("=" * 60)
            for gap in gaps[:20]:
                print(f"\n{gap['document']}")
                print(f"  Score: {gap['overall_score']}%")
                print(f"  Page Coverage: {gap['page_coverage']}%")
                print(f"  Recommendation: {gap['recommendation']}")

    elif args.all:
        summary = analyzer.analyze_all()
        if args.json:
            print(json.dumps(summary.to_dict(), indent=2))
        else:
            print("Coverage Analysis Summary")
            print("=" * 50)
            print(f"Documents:         {summary.total_documents}")
            print(f"Total Pages:       {summary.total_pages}")
            print(f"Covered Pages:     {summary.covered_pages} ({summary.page_coverage_pct}%)")
            print(f"Total Chunks:      {summary.total_chunks}")
            print(f"Total KUs:         {summary.total_kus}")
            print(f"KUs with Reasoning: {summary.kus_with_reasoning} ({summary.ku_coverage_pct}%)")
            print(f"Total RUs:         {summary.total_rus}")
            print(f"Topics:            {len(summary.by_topic)}")
            print(f"Coverage Grade:    {summary.coverage_grade}")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
