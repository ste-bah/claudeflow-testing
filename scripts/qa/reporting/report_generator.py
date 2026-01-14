#!/usr/bin/env python3
"""
QA Report Generator - Advanced reporting with trend analysis

Features:
- Historical tracking across multiple reports
- Trend analysis (7-day, 30-day)
- Severity-based grouping
- Delta calculations between reports
- Growth rate calculations
"""

import json
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import sys

# Add scripts to path
scripts_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(scripts_dir))

from qa.core.baseline_manager import BaselineManager
from qa.core.regression_detector import RegressionDetector
from qa.core.consistency_checker import ConsistencyChecker
from explore.core.artifact_loader import ArtifactLoader


@dataclass
class TrendPoint:
    """A single data point in a trend series."""
    timestamp: str
    value: float
    delta: Optional[float] = None
    delta_pct: Optional[float] = None


@dataclass
class TrendAnalysis:
    """Trend analysis for a metric over time."""
    metric_name: str
    current_value: float
    trend_7d: Optional[float] = None  # % change over 7 days
    trend_30d: Optional[float] = None  # % change over 30 days
    direction: str = "stable"  # "up", "down", "stable"
    data_points: List[TrendPoint] = field(default_factory=list)


@dataclass
class HealthScore:
    """Overall health score calculation."""
    score: float  # 0-100
    grade: str  # A, B, C, D, F
    factors: Dict[str, float] = field(default_factory=dict)
    breakdown: Dict[str, str] = field(default_factory=dict)


@dataclass
class QAReportV2:
    """Enhanced QA report with trend analysis."""
    version: str = "2.0"
    generated: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")

    # Corpus snapshot
    corpus_stats: Dict[str, Any] = field(default_factory=dict)

    # Check results
    coverage_check: Dict[str, Any] = field(default_factory=dict)
    reasoning_check: Dict[str, Any] = field(default_factory=dict)
    consistency_check: Dict[str, Any] = field(default_factory=dict)

    # Trend analysis
    trends: Dict[str, TrendAnalysis] = field(default_factory=dict)

    # Health score
    health: Optional[HealthScore] = None

    # Deltas from previous report
    deltas: Dict[str, Any] = field(default_factory=dict)


