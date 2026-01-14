#!/usr/bin/env python3
"""
Phase 16 Week 3: Unified Audit CLI

Provides a single entry point for all provenance audit operations.

Usage:
    god-audit chain [--ru ID | --ku ID | --all]
    god-audit gaps [--links | --orphans | --all]
    god-audit coverage [--document PATH | --topic TAG | --all]
    god-audit report [--summary | --full | --export FILE]
    god-audit fix [--dry-run] [--type TYPE]
    god-audit full [--json] [--ci]
"""

import json
import sys
import argparse
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))

from audit.core.provenance_tracer import ProvenanceTracer
from audit.core.chunk_resolver import ChunkResolver
from audit.core.citation_checker import CitationChecker
from audit.core.missing_link_detector import MissingLinkDetector
from audit.core.orphan_identifier import OrphanIdentifier
from audit.core.coverage_analyzer import CoverageAnalyzer
from audit.core.gap_reporter import GapReporter, GapReport


class AuditExitCode(Enum):
    """Exit codes for CI integration."""
    SUCCESS = 0
    WARNINGS = 1
    ERRORS = 2
    CRITICAL = 3


@dataclass
class AuditResult:
    """Result from an audit operation."""
    command: str
    success: bool
    exit_code: AuditExitCode
    summary: str
    details: Dict[str, Any] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "command": self.command,
            "success": self.success,
            "exit_code": self.exit_code.value,
            "summary": self.summary,
            "details": self.details,
            "warnings": self.warnings,
            "errors": self.errors,
            "timestamp": self.timestamp
        }


