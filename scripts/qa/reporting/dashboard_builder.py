#!/usr/bin/env python3
"""
QA Dashboard Builder - Metrics aggregation and trend visualization

Features:
- 7-day and 30-day trend summaries
- Growth rate calculations
- Metrics aggregation across reports
- Terminal-based dashboard display
- Sparkline visualizations
"""

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta

# Add scripts to path
scripts_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(scripts_dir))

from qa.core.baseline_manager import BaselineManager
from qa.core.consistency_checker import ConsistencyChecker
from explore.core.artifact_loader import ArtifactLoader


@dataclass
class MetricSummary:
    """Summary of a single metric."""
    name: str
    current: float
    previous: Optional[float] = None
    delta: Optional[float] = None
    delta_pct: Optional[float] = None
    trend_7d: Optional[float] = None
    trend_30d: Optional[float] = None
    sparkline: str = ""


@dataclass
class DashboardData:
    """Complete dashboard data structure."""
    generated: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")

    # Corpus metrics
    corpus: Dict[str, MetricSummary] = field(default_factory=dict)

    # Check status
    check_status: Dict[str, str] = field(default_factory=dict)

    # Health
    health_score: float = 0.0
    health_grade: str = "?"

    # Trends
    trend_7d_summary: Dict[str, str] = field(default_factory=dict)
    trend_30d_summary: Dict[str, str] = field(default_factory=dict)

    # Issues
    issue_counts: Dict[str, int] = field(default_factory=dict)


