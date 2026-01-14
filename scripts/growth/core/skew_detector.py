"""
Phase 17 Week 5: Skew Detector

Detects knowledge distribution imbalances and semantic drift.
Provides actionable alerts for corpus rebalancing.

Key Features:
- Statistical skew detection
- Semantic drift monitoring
- Coverage gap identification
- Priority-ranked recommendations
"""

import json
from pathlib import Path
from datetime import datetime
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Tuple
from enum import Enum
import math

from .density_analyzer import DensityAnalyzer, DomainMetrics, SourceMetrics


class SkewType(Enum):
    """Types of detected skew."""
    DOMAIN_IMBALANCE = "domain_imbalance"      # Uneven domain sizes
    DENSITY_VARIANCE = "density_variance"       # Inconsistent density
    COVERAGE_GAP = "coverage_gap"               # Missing coverage areas
    QUALITY_DRIFT = "quality_drift"             # Declining quality
    SEMANTIC_SHIFT = "semantic_shift"           # Topic drift over time
    ORPHAN_CONTENT = "orphan_content"           # Disconnected knowledge


class SkewSeverity(Enum):
    """Severity levels for detected skew."""
    CRITICAL = "critical"    # Requires immediate attention
    HIGH = "high"            # Should be addressed soon
    MEDIUM = "medium"        # Monitor and address when possible
    LOW = "low"              # Informational, no action needed


@dataclass
class SkewAlert:
    """An alert for detected skew."""
    skew_type: SkewType
    severity: SkewSeverity
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    recommendations: List[str] = field(default_factory=list)
    affected_domains: List[str] = field(default_factory=list)
    detected_at: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.skew_type.value,
            "severity": self.severity.value,
            "message": self.message,
            "details": self.details,
            "recommendations": self.recommendations,
            "affected_domains": self.affected_domains,
            "detected_at": self.detected_at
        }


@dataclass
class SkewReport:
    """Complete skew detection report."""
    timestamp: str
    total_alerts: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    alerts: List[SkewAlert] = field(default_factory=list)
    health_score: float = 100.0  # 0-100 corpus health

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "summary": {
                "total_alerts": self.total_alerts,
                "by_severity": {
                    "critical": self.critical_count,
                    "high": self.high_count,
                    "medium": self.medium_count,
                    "low": self.low_count
                },
                "health_score": round(self.health_score, 1)
            },
            "alerts": [a.to_dict() for a in self.alerts]
        }


