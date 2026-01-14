"""
Phase 17 Week 5: Density Analyzer

Analyzes reasoning density metrics across domains and sources.
Provides insights into knowledge distribution for rebalancing decisions.

Key Features:
- Domain-level density metrics
- Source-level coverage analysis
- Temporal density trends
- Quality-weighted density scores
"""

import json
import sys
from pathlib import Path
from datetime import datetime
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Tuple
from collections import defaultdict

# Add project root for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from scripts.common import get_logger

logger = get_logger("phase17.density")


@dataclass
class DomainMetrics:
    """Metrics for a single domain."""
    domain: str
    ku_count: int = 0
    ru_count: int = 0
    source_count: int = 0
    avg_confidence: float = 0.0
    total_pages: int = 0
    density_score: float = 0.0  # KUs per source page
    quality_score: float = 0.0  # Weighted by confidence
    sources: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "domain": self.domain,
            "ku_count": self.ku_count,
            "ru_count": self.ru_count,
            "source_count": self.source_count,
            "avg_confidence": round(self.avg_confidence, 3),
            "total_pages": self.total_pages,
            "density_score": round(self.density_score, 3),
            "quality_score": round(self.quality_score, 3),
            "sources": self.sources[:5]  # Limit for display
        }


@dataclass
class SourceMetrics:
    """Metrics for a single source document."""
    path: str
    domain: Optional[str] = None
    ku_count: int = 0
    ru_count: int = 0
    page_count: int = 0
    avg_confidence: float = 0.0
    density: float = 0.0  # KUs per page
    coverage: float = 0.0  # Pages with KUs / total pages

    def to_dict(self) -> Dict[str, Any]:
        return {
            "path": self.path,
            "domain": self.domain,
            "ku_count": self.ku_count,
            "ru_count": self.ru_count,
            "page_count": self.page_count,
            "avg_confidence": round(self.avg_confidence, 3),
            "density": round(self.density, 3),
            "coverage": round(self.coverage, 3)
        }


@dataclass
class DensityReport:
    """Complete density analysis report."""
    timestamp: str
    total_kus: int = 0
    total_rus: int = 0
    total_sources: int = 0
    avg_density: float = 0.0
    avg_quality: float = 0.0
    domains: List[DomainMetrics] = field(default_factory=list)
    sources: List[SourceMetrics] = field(default_factory=list)
    imbalances: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "summary": {
                "total_kus": self.total_kus,
                "total_rus": self.total_rus,
                "total_sources": self.total_sources,
                "avg_density": round(self.avg_density, 3),
                "avg_quality": round(self.avg_quality, 3)
            },
            "domains": [d.to_dict() for d in self.domains],
            "top_sources": [s.to_dict() for s in self.sources[:10]],
            "imbalances": self.imbalances
        }


