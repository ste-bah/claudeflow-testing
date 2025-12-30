# SPEC-TRAJ-001: Cross-Session Trajectory Feedback Bug Fix

**Document ID**: SPEC-TRAJ-001
**Version**: 1.0.0
**Status**: Draft
**Implements**: GAP-TRAJ-001 (Cross-Session Feedback Failure)
**Constitution Compliance**: RULE-001, RULE-003, RULE-008, RULE-009, RULE-015, RULE-069, RULE-070
**Last Updated**: 2025-12-30
**Author**: System Architecture Designer Agent

---

## 1. Executive Summary

### 1.1 Problem Statement

The God Agent learning system fails to process feedback for trajectories created in previous CLI process invocations. This occurs because `TrajectoryTracker.updateFeedback()` (line 252) only checks the in-memory `this.trajectories` Map, which is empty when a new process starts.

### 1.2 Impact

- `/god-code` and `/god-write` two-phase execution model is broken
- Phase 1 (trajectory creation) completes in CLI process
- Phase 2 (task execution) runs in Task subagent - separate process
- Feedback fails with "Trajectory not found" error
- **Learning system cannot learn from any code/write tasks**

### 1.3 Root Cause

```
Phase 1: CLI Process
  prepareCodeTask() / prepareWriteTask()
    -> TrajectoryTracker.createTrajectory()
    -> SonaEngine.createTrajectoryWithId()
    -> TrajectoryMetadataDAO.insert() [SQLite - CORRECT]
    -> Process exits

Phase 2: Task Subagent Process (NEW PROCESS)
  executeTask()
    -> ...task execution...
    -> provideFeedback(trajectoryId, quality)
    -> SonaEngine.getTrajectory(trajectoryId) [In-Memory Map - FAILS]
    -> "Trajectory not found" error
```

The trajectory IS persisted to SQLite via `TrajectoryMetadataDAO.insert()`, but the lookup in `SonaEngine.getTrajectory()` only checks the in-memory Map without falling back to the database.

---

## 2. Requirements

### 2.1 Functional Requirements

| REQ ID | Description | Priority | Verification |
|--------|-------------|----------|--------------|
| REQ-TRAJ-001 | `SonaEngine.getTrajectory()` MUST check SQLite via `TrajectoryMetadataDAO.findById()` when trajectory not found in memory | Critical | Integration test: create trajectory in process A, retrieve in process B |
| REQ-TRAJ-002 | Retrieved trajectories from SQLite MUST be cached in memory Map for subsequent access within same session | High | Unit test: verify second access hits cache |
| REQ-TRAJ-003 | `SonaEngine.provideFeedback()` MUST work for trajectories loaded from SQLite | Critical | Integration test: feedback for cross-session trajectory |
| REQ-TRAJ-004 | `TrajectoryTracker.updateFeedback()` MUST use SQLite fallback when trajectory not in memory | Critical | Integration test: cross-session feedback flow |
| REQ-TRAJ-005 | `TrajectoryTracker.getTrajectory()` MUST use SQLite fallback when trajectory not in memory | High | Unit test: retrieval with empty memory Map |
| REQ-TRAJ-006 | `ISonaEngine` interface MUST include `loadTrajectoryFromDb()` method for explicit SQLite lookup | Medium | Compile-time check |
| REQ-TRAJ-007 | All SQLite lookups MUST have try/catch with error logging per RULE-069, RULE-070 | Critical | Code review |
| REQ-TRAJ-008 | Loaded trajectories MUST have all required fields populated from SQLite row | High | Unit test: field mapping verification |

### 2.2 Non-Functional Requirements

| REQ ID | Description | Metric | Verification |
|--------|-------------|--------|--------------|
| REQ-TRAJ-NFR-001 | SQLite trajectory lookup latency | < 20ms p95 | Performance test |
| REQ-TRAJ-NFR-002 | Memory cache hit ratio | > 90% in steady state | Metrics observability |
| REQ-TRAJ-NFR-003 | Zero data loss on process restart | 100% trajectories recoverable | Persistence test |

---

## 3. Affected Files and Changes

### 3.1 `sona-engine.ts` (Primary)

**Current Code (lines 586-588):**
```typescript
getTrajectory(trajectoryId: TrajectoryID): ITrajectory | null {
  return this.trajectories.get(trajectoryId) || null;
}
```

**Problem:** Only checks in-memory Map, ignores SQLite persistence.

**Required Changes:**