class SkewDetector:
    """
    Detects and reports knowledge distribution skew.

    Monitors the corpus for imbalances that could affect
    quality or completeness of reasoning.
    """

    def __init__(self, base_path: Optional[Path] = None):
        """Initialize skew detector."""
        self.base_path = base_path or Path.cwd()
        self.density_analyzer = DensityAnalyzer(self.base_path)
        self.alerts_file = self.base_path / "god-learn" / "skew_alerts.json"

        # Detection thresholds
        self.thresholds = {
            "domain_imbalance_ratio": 3.0,       # Max ratio between largest/smallest
            "density_cv_threshold": 0.5,          # Coefficient of variation for density
            "min_domain_coverage": 0.2,           # Minimum fraction of total KUs
            "quality_threshold": 0.5,             # Minimum average confidence
            "orphan_threshold": 0.1,              # Max fraction of orphan content
        }

    # =========================================================================
    # Statistical Utilities
    # =========================================================================

    def _calculate_cv(self, values: List[float]) -> float:
        """Calculate coefficient of variation."""
        if not values or len(values) < 2:
            return 0.0

        mean = sum(values) / len(values)
        if mean == 0:
            return 0.0

        variance = sum((x - mean) ** 2 for x in values) / len(values)
        std_dev = math.sqrt(variance)

        return std_dev / mean

    def _calculate_gini(self, values: List[float]) -> float:
        """Calculate Gini coefficient for inequality."""
        if not values or sum(values) == 0:
            return 0.0

        sorted_values = sorted(values)
        n = len(sorted_values)
        cumsum = sum((i + 1) * v for i, v in enumerate(sorted_values))
        total = sum(sorted_values)

        return (2 * cumsum) / (n * total) - (n + 1) / n

    def _calculate_entropy(self, values: List[float]) -> float:
        """Calculate normalized entropy."""
        if not values or sum(values) == 0:
            return 0.0

        total = sum(values)
        probs = [v / total for v in values if v > 0]

        if len(probs) <= 1:
            return 1.0

        entropy = -sum(p * math.log2(p) for p in probs)
        max_entropy = math.log2(len(probs))

        return entropy / max_entropy if max_entropy > 0 else 0.0

    # =========================================================================
    # Skew Detection
    # =========================================================================

    def detect_domain_imbalance(
        self,
        domain_metrics: List[DomainMetrics]
    ) -> Optional[SkewAlert]:
        """Detect imbalance in domain sizes."""
        if len(domain_metrics) < 2:
            return None

        ku_counts = [m.ku_count for m in domain_metrics]
        total = sum(ku_counts)

        if total == 0:
            return None

        # Calculate imbalance metrics
        gini = self._calculate_gini(ku_counts)
        entropy = self._calculate_entropy(ku_counts)

        # Check ratio of largest to smallest
        largest = max(ku_counts)
        smallest = min(k for k in ku_counts if k > 0) if any(k > 0 for k in ku_counts) else 1
        ratio = largest / smallest

        if ratio < self.thresholds["domain_imbalance_ratio"] and gini < 0.4:
            return None

        # Determine severity
        if ratio >= 10 or gini >= 0.6:
            severity = SkewSeverity.HIGH
        elif ratio >= 5 or gini >= 0.5:
            severity = SkewSeverity.MEDIUM
        else:
            severity = SkewSeverity.LOW

        # Identify affected domains
        affected = [m.domain for m in domain_metrics if m.ku_count < total * 0.1]

        return SkewAlert(
            skew_type=SkewType.DOMAIN_IMBALANCE,
            severity=severity,
            message=f"Domain sizes are imbalanced (Gini: {gini:.2f}, ratio: {ratio:.1f}:1)",
            details={
                "gini_coefficient": round(gini, 3),
                "largest_smallest_ratio": round(ratio, 2),
                "entropy": round(entropy, 3)
            },
            recommendations=[
                f"Add more content to underrepresented domains: {', '.join(affected[:3])}",
                "Consider reprocessing low-coverage sources with more detailed extraction"
            ],
            affected_domains=affected,
            detected_at=datetime.now().isoformat()
        )

    def detect_density_variance(
        self,
        domain_metrics: List[DomainMetrics]
    ) -> Optional[SkewAlert]:
        """Detect inconsistent density across domains."""
        if len(domain_metrics) < 2:
            return None

        densities = [m.density_score for m in domain_metrics if m.density_score > 0]

        if len(densities) < 2:
            return None

        cv = self._calculate_cv(densities)

        if cv < self.thresholds["density_cv_threshold"]:
            return None

        # Determine severity
        if cv >= 1.0:
            severity = SkewSeverity.HIGH
        elif cv >= 0.75:
            severity = SkewSeverity.MEDIUM
        else:
            severity = SkewSeverity.LOW

        # Identify outliers
        mean_density = sum(densities) / len(densities)
        low_density = [m.domain for m in domain_metrics if m.density_score < mean_density * 0.5]
        high_density = [m.domain for m in domain_metrics if m.density_score > mean_density * 2]

        return SkewAlert(
            skew_type=SkewType.DENSITY_VARIANCE,
            severity=severity,
            message=f"Density varies significantly across domains (CV: {cv:.2f})",
            details={
                "coefficient_of_variation": round(cv, 3),
                "mean_density": round(mean_density, 3),
                "low_density_domains": low_density,
                "high_density_domains": high_density
            },
            recommendations=[
                "Review extraction parameters for consistency",
                f"Increase extraction depth for: {', '.join(low_density[:3])}" if low_density else ""
            ],
            affected_domains=low_density + high_density,
            detected_at=datetime.now().isoformat()
        )

    def detect_coverage_gaps(
        self,
        source_metrics: List[SourceMetrics]
    ) -> Optional[SkewAlert]:
        """Detect sources with low knowledge coverage."""
        if not source_metrics:
            return None

        # Find sources with very low coverage
        low_coverage = [
            s for s in source_metrics
            if s.coverage < 0.1 and s.page_count > 5
        ]

        if not low_coverage:
            return None

        gap_fraction = len(low_coverage) / len(source_metrics)

        if gap_fraction < 0.2:
            severity = SkewSeverity.LOW
        elif gap_fraction < 0.4:
            severity = SkewSeverity.MEDIUM
        else:
            severity = SkewSeverity.HIGH

        return SkewAlert(
            skew_type=SkewType.COVERAGE_GAP,
            severity=severity,
            message=f"{len(low_coverage)} sources have low knowledge coverage (<10%)",
            details={
                "low_coverage_sources": len(low_coverage),
                "gap_fraction": round(gap_fraction, 3),
                "examples": [s.path for s in low_coverage[:5]]
            },
            recommendations=[
                "Reprocess low-coverage sources with different extraction parameters",
                "Review if sources are appropriate for knowledge extraction"
            ],
            affected_domains=list(set(s.domain for s in low_coverage if s.domain)),
            detected_at=datetime.now().isoformat()
        )

    def detect_quality_drift(
        self,
        domain_metrics: List[DomainMetrics]
    ) -> Optional[SkewAlert]:
        """Detect domains with declining quality."""
        low_quality = [
            m for m in domain_metrics
            if m.avg_confidence < self.thresholds["quality_threshold"]
        ]

        if not low_quality:
            return None

        if len(low_quality) == 1:
            severity = SkewSeverity.LOW
        elif len(low_quality) <= 3:
            severity = SkewSeverity.MEDIUM
        else:
            severity = SkewSeverity.HIGH

        return SkewAlert(
            skew_type=SkewType.QUALITY_DRIFT,
            severity=severity,
            message=f"{len(low_quality)} domains have low average confidence",
            details={
                "low_quality_domains": [
                    {"domain": m.domain, "confidence": round(m.avg_confidence, 3)}
                    for m in low_quality
                ]
            },
            recommendations=[
                "Review extraction quality for affected domains",
                "Consider manual validation and correction",
                "Adjust confidence thresholds for extraction"
            ],
            affected_domains=[m.domain for m in low_quality],
            detected_at=datetime.now().isoformat()
        )

    # =========================================================================
    # Health Score
    # =========================================================================

    def calculate_health_score(self, alerts: List[SkewAlert]) -> float:
        """Calculate overall corpus health score (0-100)."""
        if not alerts:
            return 100.0

        # Penalty per severity level
        penalties = {
            SkewSeverity.CRITICAL: 25,
            SkewSeverity.HIGH: 15,
            SkewSeverity.MEDIUM: 8,
            SkewSeverity.LOW: 3
        }

        total_penalty = sum(penalties.get(a.severity, 0) for a in alerts)
        score = max(0, 100 - total_penalty)

        return score

    # =========================================================================
    # Full Detection
    # =========================================================================

    def detect_all(self) -> SkewReport:
        """Run all skew detection checks."""
        # Get metrics
        domain_metrics = self.density_analyzer.analyze_domains()
        source_metrics = self.density_analyzer.analyze_sources()

        alerts = []

        # Run all detectors
        checks = [
            self.detect_domain_imbalance(domain_metrics),
            self.detect_density_variance(domain_metrics),
            self.detect_coverage_gaps(source_metrics),
            self.detect_quality_drift(domain_metrics)
        ]

        for alert in checks:
            if alert:
                alerts.append(alert)

        # Count by severity
        severity_counts = {s: 0 for s in SkewSeverity}
        for alert in alerts:
            severity_counts[alert.severity] += 1

        # Calculate health
        health = self.calculate_health_score(alerts)

        return SkewReport(
            timestamp=datetime.now().isoformat(),
            total_alerts=len(alerts),
            critical_count=severity_counts[SkewSeverity.CRITICAL],
            high_count=severity_counts[SkewSeverity.HIGH],
            medium_count=severity_counts[SkewSeverity.MEDIUM],
            low_count=severity_counts[SkewSeverity.LOW],
            alerts=alerts,
            health_score=health
        )

    def save_alerts(self, report: Optional[SkewReport] = None) -> str:
        """Save alerts to file."""
        report = report or self.detect_all()

        with open(self.alerts_file, "w") as f:
            json.dump(report.to_dict(), f, indent=2)

        return str(self.alerts_file)

    def load_alerts(self) -> Optional[SkewReport]:
        """Load previous alerts from file."""
        if not self.alerts_file.exists():
            return None

        with open(self.alerts_file) as f:
            data = json.load(f)

        alerts = []
        for a in data.get("alerts", []):
            alerts.append(SkewAlert(
                skew_type=SkewType(a["type"]),
                severity=SkewSeverity(a["severity"]),
                message=a["message"],
                details=a.get("details", {}),
                recommendations=a.get("recommendations", []),
                affected_domains=a.get("affected_domains", []),
                detected_at=a.get("detected_at", "")
            ))

        summary = data.get("summary", {})
        return SkewReport(
            timestamp=data.get("timestamp", ""),
            total_alerts=summary.get("total_alerts", 0),
            critical_count=summary.get("by_severity", {}).get("critical", 0),
            high_count=summary.get("by_severity", {}).get("high", 0),
            medium_count=summary.get("by_severity", {}).get("medium", 0),
            low_count=summary.get("by_severity", {}).get("low", 0),
            alerts=alerts,
            health_score=summary.get("health_score", 100.0)
        )

    # =========================================================================
    # Reporting
    # =========================================================================

    def get_summary(self) -> Dict[str, Any]:
        """Get quick summary of current skew status."""
        report = self.detect_all()

        return {
            "health_score": report.health_score,
            "total_alerts": report.total_alerts,
            "critical": report.critical_count,
            "high": report.high_count,
            "needs_attention": report.critical_count + report.high_count > 0
        }
