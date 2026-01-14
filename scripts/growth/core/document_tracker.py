"""
Phase 17 Week 3-4: Document Tracker

Tracks new, modified, and deleted documents since the last snapshot.
Provides efficient detection of changes requiring reprocessing.

Key Features:
- Hash-based change detection
- Modification timestamp tracking
- Pending/processed status management
- Integration with CorpusVersionManager
"""

import hashlib
import json
from pathlib import Path
from datetime import datetime
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Set, Any
from enum import Enum


class DocumentStatus(Enum):
    """Status of a tracked document."""
    NEW = "new"                  # Not in any snapshot
    MODIFIED = "modified"        # Hash differs from snapshot
    UNCHANGED = "unchanged"      # Matches snapshot
    PENDING = "pending"          # Awaiting processing
    PROCESSED = "processed"      # Successfully processed
    FAILED = "failed"            # Processing failed
    DELETED = "deleted"          # Removed from corpus


@dataclass
class TrackedDocument:
    """A document being tracked for changes."""
    path: str
    status: DocumentStatus
    current_hash: str
    snapshot_hash: Optional[str] = None
    modified_at: Optional[str] = None
    processed_at: Optional[str] = None
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        d = asdict(self)
        d["status"] = self.status.value
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TrackedDocument":
        """Create from dictionary."""
        data["status"] = DocumentStatus(data["status"])
        return cls(**data)