class DensityAnalyzer:
    """
    Analyzes reasoning density across the knowledge base.

    Provides metrics for identifying under-represented domains
    and sources that may need additional processing.
    """

    def __init__(self, base_path: Optional[Path] = None):
        """Initialize density analyzer."""
        self.base_path = base_path or Path.cwd()
        self.god_learn_dir = self.base_path / "god-learn"
        self.knowledge_file = self.god_learn_dir / "knowledge.jsonl"
        self.corpus_dir = self.base_path / "corpus"

        # Thresholds for imbalance detection
        self.low_density_threshold = 0.5   # KUs per page
        self.high_density_threshold = 5.0  # KUs per page
        self.imbalance_ratio = 3.0         # Domain size ratio

    # =========================================================================
    # Data Loading
    # =========================================================================

    def _load_knowledge(self) -> List[Dict[str, Any]]:
        """Load all knowledge units."""
        kus = []
        if self.knowledge_file.exists():
            with open(self.knowledge_file) as f:
                for line in f:
                    try:
                        kus.append(json.loads(line.strip()))
                    except (json.JSONDecodeError, ValueError) as e:
                        logger.debug("Skipping malformed KU", extra={"error": str(e)})
                        continue
        return kus

    def _get_source_pages(self) -> Dict[str, int]:
        """Get page counts for source documents."""
        page_counts = {}

        # Try to read from manifest
        manifest_file = self.base_path / "scripts" / "ingest" / "manifest.jsonl"
        if manifest_file.exists():
            with open(manifest_file) as f:
                for line in f:
                    try:
                        entry = json.loads(line.strip())
                        path = entry.get("pdf_file", "")
                        pages = entry.get("total_pages", 0)
                        if path and pages:
                            page_counts[path] = pages
                    except (json.JSONDecodeError, KeyError, ValueError) as e:
                        logger.debug("Skipping malformed manifest entry", extra={"error": str(e)})
                        continue

        return page_counts

    def _extract_domain(self, ku: Dict[str, Any]) -> str:
        """Extract domain from a knowledge unit."""
        # Try tags first
        tags = ku.get("tags", [])
        if tags and isinstance(tags, list):
            return str(tags[0])

        # Try domain field
        domain = ku.get("domain", "")
        if domain:
            return domain

        # Infer from source path
        sources = ku.get("sources", [])
        if sources:
            first_source = sources[0] if isinstance(sources, list) else sources
            if isinstance(first_source, dict):
                source_path = first_source.get("source", "")
            else:
                source_path = str(first_source)

            if source_path:
                parts = Path(source_path).parts
                if len(parts) > 1:
                    return parts[0]

        return "unknown"

    def _extract_source(self, ku: Dict[str, Any]) -> str:
        """Extract source path from a knowledge unit."""
        sources = ku.get("sources", [])
        if sources:
            first_source = sources[0] if isinstance(sources, list) else sources
            if isinstance(first_source, dict):
                return first_source.get("source", "")
            return str(first_source)
        return "unknown"

    def _extract_confidence(self, ku: Dict[str, Any]) -> float:
        """Extract confidence score from a knowledge unit."""
        conf = ku.get("confidence", 0.5)
        if isinstance(conf, (int, float)):
            return float(conf)
        return 0.5

    # =========================================================================
    # Domain Analysis
    # =========================================================================

    def analyze_domains(self) -> List[DomainMetrics]:
        """Analyze density metrics by domain."""
        kus = self._load_knowledge()
        page_counts = self._get_source_pages()

        # Group by domain
        domain_data: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            "kus": [],
            "sources": set(),
            "confidences": []
        })

        for ku in kus:
            domain = self._extract_domain(ku)
            source = self._extract_source(ku)
            confidence = self._extract_confidence(ku)

            domain_data[domain]["kus"].append(ku)
            domain_data[domain]["sources"].add(source)
            domain_data[domain]["confidences"].append(confidence)

        # Calculate metrics
        metrics = []
        for domain, data in domain_data.items():
            ku_count = len(data["kus"])
            sources = list(data["sources"])
            confidences = data["confidences"]

            # Calculate total pages for this domain
            total_pages = sum(
                page_counts.get(s, 1)
                for s in sources
            )

            # Calculate averages
            avg_conf = sum(confidences) / len(confidences) if confidences else 0.0

            # Calculate density and quality
            density = ku_count / max(total_pages, 1)
            quality = density * avg_conf

            metrics.append(DomainMetrics(
                domain=domain,
                ku_count=ku_count,
                ru_count=0,  # TODO: Add RU counting
                source_count=len(sources),
                avg_confidence=avg_conf,
                total_pages=total_pages,
                density_score=density,
                quality_score=quality,
                sources=sources
            ))

        # Sort by KU count
        return sorted(metrics, key=lambda m: -m.ku_count)

    def analyze_sources(self) -> List[SourceMetrics]:
        """Analyze density metrics by source document."""
        kus = self._load_knowledge()
        page_counts = self._get_source_pages()

        # Group by source
        source_data: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            "kus": [],
            "pages_with_kus": set(),
            "confidences": [],
            "domain": None
        })

        for ku in kus:
            source = self._extract_source(ku)
            domain = self._extract_domain(ku)
            confidence = self._extract_confidence(ku)

            source_data[source]["kus"].append(ku)
            source_data[source]["confidences"].append(confidence)
            source_data[source]["domain"] = domain

            # Track pages with KUs
            sources_list = ku.get("sources", [])
            if sources_list:
                first = sources_list[0] if isinstance(sources_list, list) else sources_list
                if isinstance(first, dict):
                    page = first.get("page", first.get("paragraph", 0))
                    source_data[source]["pages_with_kus"].add(page)

        # Calculate metrics
        metrics = []
        for source, data in source_data.items():
            ku_count = len(data["kus"])
            page_count = page_counts.get(source, 1)
            pages_with_kus = len(data["pages_with_kus"])
            confidences = data["confidences"]

            avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
            density = ku_count / max(page_count, 1)
            coverage = pages_with_kus / max(page_count, 1)

            metrics.append(SourceMetrics(
                path=source,
                domain=data["domain"],
                ku_count=ku_count,
                ru_count=0,
                page_count=page_count,
                avg_confidence=avg_conf,
                density=density,
                coverage=min(coverage, 1.0)
            ))

        # Sort by density
        return sorted(metrics, key=lambda m: -m.density)

    # =========================================================================
    # Imbalance Detection
    # =========================================================================

    def detect_imbalances(self, domain_metrics: List[DomainMetrics]) -> List[Dict[str, Any]]:
        """Detect imbalances in domain coverage."""
        if not domain_metrics:
            return []

        imbalances = []

        # Calculate statistics
        total_kus = sum(m.ku_count for m in domain_metrics)
        avg_kus = total_kus / len(domain_metrics) if domain_metrics else 0
        avg_density = sum(m.density_score for m in domain_metrics) / len(domain_metrics)

        # Check for domain size imbalances
        if len(domain_metrics) >= 2:
            largest = domain_metrics[0]
            smallest = domain_metrics[-1]

            if smallest.ku_count > 0:
                ratio = largest.ku_count / smallest.ku_count
                if ratio >= self.imbalance_ratio:
                    imbalances.append({
                        "type": "domain_size_imbalance",
                        "severity": "high" if ratio >= 5.0 else "medium",
                        "details": {
                            "largest": largest.domain,
                            "smallest": smallest.domain,
                            "ratio": round(ratio, 2)
                        },
                        "recommendation": f"Consider adding more content to '{smallest.domain}' domain"
                    })

        # Check for low density domains
        for m in domain_metrics:
            if m.density_score < self.low_density_threshold and m.source_count > 0:
                imbalances.append({
                    "type": "low_density",
                    "severity": "medium",
                    "details": {
                        "domain": m.domain,
                        "density": round(m.density_score, 3),
                        "threshold": self.low_density_threshold
                    },
                    "recommendation": f"Reprocess '{m.domain}' sources for more detailed extraction"
                })

        # Check for high density outliers
        for m in domain_metrics:
            if m.density_score > self.high_density_threshold:
                imbalances.append({
                    "type": "high_density",
                    "severity": "low",
                    "details": {
                        "domain": m.domain,
                        "density": round(m.density_score, 3),
                        "threshold": self.high_density_threshold
                    },
                    "recommendation": f"Review '{m.domain}' for potential over-extraction or duplication"
                })

        # Check for quality imbalances
        high_quality = [m for m in domain_metrics if m.avg_confidence >= 0.8]
        low_quality = [m for m in domain_metrics if m.avg_confidence < 0.5]

        if low_quality:
            imbalances.append({
                "type": "low_quality_domains",
                "severity": "medium",
                "details": {
                    "domains": [m.domain for m in low_quality],
                    "avg_confidence": round(sum(m.avg_confidence for m in low_quality) / len(low_quality), 3)
                },
                "recommendation": "Review extraction quality for these domains"
            })

        return imbalances

    # =========================================================================
    # Full Analysis
    # =========================================================================

    def analyze(self) -> DensityReport:
        """Run full density analysis."""
        domain_metrics = self.analyze_domains()
        source_metrics = self.analyze_sources()
        imbalances = self.detect_imbalances(domain_metrics)

        # Calculate totals
        total_kus = sum(m.ku_count for m in domain_metrics)
        total_sources = len(source_metrics)
        avg_density = sum(m.density_score for m in domain_metrics) / len(domain_metrics) if domain_metrics else 0
        avg_quality = sum(m.quality_score for m in domain_metrics) / len(domain_metrics) if domain_metrics else 0

        return DensityReport(
            timestamp=datetime.now().isoformat(),
            total_kus=total_kus,
            total_rus=0,
            total_sources=total_sources,
            avg_density=avg_density,
            avg_quality=avg_quality,
            domains=domain_metrics,
            sources=source_metrics,
            imbalances=imbalances
        )

    def export_report(self, output_path: Optional[str] = None) -> str:
        """Export analysis report to JSON."""
        report = self.analyze()
        output = output_path or str(self.god_learn_dir / "density_report.json")

        with open(output, "w") as f:
            json.dump(report.to_dict(), f, indent=2)

        return output

    # =========================================================================
    # Trend Analysis
    # =========================================================================

    def get_density_history(self) -> List[Dict[str, Any]]:
        """Get historical density reports for trend analysis."""
        history = []
        report_pattern = "density_report_*.json"

        for report_file in self.god_learn_dir.glob(report_pattern):
            try:
                with open(report_file) as f:
                    data = json.load(f)
                    history.append({
                        "file": str(report_file),
                        "timestamp": data.get("timestamp"),
                        "total_kus": data.get("summary", {}).get("total_kus", 0),
                        "avg_density": data.get("summary", {}).get("avg_density", 0)
                    })
            except (json.JSONDecodeError, KeyError, OSError) as e:
                logger.debug("Skipping invalid report file", extra={"file": str(report_file), "error": str(e)})
                continue

        return sorted(history, key=lambda x: x.get("timestamp", ""))
