#!/usr/bin/env python3
"""
Chunk Resolver - Resolve and validate chunk references in ChromaDB

Features:
- Chunk existence validation
- Chunk metadata extraction
- Content retrieval and verification
- Batch resolution with caching
"""

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Set, Any, Tuple
from datetime import datetime
from enum import Enum

import chromadb

# Add scripts to path
scripts_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(scripts_dir))

from explore.core.artifact_loader import ArtifactLoader, KnowledgeUnit, Source


class ResolutionStatus(Enum):
    """Status of chunk resolution."""
    RESOLVED = "resolved"
    NOT_FOUND = "not_found"
    ERROR = "error"
    METADATA_MISSING = "metadata_missing"


@dataclass
class ChunkResolution:
    """Result of resolving a single chunk."""
    chunk_id: str
    status: ResolutionStatus
    exists: bool = False
    content: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    embedding_dimension: Optional[int] = None
    error: Optional[str] = None
    resolved_at: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chunk_id": self.chunk_id,
            "status": self.status.value,
            "exists": self.exists,
            "content_length": len(self.content) if self.content else 0,
            "metadata": self.metadata,
            "embedding_dimension": self.embedding_dimension,
            "error": self.error,
            "resolved_at": self.resolved_at
        }


@dataclass
class ChunkValidation:
    """Validation result for a chunk against expected properties."""
    chunk_id: str
    valid: bool = True
    issues: List[str] = field(default_factory=list)
    expected: Dict[str, Any] = field(default_factory=dict)
    actual: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chunk_id": self.chunk_id,
            "valid": self.valid,
            "issue_count": len(self.issues),
            "issues": self.issues,
            "expected": self.expected,
            "actual": self.actual
        }


