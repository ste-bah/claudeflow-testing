"""
Phase 17 Week 3-4: Merge Strategy

Strategies for merging new reasoning with existing knowledge base.
Handles deduplication, conflict resolution, and knowledge integration.

Key Features:
- Multiple merge strategies (append, dedupe, replace)
- Conflict detection and resolution
- Semantic similarity-based deduplication
- Knowledge graph integration support
"""

import json
import hashlib
import sys
from pathlib import Path
from datetime import datetime
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Set, Tuple
from enum import Enum

# Add project root for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from scripts.common import get_logger

logger = get_logger("phase17.merge")


class MergeMode(Enum):
    """Available merge strategies."""
    APPEND = "append"           # Simply add new KUs
    DEDUPE = "dedupe"           # Remove exact duplicates
    REPLACE = "replace"         # Replace existing with new
    SEMANTIC = "semantic"       # Semantic similarity deduplication
    CONFLICT = "conflict"       # Flag conflicts for review


class ConflictType(Enum):
    """Types of merge conflicts."""
    DUPLICATE = "duplicate"         # Exact duplicate
    SEMANTIC_SIMILAR = "semantic"   # High semantic similarity
    SOURCE_CONFLICT = "source"      # Same source, different content
    SUPERSEDED = "superseded"       # New version supersedes old


@dataclass
class KnowledgeUnit:
    """Representation of a knowledge unit for merging."""
    ku_id: str
    content: str
    source_path: str
    source_page: Optional[int] = None
    domain: Optional[str] = None
    created_at: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def content_hash(self) -> str:
        """Hash of content for deduplication."""
        return hashlib.md5(self.content.encode()).hexdigest()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "ku_id": self.ku_id,
            "content": self.content,
            "source_path": self.source_path,
            "source_page": self.source_page,
            "domain": self.domain,
            "created_at": self.created_at,
            "metadata": self.metadata
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "KnowledgeUnit":
        """Create from dictionary, handling multiple field name formats."""
        # Handle actual knowledge.jsonl format
        ku_id = data.get("ku_id") or data.get("id", "")
        content = data.get("content") or data.get("claim", "")
        source_path = data.get("source_path", "")

        # Handle sources array format
        sources = data.get("sources", [])
        if sources and not source_path:
            if isinstance(sources, list) and sources:
                first_source = sources[0]
                if isinstance(first_source, dict):
                    source_path = first_source.get("source", "")
                else:
                    source_path = str(first_source)

        return cls(
            ku_id=ku_id,
            content=content,
            source_path=source_path,
            source_page=data.get("source_page"),
            domain=data.get("domain") or (data.get("tags", [None])[0] if data.get("tags") else None),
            created_at=data.get("created_at"),
            metadata={k: v for k, v in data.items()
                     if k not in ("ku_id", "id", "content", "claim", "source_path", "sources",
                                 "source_page", "domain", "created_at")}
        )


@dataclass
class MergeConflict:
    """A conflict detected during merge."""
    conflict_type: ConflictType
    existing_ku: KnowledgeUnit
    new_ku: KnowledgeUnit
    similarity_score: float = 1.0
    resolution: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MergeResult:
    """Result of a merge operation."""
    strategy: MergeMode
    total_new: int
    added: int
    updated: int
    skipped: int
    conflicts: List[MergeConflict] = field(default_factory=list)
    duration_seconds: float = 0.0


