#!/usr/bin/env python3
"""
Phase 16 Week 3: QA Dashboard Integration

Extends the QA Dashboard with provenance audit metrics:
- Link integrity scores
- Orphan entity counts
- Coverage analysis
- Gap severity breakdown
- Remediation status

Usage:
    python scripts/audit/cli/dashboard_integration.py --full
    python scripts/audit/cli/dashboard_integration.py --compact
    python scripts/audit/cli/dashboard_integration.py --json
"""

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Any, Optional, List
from datetime import datetime

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))

from audit.core.missing_link_detector import MissingLinkDetector
from audit.core.orphan_identifier import OrphanIdentifier
from audit.core.coverage_analyzer import CoverageAnalyzer
from audit.core.gap_reporter import GapReporter

# Try importing QA dashboard builder
try:
    from qa.reporting.dashboard_builder import DashboardBuilder, DashboardData, MetricSummary
    HAS_QA_DASHBOARD = True
except ImportError:
    HAS_QA_DASHBOARD = False


@dataclass
class AuditMetrics:
    """Audit metrics for dashboard integration."""
    # Link integrity
    total_links: int = 0
    broken_links: int = 0
    link_integrity_pct: float = 100.0

    # Orphan counts
    orphan_chunks: int = 0
    orphan_kus: int = 0
    orphan_pdfs: int = 0
    isolated_clusters: int = 0
    total_orphans: int = 0

    # Coverage
    page_coverage_pct: float = 0.0
    ku_coverage_pct: float = 0.0
    coverage_grade: str = "?"

    # Gaps
    critical_gaps: int = 0
    high_gaps: int = 0
    medium_gaps: int = 0
    low_gaps: int = 0
    total_gaps: int = 0

    # Health
    audit_health_score: float = 100.0
    audit_health_grade: str = "A"

    # Remediation
    pending_fixes: int = 0
    auto_fixable: int = 0
    manual_required: int = 0

    # Timestamp
    generated: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")


@dataclass
class IntegratedDashboard:
    """Combined QA + Audit dashboard."""
    qa_data: Optional[Any] = None  # DashboardData from QA
    audit_metrics: Optional[AuditMetrics] = None
    combined_health_score: float = 0.0
    combined_health_grade: str = "?"
    generated: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")


