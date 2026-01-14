"""
Phase 17 (13→14): Corpus Growth & Rebalancing

Safe scaling of corpus without semantic drift:
- Corpus versioning and changelog
- Selective Phase 6-7 rerun (new docs only)
- Reasoning density skew detection
- Manual calibration tools

Week 1-2: Versioning Infrastructure
- CorpusVersionManager: Version numbering, changelog, snapshots
- CorpusSnapshot: Point-in-time corpus state
- CorpusChangelog: Track all changes with rollback support

Week 3-4: Selective Reprocessing
- DocumentTracker: Track new/modified documents
- IncrementalProcessor: Run Phase 6-7 on new docs only
- MergeStrategy: Merge new reasoning with existing

Week 5: Skew Detection
- DensityAnalyzer: Reasoning density by domain
- SkewDetector: Detect imbalances
- CalibrationTools: Manual adjustment tools

Week 6: CLI & Validation
- god-grow CLI
- Testing and documentation

Usage:
    from scripts.growth import CorpusVersionManager

    manager = CorpusVersionManager()
    manager.create_snapshot("Adding new documents")
    manager.add_documents(["/path/to/new.pdf"])
    manager.process_new()

CLI Usage:
    python -m scripts.growth.cli.growth_cli status
    python -m scripts.growth.cli.growth_cli snapshot -d "Description"
    python -m scripts.growth.cli.growth_cli verify
    python -m scripts.growth.cli.growth_cli rollback <snapshot-id>
"""

from .core import (
    # Week 1-2: Versioning
    CorpusVersionManager,
    CorpusVersion,
    CorpusSnapshot,
    CorpusChangelog,
    ChangeEntry,
    ChangeType,
    # Week 3-4: Reprocessing
    DocumentTracker,
    TrackedDocument,
    DocumentStatus,
    IncrementalProcessor,
    ProcessingMode,
    ProcessingResult,
    BatchResult,
    MergeStrategy,
    MergeMode,
    MergeResult,
    MergeConflict,
    ConflictType,
    KnowledgeUnit,
    # Week 5: Skew Detection & Calibration
    DensityAnalyzer,
    DomainMetrics,
    SourceMetrics,
    DensityReport,
    SkewDetector,
    SkewType,
    SkewSeverity,
    SkewAlert,
    SkewReport,
    CalibrationTools,
    CalibrationAction,
    CalibrationRule,
    CalibrationPlan
)
from .cli import main as cli_main, GrowthCLI

__all__ = [
    # Core versioning (Week 1-2)
    "CorpusVersionManager",
    "CorpusVersion",
    "CorpusSnapshot",
    "CorpusChangelog",
    "ChangeEntry",
    "ChangeType",
    # Document tracking (Week 3-4)
    "DocumentTracker",
    "TrackedDocument",
    "DocumentStatus",
    # Incremental processing (Week 3-4)
    "IncrementalProcessor",
    "ProcessingMode",
    "ProcessingResult",
    "BatchResult",
    # Merge strategy (Week 3-4)
    "MergeStrategy",
    "MergeMode",
    "MergeResult",
    "MergeConflict",
    "ConflictType",
    "KnowledgeUnit",
    # Density analysis (Week 5)
    "DensityAnalyzer",
    "DomainMetrics",
    "SourceMetrics",
    "DensityReport",
    # Skew detection (Week 5)
    "SkewDetector",
    "SkewType",
    "SkewSeverity",
    "SkewAlert",
    "SkewReport",
    # Calibration (Week 5)
    "CalibrationTools",
    "CalibrationAction",
    "CalibrationRule",
    "CalibrationPlan",
    # CLI
    "cli_main",
    "GrowthCLI"
]