class MergeStrategy:
    """
    Handles merging new reasoning with existing knowledge.

    Supports multiple strategies for handling duplicates,
    conflicts, and knowledge integration.
    """

    def __init__(self, base_path: Optional[Path] = None):
        """Initialize merge strategy handler."""
        self.base_path = base_path or Path.cwd()
        self.god_learn_dir = self.base_path / "god-learn"
        self.knowledge_file = self.god_learn_dir / "knowledge.jsonl"
        self.conflicts_file = self.god_learn_dir / "merge_conflicts.json"

        # Similarity threshold for semantic deduplication
        self.similarity_threshold = 0.85

        # Cache for existing knowledge
        self._existing_kus: Optional[Dict[str, KnowledgeUnit]] = None
        self._content_hashes: Optional[Dict[str, str]] = None

    # =========================================================================
    # Knowledge Loading
    # =========================================================================

    def _load_existing_knowledge(self) -> Dict[str, KnowledgeUnit]:
        """Load existing knowledge units from file."""
        if self._existing_kus is not None:
            return self._existing_kus

        self._existing_kus = {}
        self._content_hashes = {}

        if not self.knowledge_file.exists():
            return self._existing_kus

        with open(self.knowledge_file) as f:
            for line in f:
                try:
                    data = json.loads(line.strip())
                    ku = KnowledgeUnit.from_dict(data)
                    self._existing_kus[ku.ku_id] = ku
                    self._content_hashes[ku.content_hash] = ku.ku_id
                except (json.JSONDecodeError, KeyError, TypeError, ValueError) as e:
                    logger.debug("Skipping malformed KU entry", extra={"error": str(e)})
                    continue

        return self._existing_kus

    def _save_knowledge(self, kus: Dict[str, KnowledgeUnit]) -> None:
        """Save knowledge units to file."""
        self.god_learn_dir.mkdir(parents=True, exist_ok=True)

        with open(self.knowledge_file, "w") as f:
            for ku in kus.values():
                f.write(json.dumps(ku.to_dict()) + "\n")

    def refresh_cache(self) -> None:
        """Refresh the knowledge cache."""
        self._existing_kus = None
        self._content_hashes = None
        self._load_existing_knowledge()

    # =========================================================================
    # Deduplication
    # =========================================================================

    def is_duplicate(self, ku: KnowledgeUnit) -> Tuple[bool, Optional[str]]:
        """
        Check if a KU is a duplicate of existing knowledge.

        Returns:
            Tuple of (is_duplicate, existing_ku_id)
        """
        existing = self._load_existing_knowledge()

        # Check by ID
        if ku.ku_id in existing:
            return True, ku.ku_id

        # Check by content hash
        if self._content_hashes and ku.content_hash in self._content_hashes:
            return True, self._content_hashes[ku.content_hash]

        return False, None

    def find_similar(
        self,
        ku: KnowledgeUnit,
        threshold: Optional[float] = None
    ) -> List[Tuple[KnowledgeUnit, float]]:
        """
        Find semantically similar existing KUs.

        Uses simple text similarity for now. Can be extended
        to use embeddings for more accurate matching.

        Returns:
            List of (similar_ku, similarity_score) tuples.
        """
        threshold = threshold or self.similarity_threshold
        existing = self._load_existing_knowledge()
        similar = []

        for existing_ku in existing.values():
            score = self._compute_similarity(ku.content, existing_ku.content)
            if score >= threshold:
                similar.append((existing_ku, score))

        return sorted(similar, key=lambda x: -x[1])

    def _compute_similarity(self, text1: str, text2: str) -> float:
        """
        Compute text similarity using simple methods.

        Uses Jaccard similarity on words. For production,
        would use embeddings or more sophisticated methods.
        """
        # Normalize
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())

        if not words1 or not words2:
            return 0.0

        intersection = words1 & words2
        union = words1 | words2

        return len(intersection) / len(union)

    # =========================================================================
    # Merge Operations
    # =========================================================================

    def merge(
        self,
        new_kus: List[KnowledgeUnit],
        mode: MergeMode = MergeMode.DEDUPE,
        dry_run: bool = False
    ) -> MergeResult:
        """
        Merge new knowledge units with existing.

        Args:
            new_kus: New knowledge units to merge
            mode: Merge strategy to use
            dry_run: If True, don't actually modify files

        Returns:
            MergeResult with statistics.
        """
        start_time = datetime.now()

        if mode == MergeMode.APPEND:
            result = self._merge_append(new_kus, dry_run)
        elif mode == MergeMode.DEDUPE:
            result = self._merge_dedupe(new_kus, dry_run)
        elif mode == MergeMode.REPLACE:
            result = self._merge_replace(new_kus, dry_run)
        elif mode == MergeMode.SEMANTIC:
            result = self._merge_semantic(new_kus, dry_run)
        elif mode == MergeMode.CONFLICT:
            result = self._merge_conflict(new_kus, dry_run)
        else:
            result = MergeResult(
                strategy=mode,
                total_new=len(new_kus),
                added=0,
                updated=0,
                skipped=len(new_kus)
            )

        result.duration_seconds = (datetime.now() - start_time).total_seconds()
        return result

    def _merge_append(
        self,
        new_kus: List[KnowledgeUnit],
        dry_run: bool
    ) -> MergeResult:
        """Simply append all new KUs."""
        existing = self._load_existing_knowledge()
        added = 0

        for ku in new_kus:
            if ku.ku_id not in existing:
                if not dry_run:
                    existing[ku.ku_id] = ku
                added += 1

        if not dry_run:
            self._save_knowledge(existing)

        return MergeResult(
            strategy=MergeMode.APPEND,
            total_new=len(new_kus),
            added=added,
            updated=0,
            skipped=len(new_kus) - added
        )

    def _merge_dedupe(
        self,
        new_kus: List[KnowledgeUnit],
        dry_run: bool
    ) -> MergeResult:
        """Deduplicate by content hash."""
        existing = self._load_existing_knowledge()
        added = 0
        skipped = 0
        conflicts = []

        for ku in new_kus:
            is_dup, existing_id = self.is_duplicate(ku)

            if is_dup:
                skipped += 1
                conflicts.append(MergeConflict(
                    conflict_type=ConflictType.DUPLICATE,
                    existing_ku=existing[existing_id],
                    new_ku=ku,
                    similarity_score=1.0,
                    resolution="skipped"
                ))
            else:
                if not dry_run:
                    existing[ku.ku_id] = ku
                    self._content_hashes[ku.content_hash] = ku.ku_id
                added += 1

        if not dry_run:
            self._save_knowledge(existing)

        return MergeResult(
            strategy=MergeMode.DEDUPE,
            total_new=len(new_kus),
            added=added,
            updated=0,
            skipped=skipped,
            conflicts=conflicts
        )

    def _merge_replace(
        self,
        new_kus: List[KnowledgeUnit],
        dry_run: bool
    ) -> MergeResult:
        """Replace existing with new if IDs match."""
        existing = self._load_existing_knowledge()
        added = 0
        updated = 0

        for ku in new_kus:
            if ku.ku_id in existing:
                if not dry_run:
                    existing[ku.ku_id] = ku
                updated += 1
            else:
                if not dry_run:
                    existing[ku.ku_id] = ku
                added += 1

        if not dry_run:
            self._save_knowledge(existing)

        return MergeResult(
            strategy=MergeMode.REPLACE,
            total_new=len(new_kus),
            added=added,
            updated=updated,
            skipped=0
        )

    def _merge_semantic(
        self,
        new_kus: List[KnowledgeUnit],
        dry_run: bool
    ) -> MergeResult:
        """Semantic similarity-based deduplication."""
        existing = self._load_existing_knowledge()
        added = 0
        skipped = 0
        conflicts = []

        for ku in new_kus:
            # First check exact duplicate
            is_dup, existing_id = self.is_duplicate(ku)
            if is_dup:
                skipped += 1
                conflicts.append(MergeConflict(
                    conflict_type=ConflictType.DUPLICATE,
                    existing_ku=existing[existing_id],
                    new_ku=ku,
                    similarity_score=1.0,
                    resolution="skipped"
                ))
                continue

            # Check semantic similarity
            similar = self.find_similar(ku)
            if similar:
                most_similar, score = similar[0]
                skipped += 1
                conflicts.append(MergeConflict(
                    conflict_type=ConflictType.SEMANTIC_SIMILAR,
                    existing_ku=most_similar,
                    new_ku=ku,
                    similarity_score=score,
                    resolution="skipped"
                ))
            else:
                if not dry_run:
                    existing[ku.ku_id] = ku
                added += 1

        if not dry_run:
            self._save_knowledge(existing)

        return MergeResult(
            strategy=MergeMode.SEMANTIC,
            total_new=len(new_kus),
            added=added,
            updated=0,
            skipped=skipped,
            conflicts=conflicts
        )

    def _merge_conflict(
        self,
        new_kus: List[KnowledgeUnit],
        dry_run: bool
    ) -> MergeResult:
        """Flag all potential conflicts for manual review."""
        existing = self._load_existing_knowledge()
        added = 0
        conflicts = []

        for ku in new_kus:
            # Check various conflict types
            is_dup, existing_id = self.is_duplicate(ku)

            if is_dup:
                conflicts.append(MergeConflict(
                    conflict_type=ConflictType.DUPLICATE,
                    existing_ku=existing[existing_id],
                    new_ku=ku,
                    similarity_score=1.0
                ))
                continue

            similar = self.find_similar(ku, threshold=0.7)
            if similar:
                for sim_ku, score in similar:
                    conflicts.append(MergeConflict(
                        conflict_type=ConflictType.SEMANTIC_SIMILAR,
                        existing_ku=sim_ku,
                        new_ku=ku,
                        similarity_score=score
                    ))

            # Check source conflicts
            same_source = [
                ex for ex in existing.values()
                if ex.source_path == ku.source_path and
                   ex.source_page == ku.source_page
            ]
            for ex in same_source:
                if ex.ku_id != ku.ku_id:
                    conflicts.append(MergeConflict(
                        conflict_type=ConflictType.SOURCE_CONFLICT,
                        existing_ku=ex,
                        new_ku=ku,
                        similarity_score=self._compute_similarity(ku.content, ex.content)
                    ))

            # Add if no blocking conflicts
            if not is_dup:
                if not dry_run:
                    existing[ku.ku_id] = ku
                added += 1

        # Save conflicts for review
        if conflicts and not dry_run:
            self._save_conflicts(conflicts)

        if not dry_run:
            self._save_knowledge(existing)

        return MergeResult(
            strategy=MergeMode.CONFLICT,
            total_new=len(new_kus),
            added=added,
            updated=0,
            skipped=len(new_kus) - added,
            conflicts=conflicts
        )

    def _save_conflicts(self, conflicts: List[MergeConflict]) -> None:
        """Save conflicts to file for review."""
        conflict_data = []
        for c in conflicts:
            conflict_data.append({
                "type": c.conflict_type.value,
                "similarity": c.similarity_score,
                "existing": c.existing_ku.to_dict(),
                "new": c.new_ku.to_dict(),
                "resolution": c.resolution
            })

        with open(self.conflicts_file, "w") as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "count": len(conflicts),
                "conflicts": conflict_data
            }, f, indent=2)

    # =========================================================================
    # Conflict Resolution
    # =========================================================================

    def load_conflicts(self) -> List[MergeConflict]:
        """Load pending conflicts from file."""
        if not self.conflicts_file.exists():
            return []

        with open(self.conflicts_file) as f:
            data = json.load(f)

        conflicts = []
        for c in data.get("conflicts", []):
            conflicts.append(MergeConflict(
                conflict_type=ConflictType(c["type"]),
                existing_ku=KnowledgeUnit.from_dict(c["existing"]),
                new_ku=KnowledgeUnit.from_dict(c["new"]),
                similarity_score=c["similarity"],
                resolution=c.get("resolution")
            ))

        return conflicts

    def resolve_conflict(
        self,
        conflict_index: int,
        resolution: str,
        keep_existing: bool = True
    ) -> bool:
        """
        Resolve a specific conflict.

        Args:
            conflict_index: Index of conflict to resolve
            resolution: Resolution description
            keep_existing: If True, keep existing; otherwise use new

        Returns:
            True if resolved successfully.
        """
        conflicts = self.load_conflicts()

        if conflict_index >= len(conflicts):
            return False

        conflict = conflicts[conflict_index]
        conflict.resolution = resolution

        if not keep_existing:
            # Replace existing with new
            existing = self._load_existing_knowledge()
            existing[conflict.new_ku.ku_id] = conflict.new_ku

            # Remove old if different ID
            if conflict.existing_ku.ku_id != conflict.new_ku.ku_id:
                existing.pop(conflict.existing_ku.ku_id, None)

            self._save_knowledge(existing)

        # Remove resolved conflict
        conflicts.pop(conflict_index)
        self._save_conflicts_list(conflicts)

        return True

    def _save_conflicts_list(self, conflicts: List[MergeConflict]) -> None:
        """Save updated conflicts list."""
        conflict_data = []
        for c in conflicts:
            conflict_data.append({
                "type": c.conflict_type.value,
                "similarity": c.similarity_score,
                "existing": c.existing_ku.to_dict(),
                "new": c.new_ku.to_dict(),
                "resolution": c.resolution
            })

        with open(self.conflicts_file, "w") as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "count": len(conflicts),
                "conflicts": conflict_data
            }, f, indent=2)

    # =========================================================================
    # Reporting
    # =========================================================================

    def get_merge_stats(self) -> Dict[str, Any]:
        """Get statistics about knowledge base."""
        existing = self._load_existing_knowledge()
        conflicts = self.load_conflicts()

        # Domain distribution
        domains: Dict[str, int] = {}
        for ku in existing.values():
            domain = ku.domain or "unknown"
            domains[domain] = domains.get(domain, 0) + 1

        # Source distribution
        sources: Dict[str, int] = {}
        for ku in existing.values():
            source = ku.source_path
            sources[source] = sources.get(source, 0) + 1

        return {
            "total_kus": len(existing),
            "domains": domains,
            "sources": dict(sorted(sources.items(), key=lambda x: -x[1])[:10]),
            "pending_conflicts": len(conflicts),
            "unique_sources": len(sources)
        }