class ChunkResolver:
    """
    Resolves and validates chunk references in ChromaDB.

    Provides:
    - Chunk existence checking
    - Metadata extraction
    - Content retrieval
    - Page boundary validation
    - Batch operations with caching
    """

    def __init__(
        self,
        project_root: Optional[Path] = None,
        chroma_path: Optional[Path] = None
    ):
        """
        Initialize chunk resolver.

        Args:
            project_root: Project root directory
            chroma_path: Path to ChromaDB database
        """
        if project_root is None:
            project_root = Path(__file__).parent.parent.parent.parent

        self.project_root = Path(project_root)

        if chroma_path is None:
            chroma_path = self.project_root / "vector_db_1536"

        self.chroma_path = Path(chroma_path)
        self.loader = ArtifactLoader(self.project_root)

        # Lazy-loaded ChromaDB
        self._client: Optional[chromadb.Client] = None
        self._collection: Optional[chromadb.Collection] = None

        # Resolution cache
        self._cache: Dict[str, ChunkResolution] = {}

    def _init_chromadb(self) -> None:
        """Initialize ChromaDB client (lazy loading)."""
        if self._client is None:
            if not self.chroma_path.exists():
                raise FileNotFoundError(
                    f"ChromaDB not found at {self.chroma_path}\n"
                    "Have you run Phase 4 (chunking)?"
                )

            self._client = chromadb.PersistentClient(path=str(self.chroma_path))

            try:
                self._collection = self._client.get_collection("knowledge_chunks")
            except Exception:
                # Try alternative collection names
                collections = self._client.list_collections()
                if collections:
                    self._collection = collections[0]
                else:
                    raise ValueError("No collections found in ChromaDB")

    # ========================
    # Single Chunk Resolution
    # ========================

    def resolve_chunk(
        self,
        chunk_id: str,
        include_content: bool = True,
        include_embedding: bool = False,
        use_cache: bool = True
    ) -> ChunkResolution:
        """
        Resolve a single chunk from ChromaDB.

        Args:
            chunk_id: Chunk ID to resolve
            include_content: Include chunk text content
            include_embedding: Include embedding vector
            use_cache: Use cached results if available

        Returns:
            ChunkResolution with chunk data
        """
        # Check cache
        if use_cache and chunk_id in self._cache:
            return self._cache[chunk_id]

        self._init_chromadb()

        try:
            # Build include list
            include = ["metadatas"]
            if include_content:
                include.append("documents")
            if include_embedding:
                include.append("embeddings")

            result = self._collection.get(
                ids=[chunk_id],
                include=include
            )

            if not result['ids']:
                resolution = ChunkResolution(
                    chunk_id=chunk_id,
                    status=ResolutionStatus.NOT_FOUND,
                    exists=False
                )
            else:
                # Extract data
                metadata = result['metadatas'][0] if result.get('metadatas') else {}
                content = result['documents'][0] if result.get('documents') else None
                embedding = result['embeddings'][0] if result.get('embeddings') else None

                resolution = ChunkResolution(
                    chunk_id=chunk_id,
                    status=ResolutionStatus.RESOLVED,
                    exists=True,
                    content=content,
                    metadata=metadata,
                    embedding_dimension=len(embedding) if embedding else None
                )

                # Check for required metadata
                if not metadata:
                    resolution.status = ResolutionStatus.METADATA_MISSING

        except Exception as e:
            resolution = ChunkResolution(
                chunk_id=chunk_id,
                status=ResolutionStatus.ERROR,
                exists=False,
                error=str(e)
            )

        # Cache result
        if use_cache:
            self._cache[chunk_id] = resolution

        return resolution

    # ========================
    # Batch Resolution
    # ========================

    def resolve_chunks(
        self,
        chunk_ids: List[str],
        include_content: bool = False,
        batch_size: int = 100
    ) -> Dict[str, ChunkResolution]:
        """
        Resolve multiple chunks efficiently.

        Args:
            chunk_ids: List of chunk IDs to resolve
            include_content: Include chunk text content
            batch_size: Number of chunks per batch query

        Returns:
            Dictionary mapping chunk_id to resolution
        """
        self._init_chromadb()
        results = {}

        # Check cache first
        uncached = []
        for chunk_id in chunk_ids:
            if chunk_id in self._cache:
                results[chunk_id] = self._cache[chunk_id]
            else:
                uncached.append(chunk_id)

        # Batch resolve uncached
        for i in range(0, len(uncached), batch_size):
            batch = uncached[i:i + batch_size]

            try:
                include = ["metadatas"]
                if include_content:
                    include.append("documents")

                result = self._collection.get(
                    ids=batch,
                    include=include
                )

                # Process found chunks
                found_ids = set(result['ids'])
                for idx, chunk_id in enumerate(result['ids']):
                    metadata = result['metadatas'][idx] if result.get('metadatas') else {}
                    content = result['documents'][idx] if result.get('documents') else None

                    resolution = ChunkResolution(
                        chunk_id=chunk_id,
                        status=ResolutionStatus.RESOLVED,
                        exists=True,
                        content=content,
                        metadata=metadata
                    )

                    results[chunk_id] = resolution
                    self._cache[chunk_id] = resolution

                # Mark not found
                for chunk_id in batch:
                    if chunk_id not in found_ids:
                        resolution = ChunkResolution(
                            chunk_id=chunk_id,
                            status=ResolutionStatus.NOT_FOUND,
                            exists=False
                        )
                        results[chunk_id] = resolution
                        self._cache[chunk_id] = resolution

            except Exception as e:
                # Mark all in batch as error
                for chunk_id in batch:
                    if chunk_id not in results:
                        results[chunk_id] = ChunkResolution(
                            chunk_id=chunk_id,
                            status=ResolutionStatus.ERROR,
                            error=str(e)
                        )

        return results

    # ========================
    # Chunk Validation
    # ========================

    def validate_chunk(
        self,
        chunk_id: str,
        expected_path: Optional[str] = None,
        expected_pages: Optional[str] = None
    ) -> ChunkValidation:
        """
        Validate a chunk against expected properties.

        Args:
            chunk_id: Chunk ID to validate
            expected_path: Expected document path
            expected_pages: Expected page range

        Returns:
            ChunkValidation with validation results
        """
        validation = ChunkValidation(chunk_id=chunk_id)

        # Resolve chunk
        resolution = self.resolve_chunk(chunk_id)

        if not resolution.exists:
            validation.valid = False
            validation.issues.append(f"Chunk not found in ChromaDB")
            return validation

        metadata = resolution.metadata

        # Validate path
        if expected_path:
            validation.expected["path"] = expected_path
            actual_path = metadata.get("source") or metadata.get("path_rel") or metadata.get("file")
            validation.actual["path"] = actual_path

            if actual_path and expected_path not in actual_path and actual_path not in expected_path:
                validation.valid = False
                validation.issues.append(
                    f"Path mismatch: expected '{expected_path}', got '{actual_path}'"
                )

        # Validate pages
        if expected_pages:
            validation.expected["pages"] = expected_pages

            chunk_start = metadata.get("page_start") or metadata.get("page")
            chunk_end = metadata.get("page_end") or metadata.get("page")

            if chunk_start is not None:
                validation.actual["page_start"] = chunk_start
                validation.actual["page_end"] = chunk_end

                # Parse expected pages
                try:
                    exp_start, exp_end = self._parse_page_range(expected_pages)

                    if chunk_start is not None and chunk_end is not None:
                        # Check if expected pages are within chunk boundaries
                        if not (int(chunk_start) <= exp_start <= int(chunk_end) and
                                int(chunk_start) <= exp_end <= int(chunk_end)):
                            validation.valid = False
                            validation.issues.append(
                                f"Page range {expected_pages} outside chunk boundaries "
                                f"({chunk_start}-{chunk_end})"
                            )
                except ValueError as e:
                    validation.issues.append(f"Could not parse page range: {e}")

        return validation

    def validate_source(self, source: Source) -> ChunkValidation:
        """
        Validate a source reference.

        Args:
            source: Source object from a KnowledgeUnit

        Returns:
            ChunkValidation with validation results
        """
        return self.validate_chunk(
            chunk_id=source.chunk_id,
            expected_path=source.path_rel,
            expected_pages=source.pages
        )

    def validate_ku_sources(self, ku: KnowledgeUnit) -> List[ChunkValidation]:
        """
        Validate all sources for a knowledge unit.

        Args:
            ku: Knowledge unit to validate

        Returns:
            List of validation results for each source
        """
        return [self.validate_source(source) for source in ku.sources]

    def _parse_page_range(self, pages: str) -> Tuple[int, int]:
        """Parse page range string."""
        import re

        pages = pages.strip()

        # Single page
        if pages.isdigit():
            page = int(pages)
            return (page, page)

        # Range
        match = re.match(r'^(\d+)\s*[–-]\s*(\d+)$', pages)
        if match:
            return (int(match.group(1)), int(match.group(2)))

        # Comma
        match = re.match(r'^(\d+)\s*,\s*(\d+)$', pages)
        if match:
            return (int(match.group(1)), int(match.group(2)))

        raise ValueError(f"Invalid page format: {pages}")

    # ========================
    # Corpus-Wide Operations
    # ========================

    def resolve_all_referenced_chunks(self) -> Dict[str, ChunkResolution]:
        """
        Resolve all chunks referenced by knowledge units.

        Returns:
            Dictionary mapping chunk_id to resolution
        """
        # Collect all referenced chunk IDs
        chunk_ids = set()
        kus = self.loader.get_all_kus()

        for ku in kus.values():
            for source in ku.sources:
                chunk_ids.add(source.chunk_id)

        print(f"Resolving {len(chunk_ids)} referenced chunks...")
        return self.resolve_chunks(list(chunk_ids))

    def validate_all_sources(self) -> Dict[str, List[ChunkValidation]]:
        """
        Validate all sources across all knowledge units.

        Returns:
            Dictionary mapping ku_id to list of validations
        """
        results = {}
        kus = self.loader.get_all_kus()

        print(f"Validating sources for {len(kus)} knowledge units...")

        for ku_id, ku in kus.items():
            results[ku_id] = self.validate_ku_sources(ku)

        return results

    def get_resolution_summary(
        self,
        resolutions: Dict[str, ChunkResolution]
    ) -> Dict[str, Any]:
        """Get summary statistics for chunk resolutions."""
        status_counts = {s.value: 0 for s in ResolutionStatus}
        total_content_length = 0
        metadata_fields = set()

        for resolution in resolutions.values():
            status_counts[resolution.status.value] += 1

            if resolution.content:
                total_content_length += len(resolution.content)

            metadata_fields.update(resolution.metadata.keys())

        return {
            "total_chunks": len(resolutions),
            "by_status": status_counts,
            "resolved_count": status_counts[ResolutionStatus.RESOLVED.value],
            "not_found_count": status_counts[ResolutionStatus.NOT_FOUND.value],
            "error_count": status_counts[ResolutionStatus.ERROR.value],
            "total_content_length": total_content_length,
            "metadata_fields": list(metadata_fields),
            "resolution_rate": (
                status_counts[ResolutionStatus.RESOLVED.value] / len(resolutions) * 100
                if resolutions else 0
            )
        }

    def get_validation_summary(
        self,
        validations: Dict[str, List[ChunkValidation]]
    ) -> Dict[str, Any]:
        """Get summary statistics for validations."""
        total_validations = 0
        valid_count = 0
        invalid_count = 0
        issue_types = {}

        for ku_validations in validations.values():
            for validation in ku_validations:
                total_validations += 1

                if validation.valid:
                    valid_count += 1
                else:
                    invalid_count += 1

                for issue in validation.issues:
                    # Extract issue type
                    issue_type = issue.split(":")[0] if ":" in issue else issue[:50]
                    issue_types[issue_type] = issue_types.get(issue_type, 0) + 1

        return {
            "total_validations": total_validations,
            "valid_count": valid_count,
            "invalid_count": invalid_count,
            "validation_rate": (valid_count / total_validations * 100) if total_validations else 0,
            "issue_types": issue_types,
            "kus_checked": len(validations)
        }

    # ========================
    # Reporting
    # ========================

    def format_resolution_report(
        self,
        resolutions: Dict[str, ChunkResolution]
    ) -> str:
        """Format resolution results as human-readable report."""
        summary = self.get_resolution_summary(resolutions)

        lines = []
        lines.append("Chunk Resolution Report")
        lines.append("=" * 60)
        lines.append(f"Total Chunks: {summary['total_chunks']}")
        lines.append(f"Resolved: {summary['resolved_count']} ({summary['resolution_rate']:.1f}%)")
        lines.append(f"Not Found: {summary['not_found_count']}")
        lines.append(f"Errors: {summary['error_count']}")
        lines.append("")

        # List not found
        not_found = [r for r in resolutions.values()
                     if r.status == ResolutionStatus.NOT_FOUND]

        if not_found:
            lines.append(f"Missing Chunks ({len(not_found)}):")
            lines.append("-" * 40)
            for resolution in not_found[:10]:
                lines.append(f"  - {resolution.chunk_id}")
            if len(not_found) > 10:
                lines.append(f"  ... and {len(not_found) - 10} more")

        # List errors
        errors = [r for r in resolutions.values()
                  if r.status == ResolutionStatus.ERROR]

        if errors:
            lines.append(f"\nErrors ({len(errors)}):")
            lines.append("-" * 40)
            for resolution in errors[:5]:
                lines.append(f"  - {resolution.chunk_id}: {resolution.error}")

        return "\n".join(lines)


