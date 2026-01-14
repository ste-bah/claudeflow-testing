#!/usr/bin/env python3
"""
Phase 16 Week 2: Missing Link Detector

Detects breaks in provenance chains:
- KUs referencing non-existent chunks
- RUs referencing non-existent KUs
- Sources with invalid references
- Broken chains that prevent full tracing

Usage:
    python scripts/audit/core/missing_link_detector.py --all --json
    python scripts/audit/core/missing_link_detector.py --ku ku_001
    python scripts/audit/core/missing_link_detector.py --ru ru_001
"""

import json
import sys
import argparse
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Set, Any
from enum import Enum
from datetime import datetime

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT_ROOT))

try:
    import chromadb
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False

from explore.core.artifact_loader import ArtifactLoader


class LinkType(Enum):
    """Type of link in provenance chain."""
    KU_TO_CHUNK = "ku_to_chunk"
    RU_TO_KU = "ru_to_ku"
    SOURCE_TO_PDF = "source_to_pdf"
    CHUNK_TO_PDF = "chunk_to_pdf"


class LinkStatus(Enum):
    """Status of a provenance link."""
    VALID = "valid"
    BROKEN = "broken"
    PARTIAL = "partial"
    UNKNOWN = "unknown"


@dataclass
class MissingLink:
    """Represents a missing or broken link in the provenance chain."""
    link_type: LinkType
    source_id: str
    source_type: str
    target_id: str
    target_type: str
    status: LinkStatus
    context: Dict[str, Any] = field(default_factory=dict)
    error_message: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "link_type": self.link_type.value,
            "source_id": self.source_id,
            "source_type": self.source_type,
            "target_id": self.target_id,
            "target_type": self.target_type,
            "status": self.status.value,
            "context": self.context,
            "error_message": self.error_message
        }


@dataclass
class LinkDetectionResult:
    """Result of missing link detection."""
    entity_id: str
    entity_type: str
    total_links: int
    valid_links: int
    broken_links: int
    missing_links: List[MissingLink] = field(default_factory=list)
    chain_complete: bool = True
    checked_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "entity_id": self.entity_id,
            "entity_type": self.entity_type,
            "total_links": self.total_links,
            "valid_links": self.valid_links,
            "broken_links": self.broken_links,
            "missing_links": [ml.to_dict() for ml in self.missing_links],
            "chain_complete": self.chain_complete,
            "checked_at": self.checked_at
        }


@dataclass
class DetectionSummary:
    """Summary of all missing link detection."""
    total_entities: int
    entities_with_issues: int
    total_links_checked: int
    total_broken_links: int
    by_link_type: Dict[str, Dict[str, int]] = field(default_factory=dict)
    critical_breaks: List[MissingLink] = field(default_factory=list)
    integrity_score: float = 100.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_entities": self.total_entities,
            "entities_with_issues": self.entities_with_issues,
            "total_links_checked": self.total_links_checked,
            "total_broken_links": self.total_broken_links,
            "by_link_type": self.by_link_type,
            "critical_breaks": [cb.to_dict() for cb in self.critical_breaks],
            "integrity_score": self.integrity_score
        }


