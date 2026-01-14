"""
Phase 17 Week 5: Calibration Tools

Manual calibration tools for adjusting corpus balance.
Provides targeted interventions for detected imbalances.

Key Features:
- Domain weighting adjustments
- Source priority configuration
- Manual KU promotion/demotion
- Rebalancing execution
"""

import json
import logging
import sys
from pathlib import Path
from datetime import datetime
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from enum import Enum

# Add project root for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from scripts.common import get_logger
from .density_analyzer import DensityAnalyzer
from .skew_detector import SkewDetector, SkewReport

logger = get_logger("phase17.calibration")


class CalibrationAction(Enum):
    """Types of calibration actions."""
    BOOST_DOMAIN = "boost_domain"           # Increase domain weight
    SUPPRESS_DOMAIN = "suppress_domain"     # Decrease domain weight
    PRIORITIZE_SOURCE = "prioritize_source" # Mark source for reprocessing
    DEPRIORITIZE_SOURCE = "deprioritize"    # Lower source priority
    PROMOTE_KU = "promote_ku"               # Increase KU confidence
    DEMOTE_KU = "demote_ku"                 # Decrease KU confidence
    ARCHIVE_KU = "archive_ku"               # Move KU to archive
    RESTORE_KU = "restore_ku"               # Restore from archive


@dataclass
class CalibrationRule:
    """A calibration rule to apply."""
    action: CalibrationAction
    target: str  # Domain, source path, or KU ID
    weight: float = 1.0  # Adjustment factor
    reason: str = ""
    created_at: str = ""
    applied: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "action": self.action.value,
            "target": self.target,
            "weight": self.weight,
            "reason": self.reason,
            "created_at": self.created_at,
            "applied": self.applied
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CalibrationRule":
        return cls(
            action=CalibrationAction(data["action"]),
            target=data["target"],
            weight=data.get("weight", 1.0),
            reason=data.get("reason", ""),
            created_at=data.get("created_at", ""),
            applied=data.get("applied", False)
        )


@dataclass
class CalibrationPlan:
    """A plan for rebalancing the corpus."""
    created_at: str
    skew_report: Optional[SkewReport] = None
    rules: List[CalibrationRule] = field(default_factory=list)
    auto_generated: bool = False
    executed: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "created_at": self.created_at,
            "skew_report": self.skew_report.to_dict() if self.skew_report else None,
            "rules": [r.to_dict() for r in self.rules],
            "auto_generated": self.auto_generated,
            "executed": self.executed
        }