class AuditCLI:
    """
    Unified CLI for provenance auditing.

    Provides commands for:
    - Chain tracing and validation
    - Gap detection (missing links, orphans)
    - Coverage analysis
    - Report generation
    - Auto-remediation
    """

    def __init__(self, verbose: bool = False, json_output: bool = False):
        self.verbose = verbose
        self.json_output = json_output

        # Lazy initialization of components
        self._tracer = None
        self._resolver = None
        self._checker = None
        self._link_detector = None
        self._orphan_identifier = None
        self._coverage_analyzer = None
        self._gap_reporter = None

    @property
    def tracer(self) -> ProvenanceTracer:
        if self._tracer is None:
            self._tracer = ProvenanceTracer()
        return self._tracer

    @property
    def resolver(self) -> ChunkResolver:
        if self._resolver is None:
            self._resolver = ChunkResolver()
        return self._resolver

    @property
    def checker(self) -> CitationChecker:
        if self._checker is None:
            self._checker = CitationChecker()
        return self._checker

    @property
    def link_detector(self) -> MissingLinkDetector:
        if self._link_detector is None:
            self._link_detector = MissingLinkDetector(verbose=self.verbose)
        return self._link_detector

    @property
    def orphan_identifier(self) -> OrphanIdentifier:
        if self._orphan_identifier is None:
            self._orphan_identifier = OrphanIdentifier(verbose=self.verbose)
        return self._orphan_identifier

    @property
    def coverage_analyzer(self) -> CoverageAnalyzer:
        if self._coverage_analyzer is None:
            self._coverage_analyzer = CoverageAnalyzer(verbose=self.verbose)
        return self._coverage_analyzer

    @property
    def gap_reporter(self) -> GapReporter:
        if self._gap_reporter is None:
            self._gap_reporter = GapReporter(verbose=self.verbose)
        return self._gap_reporter

    def cmd_chain(self, args) -> AuditResult:
        """Trace and validate provenance chains."""
        if args.ru:
            chain = self.tracer.trace_from_ru(args.ru)
            details = chain.to_dict() if hasattr(chain, 'to_dict') else {"chain": str(chain)}
            summary = f"Traced chain from RU {args.ru}: {chain.status.value if hasattr(chain, 'status') else 'complete'}"
        elif args.ku:
            chain = self.tracer.trace_from_ku(args.ku)
            details = chain.to_dict() if hasattr(chain, 'to_dict') else {"chain": str(chain)}
            summary = f"Traced chain from KU {args.ku}: {chain.status.value if hasattr(chain, 'status') else 'complete'}"
        elif args.all_rus:
            results = {}
            all_rus = self.tracer.loader.get_all_rus()
            for ru_id in all_rus:
                chain = self.tracer.trace_from_ru(ru_id)
                results[ru_id] = chain.to_dict() if hasattr(chain, 'to_dict') else str(chain)
            details = {"chains": results, "count": len(results)}
            complete = sum(1 for c in results.values() if isinstance(c, dict) and c.get("status") == "complete")
            summary = f"Traced {len(results)} RU chains: {complete} complete"
        elif args.all_kus:
            results = {}
            all_kus = self.tracer.loader.get_all_kus()
            for ku_id in all_kus:
                chain = self.tracer.trace_from_ku(ku_id)
                results[ku_id] = chain.to_dict() if hasattr(chain, 'to_dict') else str(chain)
            details = {"chains": results, "count": len(results)}
            complete = sum(1 for c in results.values() if isinstance(c, dict) and c.get("status") == "complete")
            summary = f"Traced {len(results)} KU chains: {complete} complete"
        else:
            # Default: trace all KUs
            results = {}
            all_kus = self.tracer.loader.get_all_kus()
            for ku_id in all_kus:
                chain = self.tracer.trace_from_ku(ku_id)
                results[ku_id] = chain.to_dict() if hasattr(chain, 'to_dict') else str(chain)
            details = {"chains": results, "count": len(results)}
            complete = sum(1 for c in results.values() if isinstance(c, dict) and c.get("status") == "complete")
            summary = f"Traced {len(results)} chains: {complete} complete"

        return AuditResult(
            command="chain",
            success=True,
            exit_code=AuditExitCode.SUCCESS,
            summary=summary,
            details=details
        )

    def cmd_gaps(self, args) -> AuditResult:
        """Detect missing links and orphans."""
        warnings = []
        errors = []

        if args.links:
            result = self.link_detector.detect_all()
            details = result.to_dict()
            summary = f"Link integrity: {result.integrity_score}% ({result.total_broken_links} broken)"
            if result.total_broken_links > 0:
                warnings.append(f"{result.total_broken_links} broken links detected")

        elif args.orphans:
            result = self.orphan_identifier.identify_all()
            details = result.to_dict()
            summary = f"Found {result.total_orphans} orphans (utilization: {result.overall_utilization}%)"
            if result.total_orphans > 100:
                warnings.append(f"High orphan count: {result.total_orphans}")

        else:  # --all or default
            link_result = self.link_detector.detect_all()
            orphan_result = self.orphan_identifier.identify_all()
            details = {
                "links": link_result.to_dict(),
                "orphans": orphan_result.to_dict()
            }
            summary = f"Links: {link_result.integrity_score}% | Orphans: {orphan_result.total_orphans}"

            if link_result.total_broken_links > 0:
                warnings.append(f"{link_result.total_broken_links} broken links")
            if orphan_result.total_orphans > 100:
                warnings.append(f"{orphan_result.total_orphans} orphans found")

        exit_code = AuditExitCode.SUCCESS
        if warnings:
            exit_code = AuditExitCode.WARNINGS
        if errors:
            exit_code = AuditExitCode.ERRORS

        return AuditResult(
            command="gaps",
            success=len(errors) == 0,
            exit_code=exit_code,
            summary=summary,
            details=details,
            warnings=warnings,
            errors=errors
        )

    def cmd_coverage(self, args) -> AuditResult:
        """Analyze source document coverage."""
        warnings = []

        if args.document:
            result = self.coverage_analyzer.analyze_document_coverage(args.document)
            details = result.to_dict()
            summary = f"Document {args.document}: {result.overall_score}% coverage"
            if result.overall_score < 50:
                warnings.append(f"Low coverage: {result.overall_score}%")

        elif args.topic:
            result = self.coverage_analyzer.analyze_topic_coverage(args.topic)
            details = result.to_dict()
            summary = f"Topic '{args.topic}': depth {result.depth_score}, {result.ku_count} KUs"

        elif args.gaps_only:
            gaps = self.coverage_analyzer.get_coverage_gaps()
            details = {"gaps": gaps, "count": len(gaps)}
            summary = f"Found {len(gaps)} documents with coverage gaps"
            if gaps:
                warnings.append(f"{len(gaps)} documents below 50% coverage")

        else:  # --all or default
            result = self.coverage_analyzer.analyze_all()
            details = result.to_dict()
            summary = f"Coverage: {result.page_coverage_pct}% pages, {result.ku_coverage_pct}% KU→RU (Grade: {result.coverage_grade})"

            if result.page_coverage_pct < 80:
                warnings.append(f"Page coverage below 80%: {result.page_coverage_pct}%")
            if result.ku_coverage_pct < 70:
                warnings.append(f"KU→RU coverage below 70%: {result.ku_coverage_pct}%")

        exit_code = AuditExitCode.SUCCESS if not warnings else AuditExitCode.WARNINGS

        return AuditResult(
            command="coverage",
            success=True,
            exit_code=exit_code,
            summary=summary,
            details=details,
            warnings=warnings
        )

    def cmd_report(self, args) -> AuditResult:
        """Generate comprehensive audit reports."""
        report = self.gap_reporter.generate_report()

        if args.export:
            self.gap_reporter.export_report(args.export)
            summary = f"Report exported to {args.export}"
        elif args.summary_only:
            summary = f"Health: {report.health_score}/100 (Grade: {report.health_grade}) | Gaps: {report.total_gaps}"
        else:
            summary = f"Full report: {report.total_gaps} gaps, health {report.health_score} ({report.health_grade})"

        details = report.to_dict()
        warnings = []
        errors = []

        if report.critical_count > 0:
            errors.append(f"{report.critical_count} critical issues")
        if report.high_count > 0:
            warnings.append(f"{report.high_count} high-severity issues")

        if report.critical_count > 0:
            exit_code = AuditExitCode.CRITICAL
        elif report.high_count > 0:
            exit_code = AuditExitCode.ERRORS
        elif report.medium_count > 0:
            exit_code = AuditExitCode.WARNINGS
        else:
            exit_code = AuditExitCode.SUCCESS

        return AuditResult(
            command="report",
            success=report.critical_count == 0,
            exit_code=exit_code,
            summary=summary,
            details=details,
            warnings=warnings,
            errors=errors
        )

    def cmd_fix(self, args) -> AuditResult:
        """Auto-fix common issues."""
        from audit.cli.remediation import RemediationEngine

        engine = RemediationEngine(dry_run=args.dry_run, verbose=self.verbose)

        if args.fix_type:
            results = engine.fix_by_type(args.fix_type)
        else:
            results = engine.fix_all()

        details = results
        applied = sum(1 for r in results.get("fixes", []) if r.get("applied"))
        skipped = sum(1 for r in results.get("fixes", []) if not r.get("applied"))

        if args.dry_run:
            summary = f"Dry run: {len(results.get('fixes', []))} fixes would be applied"
        else:
            summary = f"Applied {applied} fixes, skipped {skipped}"

        return AuditResult(
            command="fix",
            success=True,
            exit_code=AuditExitCode.SUCCESS,
            summary=summary,
            details=details
        )

    def cmd_full(self, args) -> AuditResult:
        """Run complete audit suite."""
        results = {}
        warnings = []
        errors = []

        # Run all audits
        if self.verbose:
            print("Running chain validation...", file=sys.stderr)
        chain_args = argparse.Namespace(ru=None, ku=None, all_rus=False, all_kus=True)
        chain_result = self.cmd_chain(chain_args)
        results["chain"] = chain_result.to_dict()

        if self.verbose:
            print("Running gap detection...", file=sys.stderr)
        gaps_args = argparse.Namespace(links=False, orphans=False)
        gaps_result = self.cmd_gaps(gaps_args)
        results["gaps"] = gaps_result.to_dict()
        warnings.extend(gaps_result.warnings)
        errors.extend(gaps_result.errors)

        if self.verbose:
            print("Running coverage analysis...", file=sys.stderr)
        coverage_args = argparse.Namespace(document=None, topic=None, gaps_only=False)
        coverage_result = self.cmd_coverage(coverage_args)
        results["coverage"] = coverage_result.to_dict()
        warnings.extend(coverage_result.warnings)

        if self.verbose:
            print("Generating report...", file=sys.stderr)
        report_args = argparse.Namespace(export=None, summary_only=True)
        report_result = self.cmd_report(report_args)
        results["report"] = report_result.to_dict()
        warnings.extend(report_result.warnings)
        errors.extend(report_result.errors)

        # Determine overall exit code
        if errors:
            exit_code = AuditExitCode.ERRORS
        elif warnings:
            exit_code = AuditExitCode.WARNINGS
        else:
            exit_code = AuditExitCode.SUCCESS

        # For CI mode, use strict exit codes
        if args.ci:
            report = self.gap_reporter.generate_report()
            if report.critical_count > 0:
                exit_code = AuditExitCode.CRITICAL
            elif report.high_count > 0:
                exit_code = AuditExitCode.ERRORS

        summary = f"Full audit: {len(warnings)} warnings, {len(errors)} errors"
        if "report" in results:
            health = results["report"]["details"].get("health_score", 0)
            grade = results["report"]["details"].get("health_grade", "?")
            summary += f" | Health: {health} ({grade})"

        return AuditResult(
            command="full",
            success=len(errors) == 0,
            exit_code=exit_code,
            summary=summary,
            details=results,
            warnings=warnings,
            errors=errors
        )

    def output(self, result: AuditResult):
        """Output result in appropriate format."""
        if self.json_output:
            print(json.dumps(result.to_dict(), indent=2))
        else:
            print(f"\n{'='*60}")
            print(f"AUDIT: {result.command.upper()}")
            print(f"{'='*60}")
            print(f"Status: {'SUCCESS' if result.success else 'FAILED'}")
            print(f"Summary: {result.summary}")

            if result.warnings:
                print(f"\nWarnings ({len(result.warnings)}):")
                for w in result.warnings:
                    print(f"  ⚠ {w}")

            if result.errors:
                print(f"\nErrors ({len(result.errors)}):")
                for e in result.errors:
                    print(f"  ✗ {e}")

            if self.verbose and result.details:
                print(f"\nDetails:")
                print(json.dumps(result.details, indent=2)[:2000])

            print(f"\nExit Code: {result.exit_code.value} ({result.exit_code.name})")
            print(f"{'='*60}\n")


