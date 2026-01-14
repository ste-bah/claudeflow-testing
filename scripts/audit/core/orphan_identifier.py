#!/usr/bin/env python3
"""
Phase 16 Week 2: Orphan Identifier

Detects unreferenced and isolated entities:
- Chunks not referenced by any KU
- KUs not referenced by any RU
- PDFs in corpus not used by any chunk
- Isolated nodes in the knowledge graph

Usage:
    python scripts/audit/core/orphan_identifier.py --all --json
    python scripts/audit/core/orphan_identifier.py --chunks
    python scripts/audit/core/orphan_identifier.py --kus
    python scripts/audit/core/orphan_identifier.py --pdfs
"""

import json
import sys
import argparse
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Set, Any, Optional
from enum import Enum
from datetime import datetime
from collections import defaultdict

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT_ROOT))

try:
    import chromadb
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False

from explore.core.artifact_loader import ArtifactLoader


class OrphanType(Enum):
    """Type of orphaned entity."""
    ORPHAN_CHUNK = "orphan_chunk"
    ORPHAN_KU = "orphan_ku"
    ORPHAN_PDF = "orphan_pdf"
    ISOLATED_CLUSTER = "isolated_cluster"


class OrphanSeverity(Enum):
    """Severity of orphan issue."""
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass
class OrphanEntity:
    """Represents an orphaned entity in the knowledge base."""
    orphan_type: OrphanType
    entity_id: str
    entity_path: Optional[str] = None
    severity: OrphanSeverity = OrphanSeverity.LOW
    metadata: Dict[str, Any] = field(default_factory=dict)
    recommendation: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "orphan_type": self.orphan_type.value,
            "entity_id": self.entity_id,
            "entity_path": self.entity_path,
            "severity": self.severity.value,
            "metadata": self.metadata,
            "recommendation": self.recommendation
        }


@dataclass
class OrphanReport:
    """Report for a specific orphan type."""
    orphan_type: OrphanType
    total_entities: int
    orphan_count: int
    utilization_rate: float
    orphans: List[OrphanEntity] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "orphan_type": self.orphan_type.value,
            "total_entities": self.total_entities,
            "orphan_count": self.orphan_count,
            "utilization_rate": self.utilization_rate,
            "orphans": [o.to_dict() for o in self.orphans]
        }


@dataclass
class OrphanSummary:
    """Summary of all orphan detection."""
    total_orphans: int
    by_type: Dict[str, int] = field(default_factory=dict)
    by_severity: Dict[str, int] = field(default_factory=dict)
    overall_utilization: float = 100.0
    reports: Dict[str, OrphanReport] = field(default_factory=dict)
    detected_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_orphans": self.total_orphans,
            "by_type": self.by_type,
            "by_severity": self.by_severity,
            "overall_utilization": self.overall_utilization,
            "reports": {k: v.to_dict() for k, v in self.reports.items()},
            "detected_at": self.detected_at
        }