class DashboardBuilder:
    """
    Builds QA dashboards with metrics aggregation.

    Features:
    - Real-time corpus statistics
    - Historical trend analysis
    - Terminal-based visualization
    - Sparkline charts
    """

    def __init__(
        self,
        project_root: Optional[Path] = None,
        reports_dir: Optional[Path] = None
    ):
        """
        Initialize dashboard builder.

        Args:
            project_root: Project root directory
            reports_dir: Directory containing historical reports
        """
        if project_root is None:
            project_root = Path(__file__).parent.parent.parent.parent

        self.project_root = Path(project_root)

        if reports_dir is None:
            reports_dir = self.project_root / "qa" / "reports"

        self.reports_dir = Path(reports_dir)

        # Components
        self.loader = ArtifactLoader(self.project_root)
        self.baseline_manager = BaselineManager()
        self.checker = ConsistencyChecker()

    # ========================
    # Dashboard Building
    # ========================

    def build_dashboard(self) -> DashboardData:
        """
        Build complete dashboard data.

        Returns:
            Dashboard data structure
        """
        dashboard = DashboardData()

        # 1. Current corpus metrics
        dashboard.corpus = self._build_corpus_metrics()

        # 2. Check status
        dashboard.check_status = self._get_check_status()

        # 3. Health score (from latest report)
        health = self._get_latest_health()
        dashboard.health_score = health.get("score", 0)
        dashboard.health_grade = health.get("grade", "?")

        # 4. Trend summaries
        dashboard.trend_7d_summary = self._build_trend_summary(7)
        dashboard.trend_30d_summary = self._build_trend_summary(30)

        # 5. Issue counts
        dashboard.issue_counts = self._get_issue_counts()

        return dashboard

    def _build_corpus_metrics(self) -> Dict[str, MetricSummary]:
        """Build corpus metric summaries with trends."""
        metrics = {}

        # Current state
        all_kus = self.loader.get_all_kus()
        all_rus = self.loader.get_all_rus()

        documents = set()
        authors = set()
        for ku in all_kus.values():
            if ku.sources:
                documents.add(ku.sources[0].title)
                authors.add(ku.sources[0].author)

        # Load historical data
        historical = self._load_metric_history("knowledge_units", 30)

        # Knowledge Units
        ku_history = [h[1] for h in historical]
        metrics["knowledge_units"] = MetricSummary(
            name="Knowledge Units",
            current=len(all_kus),
            previous=ku_history[-2] if len(ku_history) >= 2 else None,
            delta=len(all_kus) - ku_history[-2] if len(ku_history) >= 2 else None,
            delta_pct=self._calc_pct_change(ku_history[-2] if len(ku_history) >= 2 else None, len(all_kus)),
            trend_7d=self._calc_trend(ku_history, 7),
            trend_30d=self._calc_trend(ku_history, 30),
            sparkline=self._make_sparkline(ku_history[-10:])
        )

        # Reasoning Units
        ru_history = self._load_metric_history("reasoning_units", 30)
        ru_values = [h[1] for h in ru_history]
        metrics["reasoning_units"] = MetricSummary(
            name="Reasoning Units",
            current=len(all_rus),
            previous=ru_values[-2] if len(ru_values) >= 2 else None,
            delta=len(all_rus) - ru_values[-2] if len(ru_values) >= 2 else None,
            delta_pct=self._calc_pct_change(ru_values[-2] if len(ru_values) >= 2 else None, len(all_rus)),
            trend_7d=self._calc_trend(ru_values, 7),
            trend_30d=self._calc_trend(ru_values, 30),
            sparkline=self._make_sparkline(ru_values[-10:])
        )

        # Documents
        metrics["documents"] = MetricSummary(
            name="Documents",
            current=len(documents)
        )

        # Authors
        metrics["authors"] = MetricSummary(
            name="Authors",
            current=len(authors)
        )

        return metrics

    def _load_metric_history(
        self,
        metric_name: str,
        days: int
    ) -> List[Tuple[str, float]]:
        """Load historical values for a metric."""
        history = []
        cutoff = datetime.utcnow() - timedelta(days=days)

        for report_file in sorted(self.reports_dir.glob("report_*.json")):
            try:
                with open(report_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                generated = data.get("generated", "")
                if not generated:
                    continue

                report_date = datetime.fromisoformat(generated.replace("Z", "+00:00"))
                if report_date.replace(tzinfo=None) < cutoff:
                    continue

                # Extract metric value
                value = None
                if metric_name in ["knowledge_units", "reasoning_units", "unique_documents"]:
                    value = data.get("corpus_stats", {}).get(metric_name, 0)
                elif metric_name == "health_score":
                    value = data.get("health", {}).get("score", 0)
                elif metric_name == "consistency_issues":
                    value = data.get("checks", {}).get("consistency", {}).get("total_issues", 0)

                if value is not None:
                    history.append((generated, value))

            except (json.JSONDecodeError, KeyError, ValueError):
                continue

        return sorted(history, key=lambda x: x[0])

    def _calc_pct_change(
        self,
        previous: Optional[float],
        current: float
    ) -> Optional[float]:
        """Calculate percentage change."""
        if previous is None or previous == 0:
            return None
        return round(((current - previous) / previous) * 100, 2)

    def _calc_trend(self, values: List[float], days: int) -> Optional[float]:
        """Calculate trend as percentage change over N days."""
        if len(values) < 2:
            return None

        # Take values from beginning and end of period
        # Assuming values are evenly distributed
        start_idx = max(0, len(values) - days)
        start_val = values[start_idx]
        end_val = values[-1]

        if start_val == 0:
            return None

        return round(((end_val - start_val) / start_val) * 100, 2)

    def _make_sparkline(self, values: List[float]) -> str:
        """Generate ASCII sparkline for values."""
        if not values or len(values) < 2:
            return ""

        # Sparkline characters (low to high)
        chars = "▁▂▃▄▅▆▇█"

        min_val = min(values)
        max_val = max(values)

        if max_val == min_val:
            return chars[4] * len(values)

        sparkline = ""
        for v in values:
            normalized = (v - min_val) / (max_val - min_val)
            idx = int(normalized * (len(chars) - 1))
            sparkline += chars[idx]

        return sparkline

    def _get_check_status(self) -> Dict[str, str]:
        """Get status of each check type."""
        status = {}

        # Coverage baseline
        if self.baseline_manager.coverage_file.exists():
            status["coverage"] = "active"
        else:
            status["coverage"] = "no_baseline"

        # Reasoning baseline
        if self.baseline_manager.reasoning_file.exists():
            status["reasoning"] = "active"
        else:
            status["reasoning"] = "no_baseline"

        # Consistency (always available)
        status["consistency"] = "active"

        return status

    def _get_latest_health(self) -> Dict[str, Any]:
        """Get health score from latest report."""
        latest_report = self._get_latest_report()
        if latest_report:
            return latest_report.get("health", {})
        return {}

    def _get_latest_report(self) -> Optional[Dict[str, Any]]:
        """Load the most recent report."""
        reports = sorted(self.reports_dir.glob("report_*.json"), reverse=True)

        for report_file in reports:
            try:
                with open(report_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except (json.JSONDecodeError, KeyError):
                continue

        return None

    def _build_trend_summary(self, days: int) -> Dict[str, str]:
        """Build trend summary for N days."""
        summary = {}

        for metric in ["knowledge_units", "reasoning_units", "health_score"]:
            history = self._load_metric_history(metric, days)
            values = [h[1] for h in history]

            if len(values) >= 2:
                trend = self._calc_trend(values, days)
                if trend is not None:
                    if trend > 5:
                        summary[metric] = f"↑ +{trend:.1f}%"
                    elif trend < -5:
                        summary[metric] = f"↓ {trend:.1f}%"
                    else:
                        summary[metric] = f"→ {trend:+.1f}%"
                else:
                    summary[metric] = "→ stable"
            else:
                summary[metric] = "— no data"

        return summary

    def _get_issue_counts(self) -> Dict[str, int]:
        """Get current issue counts from consistency checker."""
        try:
            results = self.checker.check_all()
            summary = self.checker.get_summary(results)
            return summary.get("by_severity", {})
        except Exception:
            return {"critical": 0, "high": 0, "medium": 0, "low": 0}

    # ========================
    # Dashboard Display
    # ========================

    def display_dashboard(self, dashboard: Optional[DashboardData] = None) -> str:
        """
        Render dashboard as terminal output.

        Args:
            dashboard: Dashboard data (or build fresh)

        Returns:
            Formatted dashboard string
        """
        if dashboard is None:
            dashboard = self.build_dashboard()

        lines = []

        # Header
        lines.append("")
        lines.append("╔" + "═" * 58 + "╗")
        lines.append("║" + " " * 15 + "God-Learn QA Dashboard" + " " * 21 + "║")
        lines.append("╠" + "═" * 58 + "╣")

        # Health score with color hint
        grade = dashboard.health_grade
        score = dashboard.health_score
        grade_color = {"A": "🟢", "B": "🟢", "C": "🟡", "D": "🟠", "F": "🔴"}.get(grade, "⚪")
        lines.append(f"║  Health: {grade_color} {score:.0f}/100 ({grade})" + " " * (38 - len(str(int(score)))) + "║")
        lines.append("╠" + "═" * 58 + "╣")

        # Corpus metrics
        lines.append("║  Corpus Statistics:                                      ║")

        for key, metric in dashboard.corpus.items():
            value = int(metric.current)
            trend_str = ""

            if metric.delta is not None:
                sign = "+" if metric.delta > 0 else ""
                trend_str = f" ({sign}{int(metric.delta)})"

            sparkline = metric.sparkline if metric.sparkline else ""

            line = f"    {metric.name}: {value}{trend_str}"
            if sparkline:
                line += f"  {sparkline}"

            # Pad to fit box
            padding = 56 - len(line)
            lines.append("║" + line + " " * max(0, padding) + "║")

        lines.append("╠" + "═" * 58 + "╣")

        # Check status
        lines.append("║  Check Status:                                           ║")

        for check_name, status in dashboard.check_status.items():
            icon = "✅" if status == "active" else "⏭️ "
            status_text = "Active" if status == "active" else "No baseline"
            line = f"    {check_name.capitalize()}: {icon} {status_text}"
            padding = 56 - len(line)
            lines.append("║" + line + " " * max(0, padding) + "║")

        lines.append("╠" + "═" * 58 + "╣")

        # Issue counts
        lines.append("║  Issues by Severity:                                     ║")

        severity_icons = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "⚪"}
        for severity, count in dashboard.issue_counts.items():
            icon = severity_icons.get(severity, "⚪")
            line = f"    {severity.capitalize()}: {icon} {count}"
            padding = 56 - len(line)
            lines.append("║" + line + " " * max(0, padding) + "║")

        lines.append("╠" + "═" * 58 + "╣")

        # 7-day trends
        lines.append("║  7-Day Trends:                                           ║")

        for metric, trend in dashboard.trend_7d_summary.items():
            display_name = metric.replace("_", " ").title()
            line = f"    {display_name}: {trend}"
            padding = 56 - len(line)
            lines.append("║" + line + " " * max(0, padding) + "║")

        lines.append("╠" + "═" * 58 + "╣")

        # 30-day trends
        lines.append("║  30-Day Trends:                                          ║")

        for metric, trend in dashboard.trend_30d_summary.items():
            display_name = metric.replace("_", " ").title()
            line = f"    {display_name}: {trend}"
            padding = 56 - len(line)
            lines.append("║" + line + " " * max(0, padding) + "║")

        # Footer
        lines.append("╠" + "═" * 58 + "╣")
        timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
        lines.append(f"║  Generated: {timestamp}" + " " * (45 - len(timestamp)) + "║")
        lines.append("╚" + "═" * 58 + "╝")
        lines.append("")

        return "\n".join(lines)

    def display_compact_dashboard(self) -> str:
        """
        Render compact single-line dashboard.

        Returns:
            Single-line status string
        """
        dashboard = self.build_dashboard()

        kus = int(dashboard.corpus.get("knowledge_units", MetricSummary(name="", current=0)).current)
        rus = int(dashboard.corpus.get("reasoning_units", MetricSummary(name="", current=0)).current)
        score = dashboard.health_score
        grade = dashboard.health_grade

        issues = dashboard.issue_counts
        critical = issues.get("critical", 0)
        high = issues.get("high", 0)

        if critical > 0:
            status = "🔴 CRITICAL"
        elif high > 0:
            status = "🟠 WARNING"
        elif score >= 80:
            status = "🟢 HEALTHY"
        else:
            status = "🟡 OK"

        return f"QA: {status} | KUs: {kus} | RUs: {rus} | Health: {score:.0f}/100 ({grade})"

    # ========================
    # Growth Analysis
    # ========================

    def calculate_growth_rates(self, days: int = 30) -> Dict[str, Dict[str, Any]]:
        """
        Calculate growth rates for all metrics.

        Args:
            days: Time period for growth calculation

        Returns:
            Dictionary of metric name to growth data
        """
        growth = {}

        for metric in ["knowledge_units", "reasoning_units"]:
            history = self._load_metric_history(metric, days)
            values = [h[1] for h in history]

            if len(values) >= 2:
                start_val = values[0]
                end_val = values[-1]
                absolute_growth = end_val - start_val

                if start_val > 0:
                    pct_growth = ((end_val - start_val) / start_val) * 100
                    daily_growth = pct_growth / days
                    projected_30d = end_val * (1 + (daily_growth / 100)) ** 30
                else:
                    pct_growth = 0
                    daily_growth = 0
                    projected_30d = end_val

                growth[metric] = {
                    "start_value": start_val,
                    "end_value": end_val,
                    "absolute_growth": absolute_growth,
                    "percent_growth": round(pct_growth, 2),
                    "daily_growth_rate": round(daily_growth, 4),
                    "projected_30d": int(projected_30d),
                    "period_days": days,
                    "data_points": len(values)
                }
            else:
                growth[metric] = {
                    "start_value": values[-1] if values else 0,
                    "end_value": values[-1] if values else 0,
                    "absolute_growth": 0,
                    "percent_growth": 0,
                    "daily_growth_rate": 0,
                    "projected_30d": values[-1] if values else 0,
                    "period_days": days,
                    "data_points": len(values),
                    "note": "Insufficient data points"
                }

        return growth

    def format_growth_report(self, growth: Dict[str, Dict[str, Any]]) -> str:
        """Format growth rates as readable report."""
        lines = []
        lines.append("=" * 50)
        lines.append("Growth Rate Analysis")
        lines.append("=" * 50)
        lines.append("")

        for metric, data in growth.items():
            display_name = metric.replace("_", " ").title()
            lines.append(f"{display_name}:")
            lines.append(f"  Period: {data['period_days']} days ({data['data_points']} data points)")
            lines.append(f"  Start: {data['start_value']}")
            lines.append(f"  End: {data['end_value']}")
            lines.append(f"  Absolute Growth: {data['absolute_growth']:+d}")
            lines.append(f"  Percent Growth: {data['percent_growth']:+.2f}%")
            lines.append(f"  Daily Rate: {data['daily_growth_rate']:+.4f}%")
            lines.append(f"  Projected (30d): {data['projected_30d']}")

            if "note" in data:
                lines.append(f"  Note: {data['note']}")

            lines.append("")

        return "\n".join(lines)


def main():
    """CLI entry point for dashboard builder."""
    import argparse

    parser = argparse.ArgumentParser(description="QA Dashboard Builder")
    parser.add_argument("--compact", action="store_true", help="Show compact single-line dashboard")
    parser.add_argument("--growth", action="store_true", help="Show growth rate analysis")
    parser.add_argument("--growth-days", type=int, default=30, help="Days for growth analysis")
    parser.add_argument("--json", action="store_true", help="Output as JSON")

    args = parser.parse_args()

    builder = DashboardBuilder()

    if args.compact:
        print(builder.display_compact_dashboard())
        return 0

    if args.growth:
        growth = builder.calculate_growth_rates(args.growth_days)
        if args.json:
            print(json.dumps(growth, indent=2))
        else:
            print(builder.format_growth_report(growth))
        return 0

    # Full dashboard
    dashboard = builder.build_dashboard()

    if args.json:
        # Serialize dashboard
        data = {
            "generated": dashboard.generated,
            "corpus": {k: {
                "name": v.name,
                "current": v.current,
                "previous": v.previous,
                "delta": v.delta,
                "delta_pct": v.delta_pct,
                "trend_7d": v.trend_7d,
                "trend_30d": v.trend_30d,
                "sparkline": v.sparkline
            } for k, v in dashboard.corpus.items()},
            "check_status": dashboard.check_status,
            "health_score": dashboard.health_score,
            "health_grade": dashboard.health_grade,
            "trend_7d_summary": dashboard.trend_7d_summary,
            "trend_30d_summary": dashboard.trend_30d_summary,
            "issue_counts": dashboard.issue_counts
        }
        print(json.dumps(data, indent=2))
    else:
        print(builder.display_dashboard(dashboard))

    return 0


if __name__ == "__main__":
    sys.exit(main())
