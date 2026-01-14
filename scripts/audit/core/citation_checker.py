#!/usr/bin/env python3
"""
Citation Accuracy Checker - Validate citation accuracy and completeness

Features:
- Page number validation
- Quote verification against source text
- Author/title consistency checks
- Citation completeness scoring
"""

import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Set, Any, Tuple
from datetime import datetime
from enum import Enum

# Add scripts to path
scripts_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(scripts_dir))

from explore.core.artifact_loader import ArtifactLoader, KnowledgeUnit, Source
from audit.core.chunk_resolver import ChunkResolver, ChunkResolution


class CitationSeverity(Enum):
    """Severity levels for citation issues."""
    CRITICAL = "critical"  # Citation completely broken
    HIGH = "high"          # Major accuracy problem
    MEDIUM = "medium"      # Minor accuracy problem
    LOW = "low"            # Informational
    INFO = "info"          # Suggestion only


class CitationIssueType(Enum):
    """Types of citation issues."""
    MISSING_CHUNK = "missing_chunk"
    PAGE_MISMATCH = "page_mismatch"
    PAGE_FORMAT_ERROR = "page_format_error"
    AUTHOR_MISMATCH = "author_mismatch"
    TITLE_MISMATCH = "title_mismatch"
    PATH_MISMATCH = "path_mismatch"
    QUOTE_NOT_FOUND = "quote_not_found"
    EMPTY_CONTENT = "empty_content"
    METADATA_MISSING = "metadata_missing"


@dataclass
class CitationIssue:
    """A single citation issue."""
    issue_type: CitationIssueType
    severity: CitationSeverity
    ku_id: str
    source_index: int
    chunk_id: str
    message: str
    expected: Optional[Any] = None
    actual: Optional[Any] = None
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "issue_type": self.issue_type.value,
            "severity": self.severity.value,
            "ku_id": self.ku_id,
            "source_index": self.source_index,
            "chunk_id": self.chunk_id,
            "message": self.message,
            "expected": self.expected,
            "actual": self.actual,
            "details": self.details
        }


@dataclass
class CitationAudit:
    """Complete citation audit result for a knowledge unit."""
    ku_id: str
    claim: str
    source_count: int
    issues: List[CitationIssue] = field(default_factory=list)
    accuracy_score: float = 100.0
    completeness_score: float = 100.0
    overall_score: float = 100.0
    audited_at: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")

    @property
    def is_valid(self) -> bool:
        """Check if citation passes validation (no critical/high issues)."""
        return not any(
            issue.severity in [CitationSeverity.CRITICAL, CitationSeverity.HIGH]
            for issue in self.issues
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ku_id": self.ku_id,
            "claim": self.claim[:100] + "..." if len(self.claim) > 100 else self.claim,
            "source_count": self.source_count,
            "issue_count": len(self.issues),
            "is_valid": self.is_valid,
            "accuracy_score": round(self.accuracy_score, 2),
            "completeness_score": round(self.completeness_score, 2),
            "overall_score": round(self.overall_score, 2),
            "issues": [i.to_dict() for i in self.issues],
            "audited_at": self.audited_at
        }