class MissingLinkDetector:
    """
    Detects missing and broken links in provenance chains.

    Validates:
    - KU → Chunk references
    - RU → KU references
    - Source → PDF references
    - Chunk → PDF references
    """

    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.loader = ArtifactLoader()

        # Load all artifacts
        self.kus = {ku.id: ku for ku in self.loader.get_all_kus().values()}
        self.rus = {ru.reason_id: ru for ru in self.loader.get_all_rus().values()}

        # Initialize ChromaDB
        self.chroma_client = None
        self.collection = None
        self._init_chroma()

        # Cache chunk IDs
        self.chunk_ids: Set[str] = set()
        self._cache_chunk_ids()

        # Track PDF paths
        self.pdf_paths: Set[str] = set()
        self._cache_pdf_paths()

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

    def _cache_chunk_ids(self):
        """Cache all chunk IDs from ChromaDB."""
        if self.collection:
            try:
                result = self.collection.get(include=[])
                self.chunk_ids = set(result.get("ids", []))
            except Exception:
                pass

    def _cache_pdf_paths(self):
        """Cache all PDF paths from corpus."""
        corpus_dir = PROJECT_ROOT / "corpus"
        if corpus_dir.exists():
            for pdf in corpus_dir.rglob("*.pdf"):
                rel_path = pdf.relative_to(PROJECT_ROOT)
                self.pdf_paths.add(str(rel_path))
                # Also add without corpus/ prefix
                try:
                    self.pdf_paths.add(str(pdf.relative_to(corpus_dir)))
                except ValueError:
                    pass

    def detect_ku_links(self, ku_id: str) -> LinkDetectionResult:
        """
        Detect missing links for a specific Knowledge Unit.

        Checks:
        - Each source's chunk_id exists in ChromaDB
        - Each source's path_rel points to existing PDF
        """
        if ku_id not in self.kus:
            return LinkDetectionResult(
                entity_id=ku_id,
                entity_type="knowledge_unit",
                total_links=0,
                valid_links=0,
                broken_links=1,
                missing_links=[MissingLink(
                    link_type=LinkType.KU_TO_CHUNK,
                    source_id=ku_id,
                    source_type="knowledge_unit",
                    target_id="unknown",
                    target_type="unknown",
                    status=LinkStatus.BROKEN,
                    error_message=f"Knowledge unit {ku_id} not found"
                )],
                chain_complete=False
            )

        ku = self.kus[ku_id]
        missing_links: List[MissingLink] = []
        valid_count = 0
        total_count = 0

        # Check each source
        for source in ku.sources:
            chunk_id = source.chunk_id
            path_rel = source.path_rel

            # Check chunk reference
            if chunk_id:
                total_count += 1
                if chunk_id in self.chunk_ids:
                    valid_count += 1
                else:
                    missing_links.append(MissingLink(
                        link_type=LinkType.KU_TO_CHUNK,
                        source_id=ku_id,
                        source_type="knowledge_unit",
                        target_id=chunk_id,
                        target_type="chunk",
                        status=LinkStatus.BROKEN,
                        context={"source": {"chunk_id": source.chunk_id, "path_rel": source.path_rel}},
                        error_message=f"Chunk {chunk_id} not found in ChromaDB"
                    ))

            # Check PDF reference
            if path_rel:
                total_count += 1
                if self._pdf_exists(path_rel):
                    valid_count += 1
                else:
                    missing_links.append(MissingLink(
                        link_type=LinkType.SOURCE_TO_PDF,
                        source_id=ku_id,
                        source_type="knowledge_unit",
                        target_id=path_rel,
                        target_type="pdf",
                        status=LinkStatus.BROKEN,
                        context={"source": {"chunk_id": source.chunk_id, "path_rel": source.path_rel}},
                        error_message=f"PDF not found: {path_rel}"
                    ))

        return LinkDetectionResult(
            entity_id=ku_id,
            entity_type="knowledge_unit",
            total_links=total_count,
            valid_links=valid_count,
            broken_links=len(missing_links),
            missing_links=missing_links,
            chain_complete=len(missing_links) == 0
        )

    def detect_ru_links(self, ru_id: str) -> LinkDetectionResult:
        """
        Detect missing links for a specific Reasoning Unit.

        Checks:
        - Each knowledge_id references existing KU
        """
        if ru_id not in self.rus:
            return LinkDetectionResult(
                entity_id=ru_id,
                entity_type="reasoning_unit",
                total_links=0,
                valid_links=0,
                broken_links=1,
                missing_links=[MissingLink(
                    link_type=LinkType.RU_TO_KU,
                    source_id=ru_id,
                    source_type="reasoning_unit",
                    target_id="unknown",
                    target_type="unknown",
                    status=LinkStatus.BROKEN,
                    error_message=f"Reasoning unit {ru_id} not found"
                )],
                chain_complete=False
            )

        ru = self.rus[ru_id]
        missing_links: List[MissingLink] = []
        valid_count = 0

        knowledge_ids = ru.knowledge_ids or []

        for ku_id in knowledge_ids:
            if ku_id in self.kus:
                valid_count += 1
            else:
                missing_links.append(MissingLink(
                    link_type=LinkType.RU_TO_KU,
                    source_id=ru_id,
                    source_type="reasoning_unit",
                    target_id=ku_id,
                    target_type="knowledge_unit",
                    status=LinkStatus.BROKEN,
                    context={"relation": ru.relation, "topic": ru.topic},
                    error_message=f"Knowledge unit {ku_id} not found"
                ))

        return LinkDetectionResult(
            entity_id=ru_id,
            entity_type="reasoning_unit",
            total_links=len(knowledge_ids),
            valid_links=valid_count,
            broken_links=len(missing_links),
            missing_links=missing_links,
            chain_complete=len(missing_links) == 0
        )

    def detect_all_ku_links(self) -> Dict[str, LinkDetectionResult]:
        """Detect missing links for all Knowledge Units."""
        results = {}
        for ku_id in self.kus:
            results[ku_id] = self.detect_ku_links(ku_id)
        return results

    def detect_all_ru_links(self) -> Dict[str, LinkDetectionResult]:
        """Detect missing links for all Reasoning Units."""
        results = {}
        for ru_id in self.rus:
            results[ru_id] = self.detect_ru_links(ru_id)
        return results

    def detect_all(self) -> DetectionSummary:
        """
        Run complete missing link detection across all entities.

        Returns comprehensive summary with integrity score.
        """
        ku_results = self.detect_all_ku_links()
        ru_results = self.detect_all_ru_links()

        # Aggregate statistics
        total_entities = len(ku_results) + len(ru_results)
        entities_with_issues = 0
        total_links = 0
        total_broken = 0

        by_link_type: Dict[str, Dict[str, int]] = {}
        critical_breaks: List[MissingLink] = []

        # Process KU results
        for result in ku_results.values():
            total_links += result.total_links
            total_broken += result.broken_links
            if result.broken_links > 0:
                entities_with_issues += 1

            for ml in result.missing_links:
                lt = ml.link_type.value
                if lt not in by_link_type:
                    by_link_type[lt] = {"total": 0, "broken": 0}
                by_link_type[lt]["total"] += 1
                by_link_type[lt]["broken"] += 1

                # Chunk links are critical
                if ml.link_type == LinkType.KU_TO_CHUNK:
                    critical_breaks.append(ml)

        # Process RU results
        for result in ru_results.values():
            total_links += result.total_links
            total_broken += result.broken_links
            if result.broken_links > 0:
                entities_with_issues += 1

            for ml in result.missing_links:
                lt = ml.link_type.value
                if lt not in by_link_type:
                    by_link_type[lt] = {"total": 0, "broken": 0}
                by_link_type[lt]["total"] += 1
                by_link_type[lt]["broken"] += 1

                # RU to KU links are critical
                if ml.link_type == LinkType.RU_TO_KU:
                    critical_breaks.append(ml)

        # Calculate integrity score
        if total_links > 0:
            integrity_score = ((total_links - total_broken) / total_links) * 100
        else:
            integrity_score = 100.0

        return DetectionSummary(
            total_entities=total_entities,
            entities_with_issues=entities_with_issues,
            total_links_checked=total_links,
            total_broken_links=total_broken,
            by_link_type=by_link_type,
            critical_breaks=critical_breaks[:10],  # Top 10 critical
            integrity_score=round(integrity_score, 2)
        )

    def _pdf_exists(self, path_rel: str) -> bool:
        """Check if a PDF path exists."""
        if not path_rel:
            return False

        # Check various path formats
        if path_rel in self.pdf_paths:
            return True

        # Try with corpus/ prefix
        corpus_path = f"corpus/{path_rel}"
        if corpus_path in self.pdf_paths:
            return True

        # Try absolute check
        full_path = PROJECT_ROOT / path_rel
        if full_path.exists():
            return True

        full_path = PROJECT_ROOT / "corpus" / path_rel
        if full_path.exists():
            return True

        return False

    def get_broken_chains(self) -> List[Dict[str, Any]]:
        """Get list of entities with broken chains for remediation."""
        broken = []

        ku_results = self.detect_all_ku_links()
        for ku_id, result in ku_results.items():
            if not result.chain_complete:
                broken.append({
                    "entity_type": "knowledge_unit",
                    "entity_id": ku_id,
                    "broken_links": result.broken_links,
                    "missing": [ml.to_dict() for ml in result.missing_links]
                })

        ru_results = self.detect_all_ru_links()
        for ru_id, result in ru_results.items():
            if not result.chain_complete:
                broken.append({
                    "entity_type": "reasoning_unit",
                    "entity_id": ru_id,
                    "broken_links": result.broken_links,
                    "missing": [ml.to_dict() for ml in result.missing_links]
                })

        return broken