class OrphanIdentifier:
    """
    Identifies orphaned and unreferenced entities in the knowledge base.

    Detects:
    - Chunks not used by any KU
    - KUs not referenced by any RU
    - PDFs not represented in ChromaDB
    - Isolated knowledge clusters
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
        self.chunk_to_kus: Dict[str, Set[str]] = defaultdict(set)
        self.ku_to_rus: Dict[str, Set[str]] = defaultdict(set)
        self.pdf_to_chunks: Dict[str, Set[str]] = defaultdict(set)
        self._build_reference_maps()

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

    def _build_reference_maps(self):
        """Build maps of references between entities."""
        # KU sources → chunks
        for ku_id, ku in self.kus.items():
            for source in ku.sources:
                chunk_id = source.chunk_id
                path_rel = source.path_rel
                if chunk_id:
                    self.chunk_to_kus[chunk_id].add(ku_id)
                if path_rel:
                    self.pdf_to_chunks[path_rel].add(chunk_id or f"unknown_{ku_id}")

        # RU knowledge_ids → KUs
        for ru_id, ru in self.rus.items():
            for ku_id in (ru.knowledge_ids or []):
                self.ku_to_rus[ku_id].add(ru_id)

    def find_orphan_chunks(self) -> OrphanReport:
        """
        Find chunks in ChromaDB not referenced by any KU.

        These chunks exist in the vector database but aren't used
        in any knowledge unit, representing wasted storage.
        """
        orphans: List[OrphanEntity] = []

        if not self.collection:
            return OrphanReport(
                orphan_type=OrphanType.ORPHAN_CHUNK,
                total_entities=0,
                orphan_count=0,
                utilization_rate=100.0
            )

        # Get all chunk IDs
        try:
            result = self.collection.get(include=["metadatas"])
            all_chunks = result.get("ids", [])
            metadatas = result.get("metadatas", [])
        except Exception as e:
            if self.verbose:
                print(f"Error getting chunks: {e}", file=sys.stderr)
            return OrphanReport(
                orphan_type=OrphanType.ORPHAN_CHUNK,
                total_entities=0,
                orphan_count=0,
                utilization_rate=100.0
            )

        referenced_chunks = set(self.chunk_to_kus.keys())

        for i, chunk_id in enumerate(all_chunks):
            if chunk_id not in referenced_chunks:
                meta = metadatas[i] if i < len(metadatas) else {}
                orphans.append(OrphanEntity(
                    orphan_type=OrphanType.ORPHAN_CHUNK,
                    entity_id=chunk_id,
                    entity_path=meta.get("path_rel"),
                    severity=OrphanSeverity.LOW,
                    metadata={
                        "doc_id": meta.get("doc_id"),
                        "page_start": meta.get("page_start"),
                        "page_end": meta.get("page_end"),
                        "title": meta.get("title_raw")
                    },
                    recommendation="Consider creating KU for this content or remove unused chunk"
                ))

        total = len(all_chunks)
        orphan_count = len(orphans)
        utilization = ((total - orphan_count) / total * 100) if total > 0 else 100.0

        return OrphanReport(
            orphan_type=OrphanType.ORPHAN_CHUNK,
            total_entities=total,
            orphan_count=orphan_count,
            utilization_rate=round(utilization, 2),
            orphans=orphans
        )

    def find_orphan_kus(self) -> OrphanReport:
        """
        Find KUs not referenced by any RU.

        These knowledge units exist but aren't connected to any
        reasoning, meaning they won't appear in answers.
        """
        orphans: List[OrphanEntity] = []
        referenced_kus = set(self.ku_to_rus.keys())

        for ku_id, ku in self.kus.items():
            if ku_id not in referenced_kus:
                # Get source info for context
                source_paths = [s.path_rel for s in ku.sources if s.path_rel]

                orphans.append(OrphanEntity(
                    orphan_type=OrphanType.ORPHAN_KU,
                    entity_id=ku_id,
                    entity_path=source_paths[0] if source_paths else None,
                    severity=OrphanSeverity.MEDIUM,
                    metadata={
                        "claim_preview": ku.claim[:100] if ku.claim else "",
                        "source_count": len(ku.sources),
                        "confidence": ku.confidence,
                        "tags": ku.tags
                    },
                    recommendation="Create reasoning unit to connect this knowledge or review for removal"
                ))

        total = len(self.kus)
        orphan_count = len(orphans)
        utilization = ((total - orphan_count) / total * 100) if total > 0 else 100.0

        return OrphanReport(
            orphan_type=OrphanType.ORPHAN_KU,
            total_entities=total,
            orphan_count=orphan_count,
            utilization_rate=round(utilization, 2),
            orphans=orphans
        )

    def find_orphan_pdfs(self) -> OrphanReport:
        """
        Find PDFs in corpus not represented in ChromaDB.

        These PDFs exist in the corpus directory but haven't been
        ingested, meaning they're not searchable.
        """
        orphans: List[OrphanEntity] = []

        # Get all PDFs from corpus
        corpus_dir = PROJECT_ROOT / "corpus"
        if not corpus_dir.exists():
            return OrphanReport(
                orphan_type=OrphanType.ORPHAN_PDF,
                total_entities=0,
                orphan_count=0,
                utilization_rate=100.0
            )

        all_pdfs = list(corpus_dir.rglob("*.pdf"))

        # Get indexed PDFs from ChromaDB
        indexed_paths: Set[str] = set()
        if self.collection:
            try:
                result = self.collection.get(include=["metadatas"])
                for meta in result.get("metadatas", []):
                    if meta:
                        path = meta.get("path_rel") or meta.get("path_abs")
                        if path:
                            indexed_paths.add(path)
                            # Normalize path variants
                            indexed_paths.add(Path(path).name)
                            if "corpus/" in path:
                                indexed_paths.add(path.replace("corpus/", ""))
            except Exception:
                pass

        for pdf_path in all_pdfs:
            rel_path = str(pdf_path.relative_to(PROJECT_ROOT))
            name = pdf_path.name

            # Skip Zone.Identifier files (Windows metadata)
            if ":Zone.Identifier" in name:
                continue

            # Check if indexed
            is_indexed = (
                rel_path in indexed_paths or
                name in indexed_paths or
                str(pdf_path.relative_to(corpus_dir)) in indexed_paths
            )

            if not is_indexed:
                # Check file size
                try:
                    size_mb = pdf_path.stat().st_size / (1024 * 1024)
                except Exception:
                    size_mb = 0

                orphans.append(OrphanEntity(
                    orphan_type=OrphanType.ORPHAN_PDF,
                    entity_id=name,
                    entity_path=rel_path,
                    severity=OrphanSeverity.HIGH if size_mb > 1 else OrphanSeverity.MEDIUM,
                    metadata={
                        "size_mb": round(size_mb, 2),
                        "directory": str(pdf_path.parent.relative_to(corpus_dir))
                    },
                    recommendation="Run ingestion pipeline on this PDF to make it searchable"
                ))

        total = len([p for p in all_pdfs if ":Zone.Identifier" not in p.name])
        orphan_count = len(orphans)
        utilization = ((total - orphan_count) / total * 100) if total > 0 else 100.0

        return OrphanReport(
            orphan_type=OrphanType.ORPHAN_PDF,
            total_entities=total,
            orphan_count=orphan_count,
            utilization_rate=round(utilization, 2),
            orphans=orphans
        )

    def find_isolated_clusters(self) -> OrphanReport:
        """
        Find clusters of KUs that are isolated from the main graph.

        These are groups of KUs connected to each other via RUs
        but not connected to the broader knowledge graph.
        """
        orphans: List[OrphanEntity] = []

        # Build adjacency graph from RUs
        ku_connections: Dict[str, Set[str]] = defaultdict(set)
        for ru in self.rus.values():
            ku_ids = ru.knowledge_ids or []
            for i, ku_id in enumerate(ku_ids):
                for other_ku_id in ku_ids[i+1:]:
                    ku_connections[ku_id].add(other_ku_id)
                    ku_connections[other_ku_id].add(ku_id)

        # Find connected components using BFS
        visited: Set[str] = set()
        clusters: List[Set[str]] = []

        for ku_id in self.kus:
            if ku_id in visited:
                continue

            # BFS to find cluster
            cluster: Set[str] = set()
            queue = [ku_id]

            while queue:
                current = queue.pop(0)
                if current in visited:
                    continue
                visited.add(current)
                cluster.add(current)

                for neighbor in ku_connections.get(current, []):
                    if neighbor not in visited:
                        queue.append(neighbor)

            if cluster:
                clusters.append(cluster)

        # Sort clusters by size
        clusters.sort(key=len, reverse=True)

        # Largest cluster is "main", others are potentially isolated
        if len(clusters) > 1:
            main_cluster_size = len(clusters[0])

            for i, cluster in enumerate(clusters[1:], 1):
                # Small clusters relative to main are isolated
                if len(cluster) < main_cluster_size * 0.1:
                    ku_ids_list = list(cluster)
                    topics = set()
                    for ku_id in ku_ids_list[:5]:
                        if ku_id in self.kus:
                            for tag in (self.kus[ku_id].tags or []):
                                topics.add(tag)

                    orphans.append(OrphanEntity(
                        orphan_type=OrphanType.ISOLATED_CLUSTER,
                        entity_id=f"cluster_{i}",
                        severity=OrphanSeverity.MEDIUM,
                        metadata={
                            "size": len(cluster),
                            "ku_ids": ku_ids_list[:10],
                            "topics": list(topics)[:5]
                        },
                        recommendation="Consider connecting this cluster to main knowledge graph"
                    ))

        total_clusters = len(clusters)
        isolated_count = len(orphans)

        return OrphanReport(
            orphan_type=OrphanType.ISOLATED_CLUSTER,
            total_entities=total_clusters,
            orphan_count=isolated_count,
            utilization_rate=100.0 if isolated_count == 0 else round(
                (total_clusters - isolated_count) / total_clusters * 100, 2
            ),
            orphans=orphans
        )

    def identify_all(self) -> OrphanSummary:
        """Run complete orphan identification across all entity types."""
        chunk_report = self.find_orphan_chunks()
        ku_report = self.find_orphan_kus()
        pdf_report = self.find_orphan_pdfs()
        cluster_report = self.find_isolated_clusters()

        # Aggregate counts
        total_orphans = (
            chunk_report.orphan_count +
            ku_report.orphan_count +
            pdf_report.orphan_count +
            cluster_report.orphan_count
        )

        by_type = {
            OrphanType.ORPHAN_CHUNK.value: chunk_report.orphan_count,
            OrphanType.ORPHAN_KU.value: ku_report.orphan_count,
            OrphanType.ORPHAN_PDF.value: pdf_report.orphan_count,
            OrphanType.ISOLATED_CLUSTER.value: cluster_report.orphan_count
        }

        # Count by severity
        by_severity: Dict[str, int] = defaultdict(int)
        for report in [chunk_report, ku_report, pdf_report, cluster_report]:
            for orphan in report.orphans:
                by_severity[orphan.severity.value] += 1

        # Calculate overall utilization (weighted average)
        total_entities = (
            chunk_report.total_entities +
            ku_report.total_entities +
            pdf_report.total_entities
        )
        if total_entities > 0:
            weighted_util = (
                (chunk_report.total_entities - chunk_report.orphan_count) +
                (ku_report.total_entities - ku_report.orphan_count) +
                (pdf_report.total_entities - pdf_report.orphan_count)
            ) / total_entities * 100
        else:
            weighted_util = 100.0

        return OrphanSummary(
            total_orphans=total_orphans,
            by_type=dict(by_type),
            by_severity=dict(by_severity),
            overall_utilization=round(weighted_util, 2),
            reports={
                "chunks": chunk_report,
                "kus": ku_report,
                "pdfs": pdf_report,
                "clusters": cluster_report
            }
        )


def main():
    parser = argparse.ArgumentParser(description="Identify orphaned entities in knowledge base")
    parser.add_argument("--chunks", action="store_true", help="Find orphan chunks")
    parser.add_argument("--kus", action="store_true", help="Find orphan knowledge units")
    parser.add_argument("--pdfs", action="store_true", help="Find orphan PDFs")
    parser.add_argument("--clusters", action="store_true", help="Find isolated clusters")
    parser.add_argument("--all", action="store_true", help="Run all orphan detection")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    args = parser.parse_args()

    identifier = OrphanIdentifier(verbose=args.verbose)

    if args.chunks:
        report = identifier.find_orphan_chunks()
        if args.json:
            print(json.dumps(report.to_dict(), indent=2))
        else:
            print(f"Orphan Chunks Report")
            print("=" * 40)
            print(f"Total Chunks:      {report.total_entities}")
            print(f"Orphan Count:      {report.orphan_count}")
            print(f"Utilization Rate:  {report.utilization_rate}%")
            if report.orphans:
                print(f"\nOrphans ({len(report.orphans)}):")
                for o in report.orphans[:10]:
                    print(f"  - {o.entity_id}")
                    if o.entity_path:
                        print(f"    Path: {o.entity_path}")

    elif args.kus:
        report = identifier.find_orphan_kus()
        if args.json:
            print(json.dumps(report.to_dict(), indent=2))
        else:
            print(f"Orphan KUs Report")
            print("=" * 40)
            print(f"Total KUs:         {report.total_entities}")
            print(f"Orphan Count:      {report.orphan_count}")
            print(f"Utilization Rate:  {report.utilization_rate}%")
            if report.orphans:
                print(f"\nOrphans ({len(report.orphans)}):")
                for o in report.orphans[:10]:
                    print(f"  - {o.entity_id}")
                    preview = o.metadata.get("claim_preview", "")
                    if preview:
                        print(f"    Claim: {preview[:60]}...")

    elif args.pdfs:
        report = identifier.find_orphan_pdfs()
        if args.json:
            print(json.dumps(report.to_dict(), indent=2))
        else:
            print(f"Orphan PDFs Report")
            print("=" * 40)
            print(f"Total PDFs:        {report.total_entities}")
            print(f"Orphan Count:      {report.orphan_count}")
            print(f"Utilization Rate:  {report.utilization_rate}%")
            if report.orphans:
                print(f"\nOrphans ({len(report.orphans)}):")
                for o in report.orphans[:10]:
                    print(f"  - {o.entity_id}")
                    print(f"    Size: {o.metadata.get('size_mb', 0)} MB")

    elif args.clusters:
        report = identifier.find_isolated_clusters()
        if args.json:
            print(json.dumps(report.to_dict(), indent=2))
        else:
            print(f"Isolated Clusters Report")
            print("=" * 40)
            print(f"Total Clusters:    {report.total_entities}")
            print(f"Isolated Count:    {report.orphan_count}")
            if report.orphans:
                print(f"\nIsolated Clusters:")
                for o in report.orphans[:5]:
                    print(f"  - {o.entity_id}: {o.metadata.get('size', 0)} KUs")
                    topics = o.metadata.get('topics', [])
                    if topics:
                        print(f"    Topics: {', '.join(topics)}")

    elif args.all:
        summary = identifier.identify_all()
        if args.json:
            print(json.dumps(summary.to_dict(), indent=2))
        else:
            print("Orphan Identification Summary")
            print("=" * 40)
            print(f"Total Orphans:         {summary.total_orphans}")
            print(f"Overall Utilization:   {summary.overall_utilization}%")
            print("\nBy Type:")
            for otype, count in summary.by_type.items():
                print(f"  {otype}: {count}")
            print("\nBy Severity:")
            for sev, count in summary.by_severity.items():
                print(f"  {sev}: {count}")
            print("\nReport Details:")
            for name, report in summary.reports.items():
                print(f"  {name}: {report.orphan_count}/{report.total_entities} orphans ({report.utilization_rate}% util)")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