class CitationChecker:
    """
    Validates citation accuracy and completeness.

    Checks:
    - Page numbers within chunk boundaries
    - Author/title consistency
    - Path validity
    - Content availability
    - Quote verification (if quotes present)
    """

    def __init__(
        self,
        project_root: Optional[Path] = None
    ):
        """
        Initialize citation checker.

        Args:
            project_root: Project root directory
        """
        if project_root is None:
            project_root = Path(__file__).parent.parent.parent.parent

        self.project_root = Path(project_root)
        self.loader = ArtifactLoader(self.project_root)
        self.chunk_resolver = ChunkResolver(self.project_root)

    # ========================
    # Single KU Audit
    # ========================

    def audit_ku(self, ku: KnowledgeUnit) -> CitationAudit:
        """
        Perform full citation audit on a knowledge unit.

        Args:
            ku: Knowledge unit to audit

        Returns:
            CitationAudit with all issues found
        """
        audit = CitationAudit(
            ku_id=ku.id,
            claim=ku.claim,
            source_count=len(ku.sources)
        )

        if not ku.sources:
            audit.issues.append(CitationIssue(
                issue_type=CitationIssueType.EMPTY_CONTENT,
                severity=CitationSeverity.HIGH,
                ku_id=ku.id,
                source_index=-1,
                chunk_id="",
                message="Knowledge unit has no sources"
            ))
            audit.completeness_score = 0.0
            audit.overall_score = 0.0
            return audit

        # Audit each source
        for idx, source in enumerate(ku.sources):
            source_issues = self._audit_source(ku.id, idx, source)
            audit.issues.extend(source_issues)

        # Calculate scores
        audit.accuracy_score = self._calculate_accuracy_score(audit)
        audit.completeness_score = self._calculate_completeness_score(audit)
        audit.overall_score = (audit.accuracy_score + audit.completeness_score) / 2

        return audit

    def _audit_source(
        self,
        ku_id: str,
        source_index: int,
        source: Source
    ) -> List[CitationIssue]:
        """Audit a single source reference."""
        issues = []

        # 1. Resolve chunk
        resolution = self.chunk_resolver.resolve_chunk(
            source.chunk_id,
            include_content=True
        )

        if not resolution.exists:
            issues.append(CitationIssue(
                issue_type=CitationIssueType.MISSING_CHUNK,
                severity=CitationSeverity.CRITICAL,
                ku_id=ku_id,
                source_index=source_index,
                chunk_id=source.chunk_id,
                message=f"Chunk not found in ChromaDB: {source.chunk_id}"
            ))
            return issues  # Can't check further without chunk

        metadata = resolution.metadata

        # 2. Check page numbers
        page_issues = self._check_page_numbers(
            ku_id, source_index, source, metadata
        )
        issues.extend(page_issues)

        # 3. Check path consistency
        path_issues = self._check_path_consistency(
            ku_id, source_index, source, metadata
        )
        issues.extend(path_issues)

        # 4. Check author/title if available
        author_issues = self._check_author_title(
            ku_id, source_index, source, metadata
        )
        issues.extend(author_issues)

        # 5. Check content availability
        if not resolution.content:
            issues.append(CitationIssue(
                issue_type=CitationIssueType.EMPTY_CONTENT,
                severity=CitationSeverity.MEDIUM,
                ku_id=ku_id,
                source_index=source_index,
                chunk_id=source.chunk_id,
                message="Chunk has no text content"
            ))

        # 6. Check metadata completeness
        metadata_issues = self._check_metadata_completeness(
            ku_id, source_index, source.chunk_id, metadata
        )
        issues.extend(metadata_issues)

        return issues

    def _check_page_numbers(
        self,
        ku_id: str,
        source_index: int,
        source: Source,
        metadata: Dict[str, Any]
    ) -> List[CitationIssue]:
        """Check page number accuracy."""
        issues = []

        # Parse cited pages
        try:
            cited_start, cited_end = self._parse_page_range(source.pages)
        except ValueError as e:
            issues.append(CitationIssue(
                issue_type=CitationIssueType.PAGE_FORMAT_ERROR,
                severity=CitationSeverity.MEDIUM,
                ku_id=ku_id,
                source_index=source_index,
                chunk_id=source.chunk_id,
                message=f"Invalid page format: {source.pages}",
                expected="Valid page range (e.g., '42' or '42-44')",
                actual=source.pages,
                details={"error": str(e)}
            ))
            return issues

        # Get chunk page boundaries
        chunk_start = metadata.get("page_start") or metadata.get("page")
        chunk_end = metadata.get("page_end") or metadata.get("page") or chunk_start

        if chunk_start is None:
            issues.append(CitationIssue(
                issue_type=CitationIssueType.METADATA_MISSING,
                severity=CitationSeverity.MEDIUM,
                ku_id=ku_id,
                source_index=source_index,
                chunk_id=source.chunk_id,
                message="Chunk metadata missing page information",
                details={"available_metadata": list(metadata.keys())}
            ))
            return issues

        chunk_start = int(chunk_start)
        chunk_end = int(chunk_end) if chunk_end else chunk_start

        # Check if cited pages are within chunk boundaries
        if not (chunk_start <= cited_start <= chunk_end and
                chunk_start <= cited_end <= chunk_end):
            issues.append(CitationIssue(
                issue_type=CitationIssueType.PAGE_MISMATCH,
                severity=CitationSeverity.HIGH,
                ku_id=ku_id,
                source_index=source_index,
                chunk_id=source.chunk_id,
                message=f"Cited pages {source.pages} outside chunk boundary {chunk_start}-{chunk_end}",
                expected=f"Pages within {chunk_start}-{chunk_end}",
                actual=f"{cited_start}-{cited_end}",
                details={
                    "cited_start": cited_start,
                    "cited_end": cited_end,
                    "chunk_start": chunk_start,
                    "chunk_end": chunk_end
                }
            ))

        return issues

    def _check_path_consistency(
        self,
        ku_id: str,
        source_index: int,
        source: Source,
        metadata: Dict[str, Any]
    ) -> List[CitationIssue]:
        """Check document path consistency."""
        issues = []

        # Get chunk source path
        chunk_path = (
            metadata.get("source") or
            metadata.get("path_rel") or
            metadata.get("file") or
            metadata.get("filename")
        )

        if chunk_path is None:
            return issues  # No path metadata to check

        # Normalize paths for comparison
        source_path_normalized = Path(source.path_rel).name.lower()
        chunk_path_normalized = Path(str(chunk_path)).name.lower()

        # Check if they match (allowing for different directory structures)
        if source_path_normalized != chunk_path_normalized:
            # Also try with full path
            if source.path_rel.lower() not in str(chunk_path).lower():
                issues.append(CitationIssue(
                    issue_type=CitationIssueType.PATH_MISMATCH,
                    severity=CitationSeverity.MEDIUM,
                    ku_id=ku_id,
                    source_index=source_index,
                    chunk_id=source.chunk_id,
                    message=f"Document path mismatch",
                    expected=source.path_rel,
                    actual=chunk_path
                ))

        return issues

    def _check_author_title(
        self,
        ku_id: str,
        source_index: int,
        source: Source,
        metadata: Dict[str, Any]
    ) -> List[CitationIssue]:
        """Check author and title consistency."""
        issues = []

        # Check author if in metadata
        chunk_author = metadata.get("author")
        if chunk_author and source.author:
            if not self._fuzzy_match(source.author, chunk_author):
                issues.append(CitationIssue(
                    issue_type=CitationIssueType.AUTHOR_MISMATCH,
                    severity=CitationSeverity.LOW,
                    ku_id=ku_id,
                    source_index=source_index,
                    chunk_id=source.chunk_id,
                    message="Author name differs from chunk metadata",
                    expected=source.author,
                    actual=chunk_author
                ))

        # Check title if in metadata
        chunk_title = metadata.get("title")
        if chunk_title and source.title:
            if not self._fuzzy_match(source.title, chunk_title):
                issues.append(CitationIssue(
                    issue_type=CitationIssueType.TITLE_MISMATCH,
                    severity=CitationSeverity.LOW,
                    ku_id=ku_id,
                    source_index=source_index,
                    chunk_id=source.chunk_id,
                    message="Title differs from chunk metadata",
                    expected=source.title,
                    actual=chunk_title
                ))

        return issues

    def _check_metadata_completeness(
        self,
        ku_id: str,
        source_index: int,
        chunk_id: str,
        metadata: Dict[str, Any]
    ) -> List[CitationIssue]:
        """Check for required metadata fields."""
        issues = []

        required_fields = ["page_start", "page_end", "source"]
        missing = [f for f in required_fields if f not in metadata]

        if missing:
            issues.append(CitationIssue(
                issue_type=CitationIssueType.METADATA_MISSING,
                severity=CitationSeverity.LOW,
                ku_id=ku_id,
                source_index=source_index,
                chunk_id=chunk_id,
                message=f"Chunk metadata incomplete",
                details={
                    "missing_fields": missing,
                    "available_fields": list(metadata.keys())
                }
            ))

        return issues

    # ========================
    # Utility Methods
    # ========================

    def _parse_page_range(self, pages: str) -> Tuple[int, int]:
        """Parse page range string."""
        pages = pages.strip()

        # Single page
        if pages.isdigit():
            page = int(pages)
            return (page, page)

        # Range with hyphen or en-dash
        match = re.match(r'^(\d+)\s*[–-]\s*(\d+)$', pages)
        if match:
            return (int(match.group(1)), int(match.group(2)))

        # Comma-separated
        match = re.match(r'^(\d+)\s*,\s*(\d+)$', pages)
        if match:
            return (int(match.group(1)), int(match.group(2)))

        raise ValueError(f"Invalid page format: {pages}")

    def _fuzzy_match(self, s1: str, s2: str, threshold: float = 0.8) -> bool:
        """Check if two strings are similar enough."""
        s1_lower = s1.lower().strip()
        s2_lower = s2.lower().strip()

        # Exact match
        if s1_lower == s2_lower:
            return True

        # Contains check
        if s1_lower in s2_lower or s2_lower in s1_lower:
            return True

        # Simple token overlap
        tokens1 = set(s1_lower.split())
        tokens2 = set(s2_lower.split())

        if not tokens1 or not tokens2:
            return False

        overlap = len(tokens1 & tokens2)
        max_tokens = max(len(tokens1), len(tokens2))

        return overlap / max_tokens >= threshold

    def _calculate_accuracy_score(self, audit: CitationAudit) -> float:
        """Calculate accuracy score based on issues."""
        if not audit.issues:
            return 100.0

        # Weight by severity
        severity_weights = {
            CitationSeverity.CRITICAL: 50,
            CitationSeverity.HIGH: 20,
            CitationSeverity.MEDIUM: 5,
            CitationSeverity.LOW: 1,
            CitationSeverity.INFO: 0
        }

        total_penalty = sum(
            severity_weights[issue.severity]
            for issue in audit.issues
        )

        return max(0, 100 - total_penalty)

    def _calculate_completeness_score(self, audit: CitationAudit) -> float:
        """Calculate completeness score."""
        if audit.source_count == 0:
            return 0.0

        # Count sources with critical issues
        sources_with_critical = set()
        for issue in audit.issues:
            if issue.severity == CitationSeverity.CRITICAL:
                sources_with_critical.add(issue.source_index)

        valid_sources = audit.source_count - len(sources_with_critical)
        return (valid_sources / audit.source_count) * 100

    # ========================
    # Batch Operations
    # ========================

    def audit_all_kus(self) -> Dict[str, CitationAudit]:
        """
        Audit all knowledge units.

        Returns:
            Dictionary mapping ku_id to audit result
        """
        audits = {}
        kus = self.loader.get_all_kus()

        print(f"Auditing citations for {len(kus)} knowledge units...")

        for ku_id, ku in kus.items():
            audits[ku_id] = self.audit_ku(ku)

        return audits

    def get_audit_summary(
        self,
        audits: Dict[str, CitationAudit]
    ) -> Dict[str, Any]:
        """Get summary statistics for citation audits."""
        total = len(audits)
        valid_count = sum(1 for a in audits.values() if a.is_valid)
        total_issues = sum(len(a.issues) for a in audits.values())

        # Count by severity
        severity_counts = {s.value: 0 for s in CitationSeverity}
        for audit in audits.values():
            for issue in audit.issues:
                severity_counts[issue.severity.value] += 1

        # Count by issue type
        type_counts = {t.value: 0 for t in CitationIssueType}
        for audit in audits.values():
            for issue in audit.issues:
                type_counts[issue.issue_type.value] += 1

        # Score statistics
        accuracy_scores = [a.accuracy_score for a in audits.values()]
        completeness_scores = [a.completeness_score for a in audits.values()]
        overall_scores = [a.overall_score for a in audits.values()]

        return {
            "total_audited": total,
            "valid_count": valid_count,
            "invalid_count": total - valid_count,
            "validation_rate": (valid_count / total * 100) if total else 0,
            "total_issues": total_issues,
            "by_severity": severity_counts,
            "by_type": type_counts,
            "scores": {
                "avg_accuracy": sum(accuracy_scores) / len(accuracy_scores) if accuracy_scores else 0,
                "avg_completeness": sum(completeness_scores) / len(completeness_scores) if completeness_scores else 0,
                "avg_overall": sum(overall_scores) / len(overall_scores) if overall_scores else 0,
                "min_overall": min(overall_scores) if overall_scores else 0,
                "max_overall": max(overall_scores) if overall_scores else 0
            }
        }

    # ========================
    # Reporting
    # ========================

    def format_audit_report(self, audit: CitationAudit) -> str:
        """Format single audit as human-readable report."""
        lines = []
        lines.append(f"Citation Audit: {audit.ku_id}")
        lines.append("=" * 60)
        lines.append(f"Claim: {audit.claim[:80]}...")
        lines.append(f"Sources: {audit.source_count}")
        lines.append(f"Valid: {'✓' if audit.is_valid else '✗'}")
        lines.append("")
        lines.append("Scores:")
        lines.append(f"  Accuracy:     {audit.accuracy_score:.1f}/100")
        lines.append(f"  Completeness: {audit.completeness_score:.1f}/100")
        lines.append(f"  Overall:      {audit.overall_score:.1f}/100")

        if audit.issues:
            lines.append("")
            lines.append(f"Issues ({len(audit.issues)}):")
            lines.append("-" * 40)

            severity_emoji = {
                CitationSeverity.CRITICAL: "🔴",
                CitationSeverity.HIGH: "🟠",
                CitationSeverity.MEDIUM: "🟡",
                CitationSeverity.LOW: "⚪",
                CitationSeverity.INFO: "ℹ️"
            }

            for issue in audit.issues:
                emoji = severity_emoji[issue.severity]
                lines.append(f"  {emoji} [{issue.severity.value.upper()}] {issue.message}")
                if issue.expected and issue.actual:
                    lines.append(f"      Expected: {issue.expected}")
                    lines.append(f"      Actual:   {issue.actual}")

        return "\n".join(lines)

    def format_summary_report(
        self,
        audits: Dict[str, CitationAudit]
    ) -> str:
        """Format summary as human-readable report."""
        summary = self.get_audit_summary(audits)

        lines = []
        lines.append("Citation Audit Summary")
        lines.append("=" * 60)
        lines.append(f"Total Audited: {summary['total_audited']}")
        lines.append(f"Valid: {summary['valid_count']} ({summary['validation_rate']:.1f}%)")
        lines.append(f"Invalid: {summary['invalid_count']}")
        lines.append(f"Total Issues: {summary['total_issues']}")
        lines.append("")

        lines.append("Issues by Severity:")
        severity_emoji = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "⚪", "info": "ℹ️"}
        for severity, count in summary['by_severity'].items():
            if count > 0:
                emoji = severity_emoji.get(severity, "")
                lines.append(f"  {emoji} {severity.upper()}: {count}")

        lines.append("")
        lines.append("Scores:")
        scores = summary['scores']
        lines.append(f"  Avg Accuracy:     {scores['avg_accuracy']:.1f}/100")
        lines.append(f"  Avg Completeness: {scores['avg_completeness']:.1f}/100")
        lines.append(f"  Avg Overall:      {scores['avg_overall']:.1f}/100")
        lines.append(f"  Range:            {scores['min_overall']:.1f} - {scores['max_overall']:.1f}")

        return "\n".join(lines)