def main():
    parser = argparse.ArgumentParser(description="Detect missing links in provenance chains")
    parser.add_argument("--ku", help="Check specific knowledge unit")
    parser.add_argument("--ru", help="Check specific reasoning unit")
    parser.add_argument("--all", action="store_true", help="Check all entities")
    parser.add_argument("--broken-only", action="store_true", help="Show only broken chains")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    args = parser.parse_args()

    detector = MissingLinkDetector(verbose=args.verbose)

    if args.ku:
        result = detector.detect_ku_links(args.ku)
        if args.json:
            print(json.dumps(result.to_dict(), indent=2))
        else:
            print(f"Knowledge Unit: {args.ku}")
            print(f"  Total Links: {result.total_links}")
            print(f"  Valid Links: {result.valid_links}")
            print(f"  Broken Links: {result.broken_links}")
            print(f"  Chain Complete: {result.chain_complete}")
            if result.missing_links:
                print("\n  Missing Links:")
                for ml in result.missing_links:
                    print(f"    - {ml.link_type.value}: {ml.target_id}")
                    print(f"      Error: {ml.error_message}")

    elif args.ru:
        result = detector.detect_ru_links(args.ru)
        if args.json:
            print(json.dumps(result.to_dict(), indent=2))
        else:
            print(f"Reasoning Unit: {args.ru}")
            print(f"  Total Links: {result.total_links}")
            print(f"  Valid Links: {result.valid_links}")
            print(f"  Broken Links: {result.broken_links}")
            print(f"  Chain Complete: {result.chain_complete}")
            if result.missing_links:
                print("\n  Missing Links:")
                for ml in result.missing_links:
                    print(f"    - {ml.link_type.value}: {ml.target_id}")
                    print(f"      Error: {ml.error_message}")

    elif args.broken_only:
        broken = detector.get_broken_chains()
        if args.json:
            print(json.dumps(broken, indent=2))
        else:
            print(f"Found {len(broken)} entities with broken chains:\n")
            for item in broken:
                print(f"  {item['entity_type']}: {item['entity_id']}")
                print(f"    Broken links: {item['broken_links']}")
                for ml in item['missing'][:3]:
                    print(f"      - {ml['link_type']}: {ml['target_id']}")

    elif args.all:
        summary = detector.detect_all()
        if args.json:
            print(json.dumps(summary.to_dict(), indent=2))
        else:
            print("Missing Link Detection Summary")
            print("=" * 40)
            print(f"Total Entities:        {summary.total_entities}")
            print(f"Entities with Issues:  {summary.entities_with_issues}")
            print(f"Total Links Checked:   {summary.total_links_checked}")
            print(f"Total Broken Links:    {summary.total_broken_links}")
            print(f"Integrity Score:       {summary.integrity_score}%")

            if summary.by_link_type:
                print("\nBy Link Type:")
                for lt, counts in summary.by_link_type.items():
                    print(f"  {lt}: {counts['broken']} broken")

            if summary.critical_breaks:
                print(f"\nCritical Breaks ({len(summary.critical_breaks)}):")
                for cb in summary.critical_breaks[:5]:
                    print(f"  - {cb.source_id} -> {cb.target_id}")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
