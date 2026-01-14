"""
Regression Detector - Detect coverage and reasoning stability issues

Detects:
- Coverage regressions (KU count drops, missing documents/authors)
- Reasoning stability issues (deleted RUs, relation changes, score drift)
"""

import sys
from dataclasses import dataclass
from pathlib import Path
from typing import List, Dict, Any, Optional, Set

# Add scripts to path for imports
scripts_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(scripts_dir))

from explore.core.artifact_loader import ArtifactLoader, KnowledgeUnit, ReasoningUnit
from qa.core.baseline_manager import (
    CoverageBaseline,
    CoverageQueryBaseline,
    ReasoningBaseline,
    ReasoningUnitBaseline
)


@dataclass
class CoverageRegression:
    """Represents a single coverage regression."""
    query: str
    regression_type: str  # "ku_count_drop", "missing_document", "missing_author", "ku_ids_changed"
    severity: str  # "critical", "high", "medium", "low"
    baseline_value: Any
    current_value: Any
    diff: Any


@dataclass
class ReasoningStabilityIssue:
    """Represents a reasoning stability issue."""
    issue_type: str  # "deleted_ru", "relation_change", "score_drift", "ku_ids_changed"
    severity: str  # "critical", "high", "medium", "low"
    ru_id: str
    baseline_value: Any
    current_value: Any
    details: Optional[str] = None


