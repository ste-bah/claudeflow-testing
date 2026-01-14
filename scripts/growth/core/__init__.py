"""
Phase 17 Core Modules - Corpus Growth Infrastructure

Week 1-2: Versioning
- corpus_version_manager.py - Version management and snapshots
- changelog.py - Change tracking and rollback

Week 3-4: Reprocessing
- document_tracker.py - Track new/modified documents
- incremental_processor.py - Selective Phase 6-7 execution
- merge_strategy.py - Reasoning merge strategies

Week 5: Skew Detection
- density_analyzer.py - Reasoning density metrics
- skew_detector.py - Imbalance detection
- calibration.py - Manual calibration tools
"""

from .corpus_version_manager import (
    CorpusVersionManager,
    CorpusVersion,
    CorpusSnapshot
)
from .changelog import (
    CorpusChangelog,
    ChangeEntry,
    ChangeType
)
from .document_tracker import (
    DocumentTracker,
    TrackedDocument,
    DocumentStatus
)
from .incremental_processor import (
    IncrementalProcessor,
    ProcessingMode,
    ProcessingResult,
    BatchResult
)
from .merge_strategy import (
    MergeStrategy,
    MergeMode,
    MergeResult,
    MergeConflict,
    ConflictType,
    KnowledgeUnit
)
from .density_analyzer import (
    DensityAnalyzer,
    DomainMetrics,
    SourceMetrics,
    DensityReport
)
from .skew_detector import (
    SkewDetector,
    SkewType,
    SkewSeverity,
    SkewAlert,
    SkewReport
)
from .calibration import (
    CalibrationTools,
    CalibrationAction,
    CalibrationRule,
    CalibrationPlan
)

__all__ = [
    # Versioning (Week 1-2)
    "CorpusVersionManager",
    "CorpusVersion",
    "CorpusSnapshot",
    "CorpusChangelog",
    "ChangeEntry",
    "ChangeType",
    # Document Tracking (Week 3-4)
    "DocumentTracker",
    "TrackedDocument",
    "DocumentStatus",
    # Incremental Processing (Week 3-4)
    "IncrementalProcessor",
    "ProcessingMode",
    "ProcessingResult",
    "BatchResult",
    # Merge Strategy (Week 3-4)
    "MergeStrategy",
    "MergeMode",
    "MergeResult",
    "MergeConflict",
    "ConflictType",
    "KnowledgeUnit",
    # Density Analysis (Week 5)
    "DensityAnalyzer",
    "DomainMetrics",
    "SourceMetrics",
    "DensityReport",
    # Skew Detection (Week 5)
    "SkewDetector",
    "SkewType",
    "SkewSeverity",
    "SkewAlert",
    "SkewReport",
    # Calibration (Week 5)
    "CalibrationTools",
    "CalibrationAction",
    "CalibrationRule",
    "CalibrationPlan"
]
