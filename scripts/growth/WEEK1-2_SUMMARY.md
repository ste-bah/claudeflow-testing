# Phase 17 Week 1-2: Corpus Versioning Infrastructure

## Overview

Week 1-2 establishes the foundational infrastructure for corpus growth management:
- Semantic versioning with major.minor.patch numbering
- Point-in-time snapshots with document hashing
- Comprehensive changelog with rollback support
- Unified CLI for corpus operations

## Components Created

### Core Modules (`scripts/growth/core/`)

#### 1. CorpusVersionManager (`corpus_version_manager.py`)
Manages corpus versions, snapshots, and rollback operations.

**Key Classes:**
- `CorpusVersion`: Semantic version representation (major.minor.patch)
- `CorpusSnapshot`: Point-in-time corpus state with document hashes
- `CorpusVersionManager`: Main manager class

**Key Methods:**
```python
manager = CorpusVersionManager()

# Create snapshot
snapshot = manager.create_snapshot(
    description="Adding new documents",
    bump_type="minor",
    include_artifacts=True
)

# Verify integrity
result = manager.verify_integrity(snapshot)

# Rollback
result = manager.rollback("snapshot-v1.0.0-...", dry_run=True)

# Compare versions
diff = manager.diff_versions("v1.0.0", "v1.1.0")
```

#### 2. CorpusChangelog (`changelog.py`)
Tracks all corpus changes with filtering and export capabilities.

**Key Classes:**
- `ChangeType`: Enum of change types (ADD_DOCUMENT, REMOVE_DOCUMENT, etc.)
- `ChangeEntry`: Individual change record with metadata
- `CorpusChangelog`: Main changelog manager

**Key Methods:**
```python
changelog = CorpusChangelog()

# Record changes
changelog.record_document_add("/path/to/doc.pdf", "Added research paper")
changelog.record_document_remove("/path/to/old.pdf", "Deprecated content")

# Query entries
entries = changelog.get_entries(
    change_type=ChangeType.ADD_DOCUMENT,
    since="2026-01-01",
    limit=50
)

# Export
changelog.export_markdown("changelog.md")
changelog.export_json("changelog.json")
```

### CLI Module (`scripts/growth/cli/`)

#### GrowthCLI (`growth_cli.py`)
Unified command-line interface for corpus growth operations.

**Commands:**
```bash
# Status and information
god-grow status          # Show corpus version and stats
god-grow list            # List all snapshots
god-grow changelog       # View changelog

# Versioning
god-grow snapshot -d "Description" -b minor
god-grow verify -s <snapshot-id>
god-grow rollback <snapshot-id> --dry-run
god-grow diff v1.0.0 v1.1.0

# Document management
god-grow add /path/to/docs -d domain
god-grow process --dry-run
god-grow rebalance --analyze
```

## Data Storage

### Snapshots Directory
```
.corpus-snapshots/
├── current_version.json     # Current version state
└── snapshots/
    ├── snapshot-v1.0.0-20260113-120000.json
    └── snapshot-v1.1.0-20260113-155225.json
```

### Changelog File
```
.corpus-changelog/
└── changelog.jsonl          # Line-delimited JSON entries
```

## Verification Flow

```
┌─────────────────┐
│ Current Corpus  │
└────────┬────────┘
         │ Hash documents
         ▼
┌─────────────────┐    ┌─────────────────┐
│ Current Hashes  │◄──►│ Snapshot Hashes │
└────────┬────────┘    └────────┬────────┘
         │                      │
         └──────┬───────────────┘
                ▼
         ┌──────────────┐
         │ Diff Report  │
         │ - Added      │
         │ - Removed    │
         │ - Modified   │
         └──────────────┘
```

## Testing Results

```
$ python -m scripts.growth.cli.growth_cli status
============================================================
CORPUS STATUS
============================================================

Current Version: v1.1.0
Latest Snapshot: snapshot-v1.1.0-20260113-155225
  Created: 2026-01-13T15:52:25.864714
  Description: Initial Phase 17 baseline

Corpus Documents: 12 PDFs
Knowledge Units: 45

$ python -m scripts.growth.cli.growth_cli verify
Verifying against snapshot: snapshot-v1.1.0-20260113-155225
Version: v1.1.0

----------------------------------------
VERIFICATION RESULTS
----------------------------------------

Status: PASSED
Documents: 12 current, 12 in snapshot
```

## Next Steps (Week 3-4)

Week 3-4 will implement selective reprocessing:
- `DocumentTracker`: Track new/modified documents since last snapshot
- `IncrementalProcessor`: Run Phase 6-7 on new documents only
- `MergeStrategy`: Merge new reasoning with existing knowledge

## Files Created

| File | Lines | Description |
|------|-------|-------------|
| `core/corpus_version_manager.py` | ~500 | Version management and snapshots |
| `core/changelog.py` | ~450 | Change tracking and rollback |
| `core/__init__.py` | ~40 | Core module exports |
| `cli/growth_cli.py` | ~650 | Unified CLI |
| `cli/__init__.py` | ~20 | CLI module exports |
| `__init__.py` | ~65 | Package exports |

**Total: ~1,725 lines of code**