class CalibrationTools:
    """
    Tools for manually calibrating corpus balance.

    Provides mechanisms to adjust domain weights, source priorities,
    and individual knowledge unit properties.
    """

    def __init__(self, base_path: Optional[Path] = None):
        """Initialize calibration tools."""
        self.base_path = base_path or Path.cwd()
        self.god_learn_dir = self.base_path / "god-learn"
        self.calibration_dir = self.god_learn_dir / "calibration"
        self.calibration_dir.mkdir(parents=True, exist_ok=True)

        self.rules_file = self.calibration_dir / "rules.json"
        self.weights_file = self.calibration_dir / "domain_weights.json"
        self.history_file = self.calibration_dir / "history.json"

        self.density_analyzer = DensityAnalyzer(self.base_path)
        self.skew_detector = SkewDetector(self.base_path)

    # =========================================================================
    # Domain Weights
    # =========================================================================

    def get_domain_weights(self) -> Dict[str, float]:
        """Get current domain weight configuration."""
        if self.weights_file.exists():
            with open(self.weights_file) as f:
                return json.load(f)
        return {}

    def set_domain_weight(self, domain: str, weight: float, reason: str = "") -> None:
        """Set weight for a domain."""
        weights = self.get_domain_weights()
        weights[domain] = weight

        with open(self.weights_file, "w") as f:
            json.dump(weights, f, indent=2)

        # Record in history
        self._record_action(
            CalibrationAction.BOOST_DOMAIN if weight > 1.0 else CalibrationAction.SUPPRESS_DOMAIN,
            domain,
            weight,
            reason
        )

    def reset_domain_weight(self, domain: str) -> None:
        """Reset a domain to default weight."""
        weights = self.get_domain_weights()
        if domain in weights:
            del weights[domain]
            with open(self.weights_file, "w") as f:
                json.dump(weights, f, indent=2)

    def get_effective_weights(self) -> Dict[str, float]:
        """Get effective weights for all domains including defaults."""
        domain_metrics = self.density_analyzer.analyze_domains()
        custom_weights = self.get_domain_weights()

        weights = {}
        for m in domain_metrics:
            weights[m.domain] = custom_weights.get(m.domain, 1.0)

        return weights

    # =========================================================================
    # Source Priorities
    # =========================================================================

    def get_source_priorities(self) -> Dict[str, int]:
        """Get source reprocessing priorities (higher = process first)."""
        priority_file = self.calibration_dir / "source_priorities.json"
        if priority_file.exists():
            with open(priority_file) as f:
                return json.load(f)
        return {}

    def set_source_priority(self, source_path: str, priority: int, reason: str = "") -> None:
        """Set priority for a source document."""
        priorities = self.get_source_priorities()
        priorities[source_path] = priority

        priority_file = self.calibration_dir / "source_priorities.json"
        with open(priority_file, "w") as f:
            json.dump(priorities, f, indent=2)

        action = CalibrationAction.PRIORITIZE_SOURCE if priority > 0 else CalibrationAction.DEPRIORITIZE_SOURCE
        self._record_action(action, source_path, float(priority), reason)

    def get_priority_queue(self) -> List[Dict[str, Any]]:
        """Get sources ordered by priority for reprocessing."""
        priorities = self.get_source_priorities()
        source_metrics = self.density_analyzer.analyze_sources()

        queue = []
        for m in source_metrics:
            priority = priorities.get(m.path, 0)
            queue.append({
                "path": m.path,
                "domain": m.domain,
                "current_density": m.density,
                "priority": priority
            })

        return sorted(queue, key=lambda x: -x["priority"])

    # =========================================================================
    # KU Adjustments
    # =========================================================================

    def adjust_ku_confidence(
        self,
        ku_id: str,
        adjustment: float,
        reason: str = ""
    ) -> bool:
        """Adjust confidence for a specific KU."""
        knowledge_file = self.god_learn_dir / "knowledge.jsonl"
        if not knowledge_file.exists():
            return False

        # Read all KUs
        kus = []
        modified = False
        with open(knowledge_file) as f:
            for line in f:
                try:
                    ku = json.loads(line.strip())
                    if ku.get("id") == ku_id:
                        old_conf = ku.get("confidence", 0.5)
                        new_conf = max(0.0, min(1.0, old_conf + adjustment))
                        ku["confidence"] = new_conf
                        modified = True

                        action = CalibrationAction.PROMOTE_KU if adjustment > 0 else CalibrationAction.DEMOTE_KU
                        self._record_action(action, ku_id, new_conf, reason)

                    kus.append(ku)
                except (json.JSONDecodeError, KeyError, TypeError) as e:
                    logger.debug("Skipping malformed KU line", extra={"error": str(e)})
                    continue

        if modified:
            with open(knowledge_file, "w") as f:
                for ku in kus:
                    f.write(json.dumps(ku) + "\n")

        return modified

    def archive_ku(self, ku_id: str, reason: str = "") -> bool:
        """Archive a KU (remove from active knowledge)."""
        knowledge_file = self.god_learn_dir / "knowledge.jsonl"
        archive_file = self.calibration_dir / "archived_kus.jsonl"

        if not knowledge_file.exists():
            return False

        kus = []
        archived = None

        with open(knowledge_file) as f:
            for line in f:
                try:
                    ku = json.loads(line.strip())
                    if ku.get("id") == ku_id:
                        ku["archived_at"] = datetime.now().isoformat()
                        ku["archive_reason"] = reason
                        archived = ku
                    else:
                        kus.append(ku)
                except (json.JSONDecodeError, KeyError, TypeError) as e:
                    logger.debug("Skipping malformed KU line in archive", extra={"error": str(e)})
                    continue

        if archived:
            # Write remaining KUs
            with open(knowledge_file, "w") as f:
                for ku in kus:
                    f.write(json.dumps(ku) + "\n")

            # Append to archive
            with open(archive_file, "a") as f:
                f.write(json.dumps(archived) + "\n")

            self._record_action(CalibrationAction.ARCHIVE_KU, ku_id, 0.0, reason)
            return True

        return False

    def restore_ku(self, ku_id: str) -> bool:
        """Restore a KU from archive."""
        knowledge_file = self.god_learn_dir / "knowledge.jsonl"
        archive_file = self.calibration_dir / "archived_kus.jsonl"

        if not archive_file.exists():
            return False

        archived_kus = []
        restored = None

        with open(archive_file) as f:
            for line in f:
                try:
                    ku = json.loads(line.strip())
                    if ku.get("id") == ku_id:
                        # Remove archive metadata
                        ku.pop("archived_at", None)
                        ku.pop("archive_reason", None)
                        restored = ku
                    else:
                        archived_kus.append(ku)
                except (json.JSONDecodeError, KeyError, TypeError) as e:
                    logger.debug("Skipping malformed KU line in restore", extra={"error": str(e)})
                    continue

        if restored:
            # Append to active knowledge
            with open(knowledge_file, "a") as f:
                f.write(json.dumps(restored) + "\n")

            # Rewrite archive
            with open(archive_file, "w") as f:
                for ku in archived_kus:
                    f.write(json.dumps(ku) + "\n")

            self._record_action(CalibrationAction.RESTORE_KU, ku_id, 1.0, "Restored from archive")
            return True

        return False

    # =========================================================================
    # Automatic Calibration
    # =========================================================================

    def generate_plan(self) -> CalibrationPlan:
        """Generate automatic calibration plan based on skew detection."""
        skew_report = self.skew_detector.detect_all()
        rules = []

        for alert in skew_report.alerts:
            if alert.skew_type.value == "domain_imbalance":
                # Boost underrepresented domains
                for domain in alert.affected_domains[:3]:
                    rules.append(CalibrationRule(
                        action=CalibrationAction.BOOST_DOMAIN,
                        target=domain,
                        weight=1.5,
                        reason=f"Auto-boost for underrepresented domain ({alert.message})",
                        created_at=datetime.now().isoformat()
                    ))

            elif alert.skew_type.value == "coverage_gap":
                # Prioritize low-coverage sources
                examples = alert.details.get("examples", [])
                for source in examples[:5]:
                    rules.append(CalibrationRule(
                        action=CalibrationAction.PRIORITIZE_SOURCE,
                        target=source,
                        weight=10.0,
                        reason=f"Auto-prioritize for low coverage ({alert.message})",
                        created_at=datetime.now().isoformat()
                    ))

            elif alert.skew_type.value == "quality_drift":
                # Flag low quality domains for review
                for item in alert.details.get("low_quality_domains", []):
                    domain = item.get("domain") if isinstance(item, dict) else item
                    rules.append(CalibrationRule(
                        action=CalibrationAction.SUPPRESS_DOMAIN,
                        target=domain,
                        weight=0.8,
                        reason=f"Auto-suppress for low quality ({alert.message})",
                        created_at=datetime.now().isoformat()
                    ))

        return CalibrationPlan(
            created_at=datetime.now().isoformat(),
            skew_report=skew_report,
            rules=rules,
            auto_generated=True,
            executed=False
        )

    def execute_plan(self, plan: CalibrationPlan, dry_run: bool = False) -> Dict[str, Any]:
        """Execute a calibration plan."""
        results = {
            "executed": [],
            "skipped": [],
            "errors": []
        }

        for rule in plan.rules:
            if rule.applied:
                results["skipped"].append({"rule": rule.to_dict(), "reason": "already applied"})
                continue

            try:
                if dry_run:
                    results["executed"].append({
                        "rule": rule.to_dict(),
                        "status": "would execute"
                    })
                else:
                    self._apply_rule(rule)
                    rule.applied = True
                    results["executed"].append({
                        "rule": rule.to_dict(),
                        "status": "success"
                    })
            except Exception as e:
                results["errors"].append({
                    "rule": rule.to_dict(),
                    "error": str(e)
                })

        if not dry_run:
            plan.executed = True
            self._save_plan(plan)

        return results

    def _apply_rule(self, rule: CalibrationRule) -> None:
        """Apply a single calibration rule."""
        if rule.action == CalibrationAction.BOOST_DOMAIN:
            self.set_domain_weight(rule.target, rule.weight, rule.reason)
        elif rule.action == CalibrationAction.SUPPRESS_DOMAIN:
            self.set_domain_weight(rule.target, rule.weight, rule.reason)
        elif rule.action == CalibrationAction.PRIORITIZE_SOURCE:
            self.set_source_priority(rule.target, int(rule.weight), rule.reason)
        elif rule.action == CalibrationAction.DEPRIORITIZE_SOURCE:
            self.set_source_priority(rule.target, int(rule.weight), rule.reason)
        elif rule.action == CalibrationAction.PROMOTE_KU:
            self.adjust_ku_confidence(rule.target, 0.1, rule.reason)
        elif rule.action == CalibrationAction.DEMOTE_KU:
            self.adjust_ku_confidence(rule.target, -0.1, rule.reason)
        elif rule.action == CalibrationAction.ARCHIVE_KU:
            self.archive_ku(rule.target, rule.reason)
        elif rule.action == CalibrationAction.RESTORE_KU:
            self.restore_ku(rule.target)

    def _save_plan(self, plan: CalibrationPlan) -> None:
        """Save calibration plan to file."""
        plans_file = self.calibration_dir / "plans.json"
        plans = []

        if plans_file.exists():
            with open(plans_file) as f:
                plans = json.load(f)

        plans.append(plan.to_dict())

        with open(plans_file, "w") as f:
            json.dump(plans, f, indent=2)

    # =========================================================================
    # History
    # =========================================================================

    def _record_action(
        self,
        action: CalibrationAction,
        target: str,
        value: float,
        reason: str
    ) -> None:
        """Record a calibration action in history."""
        history = []
        if self.history_file.exists():
            with open(self.history_file) as f:
                history = json.load(f)

        history.append({
            "timestamp": datetime.now().isoformat(),
            "action": action.value,
            "target": target,
            "value": value,
            "reason": reason
        })

        with open(self.history_file, "w") as f:
            json.dump(history, f, indent=2)

    def get_history(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Get calibration history."""
        if not self.history_file.exists():
            return []

        with open(self.history_file) as f:
            history = json.load(f)

        # Return most recent first
        history = list(reversed(history))
        if limit:
            history = history[:limit]

        return history

    # =========================================================================
    # Reporting
    # =========================================================================

    def get_status(self) -> Dict[str, Any]:
        """Get current calibration status."""
        weights = self.get_domain_weights()
        priorities = self.get_source_priorities()
        history = self.get_history(10)
        skew_summary = self.skew_detector.get_summary()

        return {
            "domain_weights": weights,
            "prioritized_sources": len([p for p in priorities.values() if p > 0]),
            "recent_actions": len(history),
            "corpus_health": skew_summary["health_score"],
            "needs_attention": skew_summary["needs_attention"]
        }
