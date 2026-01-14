#!/usr/bin/env python3
"""
Provenance Chain Tracer - Full end-to-end provenance tracking

Traces provenance chains:
  Answer → Reasoning Unit → Knowledge Unit(s) → Chunk(s) → PDF Pages → Original Bytes

Features:
- Complete chain resolution from any node
- Bidirectional traversal (forward and backward)
- Chain validation with completeness checking
- SHA-256 verification for immutability
"""

import hashlib
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Set, Any, Tuple
from datetime import datetime
from enum import Enum

# Add scripts to path
scripts_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(scripts_dir))

from explore.core.artifact_loader import (
    ArtifactLoader,
    KnowledgeUnit,
    ReasoningUnit,
    Source
)


class NodeType(Enum):
    """Types of nodes in the provenance chain."""
    ANSWER = "answer"
    REASONING_UNIT = "reasoning_unit"
    KNOWLEDGE_UNIT = "knowledge_unit"
    CHUNK = "chunk"
    PDF_PAGE = "pdf_page"
    PDF_FILE = "pdf_file"


class ChainStatus(Enum):
    """Status of a provenance chain."""
    COMPLETE = "complete"
    PARTIAL = "partial"
    BROKEN = "broken"
    UNVERIFIED = "unverified"


@dataclass
class ProvenanceNode:
    """A single node in the provenance chain."""
    node_type: NodeType
    node_id: str
    data: Dict[str, Any] = field(default_factory=dict)
    children: List['ProvenanceNode'] = field(default_factory=list)
    parent: Optional['ProvenanceNode'] = None
    verified: bool = False
    verification_details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert node to dictionary (non-recursive to avoid cycles)."""
        return {
            "node_type": self.node_type.value,
            "node_id": self.node_id,
            "data": self.data,
            "verified": self.verified,
            "verification_details": self.verification_details,
            "children_count": len(self.children)
        }


@dataclass
class ProvenanceChain:
    """Complete provenance chain from origin to source."""
    chain_id: str
    root: ProvenanceNode
    status: ChainStatus = ChainStatus.UNVERIFIED
    depth: int = 0
    node_count: int = 0
    issues: List[str] = field(default_factory=list)
    traced_at: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")

    def get_all_nodes(self) -> List[ProvenanceNode]:
        """Get all nodes in the chain via BFS."""
        nodes = []
        queue = [self.root]

        while queue:
            node = queue.pop(0)
            nodes.append(node)
            queue.extend(node.children)

        return nodes

    def get_nodes_by_type(self, node_type: NodeType) -> List[ProvenanceNode]:
        """Get all nodes of a specific type."""
        return [n for n in self.get_all_nodes() if n.node_type == node_type]

    def to_dict(self) -> Dict[str, Any]:
        """Convert chain to dictionary."""
        def node_to_dict_recursive(node: ProvenanceNode) -> Dict[str, Any]:
            d = node.to_dict()
            d["children"] = [node_to_dict_recursive(c) for c in node.children]
            return d

        return {
            "chain_id": self.chain_id,
            "status": self.status.value,
            "depth": self.depth,
            "node_count": self.node_count,
            "issues": self.issues,
            "traced_at": self.traced_at,
            "root": node_to_dict_recursive(self.root)
        }


class ProvenanceTracer:
    """
    Traces provenance chains through the full artifact hierarchy.

    Provenance Chain Structure:
    - Answer (optional, from Phase 9)
      └── Reasoning Unit (from Phase 7)
          └── Knowledge Unit (from Phase 6)
              └── Chunk (from Phase 4)
                  └── PDF Page (from Phase 1-3)
                      └── PDF File (original document)
    """

    def __init__(
        self,
        project_root: Optional[Path] = None,
        corpus_path: Optional[Path] = None
    ):
        """
        Initialize provenance tracer.

        Args:
            project_root: Project root directory
            corpus_path: Path to corpus directory with PDFs
        """
        if project_root is None:
            project_root = Path(__file__).parent.parent.parent.parent

        self.project_root = Path(project_root)

        if corpus_path is None:
            corpus_path = self.project_root / "corpus"

        self.corpus_path = Path(corpus_path)
        self.loader = ArtifactLoader(self.project_root)

        # Cache for traced chains
        self._chain_cache: Dict[str, ProvenanceChain] = {}

    # ========================
    # Chain Tracing - Forward (Root to Leaves)
    # ========================

    def trace_from_ru(self, ru_id: str) -> ProvenanceChain:
        """
        Trace provenance chain starting from a reasoning unit.

        Args:
            ru_id: Reasoning unit ID

        Returns:
            Complete provenance chain
        """
        cache_key = f"ru:{ru_id}"
        if cache_key in self._chain_cache:
            return self._chain_cache[cache_key]

        ru = self.loader.get_ru(ru_id)
        if ru is None:
            return self._create_broken_chain(
                f"ru:{ru_id}",
                f"Reasoning unit not found: {ru_id}"
            )

        # Create root node
        root = ProvenanceNode(
            node_type=NodeType.REASONING_UNIT,
            node_id=ru_id,
            data={
                "relation": ru.relation,
                "topic": ru.topic,
                "score": ru.score,
                "hash": ru.hash,
                "knowledge_ids": ru.knowledge_ids
            }
        )

        # Trace to knowledge units
        depth = 1
        for ku_id in ru.knowledge_ids:
            ku_node = self._trace_ku_node(ku_id)
            ku_node.parent = root
            root.children.append(ku_node)
            depth = max(depth, self._get_node_depth(ku_node) + 1)

        # Build chain
        chain = ProvenanceChain(
            chain_id=cache_key,
            root=root,
            depth=depth,
            node_count=self._count_nodes(root)
        )

        # Validate chain
        chain = self._validate_chain(chain)

        self._chain_cache[cache_key] = chain
        return chain

    def trace_from_ku(self, ku_id: str) -> ProvenanceChain:
        """
        Trace provenance chain starting from a knowledge unit.

        Args:
            ku_id: Knowledge unit ID

        Returns:
            Complete provenance chain
        """
        cache_key = f"ku:{ku_id}"
        if cache_key in self._chain_cache:
            return self._chain_cache[cache_key]

        root = self._trace_ku_node(ku_id)

        chain = ProvenanceChain(
            chain_id=cache_key,
            root=root,
            depth=self._get_node_depth(root),
            node_count=self._count_nodes(root)
        )

        chain = self._validate_chain(chain)

        self._chain_cache[cache_key] = chain
        return chain

    def _trace_ku_node(self, ku_id: str) -> ProvenanceNode:
        """Trace a knowledge unit node and its children."""
        ku = self.loader.get_ku(ku_id)
        if ku is None:
            return ProvenanceNode(
                node_type=NodeType.KNOWLEDGE_UNIT,
                node_id=ku_id,
                data={"error": "Knowledge unit not found"},
                verified=False
            )

        node = ProvenanceNode(
            node_type=NodeType.KNOWLEDGE_UNIT,
            node_id=ku_id,
            data={
                "claim": ku.claim,
                "confidence": ku.confidence,
                "tags": ku.tags,
                "created_from_query": ku.created_from_query,
                "source_count": len(ku.sources)
            }
        )

        # Trace to chunks
        for source in ku.sources:
            chunk_node = self._trace_chunk_node(source)
            chunk_node.parent = node
            node.children.append(chunk_node)

        return node

    def _trace_chunk_node(self, source: Source) -> ProvenanceNode:
        """Trace a chunk node from a source reference."""
        node = ProvenanceNode(
            node_type=NodeType.CHUNK,
            node_id=source.chunk_id,
            data={
                "author": source.author,
                "title": source.title,
                "path_rel": source.path_rel,
                "pages": source.pages
            }
        )

        # Trace to PDF page
        pdf_page_node = self._trace_pdf_page_node(source)
        pdf_page_node.parent = node
        node.children.append(pdf_page_node)

        return node

    def _trace_pdf_page_node(self, source: Source) -> ProvenanceNode:
        """Trace a PDF page node."""
        node = ProvenanceNode(
            node_type=NodeType.PDF_PAGE,
            node_id=f"{source.path_rel}:{source.pages}",
            data={
                "path_rel": source.path_rel,
                "pages": source.pages
            }
        )

        # Trace to PDF file
        pdf_file_node = self._trace_pdf_file_node(source.path_rel)
        pdf_file_node.parent = node
        node.children.append(pdf_file_node)

        return node

    def _trace_pdf_file_node(self, path_rel: str) -> ProvenanceNode:
        """Trace a PDF file node with hash verification."""
        pdf_path = self._resolve_pdf_path(path_rel)

        node = ProvenanceNode(
            node_type=NodeType.PDF_FILE,
            node_id=path_rel,
            data={
                "path_rel": path_rel,
                "resolved_path": str(pdf_path) if pdf_path else None,
                "exists": pdf_path is not None and pdf_path.exists()
            }
        )

        # Compute SHA-256 if file exists
        if pdf_path and pdf_path.exists():
            try:
                sha256 = self._compute_file_hash(pdf_path)
                node.data["sha256"] = sha256
                node.data["file_size"] = pdf_path.stat().st_size
                node.verified = True
                node.verification_details = {
                    "hash_algorithm": "sha256",
                    "hash_value": sha256,
                    "verified_at": datetime.utcnow().isoformat() + "Z"
                }
            except Exception as e:
                node.data["hash_error"] = str(e)
                node.verified = False

        return node

    def _resolve_pdf_path(self, path_rel: str) -> Optional[Path]:
        """Resolve relative path to absolute PDF path."""
        # Try corpus directory
        pdf_path = self.corpus_path / path_rel
        if pdf_path.exists():
            return pdf_path

        # Try project root
        pdf_path = self.project_root / path_rel
        if pdf_path.exists():
            return pdf_path

        # Try common subdirectories
        for subdir in ["rhetorical_ontology", "documents", "pdfs"]:
            pdf_path = self.corpus_path / subdir / Path(path_rel).name
            if pdf_path.exists():
                return pdf_path

        return None

    def _compute_file_hash(self, file_path: Path) -> str:
        """Compute SHA-256 hash of a file."""
        sha256 = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                sha256.update(chunk)
        return sha256.hexdigest()

    # ========================
    # Chain Tracing - Backward (Leaves to Root)
    # ========================

    def trace_backward_from_chunk(self, chunk_id: str) -> List[ProvenanceChain]:
        """
        Trace all provenance chains that reference a chunk.

        Args:
            chunk_id: Chunk ID to trace from

        Returns:
            List of chains that include this chunk
        """
        chains = []

        # Find all KUs that reference this chunk
        kus = self.loader.get_kus_by_chunk(chunk_id)

        for ku in kus:
            # Find all RUs that reference this KU
            rus = self.loader.get_rus_for_ku(ku.id)

            if rus:
                # Trace from each RU
                for ru in rus:
                    chain = self.trace_from_ru(ru.reason_id)
                    chains.append(chain)
            else:
                # Just trace from KU
                chain = self.trace_from_ku(ku.id)
                chains.append(chain)

        return chains

    def trace_backward_from_pdf(self, path_rel: str) -> List[ProvenanceChain]:
        """
        Trace all provenance chains that reference a PDF.

        Args:
            path_rel: Relative path to PDF

        Returns:
            List of chains that include this PDF
        """
        chains = []

        # Find all KUs that reference this document
        kus = self.loader.get_kus_by_document(path_rel)

        for ku in kus:
            chain = self.trace_from_ku(ku.id)
            chains.append(chain)

        return chains

    # ========================
    # Chain Validation
    # ========================

    def _validate_chain(self, chain: ProvenanceChain) -> ProvenanceChain:
        """
        Validate a provenance chain for completeness.

        Checks:
        - All nodes have required data
        - All file references exist
        - All hashes are computable
        - No broken links
        """
        issues = []
        all_verified = True

        for node in chain.get_all_nodes():
            # Check for errors in data
            if "error" in node.data:
                issues.append(f"{node.node_type.value}:{node.node_id} - {node.data['error']}")
                all_verified = False

            # Check file existence for PDF nodes
            if node.node_type == NodeType.PDF_FILE:
                if not node.data.get("exists", False):
                    issues.append(f"PDF file not found: {node.node_id}")
                    all_verified = False
                elif not node.verified:
                    issues.append(f"PDF hash not verified: {node.node_id}")
                    all_verified = False

        # Determine chain status
        if not issues:
            chain.status = ChainStatus.COMPLETE
        elif all_verified:
            chain.status = ChainStatus.PARTIAL
        else:
            chain.status = ChainStatus.BROKEN if len(issues) > chain.node_count / 2 else ChainStatus.PARTIAL

        chain.issues = issues
        return chain

    # ========================
    # Utility Methods
    # ========================

    def _get_node_depth(self, node: ProvenanceNode) -> int:
        """Get depth of a node (max distance to any leaf)."""
        if not node.children:
            return 1
        return 1 + max(self._get_node_depth(c) for c in node.children)

    def _count_nodes(self, node: ProvenanceNode) -> int:
        """Count total nodes in subtree."""
        return 1 + sum(self._count_nodes(c) for c in node.children)

    def _create_broken_chain(self, chain_id: str, error: str) -> ProvenanceChain:
        """Create a broken chain for error cases."""
        root = ProvenanceNode(
            node_type=NodeType.REASONING_UNIT,
            node_id=chain_id,
            data={"error": error},
            verified=False
        )

        return ProvenanceChain(
            chain_id=chain_id,
            root=root,
            status=ChainStatus.BROKEN,
            depth=1,
            node_count=1,
            issues=[error]
        )

    # ========================
    # Batch Operations
    # ========================

    def trace_all_rus(self) -> Dict[str, ProvenanceChain]:
        """Trace provenance for all reasoning units."""
        chains = {}
        rus = self.loader.get_all_rus()

        for ru_id in rus:
            chains[ru_id] = self.trace_from_ru(ru_id)

        return chains

    def trace_all_kus(self) -> Dict[str, ProvenanceChain]:
        """Trace provenance for all knowledge units."""
        chains = {}
        kus = self.loader.get_all_kus()

        for ku_id in kus:
            chains[ku_id] = self.trace_from_ku(ku_id)

        return chains

    def get_chain_summary(self, chains: Dict[str, ProvenanceChain]) -> Dict[str, Any]:
        """Get summary statistics for a set of chains."""
        status_counts = {s.value: 0 for s in ChainStatus}
        total_nodes = 0
        total_depth = 0
        total_issues = 0

        for chain in chains.values():
            status_counts[chain.status.value] += 1
            total_nodes += chain.node_count
            total_depth += chain.depth
            total_issues += len(chain.issues)

        return {
            "total_chains": len(chains),
            "by_status": status_counts,
            "total_nodes": total_nodes,
            "avg_depth": total_depth / len(chains) if chains else 0,
            "total_issues": total_issues,
            "complete_pct": (status_counts[ChainStatus.COMPLETE.value] / len(chains) * 100)
                           if chains else 0
        }

    # ========================
    # Reporting
    # ========================

    def format_chain_report(self, chain: ProvenanceChain) -> str:
        """Format a chain as human-readable report."""
        lines = []
        lines.append(f"Provenance Chain: {chain.chain_id}")
        lines.append("=" * 60)
        lines.append(f"Status: {chain.status.value.upper()}")
        lines.append(f"Depth: {chain.depth}")
        lines.append(f"Nodes: {chain.node_count}")
        lines.append(f"Traced: {chain.traced_at}")
        lines.append("")

        # Tree visualization
        lines.append("Chain Structure:")
        lines.append("-" * 40)

        def print_node(node: ProvenanceNode, indent: int = 0):
            prefix = "  " * indent
            status = "✓" if node.verified else "✗"
            lines.append(f"{prefix}[{status}] {node.node_type.value}: {node.node_id}")

            # Show key data
            for key in ["claim", "relation", "pages", "sha256"]:
                if key in node.data:
                    value = node.data[key]
                    if isinstance(value, str) and len(value) > 50:
                        value = value[:50] + "..."
                    lines.append(f"{prefix}    {key}: {value}")

            for child in node.children:
                print_node(child, indent + 1)

        print_node(chain.root)

        # Issues
        if chain.issues:
            lines.append("")
            lines.append(f"Issues ({len(chain.issues)}):")
            lines.append("-" * 40)
            for issue in chain.issues[:10]:
                lines.append(f"  - {issue}")
            if len(chain.issues) > 10:
                lines.append(f"  ... and {len(chain.issues) - 10} more")

        return "\n".join(lines)


def main():
    """CLI entry point for provenance tracer."""
    import argparse

    parser = argparse.ArgumentParser(description="Trace provenance chains")
    parser.add_argument("--ru", type=str, help="Trace from reasoning unit ID")
    parser.add_argument("--ku", type=str, help="Trace from knowledge unit ID")
    parser.add_argument("--all-rus", action="store_true", help="Trace all reasoning units")
    parser.add_argument("--all-kus", action="store_true", help="Trace all knowledge units")
    parser.add_argument("--json", action="store_true", help="Output as JSON")

    args = parser.parse_args()

    tracer = ProvenanceTracer()

    if args.ru:
        chain = tracer.trace_from_ru(args.ru)
        if args.json:
            print(json.dumps(chain.to_dict(), indent=2))
        else:
            print(tracer.format_chain_report(chain))

    elif args.ku:
        chain = tracer.trace_from_ku(args.ku)
        if args.json:
            print(json.dumps(chain.to_dict(), indent=2))
        else:
            print(tracer.format_chain_report(chain))

    elif args.all_rus:
        chains = tracer.trace_all_rus()
        summary = tracer.get_chain_summary(chains)
        if args.json:
            print(json.dumps(summary, indent=2))
        else:
            print("Provenance Summary - All Reasoning Units")
            print("=" * 50)
            for key, value in summary.items():
                print(f"  {key}: {value}")

    elif args.all_kus:
        chains = tracer.trace_all_kus()
        summary = tracer.get_chain_summary(chains)
        if args.json:
            print(json.dumps(summary, indent=2))
        else:
            print("Provenance Summary - All Knowledge Units")
            print("=" * 50)
            for key, value in summary.items():
                print(f"  {key}: {value}")

    else:
        parser.print_help()
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
