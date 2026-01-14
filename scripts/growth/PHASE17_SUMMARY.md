# Phase 17: Corpus Growth & Rebalancing - Complete

## Overview

Phase 17 (13→14) implements safe scaling of corpus without semantic drift through:
- Corpus versioning and changelog
- Selective Phase 6-7 rerun for new documents only
- Reasoning density skew detection
- Manual calibration tools

**Status**: ✅ Complete
**Duration**: 6 weeks
**Total Code**: ~4,500 lines

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Phase 17: Corpus Growth                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐    ┌─────────────────┐                 │
│  │ CorpusVersion   │    │ CorpusChangelog │  Week 1-2       │
│  │ Manager         │───▶│                 │  Versioning     │
│  │ - snapshots     │    │ - change log    │                 │
│  │ - rollback      │    │ - rollback      │                 │
│  │ - diff          │    │ - export        │                 │
│  └─────────────────┘    └─────────────────┘                 │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────┐    ┌─────────────────┐                 │
│  │ DocumentTracker │───▶│ Incremental     │  Week 3-4       │
│  │ - new docs      │    │ Processor       │  Reprocessing   │
│  │ - modified      │    │ - Phase 6-7     │                 │
│  │ - unchanged     │    │ - batch process │                 │
│  └─────────────────┘    └─────────────────┘                 │
│           │                      │                          │
│           ▼                      ▼                          │
│  ┌─────────────────┐    ┌─────────────────┐                 │
│  │ MergeStrategy   │    │ DensityAnalyzer │  Week 5         │
│  │ - dedupe        │    │ - domain stats  │  Skew Detection │
│  │ - semantic      │    │ - source stats  │                 │
│  │ - conflicts     │    │ - imbalances    │                 │
│  └─────────────────┘    └─────────────────┘                 │
│                                  │                          │
│                                  ▼                          │
│                         ┌─────────────────┐                 │
│                         │ SkewDetector    │                 │
│                         │ - health score  │                 │
│                         │ - alerts        │                 │
│                         └────────┬────────┘                 │
│                                  │                          │
│                                  ▼                          │
│                         ┌─────────────────┐                 │
│                         │ Calibration     │                 │
│                         │ Tools           │                 │
│                         │ - auto-plan     │                 │
│                         │ - manual adjust │                 │
│                         └─────────────────┘                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Components by Week

### Week 1-2: Versioning Infrastructure (~1,725 lines)

| Component | File | Description |
|-----------|------|-------------|
| CorpusVersionManager | `corpus_version_manager.py` | Version management and snapshots |
| CorpusChangelog | `changelog.py` | Change tracking with rollback |
| GrowthCLI | `growth_cli.py` | Unified CLI interface |

**Key Features:**
- Semantic versioning (major.minor.patch)
- Point-in-time snapshots with SHA-256 hashing
- Full rollback support
- Version diffing

### Week 3-4: Selective Reprocessing (~1,230 lines)

| Component | File | Description |
|-----------|------|-------------|
| DocumentTracker | `document_tracker.py` | Track new/modified documents |
| IncrementalProcessor | `incremental_processor.py` | Selective Phase 6-7 execution |
| MergeStrategy | `merge_strategy.py` | Knowledge merging with conflict resolution |

**Key Features:**
- Hash-based change detection
- Resume interrupted processing
- Multiple merge modes (append, dedupe, semantic, conflict)
- Conflict resolution workflow

### Week 5: Skew Detection & Calibration (~1,160 lines)

| Component | File | Description |
|-----------|------|-------------|
| DensityAnalyzer | `density_analyzer.py` | Reasoning density metrics |
| SkewDetector | `skew_detector.py` | Imbalance detection with health scoring |
| CalibrationTools | `calibration.py` | Manual and auto-calibration |

**Key Features:**
- Domain and source-level metrics
- Statistical skew detection (Gini, entropy)
- Health scoring (0-100)
- Auto-generated calibration plans

### Week 6: Testing & Documentation (~400 lines)