def main():
    """CLI entry point for chunk resolver."""
    import argparse

    parser = argparse.ArgumentParser(description="Resolve and validate chunks")
    parser.add_argument("--chunk", type=str, help="Resolve specific chunk ID")
    parser.add_argument("--validate-all", action="store_true", help="Validate all sources")
    parser.add_argument("--resolve-all", action="store_true", help="Resolve all referenced chunks")
    parser.add_argument("--json", action="store_true", help="Output as JSON")

    args = parser.parse_args()

    resolver = ChunkResolver()

    if args.chunk:
        resolution = resolver.resolve_chunk(args.chunk, include_content=True)
        if args.json:
            print(json.dumps(resolution.to_dict(), indent=2))
        else:
            print(f"Chunk: {resolution.chunk_id}")
            print(f"Status: {resolution.status.value}")
            print(f"Exists: {resolution.exists}")
            if resolution.metadata:
                print(f"Metadata: {resolution.metadata}")
            if resolution.content:
                print(f"Content ({len(resolution.content)} chars):")
                print(resolution.content[:500] + "..." if len(resolution.content) > 500 else resolution.content)

    elif args.resolve_all:
        resolutions = resolver.resolve_all_referenced_chunks()
        summary = resolver.get_resolution_summary(resolutions)

        if args.json:
            print(json.dumps(summary, indent=2))
        else:
            print(resolver.format_resolution_report(resolutions))

    elif args.validate_all:
        validations = resolver.validate_all_sources()
        summary = resolver.get_validation_summary(validations)

        if args.json:
            print(json.dumps(summary, indent=2))
        else:
            print("Source Validation Summary")
            print("=" * 50)
            for key, value in summary.items():
                print(f"  {key}: {value}")

    else:
        parser.print_help()
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