def main():
    parser = argparse.ArgumentParser(
        prog="god-audit",
        description="Unified provenance audit CLI for Phase 16"
    )
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    subparsers = parser.add_subparsers(dest="command", help="Audit commands")

    # Chain command
    chain_parser = subparsers.add_parser("chain", help="Trace provenance chains")
    chain_parser.add_argument("--ru", help="Trace from reasoning unit ID")
    chain_parser.add_argument("--ku", help="Trace from knowledge unit ID")
    chain_parser.add_argument("--all-rus", action="store_true", help="Trace all RUs")
    chain_parser.add_argument("--all-kus", action="store_true", help="Trace all KUs")

    # Gaps command
    gaps_parser = subparsers.add_parser("gaps", help="Detect missing links and orphans")
    gaps_parser.add_argument("--links", action="store_true", help="Check links only")
    gaps_parser.add_argument("--orphans", action="store_true", help="Check orphans only")

    # Coverage command
    coverage_parser = subparsers.add_parser("coverage", help="Analyze coverage")
    coverage_parser.add_argument("--document", help="Analyze specific document")
    coverage_parser.add_argument("--topic", help="Analyze specific topic")
    coverage_parser.add_argument("--gaps-only", action="store_true", help="Show gaps only")

    # Report command
    report_parser = subparsers.add_parser("report", help="Generate reports")
    report_parser.add_argument("--summary-only", action="store_true", help="Summary only")
    report_parser.add_argument("--export", metavar="FILE", help="Export to JSON file")

    # Fix command
    fix_parser = subparsers.add_parser("fix", help="Auto-fix issues")
    fix_parser.add_argument("--dry-run", action="store_true", help="Preview fixes")
    fix_parser.add_argument("--type", dest="fix_type", help="Fix specific type")

    # Full command
    full_parser = subparsers.add_parser("full", help="Run complete audit")
    full_parser.add_argument("--ci", action="store_true", help="CI mode (strict exit codes)")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    cli = AuditCLI(verbose=args.verbose, json_output=args.json)

    try:
        if args.command == "chain":
            result = cli.cmd_chain(args)
        elif args.command == "gaps":
            result = cli.cmd_gaps(args)
        elif args.command == "coverage":
            result = cli.cmd_coverage(args)
        elif args.command == "report":
            result = cli.cmd_report(args)
        elif args.command == "fix":
            result = cli.cmd_fix(args)
        elif args.command == "full":
            result = cli.cmd_full(args)
        else:
            parser.print_help()
            sys.exit(0)

        cli.output(result)
        sys.exit(result.exit_code.value)

    except Exception as e:
        if args.json:
            print(json.dumps({"error": str(e), "command": args.command}))
        else:
            print(f"Error: {e}", file=sys.stderr)
        sys.exit(AuditExitCode.CRITICAL.value)


if __name__ == "__main__":
    main()
