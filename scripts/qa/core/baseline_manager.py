"""
Baseline Manager - CRUD operations for QA baselines

Manages baseline files for:
- Coverage baselines (query result snapshots)
- Reasoning baselines (RU relation snapshots)
- Metrics baselines (corpus statistics)
"""

import json
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime


@dataclass
class CoverageQueryBaseline:
    """Baseline for a single query's expected results."""
    query: str
    expected_ku_count: int
    expected_min_ku_count: int  # Allow some variation
    expected_documents: List[str]
    expected_authors: List[str]
    ku_ids_snapshot: List[str]


@dataclass
class CoverageBaseline:
    """Complete coverage baseline for all tracked queries."""
    version: str = "1.0"
    created: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    queries: List[CoverageQueryBaseline] = field(default_factory=list)


@dataclass
class ReasoningUnitBaseline:
    """Baseline snapshot of a single reasoning unit."""
    relation: str
    topic: str
    knowledge_ids: List[str]
    score: float


@dataclass
class ReasoningBaseline:
    """Complete reasoning baseline for all RUs."""
    version: str = "1.0"
    created: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    reasoning_units: Dict[str, ReasoningUnitBaseline] = field(default_factory=dict)
    stats: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MetricsBaseline:
    """Baseline corpus statistics."""
    version: str = "1.0"
    created: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    knowledge_units_count: int = 0
    reasoning_units_count: int = 0
    unique_documents: int = 0
    unique_queries: int = 0
    relation_distribution: Dict[str, int] = field(default_factory=dict)