class RegressionDetector:
    """
    Detects regressions in coverage and reasoning stability.

    Uses baselines to compare current corpus state against expected state.
    """

    def __init__(self, project_root: Optional[Path] = None):
        """
        Initialize regression detector.

        Args:
            project_root: Project root directory (default: auto-detect)
        """
        if project_root is None:
            project_root = Path(__file__).parent.parent.parent.parent

        self.project_root = Path(project_root)
        self.loader = ArtifactLoader(self.project_root)

    # ========================
    # Coverage Regression Detection
    # ========================

    def detect_coverage_regressions(
        self,
        baseline: CoverageBaseline
    ) -> List[CoverageRegression]:
        """
        Detect coverage regressions across all tracked queries.

        Args:
            baseline: Coverage baseline to compare against

        Returns:
            List of detected regressions
        """
        regressions = []

        for query_baseline in baseline.queries:
            query_regressions = self._check_query_coverage(query_baseline)
            regressions.extend(query_regressions)

        return regressions

    def _check_query_coverage(
        self,
        baseline: CoverageQueryBaseline
    ) -> List[CoverageRegression]:
        """
        Check coverage for a single query.

        Args:
            baseline: Query baseline to compare against

        Returns:
            List of regressions for this query
        """
        regressions = []

        # Get current KUs for this query
        current_kus = self.loader.get_kus_by_query(baseline.query)

        # 1. Check KU count drop
        ku_count_regression = self._check_ku_count_drop(
            baseline.query,
            baseline.expected_ku_count,
            baseline.expected_min_ku_count,
            len(current_kus)
        )
        if ku_count_regression:
            regressions.append(ku_count_regression)

        # 2. Check missing documents
        current_docs = {ku.sources[0].title for ku in current_kus}
        doc_regressions = self._check_missing_documents(
            baseline.query,
            set(baseline.expected_documents),
            current_docs
        )
        regressions.extend(doc_regressions)

        # 3. Check missing authors
        current_authors = {ku.sources[0].author for ku in current_kus}
        author_regressions = self._check_missing_authors(
            baseline.query,
            set(baseline.expected_authors),
            current_authors
        )
        regressions.extend(author_regressions)

        # 4. Check KU ID changes (optional - informational)
        current_ku_ids = {ku.id for ku in current_kus}
        id_regression = self._check_ku_ids_changed(
            baseline.query,
            set(baseline.ku_ids_snapshot),
            current_ku_ids
        )
        if id_regression:
            regressions.append(id_regression)

        return regressions

    def _check_ku_count_drop(
        self,
        query: str,
        expected_count: int,
        min_count: int,
        current_count: int
    ) -> Optional[CoverageRegression]:
        """Check if KU count dropped significantly."""
        if current_count < min_count:
            drop_pct = ((expected_count - current_count) / expected_count) * 100

            # Determine severity
            if drop_pct > 50:
                severity = "critical"
            elif drop_pct > 20:
                severity = "high"
            elif drop_pct > 10:
                severity = "medium"
            else:
                severity = "low"

            return CoverageRegression(
                query=query,
                regression_type="ku_count_drop",
                severity=severity,
                baseline_value=expected_count,
                current_value=current_count,
                diff=f"-{drop_pct:.1f}% ({expected_count} → {current_count})"
            )

        return None

    def _check_missing_documents(
        self,
        query: str,
        expected_docs: Set[str],
        current_docs: Set[str]
    ) -> List[CoverageRegression]:
        """Check for missing documents in query results."""
        regressions = []
        missing_docs = expected_docs - current_docs

        if missing_docs:
            regressions.append(CoverageRegression(
                query=query,
                regression_type="missing_document",
                severity="high",
                baseline_value=list(expected_docs),
                current_value=list(current_docs),
                diff=list(missing_docs)
            ))

        return regressions

    def _check_missing_authors(
        self,
        query: str,
        expected_authors: Set[str],
        current_authors: Set[str]
    ) -> List[CoverageRegression]:
        """Check for missing authors in query results."""
        regressions = []
        missing_authors = expected_authors - current_authors

        if missing_authors:
            regressions.append(CoverageRegression(
                query=query,
                regression_type="missing_author",
                severity="medium",
                baseline_value=list(expected_authors),
                current_value=list(current_authors),
                diff=list(missing_authors)
            ))

        return regressions

    def _check_ku_ids_changed(
        self,
        query: str,
        expected_ids: Set[str],
        current_ids: Set[str]
    ) -> Optional[CoverageRegression]:
        """Check if KU IDs changed (informational)."""
        deleted_ids = expected_ids - current_ids
        added_ids = current_ids - expected_ids

        if deleted_ids or added_ids:
            return CoverageRegression(
                query=query,
                regression_type="ku_ids_changed",
                severity="low",  # Informational only
                baseline_value=f"{len(expected_ids)} KUs",
                current_value=f"{len(current_ids)} KUs",
                diff={
                    "deleted": list(deleted_ids),
                    "added": list(added_ids)
                }
            )

        return None

    # ========================
    # Reasoning Stability Detection
    # ========================

    def check_reasoning_stability(
        self,
        baseline: ReasoningBaseline
    ) -> List[ReasoningStabilityIssue]:
        """
        Check reasoning unit stability.

        Args:
            baseline: Reasoning baseline to compare against

        Returns:
            List of stability issues
        """
        issues = []

        # Load current reasoning units
        current_rus = self.loader.get_all_rus()

        # 1. Check for deleted RUs (CRITICAL - immutability violation)
        deleted_issues = self._check_deleted_rus(
            set(baseline.reasoning_units.keys()),
            set(current_rus.keys())
        )
        issues.extend(deleted_issues)

        # 2. Check for relation changes (HIGH - semantic drift)
        relation_issues = self._check_relation_changes(
            baseline.reasoning_units,
            current_rus
        )
        issues.extend(relation_issues)

        # 3. Check for score drift (MEDIUM)
        score_issues = self._check_score_drift(
            baseline.reasoning_units,
            current_rus,
            threshold=0.3
        )
        issues.extend(score_issues)

        # 4. Check for knowledge_ids changes (MEDIUM)
        ku_ids_issues = self._check_ku_ids_changes(
            baseline.reasoning_units,
            current_rus
        )
        issues.extend(ku_ids_issues)

        return issues

    def _check_deleted_rus(
        self,
        baseline_ids: Set[str],
        current_ids: Set[str]
    ) -> List[ReasoningStabilityIssue]:
        """Check for deleted reasoning units (immutability violation)."""
        issues = []
        deleted_ids = baseline_ids - current_ids

        for ru_id in deleted_ids:
            issues.append(ReasoningStabilityIssue(
                issue_type="deleted_ru",
                severity="critical",
                ru_id=ru_id,
                baseline_value="exists",
                current_value="deleted",
                details="Immutability violation - RUs should never be deleted"
            ))

        return issues

    def _check_relation_changes(
        self,
        baseline_rus: Dict[str, ReasoningUnitBaseline],
        current_rus: Dict[str, ReasoningUnit]
    ) -> List[ReasoningStabilityIssue]:
        """Check for relation type changes."""
        issues = []

        for ru_id in set(baseline_rus.keys()) & set(current_rus.keys()):
            baseline_ru = baseline_rus[ru_id]
            current_ru = current_rus[ru_id]

            if baseline_ru.relation != current_ru.relation:
                issues.append(ReasoningStabilityIssue(
                    issue_type="relation_change",
                    severity="high",
                    ru_id=ru_id,
                    baseline_value=baseline_ru.relation,
                    current_value=current_ru.relation,
                    details=f"Relation changed: {baseline_ru.relation} → {current_ru.relation}"
                ))

        return issues

    def _check_score_drift(
        self,
        baseline_rus: Dict[str, ReasoningUnitBaseline],
        current_rus: Dict[str, ReasoningUnit],
        threshold: float = 0.3
    ) -> List[ReasoningStabilityIssue]:
        """Check for significant score drift."""
        issues = []

        for ru_id in set(baseline_rus.keys()) & set(current_rus.keys()):
            baseline_ru = baseline_rus[ru_id]
            current_ru = current_rus[ru_id]

            score_diff = abs(baseline_ru.score - current_ru.score)

            if score_diff > threshold:
                issues.append(ReasoningStabilityIssue(
                    issue_type="score_drift",
                    severity="medium",
                    ru_id=ru_id,
                    baseline_value=f"{baseline_ru.score:.3f}",
                    current_value=f"{current_ru.score:.3f}",
                    details=f"Score changed by {score_diff:.3f} (threshold={threshold})"
                ))

        return issues

    def _check_ku_ids_changes(
        self,
        baseline_rus: Dict[str, ReasoningUnitBaseline],
        current_rus: Dict[str, ReasoningUnit]
    ) -> List[ReasoningStabilityIssue]:
        """Check for changes in referenced knowledge_ids."""
        issues = []

        for ru_id in set(baseline_rus.keys()) & set(current_rus.keys()):
            baseline_ru = baseline_rus[ru_id]
            current_ru = current_rus[ru_id]

            baseline_ku_ids = set(baseline_ru.knowledge_ids)
            current_ku_ids = set(current_ru.knowledge_ids)

            if baseline_ku_ids != current_ku_ids:
                added = current_ku_ids - baseline_ku_ids
                removed = baseline_ku_ids - current_ku_ids

                issues.append(ReasoningStabilityIssue(
                    issue_type="ku_ids_changed",
                    severity="medium",
                    ru_id=ru_id,
                    baseline_value=f"{len(baseline_ku_ids)} KUs",
                    current_value=f"{len(current_ku_ids)} KUs",
                    details=f"Added: {len(added)}, Removed: {len(removed)}"
                ))

        return issues

    # ========================
    # Reporting
    # ========================

    def format_coverage_regression_report(
        self,
        regressions: List[CoverageRegression],
        show_low_severity: bool = False
    ) -> str:
        """
        Format coverage regressions as human-readable report.

        Args:
            regressions: List of regressions to format
            show_low_severity: Include low-severity issues

        Returns:
            Formatted report string
        """
        if not regressions:
            return "✅ No coverage regressions detected"

        # Filter by severity
        if not show_low_severity:
            regressions = [r for r in regressions if r.severity != "low"]

        if not regressions:
            return "✅ No significant coverage regressions detected"

        # Group by severity
        by_severity = {}
        for r in regressions:
            by_severity.setdefault(r.severity, []).append(r)

        report_lines = ["Coverage Regression Report", "=" * 50, ""]

        for severity in ["critical", "high", "medium", "low"]:
            if severity not in by_severity:
                continue

            count = len(by_severity[severity])
            emoji = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "⚪"}[severity]
            report_lines.append(f"{emoji} {severity.upper()} ({count} issues)")

            for r in by_severity[severity]:
                report_lines.append(f"  Query: {r.query}")
                report_lines.append(f"    Type: {r.regression_type}")
                report_lines.append(f"    Diff: {r.diff}")
                report_lines.append("")

        return "\n".join(report_lines)

    def format_reasoning_stability_report(
        self,
        issues: List[ReasoningStabilityIssue],
        show_low_severity: bool = False
    ) -> str:
        """
        Format reasoning stability issues as human-readable report.

        Args:
            issues: List of issues to format
            show_low_severity: Include low-severity issues

        Returns:
            Formatted report string
        """
        if not issues:
            return "✅ No reasoning stability issues detected"

        # Filter by severity
        if not show_low_severity:
            issues = [i for i in issues if i.severity != "low"]

        if not issues:
            return "✅ No significant reasoning stability issues detected"

        # Group by severity
        by_severity = {}
        for i in issues:
            by_severity.setdefault(i.severity, []).append(i)

        report_lines = ["Reasoning Stability Report", "=" * 50, ""]

        for severity in ["critical", "high", "medium", "low"]:
            if severity not in by_severity:
                continue

            count = len(by_severity[severity])
            emoji = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "⚪"}[severity]
            report_lines.append(f"{emoji} {severity.upper()} ({count} issues)")

            for i in by_severity[severity]:
                report_lines.append(f"  RU: {i.ru_id}")
                report_lines.append(f"    Issue: {i.issue_type}")
                report_lines.append(f"    Baseline: {i.baseline_value}")
                report_lines.append(f"    Current: {i.current_value}")
                if i.details:
                    report_lines.append(f"    Details: {i.details}")
                report_lines.append("")

        return "\n".join(report_lines)

    def get_highest_severity(self, issues: List) -> str:
        """
        Get the highest severity from a list of issues.

        Args:
            issues: List of regressions or stability issues

        Returns:
            Highest severity level ("critical", "high", "medium", "low", or "none")
        """
        if not issues:
            return "none"

        severity_order = ["critical", "high", "medium", "low"]

        for severity in severity_order:
            if any(i.severity == severity for i in issues):
                return severity

        return "none"