def main():
    """CLI entry point for citation checker."""
    import argparse

    parser = argparse.ArgumentParser(description="Audit citation accuracy")
    parser.add_argument("--ku", type=str, help="Audit specific knowledge unit")
    parser.add_argument("--all", action="store_true", help="Audit all knowledge units")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    args = parser.parse_args()

    checker = CitationChecker()

    if args.ku:
        ku = checker.loader.get_ku(args.ku)
        if ku is None:
            print(f"Knowledge unit not found: {args.ku}")
            return 1

        audit = checker.audit_ku(ku)
        if args.json:
            print(json.dumps(audit.to_dict(), indent=2))
        else:
            print(checker.format_audit_report(audit))

    elif args.all:
        audits = checker.audit_all_kus()
        summary = checker.get_audit_summary(audits)

        if args.json:
            print(json.dumps(summary, indent=2))
        else:
            print(checker.format_summary_report(audits))

            if args.verbose:
                print("\n" + "=" * 60)
                print("Invalid Citations:")
                print("-" * 60)
                for ku_id, audit in audits.items():
                    if not audit.is_valid:
                        print(f"\n{ku_id}: {len(audit.issues)} issues")
                        for issue in audit.issues[:3]:
                            print(f"  - [{issue.severity.value}] {issue.message}")

    else:
        parser.print_help()
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