class BaselineManager:
    """
    Manages baseline files for QA regression detection.

    Provides CRUD operations for:
    - Coverage baselines (query × KU snapshots)
    - Reasoning baselines (RU relation snapshots)
    - Metrics baselines (corpus statistics)
    """

    def __init__(self, baselines_dir: Optional[Path] = None):
        """
        Initialize baseline manager.

        Args:
            baselines_dir: Directory for baseline files (default: qa/baselines/)
        """
        if baselines_dir is None:
            # Default to qa/baselines/ relative to project root
            project_root = Path(__file__).parent.parent.parent.parent
            baselines_dir = project_root / "qa" / "baselines"

        self.baselines_dir = Path(baselines_dir)
        self.baselines_dir.mkdir(parents=True, exist_ok=True)

        # Standard baseline file names
        self.coverage_file = self.baselines_dir / "coverage_baseline.json"
        self.reasoning_file = self.baselines_dir / "reasoning_baseline.json"
        self.metrics_file = self.baselines_dir / "metrics_baseline.json"

    # ========================
    # Coverage Baselines
    # ========================

    def save_coverage_baseline(self, baseline: CoverageBaseline) -> None:
        """
        Save coverage baseline to disk.

        Args:
            baseline: Coverage baseline to save
        """
        data = {
            "version": baseline.version,
            "created": baseline.created,
            "queries": [
                {
                    "query": q.query,
                    "expected_ku_count": q.expected_ku_count,
                    "expected_min_ku_count": q.expected_min_ku_count,
                    "expected_documents": q.expected_documents,
                    "expected_authors": q.expected_authors,
                    "ku_ids_snapshot": q.ku_ids_snapshot
                }
                for q in baseline.queries
            ]
        }

        with open(self.coverage_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)

    def load_coverage_baseline(self) -> Optional[CoverageBaseline]:
        """
        Load coverage baseline from disk.

        Returns:
            Coverage baseline or None if not found
        """
        if not self.coverage_file.exists():
            return None

        with open(self.coverage_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        queries = [
            CoverageQueryBaseline(
                query=q["query"],
                expected_ku_count=q["expected_ku_count"],
                expected_min_ku_count=q["expected_min_ku_count"],
                expected_documents=q["expected_documents"],
                expected_authors=q["expected_authors"],
                ku_ids_snapshot=q["ku_ids_snapshot"]
            )
            for q in data["queries"]
        ]

        return CoverageBaseline(
            version=data["version"],
            created=data["created"],
            queries=queries
        )

    def update_coverage_query(self, query: str, baseline: CoverageQueryBaseline) -> bool:
        """
        Update a single query in the coverage baseline.

        Args:
            query: Query to update
            baseline: New baseline for this query

        Returns:
            True if updated, False if baseline doesn't exist
        """
        coverage = self.load_coverage_baseline()
        if coverage is None:
            return False

        # Find and update query
        found = False
        for i, q in enumerate(coverage.queries):
            if q.query == query:
                coverage.queries[i] = baseline
                found = True
                break

        # If not found, add new query
        if not found:
            coverage.queries.append(baseline)

        self.save_coverage_baseline(coverage)
        return True

    def delete_coverage_query(self, query: str) -> bool:
        """
        Remove a query from coverage baseline.

        Args:
            query: Query to remove

        Returns:
            True if removed, False if baseline doesn't exist or query not found
        """
        coverage = self.load_coverage_baseline()
        if coverage is None:
            return False

        original_count = len(coverage.queries)
        coverage.queries = [q for q in coverage.queries if q.query != query]

        if len(coverage.queries) < original_count:
            self.save_coverage_baseline(coverage)
            return True

        return False

    # ========================
    # Reasoning Baselines
    # ========================

    def save_reasoning_baseline(self, baseline: ReasoningBaseline) -> None:
        """
        Save reasoning baseline to disk.

        Args:
            baseline: Reasoning baseline to save
        """
        data = {
            "version": baseline.version,
            "created": baseline.created,
            "reasoning_units": {
                ru_id: {
                    "relation": ru.relation,
                    "topic": ru.topic,
                    "knowledge_ids": ru.knowledge_ids,
                    "score": ru.score
                }
                for ru_id, ru in baseline.reasoning_units.items()
            },
            "stats": baseline.stats
        }

        with open(self.reasoning_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)

    def load_reasoning_baseline(self) -> Optional[ReasoningBaseline]:
        """
        Load reasoning baseline from disk.

        Returns:
            Reasoning baseline or None if not found
        """
        if not self.reasoning_file.exists():
            return None

        with open(self.reasoning_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        reasoning_units = {
            ru_id: ReasoningUnitBaseline(
                relation=ru["relation"],
                topic=ru["topic"],
                knowledge_ids=ru["knowledge_ids"],
                score=ru["score"]
            )
            for ru_id, ru in data["reasoning_units"].items()
        }

        return ReasoningBaseline(
            version=data["version"],
            created=data["created"],
            reasoning_units=reasoning_units,
            stats=data.get("stats", {})
        )

    # ========================
    # Metrics Baselines
    # ========================

    def save_metrics_baseline(self, baseline: MetricsBaseline) -> None:
        """
        Save metrics baseline to disk.

        Args:
            baseline: Metrics baseline to save
        """
        data = asdict(baseline)

        with open(self.metrics_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)

    def load_metrics_baseline(self) -> Optional[MetricsBaseline]:
        """
        Load metrics baseline from disk.

        Returns:
            Metrics baseline or None if not found
        """
        if not self.metrics_file.exists():
            return None

        with open(self.metrics_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        return MetricsBaseline(**data)

    # ========================
    # Utility Methods
    # ========================

    def baseline_exists(self, baseline_type: str) -> bool:
        """
        Check if a baseline file exists.

        Args:
            baseline_type: "coverage", "reasoning", or "metrics"

        Returns:
            True if baseline exists
        """
        if baseline_type == "coverage":
            return self.coverage_file.exists()
        elif baseline_type == "reasoning":
            return self.reasoning_file.exists()
        elif baseline_type == "metrics":
            return self.metrics_file.exists()
        else:
            raise ValueError(f"Unknown baseline type: {baseline_type}")

    def list_baselines(self) -> Dict[str, bool]:
        """
        List all baseline files and their existence status.

        Returns:
            Dictionary mapping baseline type to existence status
        """
        return {
            "coverage": self.baseline_exists("coverage"),
            "reasoning": self.baseline_exists("reasoning"),
            "metrics": self.baseline_exists("metrics")
        }

    def get_baseline_info(self, baseline_type: str) -> Optional[Dict[str, Any]]:
        """
        Get metadata about a baseline file.

        Args:
            baseline_type: "coverage", "reasoning", or "metrics"

        Returns:
            Dictionary with version, created date, and stats
        """
        if baseline_type == "coverage":
            baseline = self.load_coverage_baseline()
            if baseline:
                return {
                    "version": baseline.version,
                    "created": baseline.created,
                    "queries_tracked": len(baseline.queries),
                    "queries": [q.query for q in baseline.queries]
                }
        elif baseline_type == "reasoning":
            baseline = self.load_reasoning_baseline()
            if baseline:
                return {
                    "version": baseline.version,
                    "created": baseline.created,
                    "reasoning_units_tracked": len(baseline.reasoning_units),
                    "stats": baseline.stats
                }
        elif baseline_type == "metrics":
            baseline = self.load_metrics_baseline()
            if baseline:
                return asdict(baseline)
        else:
            raise ValueError(f"Unknown baseline type: {baseline_type}")

        return None
