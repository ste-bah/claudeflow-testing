#!/usr/bin/env python3
"""
QA CLI - Main entry point for Phase 15 QA Infrastructure

Commands:
  check-coverage       Check for coverage regression against baseline
  check-reasoning      Check for reasoning stability against baseline
  check-consistency    Check for consistency issues (provenance, duplicates)
  generate-report      Generate comprehensive QA report
  dashboard            Display QA dashboard (not yet implemented)

Exit Codes:
  0 - All checks passed
  1 - Warnings (MEDIUM severity issues)
  2 - Failures (HIGH/CRITICAL severity issues)
"""

import sys
import argparse
from pathlib import Path
from typing import Dict, List, Any

# Add scripts to path
scripts_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(scripts_dir))

from qa.core.baseline_manager import BaselineManager
from qa.core.regression_detector import RegressionDetector
from qa.core.consistency_checker import ConsistencyChecker
from explore.core.artifact_loader import ArtifactLoader


# ========================
# Coverage Regression Check
# ========================

def cmd_check_coverage(args) -> int:
    """
    Check for coverage regression against baseline.

    Returns:
        Exit code (0=pass, 1=warnings, 2=failures)
    """
    print("=" * 60)
    print("Coverage Regression Check")
    print("=" * 60)
    print()

    # Load baseline
    manager = BaselineManager(baselines_dir=args.baselines_dir)

    if not manager.coverage_file.exists():
        print(f"❌ ERROR: Coverage baseline not found at {manager.coverage_file}")
        print("   Run establish_baselines.py first to create baselines.")
        return 2

    baseline = manager.load_coverage_baseline()
    print(f"✓ Loaded coverage baseline: {len(baseline.queries)} queries tracked")
    print(f"  Created: {baseline.created}")
    print()

    # Run regression detection
    detector = RegressionDetector()
    regressions = detector.detect_coverage_regressions(baseline)

    # Generate report
    report = detector.format_coverage_regression_report(regressions)
    print(report)

    # Determine exit code
    highest_severity = detector.get_highest_severity([r.severity for r in regressions])

    if not regressions:
        print("✅ No coverage regressions detected")
        return 0

    # Check fail thresholds
    if args.fail_on_high and highest_severity in ["critical", "high"]:
        print(f"\n❌ FAIL: {highest_severity.upper()} severity regression detected (--fail-on-high)")
        return 2
    elif args.fail_on_critical and highest_severity == "critical":
        print(f"\n❌ FAIL: {highest_severity.upper()} severity regression detected (--fail-on-critical)")
        return 2
    elif highest_severity in ["critical", "high"]:
        print(f"\n⚠️  WARNING: {highest_severity.upper()} severity regression detected")
        return 1 if args.fail_on_high or args.fail_on_critical else 0
    else:
        print(f"\n⚠️  INFO: {highest_severity.upper()} severity issues detected")
        return 0


# ========================
# Reasoning Stability Check
# ========================

def cmd_check_reasoning(args) -> int:
    """
    Check for reasoning stability issues against baseline.

    Returns:
        Exit code (0=pass, 1=warnings, 2=failures)
    """
    print("=" * 60)
    print("Reasoning Stability Check")
    print("=" * 60)
    print()

    # Load baseline
    manager = BaselineManager(baselines_dir=args.baselines_dir)

    if not manager.reasoning_file.exists():
        print(f"❌ ERROR: Reasoning baseline not found at {manager.reasoning_file}")
        print("   Run establish_baselines.py first to create baselines.")
        return 2

    baseline = manager.load_reasoning_baseline()
    print(f"✓ Loaded reasoning baseline: {baseline.stats['total_rus']} RUs tracked")
    print(f"  Created: {baseline.created}")
    print()

    # Run stability detection
    detector = RegressionDetector()
    issues = detector.check_reasoning_stability(baseline)

    # Generate report
    report = detector.format_reasoning_stability_report(issues)
    print(report)

    # Determine exit code
    highest_severity = detector.get_highest_severity([i.severity for i in issues])

    if not issues:
        print("✅ No reasoning stability issues detected")
        return 0

    # Check fail thresholds
    if args.fail_on_critical and highest_severity == "critical":
        print(f"\n❌ FAIL: {highest_severity.upper()} severity issue detected (--fail-on-critical)")
        return 2
    elif args.fail_on_high and highest_severity in ["critical", "high"]:
        print(f"\n❌ FAIL: {highest_severity.upper()} severity issue detected (--fail-on-high)")
        return 2
    elif highest_severity in ["critical", "high"]:
        print(f"\n⚠️  WARNING: {highest_severity.upper()} severity issue detected")
        return 1 if args.fail_on_high or args.fail_on_critical else 0
    else:
        print(f"\n⚠️  INFO: {highest_severity.upper()} severity issues detected")
        return 0


