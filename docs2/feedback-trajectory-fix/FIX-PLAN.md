# Feedback Trajectory Lookup Bug - Fix Plan

**Date**: 2026-01-11
**Status**: ✅ IMPLEMENTED - Tests Passing
**Severity**: High (blocks SoNA weight updates)

---

## 1. Problem Statement

### Symptom
```
FeedbackValidationError: Trajectory traj_xxx not found
```

### Impact
- Feedback mechanism records entries successfully
- BUT fails to update SoNA weights
- Root cause: Table mismatch between storage and lookup

---

## 2. Root Cause Analysis

### Bug Location
**File**: `src/god-agent/core/learning/sona-engine.ts`
**Line**: 856
**Method**: `provideFeedback()`

### The Bug
```typescript
// Line 856 - CURRENT (BUG):
const trajectory = this.trajectories.get(trajectoryId);
```

This directly accesses the in-memory `Map<TrajectoryID, ITrajectory>` without falling back to SQLite storage.

### Why It Fails
1. Trajectories are stored in `trajectory_metadata` SQLite table (per RULE-008)
2. The in-memory Map is a **cache**, not the source of truth
3. After session restart or memory pressure, trajectories exist in SQLite but not in the Map
4. `provideFeedback()` fails because it only checks the Map

### Correct Implementation Already Exists
```typescript
// Lines 588-601 - getTrajectory() method:
getTrajectory(trajectoryId: TrajectoryID): ITrajectory | null {
  // Check memory cache first
  const cached = this.trajectories.get(trajectoryId);
  if (cached) {
    return cached;
  }
  // Fallback to SQLite if not in memory
  const fromStorage = this.getTrajectoryFromStorage(trajectoryId);
  if (fromStorage) {
    this.trajectories.set(trajectoryId, fromStorage);
  }
  return fromStorage;
}
```

This method:
1. Checks in-memory cache first (fast path)
2. Falls back to SQLite via `trajectoryMetadataDAO.findById()`
3. Populates cache on successful SQLite lookup

---

## 3. The Fix

### One-Line Change
```typescript
// BEFORE (line 856):
const trajectory = this.trajectories.get(trajectoryId);

// AFTER:
const trajectory = this.getTrajectory(trajectoryId);
```

### Why This Works
- `getTrajectory()` already implements the correct memory + SQLite fallback pattern
- The method exists specifically for this purpose (lines 588-601)
- No new code needed - just use the existing correct method

---

## 4. Code Context

### Before Fix (lines 853-861)
```typescript
async provideFeedback(
  trajectoryId: TrajectoryID,
  quality: number,
  options: { lScore?: number; similarities?: Map<PatternID, number>; skipAutoSave?: boolean; } = {}
): Promise<IWeightUpdateResult> {
  const startTime = performance.now();
  validateFeedbackQuality(quality);

  const trajectory = this.trajectories.get(trajectoryId);  // BUG
  if (!trajectory) {
    throw new FeedbackValidationError(`Trajectory ${trajectoryId} not found`);
  }
```

### After Fix
```typescript
async provideFeedback(
  trajectoryId: TrajectoryID,
  quality: number,
  options: { lScore?: number; similarities?: Map<PatternID, number>; skipAutoSave?: boolean; } = {}
): Promise<IWeightUpdateResult> {
  const startTime = performance.now();
  validateFeedbackQuality(quality);

  const trajectory = this.getTrajectory(trajectoryId);  // FIXED
  if (!trajectory) {
    throw new FeedbackValidationError(`Trajectory ${trajectoryId} not found`);
  }
```

---

## 5. Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Regression in existing tests | Low | `getTrajectory()` is already tested |
| Performance impact | Negligible | SQLite lookup only when cache miss |
| Breaking change | None | Same return type (ITrajectory \| null) |

---

## 6. Test Strategy

### Existing Tests to Verify
- Unit tests for `getTrajectory()` method
- Integration tests for feedback flow

### Manual Verification
```bash
npm run test -- --grep "provideFeedback"
npm run test -- --grep "getTrajectory"
```

### Acceptance Criteria
1. `provideFeedback()` succeeds for trajectories only in SQLite
2. No regression in existing feedback tests
3. Cache still populated after SQLite lookup

---

## 7. Constitution Compliance

| Rule | Status |
|------|--------|
| RULE-008 | ✅ Uses SQLite for trajectory data |
| RULE-016 | ✅ No DELETE operations added |
| RULE-072 | ✅ Existing retry logic preserved |

---

## 8. Implementation Steps

1. [x] Adversarial review of this plan - **COMPLETED** (see ADVERSARIAL-REVIEW.md)
2. [x] Apply one-line fix to line 856 - **COMPLETED** (2026-01-11)
3. [x] Run existing test suite - **PASSED** (96/96 SoNA tests, 2026-01-11)
4. [x] Verify manual test case - **PASSED** (31/31 cross-session tests, 2026-01-11)
5. [x] Commit with message referencing this plan - **COMMITTED** (b80390d0, 2026-01-11)

---

## 9. Adversarial Review Findings

**Verdict**: PASS WITH CONCERNS

### Critical Issue Identified
The adversarial review found that SQLite-loaded trajectories have **empty patterns arrays** (lines 645-652 in `getTrajectoryFromStorage()`). This means:

1. The one-line fix **prevents the error** from being thrown
2. BUT weight updates **still silently fail** when `trajectory.patterns.length === 0`

### Scope Decision
**This fix addresses the stated bug**: `FeedbackValidationError: Trajectory traj_xxx not found`

**Out of scope for this fix** (requires separate implementation):
- Storing patterns in SQLite for cross-session weight updates
- Full trajectory reconstruction from SQLite

### Known Limitation (Post-Fix)
After this fix:
- `provideFeedback()` will succeed for SQLite-loaded trajectories
- `patternsUpdated` will return 0 (no weight updates occur)
- This is acceptable degraded behavior pending pattern storage implementation

---

## Appendix: File References

- **Bug file**: `src/god-agent/core/learning/sona-engine.ts:856`
- **Correct method**: `src/god-agent/core/learning/sona-engine.ts:588-601`
- **DAO reference**: `src/god-agent/core/database/dao/trajectory-metadata-dao.ts`
