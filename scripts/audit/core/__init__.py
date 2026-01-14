"""
Phase 16 Audit Core - Provenance auditing infrastructure

Week 1 - Chain Validation:
- ProvenanceTracer: Trace claims through the full provenance chain
- ChunkResolver: Resolve and validate chunk references
- CitationChecker: Validate citation accuracy

Week 2 - Gap Detection:
- MissingLinkDetector: Detect broken links in provenance chains
- OrphanIdentifier: Find unreferenced entities
- CoverageAnalyzer: Measure source document utilization
- GapReporter: Generate actionable gap reports
"""

# Week 1 - Chain Validation
from .provenance_tracer import ProvenanceTracer, ProvenanceChain, ProvenanceNode
from .chunk_resolver import ChunkResolver, ChunkResolution, ChunkValidation
from .citation_checker import CitationChecker, CitationAudit, CitationIssue

# Week 2 - Gap Detection
from .missing_link_detector import MissingLinkDetector, MissingLink, LinkDetectionResult, DetectionSummary
from .orphan_identifier import OrphanIdentifier, OrphanEntity, OrphanReport, OrphanSummary
from .coverage_analyzer import CoverageAnalyzer, PageCoverage, DocumentCoverage, TopicCoverage, CoverageSummary
from .gap_reporter import GapReporter, Gap, GapReport, RemediationPlan

__all__ = [
    # Week 1
    "ProvenanceTracer",
    "ProvenanceChain",
    "ProvenanceNode",
    "ChunkResolver",
    "ChunkResolution",
    "ChunkValidation",
    "CitationChecker",
    "CitationAudit",
    "CitationIssue",
    # Week 2
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
    "RemediationPlan"
]