class AuditDashboardIntegration:
    """
    Integrates provenance audit metrics into QA dashboard.

    Features:
    - Collects audit metrics from all audit components
    - Extends QA dashboard with audit section
    - Calculates combined health score
    - Provides compact and full views
    """

    def __init__(self, verbose: bool = False):
        self.verbose = verbose

        # Audit components
        self.link_detector = MissingLinkDetector(verbose=verbose)
        self.orphan_identifier = OrphanIdentifier(verbose=verbose)
        self.coverage_analyzer = CoverageAnalyzer(verbose=verbose)
        self.gap_reporter = GapReporter(verbose=verbose)

        # QA dashboard (optional)
        self.qa_builder = None
        if HAS_QA_DASHBOARD:
            self.qa_builder = DashboardBuilder()

    def _log(self, message: str):
        """Log message if verbose."""
        if self.verbose:
            print(f"[AUDIT-DASHBOARD] {message}", file=sys.stderr)

    def collect_audit_metrics(self) -> AuditMetrics:
        """Collect all audit metrics."""
        metrics = AuditMetrics()

        self._log("Collecting link integrity metrics...")
        link_summary = self.link_detector.detect_all()
        metrics.total_links = link_summary.total_links_checked
        metrics.broken_links = link_summary.total_broken_links
        metrics.link_integrity_pct = link_summary.integrity_score

        self._log("Collecting orphan metrics...")

        # Orphan chunks
        chunk_report = self.orphan_identifier.find_orphan_chunks()
        metrics.orphan_chunks = chunk_report.orphan_count

        # Orphan KUs
        ku_report = self.orphan_identifier.find_orphan_kus()
        metrics.orphan_kus = ku_report.orphan_count

        # Orphan PDFs
        pdf_report = self.orphan_identifier.find_orphan_pdfs()
        metrics.orphan_pdfs = pdf_report.orphan_count

        # Isolated clusters
        cluster_report = self.orphan_identifier.find_isolated_clusters()
        metrics.isolated_clusters = cluster_report.orphan_count

        metrics.total_orphans = (
            metrics.orphan_chunks +
            metrics.orphan_kus +
            metrics.orphan_pdfs +
            metrics.isolated_clusters
        )

        self._log("Collecting coverage metrics...")
        coverage_result = self.coverage_analyzer.analyze_all()
        metrics.page_coverage_pct = coverage_result.page_coverage_pct
        metrics.ku_coverage_pct = coverage_result.ku_coverage_pct
        metrics.coverage_grade = coverage_result.coverage_grade

        self._log("Collecting gap metrics...")
        gap_report = self.gap_reporter.generate_report()
        metrics.critical_gaps = gap_report.critical_count
        metrics.high_gaps = gap_report.high_count
        metrics.medium_gaps = gap_report.medium_count
        metrics.low_gaps = gap_report.low_count
        metrics.total_gaps = gap_report.total_gaps

        metrics.audit_health_score = gap_report.health_score
        metrics.audit_health_grade = gap_report.health_grade

        # Calculate fixable issues
        # Auto-fixable: broken links can be pruned, orphan KUs can get placeholder RUs
        metrics.auto_fixable = metrics.broken_links + metrics.orphan_kus
        # All issues that need attention
        metrics.pending_fixes = metrics.total_gaps + metrics.orphan_chunks + metrics.isolated_clusters
        # Manual review required for orphan chunks and isolated clusters
        metrics.manual_required = max(0, metrics.pending_fixes - metrics.auto_fixable)

        return metrics

    def build_integrated_dashboard(self) -> IntegratedDashboard:
        """Build combined QA + Audit dashboard."""
        dashboard = IntegratedDashboard()

        # Collect audit metrics
        dashboard.audit_metrics = self.collect_audit_metrics()

        # Get QA data if available
        if self.qa_builder:
            try:
                dashboard.qa_data = self.qa_builder.build_dashboard()
            except Exception as e:
                self._log(f"Failed to get QA data: {e}")

        # Calculate combined health score
        if dashboard.qa_data and hasattr(dashboard.qa_data, 'health_score'):
            qa_score = dashboard.qa_data.health_score
            audit_score = dashboard.audit_metrics.audit_health_score
            # Weighted average (60% QA, 40% Audit)
            dashboard.combined_health_score = (qa_score * 0.6) + (audit_score * 0.4)
        else:
            dashboard.combined_health_score = dashboard.audit_metrics.audit_health_score

        # Calculate combined grade
        score = dashboard.combined_health_score
        if score >= 90:
            dashboard.combined_health_grade = "A"
        elif score >= 80:
            dashboard.combined_health_grade = "B"
        elif score >= 70:
            dashboard.combined_health_grade = "C"
        elif score >= 60:
            dashboard.combined_health_grade = "D"
        else:
            dashboard.combined_health_grade = "F"

        return dashboard

    def display_audit_section(self, metrics: AuditMetrics) -> str:
        """Render audit section as terminal output."""
        lines = []

        # Header
        lines.append("")
        lines.append("╔" + "═" * 58 + "╗")
        lines.append("║" + " " * 14 + "Provenance Audit Status" + " " * 21 + "║")
        lines.append("╠" + "═" * 58 + "╣")

        # Health score
        grade = metrics.audit_health_grade
        score = metrics.audit_health_score
        grade_icon = {"A": "🟢", "B": "🟢", "C": "🟡", "D": "🟠", "F": "🔴"}.get(grade, "⚪")
        lines.append(f"║  Audit Health: {grade_icon} {score:.0f}/100 ({grade})" + " " * (33 - len(str(int(score)))) + "║")
        lines.append("╠" + "═" * 58 + "╣")

        # Link Integrity
        lines.append("║  Link Integrity:                                         ║")
        integrity_icon = "🟢" if metrics.link_integrity_pct >= 95 else ("🟡" if metrics.link_integrity_pct >= 80 else "🔴")
        line = f"    Status: {integrity_icon} {metrics.link_integrity_pct:.1f}% ({metrics.total_links} links)"
        lines.append("║" + line + " " * (56 - len(line)) + "║")

        if metrics.broken_links > 0:
            line = f"    Broken: {metrics.broken_links}"
            lines.append("║" + line + " " * (56 - len(line)) + "║")

        lines.append("╠" + "═" * 58 + "╣")

        # Orphan Entities
        lines.append("║  Orphan Entities:                                        ║")

        orphan_items = [
            ("Chunks (unused)", metrics.orphan_chunks, "⚪"),
            ("KUs (no reasoning)", metrics.orphan_kus, "🟡"),
            ("PDFs (unindexed)", metrics.orphan_pdfs, "🔴"),
            ("Isolated clusters", metrics.isolated_clusters, "🟡")
        ]

        for name, count, icon in orphan_items:
            if count > 0:
                line = f"    {name}: {icon} {count}"
                lines.append("║" + line + " " * (56 - len(line)) + "║")

        if metrics.total_orphans == 0:
            line = "    None found ✓"
            lines.append("║" + line + " " * (56 - len(line)) + "║")

        lines.append("╠" + "═" * 58 + "╣")

        # Coverage
        lines.append("║  Coverage Analysis:                                      ║")

        page_icon = "🟢" if metrics.page_coverage_pct >= 80 else ("🟡" if metrics.page_coverage_pct >= 60 else "🔴")
        line = f"    Page Coverage: {page_icon} {metrics.page_coverage_pct:.1f}%"
        lines.append("║" + line + " " * (56 - len(line)) + "║")

        ku_icon = "🟢" if metrics.ku_coverage_pct >= 70 else ("🟡" if metrics.ku_coverage_pct >= 50 else "🔴")
        line = f"    KU→RU Coverage: {ku_icon} {metrics.ku_coverage_pct:.1f}%"
        lines.append("║" + line + " " * (56 - len(line)) + "║")

        line = f"    Grade: {metrics.coverage_grade}"
        lines.append("║" + line + " " * (56 - len(line)) + "║")

        lines.append("╠" + "═" * 58 + "╣")

        # Gap Summary
        lines.append("║  Gap Summary:                                            ║")

        gap_items = [
            ("Critical", metrics.critical_gaps, "🔴"),
            ("High", metrics.high_gaps, "🟠"),
            ("Medium", metrics.medium_gaps, "🟡"),
            ("Low", metrics.low_gaps, "⚪")
        ]

        for name, count, icon in gap_items:
            line = f"    {name}: {icon} {count}"
            lines.append("║" + line + " " * (56 - len(line)) + "║")

        lines.append("╠" + "═" * 58 + "╣")

        # Remediation Status
        lines.append("║  Remediation Status:                                     ║")

        line = f"    Total pending: {metrics.pending_fixes}"
        lines.append("║" + line + " " * (56 - len(line)) + "║")

        line = f"    Auto-fixable: {metrics.auto_fixable}"
        lines.append("║" + line + " " * (56 - len(line)) + "║")

        line = f"    Manual required: {metrics.manual_required}"
        lines.append("║" + line + " " * (56 - len(line)) + "║")

        # Footer
        lines.append("╠" + "═" * 58 + "╣")
        timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
        lines.append(f"║  Generated: {timestamp}" + " " * (45 - len(timestamp)) + "║")
        lines.append("╚" + "═" * 58 + "╝")
        lines.append("")

        return "\n".join(lines)

    def display_full_dashboard(self, dashboard: Optional[IntegratedDashboard] = None) -> str:
        """Render complete integrated dashboard."""
        if dashboard is None:
            dashboard = self.build_integrated_dashboard()

        lines = []

        # Combined header
        lines.append("")
        lines.append("╔" + "═" * 58 + "╗")
        lines.append("║" + " " * 11 + "God-Learn Integrated Dashboard" + " " * 16 + "║")
        lines.append("╠" + "═" * 58 + "╣")

        # Combined health
        grade = dashboard.combined_health_grade
        score = dashboard.combined_health_score
        grade_icon = {"A": "🟢", "B": "🟢", "C": "🟡", "D": "🟠", "F": "🔴"}.get(grade, "⚪")
        lines.append(f"║  Combined Health: {grade_icon} {score:.0f}/100 ({grade})" + " " * (30 - len(str(int(score)))) + "║")
        lines.append("╚" + "═" * 58 + "╝")

        output = "\n".join(lines)

        # Add QA section if available
        if self.qa_builder and dashboard.qa_data:
            output += self.qa_builder.display_dashboard(dashboard.qa_data)

        # Add Audit section
        if dashboard.audit_metrics:
            output += self.display_audit_section(dashboard.audit_metrics)

        return output

    def display_compact(self, dashboard: Optional[IntegratedDashboard] = None) -> str:
        """Render compact single-line dashboard."""
        if dashboard is None:
            dashboard = self.build_integrated_dashboard()

        metrics = dashboard.audit_metrics

        if metrics.critical_gaps > 0:
            status = "🔴 CRITICAL"
        elif metrics.high_gaps > 0 or metrics.broken_links > 0:
            status = "🟠 WARNING"
        elif metrics.audit_health_score >= 80:
            status = "🟢 HEALTHY"
        else:
            status = "🟡 OK"

        parts = [
            f"Audit: {status}",
            f"Links: {metrics.link_integrity_pct:.0f}%",
            f"Orphans: {metrics.total_orphans}",
            f"Gaps: {metrics.total_gaps}",
            f"Health: {metrics.audit_health_score:.0f}/100 ({metrics.audit_health_grade})"
        ]

        return " | ".join(parts)

    def to_json(self, dashboard: Optional[IntegratedDashboard] = None) -> Dict[str, Any]:
        """Export dashboard as JSON."""
        if dashboard is None:
            dashboard = self.build_integrated_dashboard()

        metrics = dashboard.audit_metrics

        result = {
            "generated": dashboard.generated,
            "combined_health": {
                "score": dashboard.combined_health_score,
                "grade": dashboard.combined_health_grade
            },
            "audit": {
                "health_score": metrics.audit_health_score,
                "health_grade": metrics.audit_health_grade,
                "link_integrity": {
                    "total_links": metrics.total_links,
                    "broken_links": metrics.broken_links,
                    "integrity_pct": metrics.link_integrity_pct
                },
                "orphans": {
                    "chunks": metrics.orphan_chunks,
                    "kus": metrics.orphan_kus,
                    "pdfs": metrics.orphan_pdfs,
                    "isolated_clusters": metrics.isolated_clusters,
                    "total": metrics.total_orphans
                },
                "coverage": {
                    "page_coverage_pct": metrics.page_coverage_pct,
                    "ku_coverage_pct": metrics.ku_coverage_pct,
                    "grade": metrics.coverage_grade
                },
                "gaps": {
                    "critical": metrics.critical_gaps,
                    "high": metrics.high_gaps,
                    "medium": metrics.medium_gaps,
                    "low": metrics.low_gaps,
                    "total": metrics.total_gaps
                },
                "remediation": {
                    "pending": metrics.pending_fixes,
                    "auto_fixable": metrics.auto_fixable,
                    "manual_required": metrics.manual_required
                }
            }
        }

        # Add QA data if available
        if dashboard.qa_data:
            result["qa"] = {
                "health_score": dashboard.qa_data.health_score,
                "health_grade": dashboard.qa_data.health_grade,
                "check_status": dashboard.qa_data.check_status,
                "issue_counts": dashboard.qa_data.issue_counts
            }

        return result


def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Audit Dashboard Integration")
    parser.add_argument("--full", action="store_true", help="Show full integrated dashboard")
    parser.add_argument("--compact", action="store_true", help="Show compact single-line status")
    parser.add_argument("--audit-only", action="store_true", help="Show only audit section")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    args = parser.parse_args()

    integration = AuditDashboardIntegration(verbose=args.verbose)
    dashboard = integration.build_integrated_dashboard()

    if args.json:
        print(json.dumps(integration.to_json(dashboard), indent=2))
        return 0

    if args.compact:
        print(integration.display_compact(dashboard))
        return 0

    if args.audit_only:
        print(integration.display_audit_section(dashboard.audit_metrics))
        return 0

    # Default: full dashboard
    print(integration.display_full_dashboard(dashboard))
    return 0


if __name__ == "__main__":
    sys.exit(main())
