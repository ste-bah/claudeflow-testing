"""
Phase 16 Audit Module - Provenance auditing infrastructure

Week 1 - Chain Validation:
- ProvenanceTracer: Trace claims through RU → KU → Chunk → PDF
- ChunkResolver: Resolve and validate chunk references
- CitationChecker: Validate citation accuracy

Week 2 - Gap Detection:
- MissingLinkDetector: Detect broken links in provenance chains
- OrphanIdentifier: Find unreferenced chunks, KUs, and PDFs
- CoverageAnalyzer: Measure source document utilization
- GapReporter: Generate actionable gap reports with remediation plans

Week 3 - Integration:
- AuditCLI: Unified command-line interface (god-audit)
- RemediationEngine: Auto-fix common provenance issues
- AuditDashboardIntegration: QA dashboard integration

Usage:
    from scripts.audit import ProvenanceTracer, GapReporter

    # Trace provenance
    tracer = ProvenanceTracer()
    chain = tracer.trace_from_ru("ru_001")

    # Generate gap report
    reporter = GapReporter()
    report = reporter.generate_report()

    # CLI usage
    from scripts.audit.cli import AuditCLI
    cli = AuditCLI()
    result = cli.cmd_full(args)
"""

from .core import (
    # Week 1 - Chain Validation
    ProvenanceTracer,
    ProvenanceChain,
    ProvenanceNode,
    ChunkResolver,
    ChunkResolution,
    ChunkValidation,
    CitationChecker,
    CitationAudit,
    CitationIssue,
    # Week 2 - Gap Detection
    MissingLinkDetector,
    MissingLink,
    LinkDetectionResult,
    DetectionSummary,
    OrphanIdentifier,
    OrphanEntity,
    OrphanReport,
    OrphanSummary,
    CoverageAnalyzer,
    PageCoverage,
    DocumentCoverage,
    TopicCoverage,
    CoverageSummary,
    GapReporter,
    Gap,
    GapReport,
    RemediationPlan
)

from .cli import (
    # Week 3 - Integration
    AuditCLI,
    RemediationEngine,
    Fix,
    FixType,
    FixStatus,
    RemediationReport,
    AuditDashboardIntegration,
    AuditMetrics,
    IntegratedDashboard
)

__all__ = [
    # Week 1 - Chain Validation
    "ProvenanceTracer",
    "ProvenanceChain",
    "ProvenanceNode",
    "ChunkResolver",
    "ChunkResolution",
    "ChunkValidation",
    "CitationChecker",
    "CitationAudit",
    "CitationIssue",
    # Week 2 - Gap Detection
    "MissingLinkDetector",
    "MissingLink",
    "LinkDetectionResult",
    "DetectionSummary",
    "OrphanIdentifier",
    "OrphanEntity",
    "OrphanReport",
    "OrphanSummary",
    "CoverageAnalyzer",
    "PageCoverage",
    "DocumentCoverage",
    "TopicCoverage",
    "CoverageSummary",
    "GapReporter",
    "Gap",
    "GapReport",
    "RemediationPlan",
    # Week 3 - Integration
    "AuditCLI",
    "RemediationEngine",
    "Fix",
    "FixType",
    "FixStatus",
    "RemediationReport",
    "AuditDashboardIntegration",
    "AuditMetrics",
    "IntegratedDashboard"
]
