# Phase 17 Week 3-4: Selective Reprocessing System

## Overview

Week 3-4 implements the selective reprocessing infrastructure:
- Document change tracking with hash-based detection
- Incremental Phase 6-7 processing for new/modified documents
- Knowledge merging with conflict resolution
- CLI integration for processing and merge operations

## Components Created

### Core Modules (`scripts/growth/core/`)

#### 1. DocumentTracker (`document_tracker.py`)
Tracks document changes for incremental processing.

**Key Classes:**
- `DocumentStatus`: Enum (NEW, MODIFIED, UNCHANGED, PENDING, PROCESSED, FAILED, DELETED)
- `TrackedDocument`: Document with status and hashes
- `DocumentTracker`: Main tracker class

**Key Methods:**
```python
tracker = DocumentTracker()

# Detect changes since snapshot
changes = tracker.detect_changes(snapshot.document_hashes)
# Returns: {"new": [...], "modified": [...], "unchanged": [...], "deleted": [...]}

# Get pending documents
pending = tracker.get_pending_documents()

# Mark documents
tracker.mark_pending(["doc1.pdf", "doc2.pdf"])
tracker.mark_processed("doc1.pdf", success=True)

# Get summary
summary = tracker.get_summary()
```

#### 2. IncrementalProcessor (`incremental_processor.py`)
Selectively runs Phase 6-7 on changed documents.

**Key Classes:**
- `ProcessingMode`: Enum (NEW_ONLY, MODIFIED_ONLY, ALL_CHANGED, FORCE_ALL)
- `ProcessingResult`: Result of processing a document
- `BatchResult`: Result of batch processing
- `IncrementalProcessor`: Main processor class

**Key Methods:**
```python
processor = IncrementalProcessor()

# Preview processing
preview = processor.dry_run(mode=ProcessingMode.ALL_CHANGED)

# Process documents
def progress(current, total, path):
    print(f"[{current}/{total}] {path}")

result = processor.process_batch(
    mode=ProcessingMode.ALL_CHANGED,
    progress_callback=progress
)

# Resume interrupted processing
result = processor.resume_processing()

# Write log
log_path = processor.write_processing_log(result)
```

#### 3. MergeStrategy (`merge_strategy.py`)
Handles merging new reasoning with existing knowledge.

**Key Classes:**
- `MergeMode`: Enum (APPEND, DEDUPE, REPLACE, SEMANTIC, CONFLICT)
- `ConflictType`: Enum (DUPLICATE, SEMANTIC_SIMILAR, SOURCE_CONFLICT, SUPERSEDED)
- `KnowledgeUnit`: Representation of a KU for merging
- `MergeConflict`: Detected conflict
- `MergeResult`: Merge operation result
- `MergeStrategy`: Main strategy class

**Key Methods:**
```python
strategy = MergeStrategy()

# Check for duplicates
is_dup, existing_id = strategy.is_duplicate(new_ku)

# Find semantically similar
similar = strategy.find_similar(new_ku, threshold=0.85)

# Merge new knowledge
result = strategy.merge(new_kus, mode=MergeMode.DEDUPE)

# Handle conflicts
conflicts = strategy.load_conflicts()
strategy.resolve_conflict(0, "Keep existing", keep_existing=True)

# Get statistics
stats = strategy.get_merge_stats()
```

## CLI Commands

### Process Command
```bash
# Preview what would be processed
god-grow process --dry-run

# Process all changed documents
god-grow process

# Force reprocess everything
god-grow process --force
```

### Merge Command
```bash
# Show merge statistics
god-grow merge --status

# List pending conflicts
god-grow merge --conflicts

# Resolve a conflict
god-grow merge --resolve 0 --reason "Keep original"
god-grow merge --resolve 0 --use-new --reason "Use newer version"
```

## Data Flow

```
┌─────────────────┐
│ Corpus Snapshot │
└────────┬────────┘
         │ compare hashes
         ▼
┌─────────────────┐
│ DocumentTracker │
│ - new           │
│ - modified      │
│ - unchanged     │
│ - deleted       │
└────────┬────────┘
         │ for new/modified
         ▼
┌─────────────────────┐
│ IncrementalProcessor│
│ - Phase 6 (extract) │
│ - Phase 7 (reason)  │
└────────┬────────────┘
         │ new KUs
         ▼
┌─────────────────┐
│ MergeStrategy   │
│ - dedupe        │
│ - semantic      │
│ - conflicts     │
└────────┬────────┘
         ▼
┌─────────────────┐
│ knowledge.jsonl │
└─────────────────┘
```

## Testing Results

```
$ python -m scripts.growth.cli.growth_cli process --dry-run
============================================================
INCREMENTAL DOCUMENT PROCESSING
============================================================

[DRY RUN] Preview of documents to process:

  Mode: all_changed
  Documents to process: 0
  Estimated time: 0 seconds

  No documents require processing.

$ python -m scripts.growth.cli.growth_cli merge --status
============================================================
MERGE STATUS
============================================================

Total Knowledge Units: 45
Unique Sources: 1
Pending Conflicts: 0

Domain Distribution:
  unknown                 45 (100.0%) ████████████████████
```

## Files Created

| File | Lines | Description |
|------|-------|-------------|
| `core/document_tracker.py` | ~350 | Document change tracking |
| `core/incremental_processor.py` | ~400 | Selective Phase 6-7 execution |
| `core/merge_strategy.py` | ~480 | Knowledge merge with conflict resolution |

**Week 3-4 Total: ~1,230 lines of code**
**Cumulative Phase 17: ~2,955 lines of code**

## Next Steps (Week 5)

Week 5 will implement skew detection and calibration:
- `DensityAnalyzer`: Reasoning density metrics by domain
- `SkewDetector`: Detect imbalances in knowledge distribution
- `CalibrationTools`: Manual adjustment and rebalancing tools