```typescript
// Implements REQ-TRAJ-001, REQ-TRAJ-002, REQ-TRAJ-007
getTrajectory(trajectoryId: TrajectoryID): ITrajectory | null {
  // Check memory cache first (REQ-TRAJ-002: cache hit path)
  const cached = this.trajectories.get(trajectoryId);
  if (cached) {
    return cached;
  }

  // SQLite fallback (REQ-TRAJ-001)
  if (!this.persistenceEnabled || !this.trajectoryMetadataDAO) {
    return null;
  }

  // RULE-069: Explicit try/catch for async-like operations
  try {
    const metadata = this.trajectoryMetadataDAO.findById(trajectoryId);
    if (!metadata) {
      return null;
    }

    // REQ-TRAJ-008: Reconstruct ITrajectory from SQLite metadata
    const trajectory: ITrajectory = {
      id: trajectoryId,
      route: metadata.route,
      patterns: [], // Patterns stored separately, may need loading
      context: [],  // Context stored separately
      createdAt: metadata.createdAt,
      quality: metadata.qualityScore,
    };

    // REQ-TRAJ-002: Cache loaded trajectory for future access
    this.trajectories.set(trajectoryId, trajectory);

    return trajectory;
  } catch (error) {
    // RULE-070: Log error with context before returning
    console.error(
      `[SonaEngine] Failed to load trajectory ${trajectoryId} from SQLite:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}
```

**New Method to Add:**

```typescript
// Implements REQ-TRAJ-006
/**
 * Explicitly load a trajectory from the database
 * Used for cross-session trajectory recovery
 *
 * @param trajectoryId - Trajectory ID to load
 * @returns ITrajectory or null if not found
 * @throws Error if database operation fails (RULE-069)
 */
loadTrajectoryFromDb(trajectoryId: TrajectoryID): ITrajectory | null {
  // Implements REQ-TRAJ-006: Explicit SQLite lookup method
  if (!this.persistenceEnabled || !this.trajectoryMetadataDAO) {
    throw new Error(
      'Cannot load trajectory from DB: persistence not enabled (RULE-008 violation)'
    );
  }

  try {
    const metadata = this.trajectoryMetadataDAO.findById(trajectoryId);
    if (!metadata) {
      return null;
    }

    // REQ-TRAJ-008: Full field mapping
    const trajectory: ITrajectory = {
      id: trajectoryId,
      route: metadata.route,
      patterns: [],
      context: [],
      createdAt: metadata.createdAt,
      quality: metadata.qualityScore,
    };

    // Cache for subsequent access (REQ-TRAJ-002)
    this.trajectories.set(trajectoryId, trajectory);

    return trajectory;
  } catch (error) {
    // RULE-070: Log with context
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(
      `[SonaEngine] loadTrajectoryFromDb failed for ${trajectoryId}:`,
      errorMsg
    );
    throw new Error(`Database trajectory load failed: ${errorMsg}`);
  }
}
```

### 3.2 `sona-types.ts` - ISonaEngine Interface Update

**Current Interface (lines 466-515):**
```typescript
export interface ISonaEngine {
  createTrajectoryWithId(...): void;
  provideFeedback(...): Promise<IWeightUpdateResult>;
  getWeight(...): Promise<Weight>;
  getTrajectory(trajectoryId: TrajectoryID): ITrajectory | null;
}
```

**Required Addition:**

```typescript
// Implements REQ-TRAJ-006
export interface ISonaEngine {
  // ... existing methods ...

  /**
   * Get a trajectory by ID (memory + SQLite fallback)
   */
  getTrajectory(trajectoryId: TrajectoryID): ITrajectory | null;

