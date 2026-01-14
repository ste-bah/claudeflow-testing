# Summary: God-Learn Phases 11-15 Architectural Review

## Overall Verdict

✅ **All proposed phases are architecturally sound and preserve epistemic guarantees**

However, I recommend significant modifications to sequencing and scope.

---

## Key Recommendations

### 1. Reorder Phases
**Current**: 11 → 12 → 13 → 14 → 15
**Recommended**: (11+12) → 15 → 13 → 16 → [defer 14]

**Rationale**: You need QA infrastructure (Phase 15) before corpus growth (Phase 13), not after.

### 2. Merge Phases 11 + 12
**New "Phase 11 — Introspection Layer"** combines:
- Interactive exploration (navigation, filtering)
- Visualization (graphs, heatmaps, exports)

**Rationale**: These are two views of the same immutable data. Merging reduces complexity and improves UX.

### 3. Move Phase 15 Before Phase 13
**Phase 15 (QA) must come before Phase 13 (Growth)**

**Rationale**: Cannot safely grow corpus without:
- Coverage regression detection
- Reasoning stability checks
- Promotion consistency verification

### 4. Add Critical Missing Phase
**Phase 16 — Provenance Auditing**

**Problem**: No current verification of end-to-end provenance chain:
- Chunk → KU → Reasoning → Answer → UI
- Page citations could drift
- PDFs could be modified post-ingestion

**Solution**: Full provenance audit from claims back to original PDF bytes

### 5. Defer Phase 14 (Multi-Corpus)
**Recommendation**: Wait 6-12 months until Phase 13 is proven stable

**Rationale**:
- Multi-corpus is "Phase 13 × N" in complexity
- Need real-world experience with single-corpus growth first
- Premature architecture decisions are costly

---

## Revised Phase Sequence

| Phase | Name | Duration | Dependencies | Priority |
|-------|------|----------|--------------|----------|
| **11** | Introspection Layer | 4 weeks | Phase 10 | P0 |
| **15** | QA Infrastructure | 4 weeks | Phase 10 | P0 |
| **16** | Provenance Auditing | 3 weeks | Phase 15 | P1 |
| **13** | Corpus Growth | 6 weeks | Phase 15, 16 | P1 |
| **14** | Multi-Corpus | 8 weeks | Phase 13 + 6mo | P2 (defer) |

**Total Time to Safe Corpus Growth**: ~17 weeks (4 months)

---

## Phase Summaries

### ✅ Phase 11 — Introspection Layer (merged 11+12)

**What**: Navigate and visualize Phase 9 artifacts
- CLI/UI for exploring KUs, reasoning units, evidence
- Graph rendering (D3, Cytoscape, GraphViz exports)
- Coverage heatmaps (queries × documents)
- Promotion lineage visualization

**Key Features**:
- Expand/collapse evidence
- Forward/backward graph traversal
- Filter by source, page range, relation type, confidence
- Export to external analysis tools

**Invariant**: Pure read-only. Phase 9 remains epistemic authority.

**Effort**: 4 weeks

---

### ✅ Phase 15 → New Phase 13: QA Infrastructure

**What**: Automated quality assurance and regression detection
- Coverage regression detection
- Reasoning stability checks
- Promotion consistency verification
- CI integration with GitHub Actions
- QA dashboard for monitoring

**Why First**: Cannot safely grow corpus without detecting:
- Query coverage degradation
- Semantic drift in reasoning
- Broken provenance chains

**Invariant**: Pure verification. No mutations. Explicit failures.

**Effort**: 4 weeks

---

### ✅ Phase 16 (NEW): Provenance Auditing

**What**: End-to-end provenance chain verification
- Trace every claim: Answer → Reasoning → KU → Chunk → PDF
- Verify page citations against chunk metadata
- Detect PDF modifications (sha256 validation)
- Validate highlight mappings

**Why Critical**: Prevents silent provenance corruption
- If PDF modified post-ingestion → citations invalid
- If chunks deleted → KUs orphaned
- If pages renumbered → readers cannot verify claims

**Invariant**: Full traceability to immutable sources.

**Effort**: 3 weeks

---

### ⚠️ Phase 13 → New Phase 14: Corpus Growth & Rebalancing

**What**: Safe scaling of corpus without semantic drift
- Corpus versioning and changelog
- Selective Phase 6-7 rerun (new docs only)
- Reasoning density skew detection
- Manual calibration tools

**Critical Dependencies**: Requires Phase 15 + 16 first!
- QA infrastructure detects regressions
- Provenance auditing catches drift

**Key Challenges**:
- Reasoning explosion (quadratic growth)
- Semantic drift detection
- Terminology alignment across documents

**Recommended Addition**: Reasoning domains
```json
{
  "domain_id": "aristotelian_psychology",
  "doc_ids": [...],
  "isolated": false
}
```

**Invariant**: Growth is additive. No silent invalidation.

**Effort**: 6 weeks

---

### ⚠️ Phase 14 → New Phase 15: Multi-Corpus (DEFERRED)

**What**: Compare corpora across periods/traditions
- Corpus namespaces (`ari:ku_xxx`, `sto:ku_yyy`)
- Within-corpus and cross-corpus reasoning
- Explicit boundary preservation
- Origin diagnosis in reports

