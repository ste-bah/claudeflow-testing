#!/usr/bin/env python3
"""Quick test script for ConsistencyChecker"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from qa.core.consistency_checker import ConsistencyChecker

def main():
    print("Testing ConsistencyChecker on current corpus...")
    print("=" * 60)

    checker = ConsistencyChecker()

    # Run all checks
    results = checker.check_all()

    # Print report
    print("\n")
    report = checker.format_consistency_report(results, show_low_severity=True)
    print(report)

    # Print summary
    print("\n" + "=" * 60)
    summary = checker.get_summary(results)
    print("Summary:")
    print(f"  Total issues: {summary['total_issues']}")
    print(f"  By check: {summary['by_check']}")
    print(f"  By severity: {summary['by_severity']}")

    return 0 if not summary['has_critical'] and not summary['has_high'] else 1

if __name__ == "__main__":
    sys.exit(main())