  /**
   * Explicitly load trajectory from database (REQ-TRAJ-006)
   * Used for cross-session trajectory recovery
   *
   * @throws Error if persistence not enabled or DB operation fails
   */
  loadTrajectoryFromDb?(trajectoryId: TrajectoryID): ITrajectory | null;
}
```

### 3.3 `trajectory-tracker.ts` - updateFeedback Fix

**Current Code (lines 248-268):**
```typescript
async updateFeedback(
  trajectoryId: TrajectoryID,
  feedback: ILearningFeedback
): Promise<TrajectoryRecord> {
  const node = this.trajectories.get(trajectoryId);

  if (!node) {
    throw new Error(`Trajectory not found: ${trajectoryId}`);
  }
  // ... rest of method
}
```

**Required Changes:**

```typescript
// Implements REQ-TRAJ-004, REQ-TRAJ-007
async updateFeedback(
  trajectoryId: TrajectoryID,
  feedback: ILearningFeedback
): Promise<TrajectoryRecord> {
  let node = this.trajectories.get(trajectoryId);

  // REQ-TRAJ-004: SQLite fallback for cross-session trajectories
  if (!node) {
    try {
      // Attempt to load from SonaEngine's SQLite persistence
      const trajectory = this.sonaEngine.getTrajectory(trajectoryId);
      if (trajectory) {
        // Reconstruct TrajectoryNode from SQLite data
        // Note: Full TrajectoryRecord requires embedding data
        // which may need separate retrieval
        logger.info('Loaded trajectory from SQLite for feedback', {
          trajectoryId
        });

        // Create minimal node for feedback processing
        node = {
          record: {
            id: trajectoryId as TrajectoryID,
            timestamp: trajectory.createdAt,
            request: {} as IReasoningRequest, // May need reconstruction
            response: {} as IReasoningResponse, // May need reconstruction
            embedding: new Float32Array(0), // Placeholder
            lScore: 0
          },
          lastAccessed: Date.now()
        };

        // Cache for subsequent access
        this.trajectories.set(trajectoryId, node);
      }
    } catch (error) {
      // RULE-070: Log error with context
      logger.error('Failed to load trajectory from SQLite', {
        trajectoryId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  if (!node) {
    throw new Error(`Trajectory not found: ${trajectoryId}`);
  }

  // ... rest of existing method unchanged
}
```

### 3.4 `trajectory-tracker.ts` - getTrajectory Fix

**Current Code (lines 228-239):**
```typescript
async getTrajectory(trajectoryId: TrajectoryID): Promise<TrajectoryRecord | null> {
  const node = this.trajectories.get(trajectoryId);

  if (!node) {
    return null;
  }

  node.lastAccessed = Date.now();
  return node.record;
}
```

**Required Changes:**

```typescript
// Implements REQ-TRAJ-005, REQ-TRAJ-007
async getTrajectory(trajectoryId: TrajectoryID): Promise<TrajectoryRecord | null> {
  const node = this.trajectories.get(trajectoryId);

  if (node) {
    node.lastAccessed = Date.now();
    return node.record;
  }

  // REQ-TRAJ-005: SQLite fallback
  try {
    const trajectory = this.sonaEngine.getTrajectory(trajectoryId);
    if (!trajectory) {
      return null;
    }

    // Reconstruct TrajectoryRecord from ITrajectory
    const record: TrajectoryRecord = {
      id: trajectoryId as TrajectoryID,
      timestamp: trajectory.createdAt,
      request: {} as IReasoningRequest, // Minimal placeholder
      response: {
        patterns: [],
        causalInferences: []
      } as IReasoningResponse,
      embedding: new Float32Array(0),
      lScore: 0,
      feedback: trajectory.quality ? { quality: trajectory.quality } : undefined
    };

    // Cache the loaded record
    this.trajectories.set(trajectoryId, {
      record,
      lastAccessed: Date.now()
    });

    return record;
  } catch (error) {
    // RULE-070: Log error with context
    logger.warn('Failed to load trajectory from SQLite', {
      trajectoryId,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}
```

---

## 4. Implementation Approach

### 4.1 Phase 1: SonaEngine SQLite Fallback (REQ-TRAJ-001, REQ-TRAJ-002)

1. Modify `SonaEngine.getTrajectory()` to check SQLite when memory miss
2. Add caching of loaded trajectories
3. Add proper error handling per RULE-069, RULE-070
4. Unit tests for memory hit and SQLite fallback paths

### 4.2 Phase 2: Interface Update (REQ-TRAJ-006)

1. Add `loadTrajectoryFromDb()` to `ISonaEngine` interface
2. Implement method in `SonaEngine`
3. Verify TypeScript compilation passes

### 4.3 Phase 3: TrajectoryTracker Fixes (REQ-TRAJ-004, REQ-TRAJ-005)

1. Modify `updateFeedback()` to use SonaEngine SQLite fallback
2. Modify `getTrajectory()` to use SonaEngine SQLite fallback
3. Integration tests for cross-session feedback flow

### 4.4 Phase 4: End-to-End Verification (REQ-TRAJ-003)

1. End-to-end test simulating two-phase execution
2. Verify feedback persists correctly
3. Verify learning metrics update

---

## 5. Test Scenarios

### 5.1 Unit Tests

| Test ID | Description | Setup | Expected Result |
|---------|-------------|-------|-----------------|
| UT-TRAJ-001 | getTrajectory returns cached trajectory | Pre-populate memory Map | Return trajectory, no DB call |
| UT-TRAJ-002 | getTrajectory loads from SQLite on cache miss | Empty Map, trajectory in DB | Return trajectory from DB |
| UT-TRAJ-003 | getTrajectory returns null when not in memory or DB | Empty Map, empty DB | Return null |
| UT-TRAJ-004 | getTrajectory caches loaded trajectory | Load from DB twice | Second call hits cache |
| UT-TRAJ-005 | loadTrajectoryFromDb throws when persistence disabled | No DB connection | Throw Error |
| UT-TRAJ-006 | loadTrajectoryFromDb logs error on DB failure | DB throws error | Error logged, exception re-thrown |

### 5.2 Integration Tests

| Test ID | Description | Setup | Expected Result |
|---------|-------------|-------|-----------------|
| IT-TRAJ-001 | Cross-session trajectory feedback | Create trajectory in process A, provide feedback in process B | Feedback recorded successfully |
| IT-TRAJ-002 | provideFeedback works with SQLite-loaded trajectory | Trajectory only in SQLite | Weight update succeeds |
| IT-TRAJ-003 | Full two-phase /god-code flow | Simulate CLI + Task subagent | Learning metrics updated |
| IT-TRAJ-004 | Full two-phase /god-write flow | Simulate CLI + Task subagent | Learning metrics updated |

### 5.3 Persistence Tests

| Test ID | Description | Setup | Expected Result |
|---------|-------------|-------|-----------------|
| PT-TRAJ-001 | Trajectory survives process restart | Create trajectory, restart, retrieve | Trajectory recovered |
| PT-TRAJ-002 | Feedback survives process restart | Create trajectory, provide feedback, restart, check | Feedback persisted |

---

## 6. CONSTITUTION Compliance Checklist

| Rule | Description | Compliance Status | Implementation Notes |
|------|-------------|-------------------|---------------------|
| RULE-001 | Code references REQ-* IDs | REQUIRED | All code comments must include REQ-TRAJ-### |
| RULE-003 | Comments reference requirements | REQUIRED | Format: `// Implements REQ-TRAJ-###: <description>` |
| RULE-008 | In-memory Maps FORBIDDEN for primary storage | COMPLIANT | SQLite is primary, Map is cache only |
| RULE-009 | Full state restore on restart | COMPLIANT | SQLite fallback enables state recovery |
| RULE-015 | Maps only for caching, backed by persistent storage | COMPLIANT | Memory Map backed by SQLite |
| RULE-069 | Async operations MUST have try/catch | REQUIRED | All SQLite operations wrapped in try/catch |
| RULE-070 | Errors logged with context before re-throwing | REQUIRED | Error messages include trajectoryId |
| RULE-072 | Database retry on failure | EXISTING | TrajectoryMetadataDAO already uses withRetrySync |
| RULE-074 | FORBIDDEN: Map as primary storage | COMPLIANT | SQLite is source of truth |

---

## 7. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SQLite lookup adds latency | Medium - 20ms per lookup | Cache loaded trajectories (REQ-TRAJ-002) |
| TrajectoryRecord reconstruction incomplete | High - missing embeddings | Document limitation, plan separate embedding recovery |
| Database not initialized in some code paths | High - null pointer | Check persistenceEnabled before DB access |
| Race condition on cache update | Low - duplicate loads | Acceptable for correctness; optimize later if needed |

---

## 8. Acceptance Criteria

1. `/god-code` two-phase execution completes without "Trajectory not found" error
2. `/god-write` two-phase execution completes without "Trajectory not found" error
3. Learning metrics show feedback being processed for code/write tasks
4. All unit tests pass (UT-TRAJ-001 through UT-TRAJ-006)
5. All integration tests pass (IT-TRAJ-001 through IT-TRAJ-004)
6. Persistence tests pass (PT-TRAJ-001, PT-TRAJ-002)
7. TypeScript compilation succeeds with no new errors
8. Code review confirms CONSTITUTION compliance

---

## 9. Dependencies

### 9.1 Existing Components (No Changes)

- `TrajectoryMetadataDAO.findById()` - Already implemented, line 342
- SQLite schema `trajectory_metadata` table - Already exists
- `withRetrySync()` - Database retry utility

### 9.2 Required For Implementation

- SonaEngine must have `persistenceEnabled = true`
- `databaseConnection` must be injected via config
- Use `createProductionSonaEngine()` factory in production

---

## 10. Appendix: Data Flow After Fix

```
Phase 1: CLI Process
  prepareCodeTask()
    -> SonaEngine.createTrajectoryWithId()
       -> this.trajectories.set() [Memory Cache]
       -> TrajectoryMetadataDAO.insert() [SQLite - PERSISTED]
    -> Process exits (memory lost, SQLite persisted)

Phase 2: Task Subagent Process (NEW PROCESS)
  executeTask()
    -> ...task execution...
    -> provideFeedback(trajectoryId, quality)
       -> SonaEngine.getTrajectory(trajectoryId)
          -> this.trajectories.get() [MISS - empty Map]
          -> TrajectoryMetadataDAO.findById() [HIT - SQLite]
          -> this.trajectories.set() [Cache loaded trajectory]
          -> Return trajectory [SUCCESS]
       -> Update weights, persist feedback
       -> Learning system receives feedback [SUCCESS]
```

---

**END OF SPECIFICATION**
