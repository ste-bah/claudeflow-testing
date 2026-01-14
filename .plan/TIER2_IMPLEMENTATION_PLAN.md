# Tier 2 Implementation Plan

## Overview
Five medium-effort, high-impact improvements to the God-Learn pipeline.

---

## #6 Incremental Pipeline (Watch Mode)

**Goal**: Auto-detect and process new PDFs added to corpus directory.

**Implementation**:
1. Create `scripts/ingest/watch_corpus.py`:
   - Use `watchdog` library for filesystem monitoring
   - Watch corpus directory for new/modified PDF files
   - Trigger Phase 1 (extract) + Phase 2 (embed) automatically
   - Debounce rapid changes (5 second window)
   - Log all activity to `logs/watch.log`

2. Add to unified CLI: `god ingest watch --root corpus/`

**Files**:
- NEW: `scripts/ingest/watch_corpus.py`
- EDIT: `scripts/god` (add watch subcommand)

---

## #7 Auto-Promotion Threshold

**Goal**: Automatically promote high-confidence retrieval hits to KUs without manual intervention.

**Implementation**:
1. Create `scripts/learn/auto_promote.py`:
   - Define confidence thresholds (distance < 0.6 = high confidence)
   - After each query, check if results meet threshold
   - Auto-invoke promote_hits.py for qualifying results
   - Track auto-promoted vs manual in metadata

2. Add config: `god-learn/config/auto_promote.json`:
   ```json
   {
     "enabled": true,
     "distance_threshold": 0.6,
     "min_overlap_score": 3,
     "require_highlight": false,
     "max_auto_per_query": 3
   }
   ```

3. Add to unified CLI: `god promote --auto`

**Files**:
- NEW: `scripts/learn/auto_promote.py`
- NEW: `god-learn/config/auto_promote.json`
- EDIT: `scripts/god` (add --auto flag)

---

## #8 Confidence Calibration

**Goal**: Track prediction accuracy over time to calibrate confidence scores.

**Implementation**:
1. Extend `god-learn/calibration/` with:
   - `predictions.jsonl`: Log each prediction with timestamp
   - `feedback.jsonl`: User feedback on prediction quality
   - `calibration_stats.json`: Aggregated accuracy metrics

2. Create `scripts/learn/calibration_tracker.py`:
   - `record_prediction(query, results, confidence)`
   - `record_feedback(prediction_id, was_correct, notes)`
   - `compute_calibration_curve()` - expected vs actual accuracy
   - `get_calibration_stats()` - summary metrics

3. Add to CLI: `god calibrate feedback <prediction_id> --correct/--incorrect`

**Files**:
- NEW: `scripts/learn/calibration_tracker.py`
- NEW: `god-learn/calibration/predictions.jsonl`
- NEW: `god-learn/calibration/feedback.jsonl`
- EDIT: `scripts/god` (add calibrate command)

---

## #9 Cross-Session Memory

**Goal**: Persist query context and results between sessions for continuity.

**Implementation**:
1. Create `god-learn/sessions/` directory:
   - `history.jsonl`: All queries with timestamps
   - `context.json`: Current session context (last query, active topic)
   - `favorites.json`: Bookmarked queries/results

2. Create `scripts/interaction/session_manager.py`:
   - `start_session()` - create/restore session
   - `record_query(query, results)` - append to history
   - `get_recent_queries(n=10)` - retrieve recent
   - `get_related_queries(query)` - semantic similarity to past queries
   - `bookmark_result(query, result_id)` - save favorite

3. Integrate with answer.py and query_chunks.py

4. Add to CLI:
   - `god history` - show recent queries
   - `god history search <term>` - search history
   - `god history clear` - clear history

**Files**:
- NEW: `scripts/interaction/session_manager.py`
- NEW: `god-learn/sessions/history.jsonl`
- NEW: `god-learn/sessions/context.json`
- EDIT: `scripts/god` (add history command)
- EDIT: `scripts/interaction/answer.py` (auto-record queries)

---

## #10 Watch Mode for QA

**Goal**: Continuous health monitoring daemon that alerts on issues.

**Implementation**:
1. Create `scripts/qa/daemon/qa_daemon.py`:
   - Background process checking health metrics
   - Configurable check interval (default: 5 minutes)
   - Checks: coverage drift, consistency issues, embedding health
   - Alerts via: console log, optional file alerts

2. Create `scripts/qa/daemon/alert_handler.py`:
   - Write alerts to `god-learn/alerts/active.json`
   - Support webhook notifications (optional)
   - Alert severity levels: info, warning, critical

3. Add to CLI:
   - `god qa watch` - start daemon in foreground
   - `god qa watch --daemon` - start as background process
   - `god qa watch --stop` - stop daemon
   - `god qa alerts` - show active alerts

**Files**:
- NEW: `scripts/qa/daemon/qa_daemon.py`
- NEW: `scripts/qa/daemon/alert_handler.py`
- NEW: `god-learn/alerts/active.json`
- EDIT: `scripts/god` (add qa watch subcommand)

---

## Execution Order

1. **#6 Watch Mode** - Foundation for automation
2. **#9 Session Memory** - Enables tracking for other features
3. **#7 Auto-Promotion** - Depends on query tracking
4. **#8 Calibration** - Depends on prediction logging
5. **#10 QA Watch** - Capstone monitoring

---

## Dependencies

- `watchdog` (pip install watchdog) - for filesystem monitoring
- All other dependencies already in project