**Why Defer**:
- Too complex without Phase 13 experience
- Reasoning explosion risk (N² corpora)
- Need validated use case from production

**When Ready**: After Phase 13 complete + 6 months production usage

**Invariant**: No implicit blending. Explicit corpus boundaries.

**Effort**: 8 weeks (when ready)

---

## Risk Matrix

| Phase | Epistemic Risk | Technical Risk | UX Risk | Business Value | Priority |
|-------|----------------|----------------|---------|---------------|----------|
| 11 (Introspection) | **Low** | Low | Medium | **High** | **P0** |
| 15→13 (QA) | **None** | Low | Low | **Critical** | **P0** |
| 16 (Audit) | **None** | Medium | Low | **Critical** | **P1** |
| 13→14 (Growth) | **Medium** | High | Medium | **High** | **P1** |
| 14→15 (Multi) | **High** | High | High | Medium | **P2** |

**Epistemic Risk**: Can the phase violate "every claim traceable to sources"?
**Technical Risk**: Implementation complexity and failure modes
**UX Risk**: Can users be confused or overwhelmed?
**Business Value**: Impact on research capability

---

## Implementation Roadmap

### Q1 2026 (Weeks 1-12): Foundation
- ✅ Week 1-4: **Phase 11** — Introspection Layer
- ✅ Week 5-8: **Phase 15→13** — QA Infrastructure
- ✅ Week 9-11: **Phase 16** — Provenance Auditing
- Week 12: Buffer, docs, testing

**Deliverables**:
- `scripts/explore/` — Navigation and visualization tools
- `scripts/qa/` — Regression detection and monitoring
- `.github/workflows/god-learn-qa.yml` — CI pipeline
- QA dashboard in Phase 10 UI

### Q2 2026 (Weeks 13-24): Growth
- ✅ Week 13-18: **Phase 13→14** — Corpus Growth
- Week 19-22: Production hardening (stress testing, performance)
- Week 23-24: Retrospective and Phase 14 planning

**Deliverables**:
- `scripts/growth/` — Corpus versioning and rebalancing
- Reasoning domain architecture
- Skew detection and calibration tools
- Production monitoring

### Future (6-12 months): Expansion
- **Phase 14→15** — Multi-Corpus (if validated need)
- Additional phases based on production learnings

---

## Critical Success Factors

### 1. Immutability Preservation
Every phase must maintain:
- Phase 1-9 artifacts are never mutated
- All operations are additive or read-only
- Provenance chains remain intact

**Verification**:
```bash
scripts/verify/verify_immutability.py --phase 11
scripts/verify/verify_immutability.py --phase 13
```

### 2. Explicit Failure Modes
No silent failures. All errors must be:
- Detected automatically
- Reported explicitly
- Diagnosable with clear root cause

**Example**: If chunk_id missing during provenance audit:
```json
{
  "error": "missing_chunk",
  "claim_id": "claim_123",
  "chunk_id": "923bdec29ef67d0f:00037",
  "provenance_chain": ["answer", "reasoning", "ku", "chunk"],
  "break_point": "chunk",
  "recommendation": "Re-run Phase 2 ingestion or remove KU"
}
```

### 3. Performance Constraints
- Graph rendering: <2s for 100 nodes
- Coverage analysis: <10s for 10 queries
- Provenance audit: <30s for full answer
- QA suite: <5min for full corpus

### 4. Epistemic Guarantees
Every claim must be:
- Traceable to exact PDF page
- Verifiable against original source
- Immutable once established
- Explicit about corpus boundaries (Phase 14)

---

## What Changes from Original Proposal?

| Original | Recommended | Reason |
|----------|------------|--------|
| Phase 11 separate from 12 | **Merge into single phase** | Reduces complexity, better UX |
| Phase 15 at end | **Move to position 13** | Need QA before growth |
| No provenance auditing | **Add Phase 16** | Critical missing verification |
| Phase 13 before QA | **QA before growth** | Prevent undetected regressions |
| Phase 14 in sequence | **Defer 6-12 months** | Too complex without Phase 13 experience |

---

## Next Steps

1. **Review this analysis** — Discuss modifications to original proposal
2. **Approve Phase 11 design** — Introspection layer architecture
3. **Approve reordering** — QA before growth (Phase 15 → 13)
4. **Consider Phase 16** — Provenance auditing
5. **Begin implementation** — Start with Phase 11 (4 weeks)

---

## Questions for Discussion

1. **Phase Merging**: Agree with combining 11+12 into Introspection Layer?
2. **QA Priority**: Accept moving Phase 15 before Phase 13?
3. **Provenance Auditing**: Should Phase 16 be added?
4. **Multi-Corpus Timing**: Defer Phase 14 until Phase 13 proven stable?
5. **Reasoning Domains**: Should we introduce domain architecture now or in Phase 13?

---

## Files Generated

1. `.plan/phases-11-15-analysis.md` — Analysis plan and approach
2. `.plan/phases-11-15-review.md` — Detailed phase-by-phase review (20+ pages)
3. `.plan/SUMMARY.md` — This executive summary

**Next**: When ready to proceed, I can:
- Design Phase 11 implementation specs
- Draft verification scripts for Phase 15
- Create provenance audit architecture (Phase 16)
- Build corpus growth roadmap (Phase 13)