class DocumentTracker:
    """
    Tracks document changes for incremental processing.

    Maintains state of all corpus documents and identifies
    which ones need processing based on changes since last snapshot.
    """

    def __init__(self, base_path: Optional[Path] = None):
        """Initialize document tracker."""
        self.base_path = base_path or Path.cwd()
        self.corpus_dir = self.base_path / "corpus"
        self.tracking_dir = self.base_path / ".corpus-tracking"
        self.tracking_file = self.tracking_dir / "tracking_state.json"

        # Ensure directories exist
        self.tracking_dir.mkdir(parents=True, exist_ok=True)

        # Load existing state
        self._state: Dict[str, TrackedDocument] = {}
        self._load_state()

    # =========================================================================
    # State Management
    # =========================================================================

    def _load_state(self) -> None:
        """Load tracking state from disk."""
        if self.tracking_file.exists():
            try:
                with open(self.tracking_file) as f:
                    data = json.load(f)
                    for path, doc_data in data.get("documents", {}).items():
                        self._state[path] = TrackedDocument.from_dict(doc_data)
            except Exception:
                self._state = {}

    def _save_state(self) -> None:
        """Save tracking state to disk."""
        data = {
            "updated_at": datetime.now().isoformat(),
            "document_count": len(self._state),
            "documents": {
                path: doc.to_dict()
                for path, doc in self._state.items()
            }
        }
        with open(self.tracking_file, "w") as f:
            json.dump(data, f, indent=2)

    # =========================================================================
    # Document Scanning
    # =========================================================================

    def _compute_hash(self, file_path: Path) -> str:
        """Compute SHA-256 hash of a file."""
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256.update(chunk)
        return sha256.hexdigest()

    def scan_corpus(self) -> Dict[str, Any]:
        """
        Scan corpus directory for all documents.

        Returns summary of found documents.
        Paths are relative to corpus directory (not project root)
        for compatibility with CorpusVersionManager.
        """
        if not self.corpus_dir.exists():
            return {"error": "Corpus directory not found", "documents": 0}

        found: Dict[str, str] = {}
        for pdf_path in self.corpus_dir.rglob("*.pdf"):
            # Use path relative to corpus dir for consistency with version manager
            rel_path = str(pdf_path.relative_to(self.corpus_dir))
            found[rel_path] = self._compute_hash(pdf_path)

        return {
            "documents": len(found),
            "hashes": found
        }

    def detect_changes(
        self,
        snapshot_hashes: Optional[Dict[str, str]] = None
    ) -> Dict[str, List[TrackedDocument]]:
        """
        Detect changes since last snapshot.

        Args:
            snapshot_hashes: Document hashes from snapshot to compare against.
                           If None, uses internal state.

        Returns:
            Dictionary with lists of new, modified, unchanged, and deleted documents.
        """
        # Scan current corpus
        scan_result = self.scan_corpus()
        if "error" in scan_result:
            return {"error": scan_result["error"]}

        current_hashes = scan_result["hashes"]

        # Use provided snapshot hashes or existing state
        reference_hashes = snapshot_hashes or {
            path: doc.snapshot_hash
            for path, doc in self._state.items()
            if doc.snapshot_hash
        }

        # Categorize documents
        result: Dict[str, List[TrackedDocument]] = {
            "new": [],
            "modified": [],
            "unchanged": [],
            "deleted": []
        }

        current_paths = set(current_hashes.keys())
        reference_paths = set(reference_hashes.keys())

        # New documents (in current but not in reference)
        for path in current_paths - reference_paths:
            doc = TrackedDocument(
                path=path,
                status=DocumentStatus.NEW,
                current_hash=current_hashes[path],
                snapshot_hash=None,
                modified_at=datetime.now().isoformat()
            )
            result["new"].append(doc)
            self._state[path] = doc

        # Potentially modified or unchanged
        for path in current_paths & reference_paths:
            current_hash = current_hashes[path]
            ref_hash = reference_hashes[path]

            if current_hash != ref_hash:
                doc = TrackedDocument(
                    path=path,
                    status=DocumentStatus.MODIFIED,
                    current_hash=current_hash,
                    snapshot_hash=ref_hash,
                    modified_at=datetime.now().isoformat()
                )
                result["modified"].append(doc)
            else:
                doc = TrackedDocument(
                    path=path,
                    status=DocumentStatus.UNCHANGED,
                    current_hash=current_hash,
                    snapshot_hash=ref_hash
                )
                result["unchanged"].append(doc)

            self._state[path] = doc

        # Deleted documents (in reference but not in current)
        for path in reference_paths - current_paths:
            doc = TrackedDocument(
                path=path,
                status=DocumentStatus.DELETED,
                current_hash="",
                snapshot_hash=reference_hashes[path],
                modified_at=datetime.now().isoformat()
            )
            result["deleted"].append(doc)
            self._state[path] = doc

        # Save state
        self._save_state()

        return result

    # =========================================================================
    # Processing Queue
    # =========================================================================

    def get_pending_documents(self) -> List[TrackedDocument]:
        """Get all documents pending processing."""
        return [
            doc for doc in self._state.values()
            if doc.status in (DocumentStatus.NEW, DocumentStatus.MODIFIED, DocumentStatus.PENDING)
        ]

    def get_documents_by_status(self, status: DocumentStatus) -> List[TrackedDocument]:
        """Get all documents with a specific status."""
        return [doc for doc in self._state.values() if doc.status == status]

    def mark_pending(self, paths: List[str]) -> int:
        """Mark documents as pending for processing."""
        count = 0
        for path in paths:
            if path in self._state:
                self._state[path].status = DocumentStatus.PENDING
                count += 1
        self._save_state()
        return count

    def mark_processed(
        self,
        path: str,
        success: bool = True,
        error_message: Optional[str] = None
    ) -> None:
        """Mark a document as processed."""
        if path in self._state:
            doc = self._state[path]
            if success:
                doc.status = DocumentStatus.PROCESSED
                doc.processed_at = datetime.now().isoformat()
                doc.error_message = None
            else:
                doc.status = DocumentStatus.FAILED
                doc.error_message = error_message
            self._save_state()

    def mark_all_pending_as_processed(self) -> int:
        """Mark all pending documents as processed."""
        count = 0
        for doc in self._state.values():
            if doc.status == DocumentStatus.PENDING:
                doc.status = DocumentStatus.PROCESSED
                doc.processed_at = datetime.now().isoformat()
                count += 1
        self._save_state()
        return count

    def reset_failed(self) -> int:
        """Reset failed documents to pending for retry."""
        count = 0
        for doc in self._state.values():
            if doc.status == DocumentStatus.FAILED:
                doc.status = DocumentStatus.PENDING
                doc.error_message = None
                count += 1
        self._save_state()
        return count

    # =========================================================================
    # Snapshot Integration
    # =========================================================================

    def sync_with_snapshot(self, snapshot_hashes: Dict[str, str]) -> Dict[str, Any]:
        """
        Synchronize tracking state with a snapshot.

        Updates internal reference hashes to match the snapshot,
        then detects changes from that baseline.
        """
        # Update all reference hashes
        for path, doc in self._state.items():
            if path in snapshot_hashes:
                doc.snapshot_hash = snapshot_hashes[path]

        # Detect changes from new baseline
        return self.detect_changes(snapshot_hashes)

    def update_after_snapshot(self, snapshot_hashes: Dict[str, str]) -> None:
        """
        Update state after a new snapshot is created.

        All processed documents become unchanged,
        and snapshot hashes are updated.
        """
        for path, current_hash in snapshot_hashes.items():
            if path in self._state:
                doc = self._state[path]
                doc.status = DocumentStatus.UNCHANGED
                doc.snapshot_hash = current_hash
                doc.current_hash = current_hash
            else:
                self._state[path] = TrackedDocument(
                    path=path,
                    status=DocumentStatus.UNCHANGED,
                    current_hash=current_hash,
                    snapshot_hash=current_hash
                )
        self._save_state()

    # =========================================================================
    # Reporting
    # =========================================================================

    def get_summary(self) -> Dict[str, Any]:
        """Get summary of tracked documents."""
        status_counts = {status.value: 0 for status in DocumentStatus}
        for doc in self._state.values():
            status_counts[doc.status.value] += 1

        return {
            "total_tracked": len(self._state),
            "status_counts": status_counts,
            "needs_processing": (
                status_counts[DocumentStatus.NEW.value] +
                status_counts[DocumentStatus.MODIFIED.value] +
                status_counts[DocumentStatus.PENDING.value]
            ),
            "failed_count": status_counts[DocumentStatus.FAILED.value]
        }

    def get_processing_report(self) -> Dict[str, Any]:
        """Get detailed processing report."""
        pending = self.get_pending_documents()
        failed = self.get_documents_by_status(DocumentStatus.FAILED)
        processed = self.get_documents_by_status(DocumentStatus.PROCESSED)

        return {
            "pending": [{"path": d.path, "status": d.status.value} for d in pending],
            "failed": [{"path": d.path, "error": d.error_message} for d in failed],
            "processed_count": len(processed),
            "pending_count": len(pending),
            "failed_count": len(failed)
        }

    def clear_state(self) -> None:
        """Clear all tracking state."""
        self._state = {}
        self._save_state()
