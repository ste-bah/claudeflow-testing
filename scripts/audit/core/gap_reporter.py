#!/usr/bin/env python3
"""
Phase 16 Week 2: Gap Reporter

Generates actionable gap reports by aggregating findings from:
- Missing Link Detector
- Orphan Identifier
- Coverage Analyzer

Produces prioritized remediation recommendations.

Usage:
    python scripts/audit/core/gap_reporter.py --full --json
    python scripts/audit/core/gap_reporter.py --summary
    python scripts/audit/core/gap_reporter.py --remediation
    python scripts/audit/core/gap_reporter.py --export report.json
"""

import json
import sys
import argparse
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from enum import Enum
from datetime import datetime
from collections import defaultdict

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT_ROOT))

from audit.core.missing_link_detector import MissingLinkDetector, DetectionSummary
from audit.core.orphan_identifier import OrphanIdentifier, OrphanSummary
from audit.core.coverage_analyzer import CoverageAnalyzer, CoverageSummary


class GapSeverity(Enum):
    """Severity level for gaps."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class GapCategory(Enum):
    """Category of gap."""
    BROKEN_CHAIN = "broken_chain"
    ORPHAN_ENTITY = "orphan_entity"
    LOW_COVERAGE = "low_coverage"
    MISSING_REASONING = "missing_reasoning"
    UNUSED_CONTENT = "unused_content"


@dataclass
class Gap:
    """Represents a single gap finding."""
    gap_id: str
    category: GapCategory
    severity: GapSeverity
    title: str
    description: str
    affected_entities: List[str] = field(default_factory=list)
    impact: str = ""
    remediation: str = ""
    effort_estimate: str = ""  # low/medium/high
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "gap_id": self.gap_id,
            "category": self.category.value,
            "severity": self.severity.value,
            "title": self.title,
            "description": self.description,
            "affected_entities": self.affected_entities[:10],
            "impact": self.impact,
            "remediation": self.remediation,
            "effort_estimate": self.effort_estimate,
            "metadata": self.metadata
        }


@dataclass
class RemediationPlan:
    """Prioritized remediation plan."""
    priority: int
    gap_id: str
    action: str
    commands: List[str] = field(default_factory=list)
    estimated_effort: str = ""
    dependencies: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "priority": self.priority,
            "gap_id": self.gap_id,
            "action": self.action,
            "commands": self.commands,
            "estimated_effort": self.estimated_effort,
            "dependencies": self.dependencies
        }


@dataclass
class GapReport:
    """Complete gap analysis report."""
    report_id: str
    generated_at: str
    total_gaps: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    health_score: float
    health_grade: str
    gaps: List[Gap] = field(default_factory=list)
    remediation_plan: List[RemediationPlan] = field(default_factory=list)
    source_data: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "report_id": self.report_id,
            "generated_at": self.generated_at,
            "total_gaps": self.total_gaps,
            "by_severity": {
                "critical": self.critical_count,
                "high": self.high_count,
                "medium": self.medium_count,
                "low": self.low_count
            },
            "health_score": self.health_score,
            "health_grade": self.health_grade,
            "gaps": [g.to_dict() for g in self.gaps],
            "remediation_plan": [r.to_dict() for r in self.remediation_plan],
            "source_data": self.source_data
        }


class GapReporter:
    """
    Generates comprehensive gap reports from audit data.

    Aggregates findings from:
    - Missing link detection
    - Orphan identification
    - Coverage analysis

    Produces prioritized remediation plans.
    """

    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.gap_counter = 0

        # Initialize analyzers
        if self.verbose:
            print("Initializing analyzers...", file=sys.stderr)

        self.link_detector = MissingLinkDetector(verbose=verbose)
        self.orphan_identifier = OrphanIdentifier(verbose=verbose)
        self.coverage_analyzer = CoverageAnalyzer(verbose=verbose)

    def _next_gap_id(self) -> str:
        """Generate next gap ID."""
        self.gap_counter += 1
        return f"GAP-{self.gap_counter:04d}"

    def analyze_missing_links(self) -> List[Gap]:
        """Convert missing link findings to gaps."""
        gaps: List[Gap] = []
        summary = self.link_detector.detect_all()

        # Critical breaks
        if summary.critical_breaks:
            for break_item in summary.critical_breaks[:20]:
                gaps.append(Gap(
                    gap_id=self._next_gap_id(),
                    category=GapCategory.BROKEN_CHAIN,
                    severity=GapSeverity.CRITICAL,
                    title=f"Broken link: {break_item.source_id} -> {break_item.target_id}",
                    description=break_item.error_message or "Chain link broken",
                    affected_entities=[break_item.source_id, break_item.target_id],
                    impact="Claims cannot be traced to source, undermining provenance",
                    remediation=f"Verify {break_item.target_type} exists or update reference",
                    effort_estimate="low",
                    metadata={
                        "link_type": break_item.link_type.value,
                        "source_type": break_item.source_type
                    }
                ))

        # Summary gap for overall link health
        if summary.total_broken_links > 0:
            gaps.append(Gap(
                gap_id=self._next_gap_id(),
                category=GapCategory.BROKEN_CHAIN,
                severity=GapSeverity.HIGH if summary.integrity_score < 90 else GapSeverity.MEDIUM,
                title=f"Link integrity at {summary.integrity_score}%",
                description=f"{summary.total_broken_links} broken links across {summary.entities_with_issues} entities",
                affected_entities=[],
                impact="Reduced provenance chain completeness",
                remediation="Run link repair script to fix or remove broken references",
                effort_estimate="medium",
                metadata={
                    "total_broken": summary.total_broken_links,
                    "by_type": summary.by_link_type
                }
            ))

        return gaps

    def analyze_orphans(self) -> List[Gap]:
        """Convert orphan findings to gaps."""
        gaps: List[Gap] = []
        summary = self.orphan_identifier.identify_all()

        # Orphan chunks
        chunk_report = summary.reports.get("chunks")
        if chunk_report and chunk_report.orphan_count > 0:
            gaps.append(Gap(
                gap_id=self._next_gap_id(),
                category=GapCategory.ORPHAN_ENTITY,
                severity=GapSeverity.LOW,
                title=f"{chunk_report.orphan_count} orphan chunks",
                description=f"Chunks in ChromaDB not referenced by any KU ({chunk_report.utilization_rate}% utilization)",
                affected_entities=[o.entity_id for o in chunk_report.orphans[:10]],
                impact="Wasted storage, potential unused knowledge",
                remediation="Create KUs for valuable chunks or prune unused ones",
                effort_estimate="medium",
                metadata={"utilization_rate": chunk_report.utilization_rate}
            ))

        # Orphan KUs
        ku_report = summary.reports.get("kus")
        if ku_report and ku_report.orphan_count > 0:
            gaps.append(Gap(
                gap_id=self._next_gap_id(),
                category=GapCategory.MISSING_REASONING,
                severity=GapSeverity.MEDIUM,
                title=f"{ku_report.orphan_count} KUs without reasoning",
                description=f"Knowledge units not connected to any reasoning ({ku_report.utilization_rate}% connected)",
                affected_entities=[o.entity_id for o in ku_report.orphans[:10]],
                impact="Knowledge exists but won't appear in answers",
                remediation="Create reasoning units to connect isolated knowledge",
                effort_estimate="high",
                metadata={"utilization_rate": ku_report.utilization_rate}
            ))

        # Orphan PDFs
        pdf_report = summary.reports.get("pdfs")
        if pdf_report and pdf_report.orphan_count > 0:
            gaps.append(Gap(
                gap_id=self._next_gap_id(),
                category=GapCategory.UNUSED_CONTENT,
                severity=GapSeverity.HIGH,
                title=f"{pdf_report.orphan_count} PDFs not indexed",
                description=f"PDFs in corpus not represented in vector database ({pdf_report.utilization_rate}% indexed)",
                affected_entities=[o.entity_path for o in pdf_report.orphans[:10] if o.entity_path],
                impact="Source documents not searchable or citable",
                remediation="Run ingestion pipeline on unindexed PDFs",
                effort_estimate="medium",
                metadata={"utilization_rate": pdf_report.utilization_rate}
            ))

        # Isolated clusters
        cluster_report = summary.reports.get("clusters")
        if cluster_report and cluster_report.orphan_count > 0:
            gaps.append(Gap(
                gap_id=self._next_gap_id(),
                category=GapCategory.ORPHAN_ENTITY,
                severity=GapSeverity.MEDIUM,
                title=f"{cluster_report.orphan_count} isolated knowledge clusters",
                description="Groups of KUs disconnected from main knowledge graph",
                affected_entities=[],
                impact="Fragmented knowledge, reduced answer coherence",
                remediation="Create cross-topic reasoning to connect clusters",
                effort_estimate="high",
                metadata={"cluster_count": cluster_report.orphan_count}
            ))

        return gaps

    def analyze_coverage(self) -> List[Gap]:
        """Convert coverage findings to gaps."""
        gaps: List[Gap] = []
        summary = self.coverage_analyzer.analyze_all()

        # Low page coverage
        if summary.page_coverage_pct < 80:
            gaps.append(Gap(
                gap_id=self._next_gap_id(),
                category=GapCategory.LOW_COVERAGE,
                severity=GapSeverity.HIGH if summary.page_coverage_pct < 50 else GapSeverity.MEDIUM,
                title=f"Page coverage at {summary.page_coverage_pct}%",
                description=f"Only {summary.covered_pages}/{summary.total_pages} pages represented in chunks",
                affected_entities=[],
                impact="Significant source content not available for retrieval",
                remediation="Re-ingest documents with finer chunking or add missing pages",
                effort_estimate="high",
                metadata={
                    "total_pages": summary.total_pages,
                    "covered_pages": summary.covered_pages
                }
            ))

        # Low KU reasoning coverage
        if summary.ku_coverage_pct < 80:
            gaps.append(Gap(
                gap_id=self._next_gap_id(),
                category=GapCategory.MISSING_REASONING,
                severity=GapSeverity.MEDIUM,
                title=f"KU reasoning coverage at {summary.ku_coverage_pct}%",
                description=f"Only {summary.kus_with_reasoning}/{summary.total_kus} KUs connected to reasoning",
                affected_entities=[],
                impact="Knowledge exists but may not appear in answers",
                remediation="Create reasoning units for orphan KUs",
                effort_estimate="high",
                metadata={
                    "total_kus": summary.total_kus,
                    "with_reasoning": summary.kus_with_reasoning
                }
            ))

        # Individual document gaps
        coverage_gaps = self.coverage_analyzer.get_coverage_gaps()
        if coverage_gaps:
            low_coverage_docs = [g for g in coverage_gaps if g["overall_score"] < 30]
            if low_coverage_docs:
                gaps.append(Gap(
                    gap_id=self._next_gap_id(),
                    category=GapCategory.LOW_COVERAGE,
                    severity=GapSeverity.HIGH,
                    title=f"{len(low_coverage_docs)} documents with very low coverage",
                    description="Documents with <30% overall coverage score",
                    affected_entities=[g["document"] for g in low_coverage_docs[:10]],
                    impact="These sources are minimally represented in knowledge base",
                    remediation="Prioritize re-ingestion and KU creation for these documents",
                    effort_estimate="high",
                    metadata={"documents": low_coverage_docs[:5]}
                ))

        return gaps

    def generate_remediation_plan(self, gaps: List[Gap]) -> List[RemediationPlan]:
        """Generate prioritized remediation plan from gaps."""
        plans: List[RemediationPlan] = []

        # Sort by severity
        severity_order = {
            GapSeverity.CRITICAL: 0,
            GapSeverity.HIGH: 1,
            GapSeverity.MEDIUM: 2,
            GapSeverity.LOW: 3,
            GapSeverity.INFO: 4
        }

        sorted_gaps = sorted(gaps, key=lambda g: severity_order.get(g.severity, 5))

        for i, gap in enumerate(sorted_gaps, 1):
            commands = self._get_remediation_commands(gap)
            plans.append(RemediationPlan(
                priority=i,
                gap_id=gap.gap_id,
                action=gap.remediation,
                commands=commands,
                estimated_effort=gap.effort_estimate,
                dependencies=self._get_dependencies(gap)
            ))

        return plans

    def _get_remediation_commands(self, gap: Gap) -> List[str]:
        """Get CLI commands for remediation."""
        commands = []

        if gap.category == GapCategory.BROKEN_CHAIN:
            commands.append("python scripts/audit/core/missing_link_detector.py --broken-only")
            commands.append("# Review and fix broken references in knowledge.jsonl")

        elif gap.category == GapCategory.ORPHAN_ENTITY:
            commands.append("python scripts/audit/core/orphan_identifier.py --all")
            commands.append("# Create KUs/RUs for orphan entities or prune")

        elif gap.category == GapCategory.LOW_COVERAGE:
            commands.append("python scripts/audit/core/coverage_analyzer.py --gaps")
            for entity in gap.affected_entities[:3]:
                commands.append(f"python scripts/ingest/pipeline.py --pdf \"{entity}\"")

        elif gap.category == GapCategory.MISSING_REASONING:
            commands.append("python scripts/audit/core/orphan_identifier.py --kus")
            commands.append("# Create reasoning units for orphan KUs")

        elif gap.category == GapCategory.UNUSED_CONTENT:
            commands.append("python scripts/audit/core/orphan_identifier.py --pdfs")
            for entity in gap.affected_entities[:3]:
                commands.append(f"python scripts/ingest/pipeline.py --pdf \"{entity}\"")

        return commands

    def _get_dependencies(self, gap: Gap) -> List[str]:
        """Get dependencies for gap remediation."""
        deps = []

        if gap.category == GapCategory.MISSING_REASONING:
            deps.append("Ensure KUs are valid first (fix broken chains)")

        if gap.category == GapCategory.LOW_COVERAGE:
            deps.append("PDFs must be ingested first (fix orphan PDFs)")

        return deps

    def generate_report(self) -> GapReport:
        """Generate complete gap report."""
        report_id = f"GAP-REPORT-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

        # Collect all gaps
        gaps: List[Gap] = []
        gaps.extend(self.analyze_missing_links())
        gaps.extend(self.analyze_orphans())
        gaps.extend(self.analyze_coverage())

        # Count by severity
        severity_counts = defaultdict(int)
        for gap in gaps:
            severity_counts[gap.severity] += 1

        # Calculate health score
        # Weighted: critical=-20, high=-10, medium=-5, low=-2
        deductions = (
            severity_counts[GapSeverity.CRITICAL] * 20 +
            severity_counts[GapSeverity.HIGH] * 10 +
            severity_counts[GapSeverity.MEDIUM] * 5 +
            severity_counts[GapSeverity.LOW] * 2
        )
        health_score = max(0, 100 - deductions)

        # Health grade
        if health_score >= 90:
            grade = "A"
        elif health_score >= 80:
            grade = "B"
        elif health_score >= 70:
            grade = "C"
        elif health_score >= 60:
            grade = "D"
        else:
            grade = "F"

        # Generate remediation plan
        remediation = self.generate_remediation_plan(gaps)

        return GapReport(
            report_id=report_id,
            generated_at=datetime.now().isoformat(),
            total_gaps=len(gaps),
            critical_count=severity_counts[GapSeverity.CRITICAL],
            high_count=severity_counts[GapSeverity.HIGH],
            medium_count=severity_counts[GapSeverity.MEDIUM],
            low_count=severity_counts[GapSeverity.LOW],
            health_score=round(health_score, 2),
            health_grade=grade,
            gaps=gaps,
            remediation_plan=remediation,
            source_data={
                "link_integrity": self.link_detector.detect_all().integrity_score,
                "orphan_count": self.orphan_identifier.identify_all().total_orphans,
                "coverage_grade": self.coverage_analyzer.analyze_all().coverage_grade
            }
        )

    def export_report(self, output_path: str) -> None:
        """Export report to JSON file."""
        report = self.generate_report()
        with open(output_path, 'w') as f:
            json.dump(report.to_dict(), f, indent=2)


def main():
    parser = argparse.ArgumentParser(description="Generate gap analysis reports")
    parser.add_argument("--full", action="store_true", help="Full gap report")
    parser.add_argument("--summary", action="store_true", help="Summary only")
    parser.add_argument("--remediation", action="store_true", help="Remediation plan only")
    parser.add_argument("--export", metavar="FILE", help="Export report to JSON file")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    args = parser.parse_args()

    reporter = GapReporter(verbose=args.verbose)

    if args.export:
        reporter.export_report(args.export)
        print(f"Report exported to: {args.export}")

    elif args.summary:
        report = reporter.generate_report()
        if args.json:
            print(json.dumps(report.to_dict(), indent=2))
        else:
            print("Gap Analysis Summary")
            print("=" * 50)
            print(f"Report ID:     {report.report_id}")
            print(f"Generated:     {report.generated_at}")
            print(f"Total Gaps:    {report.total_gaps}")
            print(f"  Critical:    {report.critical_count}")
            print(f"  High:        {report.high_count}")
            print(f"  Medium:      {report.medium_count}")
            print(f"  Low:         {report.low_count}")
            print(f"Health Score:  {report.health_score}")
            print(f"Health Grade:  {report.health_grade}")

    elif args.remediation:
        report = reporter.generate_report()
        if args.json:
            print(json.dumps([r.to_dict() for r in report.remediation_plan], indent=2))
        else:
            print("Remediation Plan")
            print("=" * 60)
            for plan in report.remediation_plan[:15]:
                print(f"\n[Priority {plan.priority}] {plan.gap_id}")
                print(f"  Action: {plan.action}")
                print(f"  Effort: {plan.estimated_effort}")
                if plan.commands:
                    print("  Commands:")
                    for cmd in plan.commands[:3]:
                        print(f"    $ {cmd}")
                if plan.dependencies:
                    print(f"  Dependencies: {', '.join(plan.dependencies)}")

    elif args.full:
        report = reporter.generate_report()
        if args.json:
            print(json.dumps(report.to_dict(), indent=2))
        else:
            print("Full Gap Analysis Report")
            print("=" * 60)
            print(f"Report ID:     {report.report_id}")
            print(f"Generated:     {report.generated_at}")
            print(f"Health Score:  {report.health_score} (Grade: {report.health_grade})")
            print(f"\nTotal Gaps: {report.total_gaps}")
            print(f"  Critical: {report.critical_count}")
            print(f"  High: {report.high_count}")
            print(f"  Medium: {report.medium_count}")
            print(f"  Low: {report.low_count}")

            print("\n" + "-" * 60)
            print("GAPS:")
            for gap in report.gaps[:20]:
                sev_marker = {
                    GapSeverity.CRITICAL: "[!!!]",
                    GapSeverity.HIGH: "[!!]",
                    GapSeverity.MEDIUM: "[!]",
                    GapSeverity.LOW: "[.]",
                    GapSeverity.INFO: "[i]"
                }.get(gap.severity, "[?]")
                print(f"\n{sev_marker} {gap.gap_id}: {gap.title}")
                print(f"    {gap.description}")
                print(f"    Impact: {gap.impact}")
                print(f"    Fix: {gap.remediation}")

            print("\n" + "-" * 60)
            print("TOP REMEDIATION ACTIONS:")
            for plan in report.remediation_plan[:10]:
                print(f"\n  {plan.priority}. [{plan.gap_id}] {plan.action}")
                if plan.commands:
                    print(f"     $ {plan.commands[0]}")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
