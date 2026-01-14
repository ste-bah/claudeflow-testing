#!/usr/bin/env python3
"""
Phase 9 Hybrid Provenance Validator

Ensures outputs correctly separate local and external provenance.
Run after Phase 9 ANSWER in hybrid mode.

GAP-H02: Provenance validation implementation

Usage:
    python3 scripts/interaction/validate_provenance.py --answer answer.json
    python3 scripts/interaction/validate_provenance.py --answer answer.json --strict
    python3 scripts/interaction/validate_provenance.py --answer answer.json --format markdown

Exit codes:
    0 - Validation passed (or passed with warnings in non-strict mode)
    1 - Validation error (failed to parse, missing file, etc.)
    2 - Validation failed (strict mode: provenance violations detected)
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Any, Tuple, Optional
from dataclasses import dataclass, field
from enum import Enum


class ProvenanceType(Enum):
    """Types of provenance for claims"""
    LOCAL = "local"
    EXTERNAL = "external"
    MIXED = "mixed"
    UNKNOWN = "unknown"


@dataclass
class ValidationResult:
    """Result of validating a single claim"""
    claim_id: str
    is_valid: bool
    provenance_type: ProvenanceType
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    local_supports: List[str] = field(default_factory=list)
    external_supports: List[str] = field(default_factory=list)


@dataclass
class OverallValidation:
    """Overall validation results"""
    valid: bool = True
    total_claims: int = 0
    local_only_claims: int = 0
    external_only_claims: int = 0
    mixed_claims: int = 0
    invalid_claims: int = 0
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    claim_results: List[ValidationResult] = field(default_factory=list)
    notes: Optional[str] = None


def is_local_provenance(support: Any) -> bool:
    """
    Check if a support reference is local provenance.

    Local provenance patterns:
    - ku_* (knowledge unit IDs)
    - ru_* (reasoning unit IDs)
    - Contains ':' (file:line references)
    - Structured object with type="local"
    """
    if isinstance(support, str):
        if support.startswith("ku_") or support.startswith("ru_"):
            return True
        if ":" in support and not support.startswith("http"):
            return True
        return False
    elif isinstance(support, dict):
        return support.get("type") == "local"
    return False


def is_external_provenance(support: Any) -> bool:
    """
    Check if a support reference is external provenance.

    External provenance patterns:
    - Starts with http:// or https://
    - Structured object with type="external"
    """
    if isinstance(support, str):
        return support.startswith("http://") or support.startswith("https://")
    elif isinstance(support, dict):
        return support.get("type") == "external"
    return False


def validate_external_support(support: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """
    Validate that an external support has required fields.

    External supports must have:
    - url: The source URL
    - justification: Why external source was needed
    """
    errors = []

    if not support.get("url"):
        errors.append("External support missing 'url' field")

    if not support.get("justification"):
        errors.append("External support missing 'justification' field")

    return len(errors) == 0, errors


def validate_claim_provenance(claim: Dict[str, Any]) -> ValidationResult:
    """
    Validate a single claim has correct provenance labeling.

    Returns a ValidationResult with detailed information.
    """
    claim_id = claim.get("claim_id", claim.get("id", "unknown"))
    result = ValidationResult(claim_id=claim_id, is_valid=True, provenance_type=ProvenanceType.UNKNOWN)

    supports = claim.get("supports", claim.get("sources", []))
    claim_type = claim.get("type", "")

    # Check if supports exist for assertions
    if claim_type == "assertion" and not supports:
        result.errors.append(f"Assertion claim has no supports")
        result.is_valid = False
        return result

    # Categorize supports
    unlabeled_supports = []

    for s in supports:
        if is_local_provenance(s):
            if isinstance(s, str):
                result.local_supports.append(s)
            else:
                result.local_supports.append(str(s.get("id", s)))
        elif is_external_provenance(s):
            if isinstance(s, dict):
                is_valid, errors = validate_external_support(s)
                if not is_valid:
                    result.errors.extend(errors)
                    result.is_valid = False
            if isinstance(s, str):
                result.external_supports.append(s)
            else:
                result.external_supports.append(s.get("url", str(s)))
        else:
            unlabeled_supports.append(s)

    # Check for unlabeled supports
    if unlabeled_supports:
        result.warnings.append(
            f"{len(unlabeled_supports)} unlabeled supports: {unlabeled_supports[:3]}"
        )

    # Determine provenance type
    has_local = len(result.local_supports) > 0
    has_external = len(result.external_supports) > 0

    if has_local and has_external:
        result.provenance_type = ProvenanceType.MIXED
    elif has_local:
        result.provenance_type = ProvenanceType.LOCAL
    elif has_external:
        result.provenance_type = ProvenanceType.EXTERNAL
    else:
        result.provenance_type = ProvenanceType.UNKNOWN
        if claim_type == "assertion":
            result.warnings.append("No recognized provenance for assertion")

    return result


def validate_hybrid_output(answer_json: Dict[str, Any]) -> OverallValidation:
    """
    Validate entire Phase 9 ANSWER output for hybrid mode compliance.

    Checks:
    1. All claims have proper provenance labeling
    2. External supports have required justification
    3. Mixed provenance is explicitly structured
    """
    results = OverallValidation()

    # Get synthesis claims (different JSON structures to check)
    synthesis = answer_json.get("layers", {}).get("synthesis", {})
    if not synthesis:
        synthesis = answer_json.get("synthesis", {})

    if not synthesis or not synthesis.get("enabled", True):
        results.notes = "Synthesis not enabled; no claims to validate"
        return results

    # Try different claim structures
    claims = synthesis.get("claims", [])
    if not claims:
        claims = answer_json.get("claims", [])
    if not claims:
        claims = answer_json.get("assertions", [])

    results.total_claims = len(claims)

    if not claims:
        results.notes = "No claims found in output"
        return results

    for claim in claims:
        claim_result = validate_claim_provenance(claim)
        results.claim_results.append(claim_result)

        if not claim_result.is_valid:
            results.valid = False
            results.invalid_claims += 1
            results.errors.extend(
                [f"Claim {claim_result.claim_id}: {e}" for e in claim_result.errors]
            )

        results.warnings.extend(
            [f"Claim {claim_result.claim_id}: {w}" for w in claim_result.warnings]
        )

        # Count by provenance type
        if claim_result.provenance_type == ProvenanceType.LOCAL:
            results.local_only_claims += 1
        elif claim_result.provenance_type == ProvenanceType.EXTERNAL:
            results.external_only_claims += 1
        elif claim_result.provenance_type == ProvenanceType.MIXED:
            results.mixed_claims += 1

    return results


def format_results_json(results: OverallValidation) -> str:
    """Format results as JSON"""
    output = {
        "valid": results.valid,
        "total_claims": results.total_claims,
        "local_only_claims": results.local_only_claims,
        "external_only_claims": results.external_only_claims,
        "mixed_claims": results.mixed_claims,
        "invalid_claims": results.invalid_claims,
        "errors": results.errors,
        "warnings": results.warnings,
    }
    if results.notes:
        output["notes"] = results.notes

    return json.dumps(output, indent=2)


def format_results_markdown(results: OverallValidation) -> str:
    """Format results as Markdown"""
    lines = [
        "# Provenance Validation Report",
        "",
        "## Summary",
        "",
        f"| Metric | Value |",
        f"|--------|-------|",
        f"| Status | {'PASS' if results.valid else 'FAIL'} |",
        f"| Total Claims | {results.total_claims} |",
        f"| Local-Only Claims | {results.local_only_claims} |",
        f"| External-Only Claims | {results.external_only_claims} |",
        f"| Mixed Provenance | {results.mixed_claims} |",
        f"| Invalid Claims | {results.invalid_claims} |",
        "",
    ]

    if results.notes:
        lines.extend(["## Notes", "", results.notes, ""])

    if results.errors:
        lines.extend(["## Errors", ""])
        for error in results.errors:
            lines.append(f"- {error}")
        lines.append("")

    if results.warnings:
        lines.extend(["## Warnings", ""])
        for warning in results.warnings:
            lines.append(f"- {warning}")
        lines.append("")

    # Detailed claim breakdown
    if results.claim_results:
        lines.extend(["## Claim Details", ""])
        for cr in results.claim_results:
            status = "VALID" if cr.is_valid else "INVALID"
            lines.append(f"### Claim: {cr.claim_id} [{status}]")
            lines.append(f"- Provenance Type: {cr.provenance_type.value}")
            if cr.local_supports:
                lines.append(f"- Local Supports: {len(cr.local_supports)}")
            if cr.external_supports:
                lines.append(f"- External Supports: {len(cr.external_supports)}")
            if cr.errors:
                lines.append(f"- Errors: {', '.join(cr.errors)}")
            lines.append("")

    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate hybrid provenance in Phase 9 ANSWER output",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        "--answer", "-a",
        required=True,
        help="Path to answer.json file"
    )
    parser.add_argument(
        "--strict", "-s",
        action="store_true",
        help="Exit with code 2 on any validation error"
    )
    parser.add_argument(
        "--format", "-f",
        choices=["json", "markdown"],
        default="json",
        help="Output format (default: json)"
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Only output on error"
    )

    args = parser.parse_args()

    # Load answer JSON
    answer_path = Path(args.answer)
    if not answer_path.exists():
        print(f"Error: File not found: {args.answer}", file=sys.stderr)
        return 1

    try:
        with open(answer_path, "r", encoding="utf-8") as f:
            answer_json = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON: {e}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"Error: Failed to read file: {e}", file=sys.stderr)
        return 1

    # Validate
    results = validate_hybrid_output(answer_json)

    # Output
    if not args.quiet or not results.valid:
        if args.format == "json":
            print(format_results_json(results))
        else:
            print(format_results_markdown(results))

    # Exit code
    if args.strict and not results.valid:
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
