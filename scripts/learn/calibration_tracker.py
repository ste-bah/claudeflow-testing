#!/usr/bin/env python3
"""
Confidence Calibration Tracker

Tracks prediction accuracy over time to calibrate confidence scores.

Features:
- Record predictions with confidence levels
- Record user feedback on prediction quality
- Compute calibration curves (expected vs actual accuracy)
- Generate calibration statistics

Storage:
  god-learn/calibration/predictions.jsonl - All predictions
  god-learn/calibration/feedback.jsonl    - User feedback
  god-learn/calibration/stats.json        - Aggregated statistics

Usage:
  god calibrate record --query "topic" --confidence 0.8 --result_id "chunk_xxx"
  god calibrate feedback <prediction_id> --correct
  god calibrate feedback <prediction_id> --incorrect --notes "wrong source"
  god calibrate stats
  god calibrate curve
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from collections import defaultdict
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Add project root for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

CALIBRATION_DIR = Path("god-learn/calibration")
PREDICTIONS_FILE = CALIBRATION_DIR / "predictions.jsonl"
FEEDBACK_FILE = CALIBRATION_DIR / "feedback.jsonl"
STATS_FILE = CALIBRATION_DIR / "stats.json"


@dataclass
class Prediction:
    """A recorded prediction."""
    id: str
    timestamp: float
    timestamp_human: str
    query: str
    result_id: str  # chunk_id or ku_id
    confidence: float  # 0.0 to 1.0
    confidence_label: str  # "high", "medium", "low"
    distance: Optional[float] = None
    source_path: Optional[str] = None
    claim_preview: Optional[str] = None


@dataclass
class Feedback:
    """User feedback on a prediction."""
    prediction_id: str
    timestamp: float
    timestamp_human: str
    was_correct: bool
    notes: Optional[str] = None
    correction: Optional[str] = None


def ensure_dirs():
    """Ensure calibration directory exists."""
    CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)


def generate_prediction_id(query: str, result_id: str, timestamp: float) -> str:
    """Generate stable ID for a prediction."""
    payload = f"{query}:{result_id}:{timestamp}"
    return "pred_" + hashlib.sha256(payload.encode()).hexdigest()[:12]


def confidence_to_label(confidence: float) -> str:
    """Convert numeric confidence to label."""
    if confidence >= 0.8:
        return "high"
    elif confidence >= 0.5:
        return "medium"
    else:
        return "low"


def distance_to_confidence(distance: float) -> float:
    """Convert vector distance to confidence score (inverse relationship)."""
    # Distance 0 = perfect match = confidence 1.0
    # Distance 1 = no match = confidence 0.0
    # Use exponential decay for more realistic curve
    import math
    return math.exp(-distance * 2)


def record_prediction(
    query: str,
    result_id: str,
    confidence: Optional[float] = None,
    distance: Optional[float] = None,
    source_path: Optional[str] = None,
    claim_preview: Optional[str] = None
) -> Prediction:
    """
    Record a prediction for later calibration.

    Args:
        query: The query string
        result_id: ID of the result (chunk_id or ku_id)
        confidence: Explicit confidence score (0-1), or computed from distance
        distance: Vector distance (used to compute confidence if not provided)
        source_path: Path to source document
        claim_preview: Preview of the claim/text

    Returns:
        The created Prediction
    """
    ensure_dirs()

    now = time.time()
    pred_id = generate_prediction_id(query, result_id, now)

    # Compute confidence from distance if not provided
    if confidence is None and distance is not None:
        confidence = distance_to_confidence(distance)
    elif confidence is None:
        confidence = 0.5  # Default to medium

    prediction = Prediction(
        id=pred_id,
        timestamp=now,
        timestamp_human=datetime.fromtimestamp(now).isoformat(),
        query=query,
        result_id=result_id,
        confidence=confidence,
        confidence_label=confidence_to_label(confidence),
        distance=distance,
        source_path=source_path,
        claim_preview=claim_preview
    )

    # Append to predictions file
    with PREDICTIONS_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(asdict(prediction)) + "\n")

    return prediction


def record_feedback(
    prediction_id: str,
    was_correct: bool,
    notes: Optional[str] = None,
    correction: Optional[str] = None
) -> Optional[Feedback]:
    """
    Record user feedback on a prediction.

    Args:
        prediction_id: ID of the prediction
        was_correct: Whether the prediction was correct
        notes: Optional notes about the feedback
        correction: Optional correction text

    Returns:
        The created Feedback, or None if prediction not found
    """
    ensure_dirs()

    # Verify prediction exists
    if not PREDICTIONS_FILE.exists():
        return None

    found = False
    with PREDICTIONS_FILE.open("r") as f:
        for line in f:
            if not line.strip():
                continue
            try:
                data = json.loads(line)
                if data.get("id") == prediction_id:
                    found = True
                    break
            except Exception:
                continue

    if not found:
        return None

    now = time.time()
    feedback = Feedback(
        prediction_id=prediction_id,
        timestamp=now,
        timestamp_human=datetime.fromtimestamp(now).isoformat(),
        was_correct=was_correct,
        notes=notes,
        correction=correction
    )

    # Append to feedback file
    with FEEDBACK_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(asdict(feedback)) + "\n")

    # Update stats
    update_stats()

    return feedback


def load_all_predictions() -> List[Prediction]:
    """Load all predictions."""
    ensure_dirs()
    if not PREDICTIONS_FILE.exists():
        return []

    predictions = []
    with PREDICTIONS_FILE.open("r") as f:
        for line in f:
            if not line.strip():
                continue
            try:
                data = json.loads(line)
                predictions.append(Prediction(**data))
            except Exception:
                continue

    return predictions


def load_all_feedback() -> Dict[str, Feedback]:
    """Load all feedback, keyed by prediction_id."""
    ensure_dirs()
    if not FEEDBACK_FILE.exists():
        return {}

    feedback = {}
    with FEEDBACK_FILE.open("r") as f:
        for line in f:
            if not line.strip():
                continue
            try:
                data = json.loads(line)
                fb = Feedback(**data)
                feedback[fb.prediction_id] = fb  # Latest wins
            except Exception:
                continue

    return feedback


def compute_calibration_curve(num_bins: int = 10) -> List[Dict[str, Any]]:
    """
    Compute calibration curve: expected vs actual accuracy by confidence bin.

    Returns list of bins with:
      - bin_start, bin_end: confidence range
      - expected: mean confidence in bin
      - actual: actual accuracy (fraction correct)
      - count: number of predictions in bin
    """
    predictions = load_all_predictions()
    feedback = load_all_feedback()

    # Only use predictions with feedback
    paired = []
    for pred in predictions:
        if pred.id in feedback:
            paired.append((pred, feedback[pred.id]))

    if not paired:
        return []

    # Create bins
    bin_size = 1.0 / num_bins
    bins = []

    for i in range(num_bins):
        bin_start = i * bin_size
        bin_end = (i + 1) * bin_size

        in_bin = [(p, f) for p, f in paired if bin_start <= p.confidence < bin_end]

        if not in_bin:
            bins.append({
                "bin_start": bin_start,
                "bin_end": bin_end,
                "expected": (bin_start + bin_end) / 2,
                "actual": None,
                "count": 0
            })
        else:
            expected = sum(p.confidence for p, f in in_bin) / len(in_bin)
            actual = sum(1 for p, f in in_bin if f.was_correct) / len(in_bin)
            bins.append({
                "bin_start": bin_start,
                "bin_end": bin_end,
                "expected": expected,
                "actual": actual,
                "count": len(in_bin)
            })

    return bins


def compute_stats() -> Dict[str, Any]:
    """Compute calibration statistics."""
    predictions = load_all_predictions()
    feedback = load_all_feedback()

    total_predictions = len(predictions)
    total_feedback = len(feedback)

    if not predictions:
        return {
            "total_predictions": 0,
            "total_feedback": 0,
            "feedback_rate": 0,
            "overall_accuracy": None,
            "accuracy_by_label": {},
            "calibration_error": None
        }

    # Accuracy by confidence label
    accuracy_by_label = defaultdict(lambda: {"correct": 0, "total": 0})

    for pred in predictions:
        if pred.id in feedback:
            label = pred.confidence_label
            accuracy_by_label[label]["total"] += 1
            if feedback[pred.id].was_correct:
                accuracy_by_label[label]["correct"] += 1

    # Compute percentages
    for label, data in accuracy_by_label.items():
        if data["total"] > 0:
            data["accuracy"] = data["correct"] / data["total"]
        else:
            data["accuracy"] = None

    # Overall accuracy
    correct = sum(1 for p in predictions if p.id in feedback and feedback[p.id].was_correct)
    with_feedback = sum(1 for p in predictions if p.id in feedback)
    overall_accuracy = correct / with_feedback if with_feedback > 0 else None

    # Calibration error (ECE - Expected Calibration Error)
    curve = compute_calibration_curve()
    if curve:
        ece = 0
        total_in_bins = sum(b["count"] for b in curve)
        for b in curve:
            if b["count"] > 0 and b["actual"] is not None:
                ece += (b["count"] / total_in_bins) * abs(b["expected"] - b["actual"])
    else:
        ece = None

    return {
        "total_predictions": total_predictions,
        "total_feedback": total_feedback,
        "feedback_rate": total_feedback / total_predictions if total_predictions > 0 else 0,
        "overall_accuracy": overall_accuracy,
        "accuracy_by_label": dict(accuracy_by_label),
        "calibration_error": ece,
        "last_updated": datetime.now().isoformat()
    }


def update_stats():
    """Update cached stats file."""
    ensure_dirs()
    stats = compute_stats()
    STATS_FILE.write_text(json.dumps(stats, indent=2))


# =========================
# CLI Interface
# =========================

def cmd_record(args) -> int:
    """Record a prediction."""
    if not args.query or not args.result_id:
        print("Error: --query and --result_id are required")
        return 1

    pred = record_prediction(
        query=args.query,
        result_id=args.result_id,
        confidence=args.confidence,
        distance=args.distance,
        source_path=args.source,
        claim_preview=args.claim
    )

    print(f"Recorded prediction: {pred.id}")
    print(f"  Query: {pred.query[:50]}...")
    print(f"  Confidence: {pred.confidence:.2f} ({pred.confidence_label})")
    return 0


def cmd_feedback(args) -> int:
    """Record feedback on a prediction."""
    if not args.prediction_id:
        print("Error: prediction_id required")
        return 1

    if args.correct:
        was_correct = True
    elif args.incorrect:
        was_correct = False
    else:
        print("Error: specify --correct or --incorrect")
        return 1

    fb = record_feedback(
        prediction_id=args.prediction_id,
        was_correct=was_correct,
        notes=args.notes
    )

    if fb is None:
        print(f"Prediction not found: {args.prediction_id}")
        return 1

    print(f"Recorded feedback for {args.prediction_id}")
    print(f"  Was correct: {was_correct}")
    if args.notes:
        print(f"  Notes: {args.notes}")
    return 0


def cmd_stats(args) -> int:
    """Show calibration statistics."""
    stats = compute_stats()

    print("Calibration Statistics")
    print("=" * 50)
    print(f"  Total predictions:  {stats['total_predictions']}")
    print(f"  Total feedback:     {stats['total_feedback']}")
    print(f"  Feedback rate:      {stats['feedback_rate']:.1%}")
    print()

    if stats['overall_accuracy'] is not None:
        print(f"  Overall accuracy:   {stats['overall_accuracy']:.1%}")
    else:
        print("  Overall accuracy:   N/A (no feedback yet)")

    if stats['calibration_error'] is not None:
        print(f"  Calibration error:  {stats['calibration_error']:.3f}")
        if stats['calibration_error'] < 0.05:
            print("    (well calibrated)")
        elif stats['calibration_error'] < 0.15:
            print("    (reasonably calibrated)")
        else:
            print("    (needs calibration)")

    print()
    print("Accuracy by confidence level:")
    for label in ["high", "medium", "low"]:
        data = stats['accuracy_by_label'].get(label, {})
        if data.get("total", 0) > 0:
            print(f"  {label:8} {data['accuracy']:.1%} ({data['correct']}/{data['total']})")
        else:
            print(f"  {label:8} N/A")

    return 0


def cmd_curve(args) -> int:
    """Show calibration curve."""
    curve = compute_calibration_curve(num_bins=args.bins)

    if not curve:
        print("No calibration data available (need predictions with feedback)")
        return 0

    print("Calibration Curve")
    print("=" * 60)
    print(f"{'Confidence':<15} {'Expected':<10} {'Actual':<10} {'Count':<8}")
    print("-" * 60)

    for b in curve:
        range_str = f"{b['bin_start']:.1f}-{b['bin_end']:.1f}"
        expected = f"{b['expected']:.2f}"
        actual = f"{b['actual']:.2f}" if b['actual'] is not None else "N/A"
        count = str(b['count'])
        print(f"{range_str:<15} {expected:<10} {actual:<10} {count:<8}")

    return 0


def cmd_list(args) -> int:
    """List recent predictions."""
    predictions = load_all_predictions()
    feedback = load_all_feedback()

    if not predictions:
        print("No predictions recorded yet.")
        return 0

    # Sort by timestamp descending
    predictions.sort(key=lambda p: p.timestamp, reverse=True)
    predictions = predictions[:args.limit]

    print(f"Recent Predictions (last {len(predictions)}):")
    print("-" * 70)

    for pred in predictions:
        fb = feedback.get(pred.id)
        fb_status = "correct" if fb and fb.was_correct else ("incorrect" if fb else "pending")
        dt = datetime.fromtimestamp(pred.timestamp)
        print(f"  [{pred.id}] {dt.strftime('%Y-%m-%d %H:%M')}")
        print(f"    Query: {pred.query[:50]}...")
        print(f"    Confidence: {pred.confidence:.2f} ({pred.confidence_label}) | Feedback: {fb_status}")
        print()

    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Confidence calibration tracker")
    subparsers = ap.add_subparsers(dest="command", help="Command")

    # Record command
    record_p = subparsers.add_parser("record", help="Record a prediction")
    record_p.add_argument("--query", required=True, help="Query string")
    record_p.add_argument("--result_id", required=True, help="Result ID (chunk_id or ku_id)")
    record_p.add_argument("--confidence", type=float, help="Confidence score (0-1)")
    record_p.add_argument("--distance", type=float, help="Vector distance")
    record_p.add_argument("--source", help="Source path")
    record_p.add_argument("--claim", help="Claim preview")

    # Feedback command
    feedback_p = subparsers.add_parser("feedback", help="Record feedback on prediction")
    feedback_p.add_argument("prediction_id", help="Prediction ID")
    feedback_p.add_argument("--correct", action="store_true", help="Mark as correct")
    feedback_p.add_argument("--incorrect", action="store_true", help="Mark as incorrect")
    feedback_p.add_argument("--notes", help="Feedback notes")

    # Stats command
    stats_p = subparsers.add_parser("stats", help="Show calibration statistics")

    # Curve command
    curve_p = subparsers.add_parser("curve", help="Show calibration curve")
    curve_p.add_argument("--bins", type=int, default=10, help="Number of bins")

    # List command
    list_p = subparsers.add_parser("list", help="List recent predictions")
    list_p.add_argument("-n", "--limit", type=int, default=10, help="Number to show")

    args = ap.parse_args()

    if not args.command:
        return cmd_stats(args)

    commands = {
        "record": cmd_record,
        "feedback": cmd_feedback,
        "stats": cmd_stats,
        "curve": cmd_curve,
        "list": cmd_list,
    }

    return commands[args.command](args)


if __name__ == "__main__":
    raise SystemExit(main())
