# SPEC-TRAJ-002: SQLite Trajectory Data Completeness Fix

## Overview
Fix TypeError when accessing `trajectory.response.patterns.length` on SQLite-loaded trajectories that have minimal data.

## Problem Statement
When trajectories are loaded from SQLite via `getTrajectoryFromStorage()`, they have minimal data:
```typescript
const trajectory: ITrajectory = {
  id: metadata.id,
  route: metadata.route as Route,
  patterns: [],
  context: [],
  createdAt: metadata.createdAt,
};
```

The code in `provideFeedback()` and `createCausalHyperedge()` tries to access:
- `trajectory.response.patterns.length`
- `trajectory.response.causalInferences.length`

This causes: `TypeError: Cannot read properties of undefined (reading 'length')`

## Requirements

### REQ-TRAJ-009: Null-Safe Response Access
All code accessing `trajectory.response` MUST check for existence before accessing nested properties.

### REQ-TRAJ-010: Graceful Degradation
If `trajectory.response` is missing/empty, the code MUST:
1. Skip operations that require response data
2. Log a warning for observability
3. Continue execution without throwing

### REQ-TRAJ-011: CONSTITUTION Compliance
- RULE-069: try/catch mandatory for all async operations
- RULE-070: error logging mandatory
- RULE-008: SQLite is primary storage (minimal data is valid)

## Affected Code Locations

1. `reasoning-bank.ts:706` - ObservabilityBus emit in provideFeedback()
2. `reasoning-bank.ts:879-880` - ObservabilityBus emit in createCausalHyperedge()
3. `reasoning-bank.ts:903` - Pattern loop in createCausalHyperedge()
4. `reasoning-bank.ts:~920` - Inference loop in createCausalHyperedge()

## Solution Design

### Option A: Early Return (Selected)
Skip hyperedge creation for trajectories without response data.
- Pros: Clean, no partial execution
- Cons: Loses some functionality for SQLite-loaded trajectories

### Option B: Defensive Defaults
Use empty arrays as fallback for missing response data.
- Pros: Attempts all operations
- Cons: May create empty/invalid hyperedges

**Selected**: Option A - Early return with warning log

## Implementation

```typescript
// In provideFeedback() before createCausalHyperedge:
if (!trajectory.response || !trajectory.response.patterns) {
  logger.warn('Skipping hyperedge creation: trajectory loaded from SQLite has minimal data', {
    trajectoryId: feedback.trajectoryId,
    hasResponse: !!trajectory.response,
  });
  return; // Skip hyperedge creation
}
```

## Test Cases
1. Feedback with in-memory trajectory (full data) - should create hyperedge
2. Feedback with SQLite-loaded trajectory (minimal data) - should skip gracefully
3. Error logging verification

## Related
- SPEC-TRAJ-001: Cross-Session Trajectory Feedback SQLite Fallback
- TASK-TRAJ-001: Original fix for "Trajectory not found" error
