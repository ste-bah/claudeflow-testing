# Tier 1 Implementation Plan - Polish/Quickwins

## Overview
Four small improvements to enhance CLI usability and user experience.

---

## #1 Add `--help` Flag Support & Command Listing

**Goal**: Standard help support and better command discovery.

**Implementation**:
1. Intercept `--help` and `-h` flags in main dispatcher before routing
2. Show command-specific help with usage examples
3. Add `god --commands` to list all commands in table format
4. Standardize help output formatting

**Files**:
- EDIT: `scripts/god` (main dispatcher)

---

## #2 Progress Indicators & Verbose Mode

**Goal**: User feedback during long-running operations.

**Implementation**:
1. Add `--verbose` (`-v`) flag to god-learn commands
2. Print phase start/end markers with timestamps
3. Add progress counters for embedding operations
4. Add `--quiet` flag to suppress non-error output

**Files**:
- EDIT: `scripts/god_learn/god_learn.py`
- EDIT: `scripts/ingest/run_ingest_phase2.py`

---

## #3 Configuration Validation Command

**Goal**: Upfront validation before expensive operations.

**Implementation**:
1. Add `god config` command with subcommands:
   - `god config show` - display current configuration
   - `god config check` - validate paths and services
2. Check critical paths (corpus_root, vector_db, etc.)
3. Verify embedding service is reachable
4. Provide actionable fix suggestions

**Files**:
- EDIT: `scripts/god` (add config dispatcher)
- NEW: `scripts/common/config_validator.py`

---

## #4 Shortcut Flags & Query Presets

**Goal**: Reduce friction for common workflows.

**Implementation**:
1. Add preset flags to query_chunks.py:
   - `--preset research` (k=20, overfetch=5, include_docs)
   - `--preset quick` (k=5, no highlights)
2. Add `--auto-promote` flag to auto-promote top results
3. Add `god query-promote <query>` shortcut command

**Files**:
- EDIT: `scripts/retrieval/query_chunks.py`
- EDIT: `scripts/god`

---

## Execution Order

1. **#1 Help Support** - Foundation for discoverability
2. **#3 Config Validation** - Prevents wasted time on misconfigured systems
3. **#4 Query Presets** - Most immediate usability impact
4. **#2 Progress Indicators** - Quality of life improvement

---

## Dependencies

- None required - all use existing libraries