| Component | File | Description |
|-----------|------|-------------|
| TestSuite | `test_phase17.py` | Comprehensive test suite |
| Summaries | `WEEK*_SUMMARY.md` | Weekly documentation |

**Test Results:**
```
21 tests passed, 0 failed
```

## CLI Commands

```bash
# Versioning
god-grow status              # Show corpus status
god-grow snapshot            # Create snapshot
god-grow list                # List snapshots
god-grow verify              # Verify integrity
god-grow rollback <id>       # Rollback to snapshot
god-grow diff v1.0.0 v1.1.0  # Compare versions

# Processing
god-grow add /path/to/docs   # Add new documents
god-grow process --dry-run   # Preview processing
god-grow process             # Process new documents

# Knowledge Management
god-grow merge --status      # Merge statistics
god-grow merge --conflicts   # View conflicts
god-grow changelog           # View changelog

# Rebalancing
god-grow rebalance           # Status overview
god-grow rebalance --analyze # Density analysis
god-grow rebalance --detect  # Skew detection
god-grow rebalance --calibrate # Auto-calibrate
```

## Data Storage

```
.corpus-snapshots/
├── current_version.json        # Current version state
└── snapshots/                  # Snapshot storage
    └── snapshot-v1.0.0-*.json

.corpus-changelog/
└── changelog.jsonl             # Change entries

.corpus-tracking/
└── tracking_state.json         # Document tracking

god-learn/
├── knowledge.jsonl             # Knowledge base
├── calibration/                # Calibration data
│   ├── domain_weights.json
│   ├── source_priorities.json
│   └── history.json
├── density_report.json         # Latest density report
└── skew_alerts.json           # Latest alerts
```

## Usage Examples

### Create Versioned Snapshot
```python
from scripts.growth import CorpusVersionManager

manager = CorpusVersionManager()
snapshot = manager.create_snapshot(
    description="Adding philosophy papers",
    bump_type="minor"
)
print(f"Created: {snapshot.snapshot_id}")
```

### Process New Documents
```python
from scripts.growth import IncrementalProcessor, ProcessingMode

processor = IncrementalProcessor()
result = processor.process_batch(
    mode=ProcessingMode.NEW_ONLY,
    progress_callback=lambda i, t, p: print(f"[{i}/{t}] {p}")
)
print(f"Processed: {result.successful}/{result.total_documents}")
```

### Detect and Fix Skew
```python
from scripts.growth import SkewDetector, CalibrationTools

detector = SkewDetector()
report = detector.detect_all()

if report.health_score < 80:
    calibration = CalibrationTools()
    plan = calibration.generate_plan()
    calibration.execute_plan(plan)
```

## Integration Points

### Phase 6-7 Integration
```python
# IncrementalProcessor calls Phase 6-7 for new documents
# Configured via scripts/ingest/ingest.py
processor._run_phase6(doc_path)  # PDF extraction
processor._run_phase7(doc_path)  # Reasoning extraction
```

### Knowledge Base Integration
```python
# MergeStrategy reads/writes god-learn/knowledge.jsonl
strategy = MergeStrategy()
result = strategy.merge(new_kus, mode=MergeMode.DEDUPE)
```

## Performance Characteristics

- **Snapshot Creation**: O(n) where n = number of documents
- **Change Detection**: O(n) hash comparisons
- **Skew Detection**: O(d × s) where d = domains, s = sources
- **Health Score**: O(alerts) severity calculations

## Future Enhancements

1. **Semantic Deduplication**: Use embeddings for smarter duplicate detection
2. **Automated Reprocessing**: Trigger processing on low coverage detection
3. **Version Branching**: Support branching for experimental changes
4. **Real-time Monitoring**: Dashboard for corpus health

## Dependencies

- Python 3.8+
- No external dependencies (stdlib only)
- Optional: Phase 6-7 pipeline for full processing

## Testing

```bash
# Run full test suite
python -m scripts.growth.tests.test_phase17

# Quick validation
python -c "from scripts.growth import *; print('OK')"
```

---

**Phase 17 Complete** ✅

Next Phase: Phase 18 (14→15) - [Next pipeline phase per IMPLEMENTATION_ROADMAP.md]