class ReportGenerator:
    """
    Advanced QA Report Generator with trend analysis.

    Generates comprehensive reports with:
    - Current state snapshot
    - Historical trend analysis
    - Severity grouping
    - Health scoring
    """

    def __init__(
        self,
        project_root: Optional[Path] = None,
        reports_dir: Optional[Path] = None
    ):
        """
        Initialize report generator.

        Args:
            project_root: Project root directory
            reports_dir: Directory for report storage
        """
        if project_root is None:
            project_root = Path(__file__).parent.parent.parent.parent

        self.project_root = Path(project_root)

        if reports_dir is None:
            reports_dir = self.project_root / "qa" / "reports"

        self.reports_dir = Path(reports_dir)
        self.reports_dir.mkdir(parents=True, exist_ok=True)

        # Initialize components
        self.loader = ArtifactLoader(self.project_root)
        self.baseline_manager = BaselineManager()
        self.detector = RegressionDetector()
        self.checker = ConsistencyChecker()

    # ========================
    # Report Generation
    # ========================

    def generate_report(
        self,
        include_trends: bool = True,
        include_health: bool = True,
        trend_days: int = 30
    ) -> QAReportV2:
        """
        Generate comprehensive QA report.

        Args:
            include_trends: Include trend analysis
            include_health: Include health scoring
            trend_days: Number of days for trend analysis

        Returns:
            Complete QA report
        """
        report = QAReportV2()

        # 1. Corpus snapshot
        report.corpus_stats = self._get_corpus_stats()

        # 2. Run checks
        report.coverage_check = self._run_coverage_check()
        report.reasoning_check = self._run_reasoning_check()
        report.consistency_check = self._run_consistency_check()

        # 3. Trend analysis
        if include_trends:
            report.trends = self._analyze_trends(trend_days)

        # 4. Health score
        if include_health:
            report.health = self._calculate_health_score(report)

        # 5. Deltas from previous report
        previous = self._get_previous_report()
        if previous:
            report.deltas = self._calculate_deltas(previous, report)

        return report

    def save_report(
        self,
        report: QAReportV2,
        output_path: Optional[Path] = None
    ) -> Path:
        """
        Save report to disk.

        Args:
            report: Report to save
            output_path: Custom output path

        Returns:
            Path to saved report
        """
        if output_path is None:
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            output_path = self.reports_dir / f"report_{timestamp}.json"

        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Serialize report
        data = self._serialize_report(report)

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)

        return output_path

    def _serialize_report(self, report: QAReportV2) -> Dict[str, Any]:
        """Serialize report to JSON-serializable dict."""
        data = {
            "version": report.version,
            "generated": report.generated,
            "corpus_stats": report.corpus_stats,
            "checks": {
                "coverage": report.coverage_check,
                "reasoning": report.reasoning_check,
                "consistency": report.consistency_check
            }
        }

        # Serialize trends
        if report.trends:
            data["trends"] = {
                name: {
                    "metric_name": t.metric_name,
                    "current_value": t.current_value,
                    "trend_7d": t.trend_7d,
                    "trend_30d": t.trend_30d,
                    "direction": t.direction,
                    "data_points": [
                        {
                            "timestamp": p.timestamp,
                            "value": p.value,
                            "delta": p.delta,
                            "delta_pct": p.delta_pct
                        }
                        for p in t.data_points
                    ]
                }
                for name, t in report.trends.items()
            }

        # Serialize health
        if report.health:
            data["health"] = {
                "score": report.health.score,
                "grade": report.health.grade,
                "factors": report.health.factors,
                "breakdown": report.health.breakdown
            }

        # Deltas
        if report.deltas:
            data["deltas"] = report.deltas

        return data

    # ========================
    # Corpus Stats
    # ========================

    def _get_corpus_stats(self) -> Dict[str, Any]:
        """Get current corpus statistics."""
        all_kus = self.loader.get_all_kus()
        all_rus = self.loader.get_all_rus()

        # Document and author stats
        documents = set()
        authors = set()
        for ku in all_kus.values():
            if ku.sources:
                documents.add(ku.sources[0].title)
                authors.add(ku.sources[0].author)

        # Relation distribution
        relations = {}
        for ru in all_rus.values():
            relations[ru.relation] = relations.get(ru.relation, 0) + 1

        # Score distribution
        scores = [ru.score for ru in all_rus.values()]
        avg_score = sum(scores) / len(scores) if scores else 0
        min_score = min(scores) if scores else 0
        max_score = max(scores) if scores else 0

        return {
            "knowledge_units": len(all_kus),
            "reasoning_units": len(all_rus),
            "unique_documents": len(documents),
            "unique_authors": len(authors),
            "documents": sorted(list(documents)),
            "authors": sorted(list(authors)),
            "relation_distribution": relations,
            "score_stats": {
                "average": round(avg_score, 4),
                "min": round(min_score, 4),
                "max": round(max_score, 4)
            }
        }

    # ========================
    # Check Runners
    # ========================

    def _run_coverage_check(self) -> Dict[str, Any]:
        """Run coverage regression check."""
        if not self.baseline_manager.coverage_file.exists():
            return {
                "status": "skipped",
                "reason": "No coverage baseline found"
            }

        baseline = self.baseline_manager.load_coverage_baseline()
        regressions = self.detector.detect_coverage_regressions(baseline)

        # Group by severity
        by_severity = {"critical": [], "high": [], "medium": [], "low": []}
        for r in regressions:
            by_severity[r.severity].append({
                "query": r.query,
                "type": r.regression_type,
                "baseline_value": r.baseline_value,
                "current_value": r.current_value,
                "diff": str(r.diff)
            })

        highest = self.detector.get_highest_severity([r.severity for r in regressions])

        return {
            "status": "checked",
            "total_regressions": len(regressions),
            "highest_severity": highest if regressions else None,
            "by_severity": {k: len(v) for k, v in by_severity.items()},
            "regressions": by_severity
        }

    def _run_reasoning_check(self) -> Dict[str, Any]:
        """Run reasoning stability check."""
        if not self.baseline_manager.reasoning_file.exists():
            return {
                "status": "skipped",
                "reason": "No reasoning baseline found"
            }

        baseline = self.baseline_manager.load_reasoning_baseline()
        issues = self.detector.check_reasoning_stability(baseline)

        # Group by severity
        by_severity = {"critical": [], "high": [], "medium": [], "low": []}
        for i in issues:
            by_severity[i.severity].append({
                "ru_id": i.ru_id,
                "type": i.issue_type,
                "baseline_value": str(i.baseline_value),
                "current_value": str(i.current_value),
                "details": i.details
            })

        highest = self.detector.get_highest_severity([i.severity for i in issues])

        return {
            "status": "checked",
            "total_issues": len(issues),
            "highest_severity": highest if issues else None,
            "by_severity": {k: len(v) for k, v in by_severity.items()},
            "issues": by_severity
        }

    def _run_consistency_check(self) -> Dict[str, Any]:
        """Run consistency check."""
        results = self.checker.check_all()
        summary = self.checker.get_summary(results)

        return {
            "status": "checked",
            "total_issues": summary["total_issues"],
            "has_critical": summary["has_critical"],
            "has_high": summary["has_high"],
            "by_severity": summary["by_severity"],
            "by_check": summary["by_check"]
        }

    # ========================
    # Trend Analysis
    # ========================

    def _analyze_trends(self, days: int = 30) -> Dict[str, TrendAnalysis]:
        """
        Analyze trends across historical reports.

        Args:
            days: Number of days to analyze

        Returns:
            Dictionary of metric name to trend analysis
        """
        # Load historical reports
        historical = self._load_historical_reports(days)

        if len(historical) < 2:
            return {}

        trends = {}

        # KU count trend
        ku_trend = self._calculate_metric_trend(
            "knowledge_units",
            [(r["generated"], r.get("corpus_stats", {}).get("knowledge_units", 0))
             for r in historical]
        )
        if ku_trend:
            trends["knowledge_units"] = ku_trend

        # RU count trend
        ru_trend = self._calculate_metric_trend(
            "reasoning_units",
            [(r["generated"], r.get("corpus_stats", {}).get("reasoning_units", 0))
             for r in historical]
        )
        if ru_trend:
            trends["reasoning_units"] = ru_trend

        # Consistency issues trend
        consistency_trend = self._calculate_metric_trend(
            "consistency_issues",
            [(r["generated"], r.get("checks", {}).get("consistency", {}).get("total_issues", 0))
             for r in historical]
        )
        if consistency_trend:
            trends["consistency_issues"] = consistency_trend

        # Health score trend
        health_trend = self._calculate_metric_trend(
            "health_score",
            [(r["generated"], r.get("health", {}).get("score", 0))
             for r in historical if r.get("health")]
        )
        if health_trend:
            trends["health_score"] = health_trend

        return trends

    def _load_historical_reports(self, days: int) -> List[Dict[str, Any]]:
        """Load historical reports from the last N days."""
        reports = []
        cutoff = datetime.utcnow() - timedelta(days=days)

        for report_file in sorted(self.reports_dir.glob("report_*.json")):
            try:
                with open(report_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                # Check if within date range
                generated = data.get("generated", "")
                if generated:
                    report_date = datetime.fromisoformat(generated.replace("Z", "+00:00"))
                    if report_date.replace(tzinfo=None) >= cutoff:
                        reports.append(data)
            except (json.JSONDecodeError, KeyError):
                continue

        return sorted(reports, key=lambda r: r.get("generated", ""))

    def _calculate_metric_trend(
        self,
        metric_name: str,
        data_points: List[Tuple[str, float]]
    ) -> Optional[TrendAnalysis]:
        """Calculate trend for a metric."""
        if len(data_points) < 2:
            return None

        # Convert to TrendPoints with deltas
        points = []
        prev_value = None
        for timestamp, value in data_points:
            delta = None
            delta_pct = None
            if prev_value is not None and prev_value != 0:
                delta = value - prev_value
                delta_pct = (delta / prev_value) * 100

            points.append(TrendPoint(
                timestamp=timestamp,
                value=value,
                delta=delta,
                delta_pct=round(delta_pct, 2) if delta_pct else None
            ))
            prev_value = value

        current_value = points[-1].value if points else 0

        # Calculate 7-day trend
        trend_7d = None
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        points_7d = [p for p in points
                     if datetime.fromisoformat(p.timestamp.replace("Z", "+00:00")).replace(tzinfo=None) >= seven_days_ago]
        if len(points_7d) >= 2 and points_7d[0].value != 0:
            trend_7d = ((points_7d[-1].value - points_7d[0].value) / points_7d[0].value) * 100

        # Calculate 30-day trend
        trend_30d = None
        if len(points) >= 2 and points[0].value != 0:
            trend_30d = ((points[-1].value - points[0].value) / points[0].value) * 100

        # Determine direction
        if trend_7d is not None:
            if trend_7d > 5:
                direction = "up"
            elif trend_7d < -5:
                direction = "down"
            else:
                direction = "stable"
        else:
            direction = "stable"

        return TrendAnalysis(
            metric_name=metric_name,
            current_value=current_value,
            trend_7d=round(trend_7d, 2) if trend_7d else None,
            trend_30d=round(trend_30d, 2) if trend_30d else None,
            direction=direction,
            data_points=points[-10:]  # Last 10 points only
        )

    # ========================
    # Health Scoring
    # ========================

    def _calculate_health_score(self, report: QAReportV2) -> HealthScore:
        """
        Calculate overall health score.

        Score components:
        - Coverage check (25 points)
        - Reasoning check (25 points)
        - Consistency check (30 points)
        - Corpus size (10 points)
        - Baseline freshness (10 points)
        """
        factors = {}
        breakdown = {}

        # 1. Coverage check (25 points)
        coverage_score = 25.0
        if report.coverage_check.get("status") == "checked":
            regressions = report.coverage_check.get("total_regressions", 0)
            highest = report.coverage_check.get("highest_severity")

            if highest == "critical":
                coverage_score = 0
                breakdown["coverage"] = "CRITICAL regressions detected"
            elif highest == "high":
                coverage_score = 10
                breakdown["coverage"] = "HIGH severity regressions"
            elif highest == "medium":
                coverage_score = 18
                breakdown["coverage"] = "MEDIUM severity regressions"
            elif regressions > 0:
                coverage_score = 22
                breakdown["coverage"] = "LOW severity regressions"
            else:
                coverage_score = 25
                breakdown["coverage"] = "No regressions"
        else:
            coverage_score = 20  # Partial credit if no baseline
            breakdown["coverage"] = "No baseline established"

        factors["coverage"] = coverage_score

        # 2. Reasoning check (25 points)
        reasoning_score = 25.0
        if report.reasoning_check.get("status") == "checked":
            issues = report.reasoning_check.get("total_issues", 0)
            highest = report.reasoning_check.get("highest_severity")

            if highest == "critical":
                reasoning_score = 0
                breakdown["reasoning"] = "CRITICAL stability issues"
            elif highest == "high":
                reasoning_score = 10
                breakdown["reasoning"] = "HIGH severity issues"
            elif highest == "medium":
                reasoning_score = 18
                breakdown["reasoning"] = "MEDIUM severity issues"
            elif issues > 0:
                reasoning_score = 22
                breakdown["reasoning"] = "LOW severity issues"
            else:
                reasoning_score = 25
                breakdown["reasoning"] = "No stability issues"
        else:
            reasoning_score = 20
            breakdown["reasoning"] = "No baseline established"

        factors["reasoning"] = reasoning_score

        # 3. Consistency check (30 points)
        consistency_score = 30.0
        if report.consistency_check.get("status") == "checked":
            has_critical = report.consistency_check.get("has_critical", False)
            has_high = report.consistency_check.get("has_high", False)
            total = report.consistency_check.get("total_issues", 0)

            if has_critical:
                consistency_score = 0
                breakdown["consistency"] = "CRITICAL issues detected"
            elif has_high:
                consistency_score = 15
                breakdown["consistency"] = "HIGH severity issues"
            elif total > 50:
                consistency_score = 22
                breakdown["consistency"] = f"{total} issues (>50)"
            elif total > 20:
                consistency_score = 26
                breakdown["consistency"] = f"{total} issues (>20)"
            else:
                consistency_score = 30
                breakdown["consistency"] = f"Only {total} low issues"

        factors["consistency"] = consistency_score

        # 4. Corpus size (10 points)
        corpus_score = 10.0
        kus = report.corpus_stats.get("knowledge_units", 0)
        rus = report.corpus_stats.get("reasoning_units", 0)

        if kus < 10 or rus < 10:
            corpus_score = 5
            breakdown["corpus"] = "Small corpus size"
        else:
            corpus_score = 10
            breakdown["corpus"] = f"{kus} KUs, {rus} RUs"

        factors["corpus_size"] = corpus_score

        # 5. Baseline freshness (10 points)
        freshness_score = 10.0
        baselines = self.baseline_manager.list_baselines()
        active_count = sum(1 for v in baselines.values() if v)

        if active_count == 3:
            freshness_score = 10
            breakdown["baselines"] = "All baselines active"
        elif active_count >= 1:
            freshness_score = 5
            breakdown["baselines"] = f"Only {active_count}/3 baselines"
        else:
            freshness_score = 0
            breakdown["baselines"] = "No baselines established"

        factors["baseline_freshness"] = freshness_score

        # Calculate total
        total = sum(factors.values())

        # Determine grade
        if total >= 90:
            grade = "A"
        elif total >= 80:
            grade = "B"
        elif total >= 70:
            grade = "C"
        elif total >= 60:
            grade = "D"
        else:
            grade = "F"

        return HealthScore(
            score=round(total, 1),
            grade=grade,
            factors=factors,
            breakdown=breakdown
        )

    # ========================
    # Delta Calculations
    # ========================

    def _get_previous_report(self) -> Optional[Dict[str, Any]]:
        """Get the most recent previous report."""
        reports = sorted(self.reports_dir.glob("report_*.json"), reverse=True)

        for report_file in reports:
            try:
                with open(report_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except (json.JSONDecodeError, KeyError):
                continue

        return None

    def _calculate_deltas(
        self,
        previous: Dict[str, Any],
        current: QAReportV2
    ) -> Dict[str, Any]:
        """Calculate changes from previous report."""
        deltas = {
            "from_report": previous.get("generated"),
            "to_report": current.generated,
            "changes": {}
        }

        prev_stats = previous.get("corpus_stats", {})

        # KU delta
        prev_kus = prev_stats.get("knowledge_units", 0)
        curr_kus = current.corpus_stats.get("knowledge_units", 0)
        if prev_kus != curr_kus:
            deltas["changes"]["knowledge_units"] = {
                "previous": prev_kus,
                "current": curr_kus,
                "delta": curr_kus - prev_kus,
                "delta_pct": round(((curr_kus - prev_kus) / prev_kus) * 100, 2) if prev_kus else 0
            }

        # RU delta
        prev_rus = prev_stats.get("reasoning_units", 0)
        curr_rus = current.corpus_stats.get("reasoning_units", 0)
        if prev_rus != curr_rus:
            deltas["changes"]["reasoning_units"] = {
                "previous": prev_rus,
                "current": curr_rus,
                "delta": curr_rus - prev_rus,
                "delta_pct": round(((curr_rus - prev_rus) / prev_rus) * 100, 2) if prev_rus else 0
            }

        # Health delta
        prev_health = previous.get("health", {}).get("score", 0)
        curr_health = current.health.score if current.health else 0
        if prev_health != curr_health:
            deltas["changes"]["health_score"] = {
                "previous": prev_health,
                "current": curr_health,
                "delta": round(curr_health - prev_health, 1),
                "improved": curr_health > prev_health
            }

        return deltas

    # ========================
    # Report Formatting
    # ========================

    def format_report_summary(self, report: QAReportV2) -> str:
        """
        Format report as human-readable summary.

        Args:
            report: Report to format

        Returns:
            Formatted summary string
        """
        lines = []
        lines.append("=" * 60)
        lines.append("QA Report Summary")
        lines.append("=" * 60)
        lines.append(f"Generated: {report.generated}")
        lines.append("")

        # Corpus stats
        lines.append("Corpus Statistics:")
        lines.append(f"  Knowledge Units: {report.corpus_stats.get('knowledge_units', 0)}")
        lines.append(f"  Reasoning Units: {report.corpus_stats.get('reasoning_units', 0)}")
        lines.append(f"  Documents: {report.corpus_stats.get('unique_documents', 0)}")
        lines.append(f"  Authors: {report.corpus_stats.get('unique_authors', 0)}")
        lines.append("")

        # Health score
        if report.health:
            lines.append(f"Health Score: {report.health.score}/100 ({report.health.grade})")
            lines.append("  Factors:")
            for factor, score in report.health.factors.items():
                lines.append(f"    {factor}: {score}")
            lines.append("")

        # Check results
        lines.append("Check Results:")

        # Coverage
        cov = report.coverage_check
        if cov.get("status") == "checked":
            regressions = cov.get("total_regressions", 0)
            if regressions == 0:
                lines.append("  Coverage: ✅ No regressions")
            else:
                lines.append(f"  Coverage: ⚠️  {regressions} regressions ({cov.get('highest_severity')})")
        else:
            lines.append(f"  Coverage: ⏭️  {cov.get('reason', 'Skipped')}")

        # Reasoning
        reas = report.reasoning_check
        if reas.get("status") == "checked":
            issues = reas.get("total_issues", 0)
            if issues == 0:
                lines.append("  Reasoning: ✅ No issues")
            else:
                lines.append(f"  Reasoning: ⚠️  {issues} issues ({reas.get('highest_severity')})")
        else:
            lines.append(f"  Reasoning: ⏭️  {reas.get('reason', 'Skipped')}")

        # Consistency
        cons = report.consistency_check
        if cons.get("status") == "checked":
            total = cons.get("total_issues", 0)
            if cons.get("has_critical"):
                lines.append(f"  Consistency: ❌ CRITICAL issues")
            elif cons.get("has_high"):
                lines.append(f"  Consistency: ⚠️  HIGH issues ({total} total)")
            else:
                lines.append(f"  Consistency: ✅ {total} low issues only")

        lines.append("")

        # Trends
        if report.trends:
            lines.append("Trends (7-day):")
            for name, trend in report.trends.items():
                arrow = {"up": "↑", "down": "↓", "stable": "→"}[trend.direction]
                pct = f"{trend.trend_7d:+.1f}%" if trend.trend_7d else "N/A"
                lines.append(f"  {name}: {trend.current_value} {arrow} ({pct})")
            lines.append("")

        # Deltas
        if report.deltas and report.deltas.get("changes"):
            lines.append("Changes from previous report:")
            for key, change in report.deltas["changes"].items():
                delta = change.get("delta", 0)
                sign = "+" if delta > 0 else ""
                lines.append(f"  {key}: {sign}{delta}")
            lines.append("")

        return "\n".join(lines)


def main():
    """CLI entry point for report generator."""
    import argparse

    parser = argparse.ArgumentParser(description="Generate QA reports with trend analysis")
    parser.add_argument("--output", "-o", type=str, help="Output path for report")
    parser.add_argument("--no-trends", action="store_true", help="Skip trend analysis")
    parser.add_argument("--no-health", action="store_true", help="Skip health scoring")
    parser.add_argument("--trend-days", type=int, default=30, help="Days for trend analysis")
    parser.add_argument("--summary", action="store_true", help="Print summary to stdout")

    args = parser.parse_args()

    generator = ReportGenerator()

    print("Generating QA report...")
    report = generator.generate_report(
        include_trends=not args.no_trends,
        include_health=not args.no_health,
        trend_days=args.trend_days
    )

    output_path = generator.save_report(
        report,
        Path(args.output) if args.output else None
    )

    print(f"✅ Report saved: {output_path}")

    if args.summary:
        print()
        print(generator.format_report_summary(report))

    return 0


if __name__ == "__main__":
    sys.exit(main())