# ========================
# Consistency Check
# ========================

def cmd_check_consistency(args) -> int:
    """
    Check for consistency issues (provenance, duplicates).

    Returns:
        Exit code (0=pass, 1=warnings, 2=failures)
    """
    print("=" * 60)
    print("Consistency Check")
    print("=" * 60)
    print()

    # Run consistency checks
    checker = ConsistencyChecker()
    results = checker.check_all()

    # Generate report
    report = checker.format_consistency_report(results, show_low_severity=args.show_low)
    print(report)

    # Get summary
    summary = checker.get_summary(results)

    print()
    print("=" * 60)
    print("Summary:")
    print(f"  Total issues: {summary['total_issues']}")
    print(f"  By severity: {summary['by_severity']}")
    print()

    # Determine exit code
    if summary['has_critical']:
        if args.fail_on_critical or args.fail_on_high:
            print("❌ FAIL: CRITICAL severity issues detected")
            return 2
        else:
            print("⚠️  WARNING: CRITICAL severity issues detected (not failing due to flags)")
            return 1
    elif summary['has_high']:
        if args.fail_on_high:
            print("❌ FAIL: HIGH severity issues detected (--fail-on-high)")
            return 2
        else:
            print("⚠️  WARNING: HIGH severity issues detected")
            return 1
    else:
        print("✅ No critical or high severity issues detected")
        return 0


# ========================
# Generate Report
# ========================

def cmd_generate_report(args) -> int:
    """
    Generate comprehensive QA report (JSON format).

    Returns:
        Exit code (always 0 - report generation)
    """
    print("=" * 60)
    print("QA Report Generation")
    print("=" * 60)
    print()

    import json
    from datetime import datetime

    # Load baselines
    manager = BaselineManager(baselines_dir=args.baselines_dir)
    detector = RegressionDetector()
    loader = detector.loader
    checker = ConsistencyChecker()

    report_data = {
        "version": "1.0",
        "generated": datetime.utcnow().isoformat() + "Z",
        "checks": {}
    }

    # Coverage regression
    if manager.coverage_file.exists():
        print("Running coverage regression check...")
        baseline = manager.load_coverage_baseline()
        regressions = detector.detect_coverage_regressions(baseline)
        report_data['checks']['coverage_regression'] = {
            "regressions_count": len(regressions),
            "highest_severity": detector.get_highest_severity([r.severity for r in regressions]) if regressions else None,
            "regressions": [
                {
                    "query": r.query,
                    "type": r.regression_type,
                    "severity": r.severity,
                    "baseline_value": r.baseline_value,
                    "current_value": r.current_value,
                    "diff": r.diff
                }
                for r in regressions
            ]
        }

    # Reasoning stability
    if manager.reasoning_file.exists():
        print("Running reasoning stability check...")
        baseline = manager.load_reasoning_baseline()
        issues = detector.check_reasoning_stability(baseline)
        report_data['checks']['reasoning_stability'] = {
            "issues_count": len(issues),
            "highest_severity": detector.get_highest_severity([i.severity for i in issues]) if issues else None,
            "issues": [
                {
                    "type": i.issue_type,
                    "ru_id": i.ru_id,
                    "severity": i.severity,
                    "baseline_value": str(i.baseline_value),
                    "current_value": str(i.current_value)
                }
                for i in issues
            ]
        }

    # Consistency checks
    print("Running consistency checks...")
    results = checker.check_all()
    summary = checker.get_summary(results)
    report_data['checks']['consistency'] = {
        "total_issues": summary['total_issues'],
        "by_severity": summary['by_severity'],
        "by_check": summary['by_check'],
        "has_critical": summary['has_critical'],
        "has_high": summary['has_high']
    }

    # Write report
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(report_data, f, indent=2)

    print()
    print(f"✅ Report generated: {output_path}")
    print(f"   Total checks: {len(report_data['checks'])}")

    return 0


# ========================
# Dashboard
# ========================

def cmd_dashboard(args) -> int:
    """
    Display QA dashboard (terminal UI).

    Returns:
        Exit code (always 0)
    """
    print("=" * 60)
    print("QA Dashboard")
    print("=" * 60)
    print()

    # Load current state
    loader = ArtifactLoader()
    all_kus = loader.get_all_kus()
    all_rus = loader.get_all_rus()

    print("╔═══════════════════════════════════════╗")
    print("║   God-Learn QA Dashboard              ║")
    print("╠═══════════════════════════════════════╣")
    print(f"║ Knowledge Units: {len(all_kus):<20} ║")
    print(f"║ Reasoning Units: {len(all_rus):<20} ║")
    print("╚═══════════════════════════════════════╝")
    print()

    # Check if baselines exist
    manager = BaselineManager()

    print("Baseline Status:")
    print(f"  Coverage:    {'✅' if manager.coverage_file.exists() else '❌'}")
    print(f"  Reasoning:   {'✅' if manager.reasoning_file.exists() else '❌'}")
    print(f"  Metrics:     {'✅' if manager.metrics_file.exists() else '❌'}")
    print()

    # Quick consistency check
    checker = ConsistencyChecker()
    results = checker.check_all()
    summary = checker.get_summary(results)

    print("Consistency Status:")
    print(f"  Total Issues:  {summary['total_issues']}")
    print(f"  Critical:      {summary['by_severity']['critical']}")
    print(f"  High:          {summary['by_severity']['high']}")
    print(f"  Medium:        {summary['by_severity']['medium']}")
    print(f"  Low:           {summary['by_severity']['low']}")
    print()

    if summary['has_critical']:
        print("⚠️  Status: CRITICAL issues detected")
    elif summary['has_high']:
        print("⚠️  Status: HIGH severity issues detected")
    else:
        print("✅ Status: Healthy")

    return 0


# ========================
# Main Entry Point
# ========================

def main():
    parser = argparse.ArgumentParser(
        description="QA CLI - Phase 15 QA Infrastructure",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Check coverage regression
  python3 qa_cli.py check-coverage --fail-on-high

  # Check reasoning stability
  python3 qa_cli.py check-reasoning --fail-on-critical

  # Check consistency
  python3 qa_cli.py check-consistency --show-low

  # Generate full report
  python3 qa_cli.py generate-report --output qa/reports/report_20260113.json

  # View dashboard
  python3 qa_cli.py dashboard
        """
    )

    # Global options
    parser.add_argument(
        '--baselines-dir',
        type=str,
        default=None,
        help='Path to baselines directory (default: qa/baselines/)'
    )

    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # check-coverage
    parser_coverage = subparsers.add_parser(
        'check-coverage',
        help='Check for coverage regression'
    )
    parser_coverage.add_argument(
        '--fail-on-high',
        action='store_true',
        help='Exit with code 2 if HIGH or CRITICAL severity detected'
    )
    parser_coverage.add_argument(
        '--fail-on-critical',
        action='store_true',
        help='Exit with code 2 if CRITICAL severity detected'
    )

    # check-reasoning
    parser_reasoning = subparsers.add_parser(
        'check-reasoning',
        help='Check for reasoning stability issues'
    )
    parser_reasoning.add_argument(
        '--fail-on-high',
        action='store_true',
        help='Exit with code 2 if HIGH or CRITICAL severity detected'
    )
    parser_reasoning.add_argument(
        '--fail-on-critical',
        action='store_true',
        help='Exit with code 2 if CRITICAL severity detected'
    )

    # check-consistency
    parser_consistency = subparsers.add_parser(
        'check-consistency',
        help='Check for consistency issues'
    )
    parser_consistency.add_argument(
        '--fail-on-high',
        action='store_true',
        help='Exit with code 2 if HIGH or CRITICAL severity detected'
    )
    parser_consistency.add_argument(
        '--fail-on-critical',
        action='store_true',
        help='Exit with code 2 if CRITICAL severity detected'
    )
    parser_consistency.add_argument(
        '--show-low',
        action='store_true',
        help='Show LOW severity issues in report'
    )

    # generate-report
    parser_report = subparsers.add_parser(
        'generate-report',
        help='Generate comprehensive QA report'
    )
    parser_report.add_argument(
        '--output',
        type=str,
        default='qa/reports/report.json',
        help='Output path for report (default: qa/reports/report.json)'
    )

    # dashboard
    subparsers.add_parser(
        'dashboard',
        help='Display QA dashboard'
    )

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    # Dispatch to command handler
    if args.command == 'check-coverage':
        return cmd_check_coverage(args)
    elif args.command == 'check-reasoning':
        return cmd_check_reasoning(args)
    elif args.command == 'check-consistency':
        return cmd_check_consistency(args)
    elif args.command == 'generate-report':
        return cmd_generate_report(args)
    elif args.command == 'dashboard':
        return cmd_dashboard(args)
    else:
        print(f"Unknown command: {args.command}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
