# God-Learn Pipeline: Actionable Recommendations Summary

**Date**: 2026-01-12
**Based on**: Gap Analysis of Phases 1-10 Pipeline Architecture

---

## Quick Reference: Top 5 Recommendations

| # | Gap ID | Recommendation | Effort | Impact | Files to Modify |
|---|--------|----------------|--------|--------|-----------------|
| 1 | GAP-A01 | Classify agents by external tool dependency | 2 days | HIGH | `phd-pipeline-config.ts` |
| 2 | GAP-A02 | Create local-only agent chain | 2-3 days | HIGH | `phd-cli.ts`, `god-research-local.md` |
| 3 | GAP-H01 | Implement programmatic tool gate | 3-4 days | CRITICAL | `session-manager.ts`, tool filtering |
| 4 | GAP-A03 | Inject Phase 9 report into agents | 1 day | HIGH | `phd-cli.ts:buildYourTaskSection()` |
| 5 | GAP-H02 | Add provenance validation | 2 days | HIGH | New: `scripts/interaction/validate_provenance.py` |

---

## Detailed Implementation Specs

### 1. Agent Tool Dependency Classification (GAP-A01)

**File**: `/home/dalton/projects/claudeflow-testing/src/god-agent/cli/phd-pipeline-config.ts`

**Current Schema**:
```typescript
interface AgentConfig {
  key: string;
  phase: number;
  displayName: string;
  file: string;
}
```

**Proposed Schema**:
```typescript
interface AgentConfig {
  key: string;
  phase: number;
  displayName: string;
  file: string;
  // NEW: Tool dependency metadata
  toolDependency: {
    canRunLocalOnly: boolean;
    requiresExternalTools: boolean;
    externalToolsUsed: ('webSearch' | 'webFetch' | 'perplexity')[];
  };
}
```

**Initial Classification (Recommended)**:

```typescript
// Agents that CAN run local-only (no external tools needed)
const LOCAL_CAPABLE_AGENTS = [
  'step-back-analyzer',           // Pure reasoning
  'self-ask-decomposer',          // Query decomposition
  'multi-perspective-synthesizer', // Synthesis from local
  'dissertation-architect',        // Structure planning
  'theoretical-framework-analyst', // Framework analysis
  'evidence-synthesizer',          // Evidence synthesis
  'opportunity-identifier',        // Pattern detection
  'methodology-writer',            // Writing from local
  'introduction-writer',           // Writing from local
  'conclusion-writer',             // Writing from local
  'abstract-writer',               // Writing from local
  'adversarial-reviewer',          // Review from local
  'quality-assurance-checker',     // QA from local
  'coherence-analyzer',            // Analysis from local
  'citation-consistency-checker',  // Citation validation
  'file-length-manager',           // Structure management
];

// Agents that REQUIRE external tools
const EXTERNAL_REQUIRED_AGENTS = [
  'literature-mapper',       // Needs webSearch for literature
  'gap-identifier',          // May need external validation
  'context-tier-manager',    // May need webFetch for sources
];
```

---

### 2. Local-Only Agent Chain (GAP-A02)

**File**: `/home/dalton/projects/claudeflow-testing/src/god-agent/cli/phd-cli.ts`

**Add new function**:
```typescript
function getLocalModeAgents(): AgentConfig[] {
  // Core local-capable agents for a focused research workflow
  const LOCAL_CHAIN = [
    'step-back-analyzer',      // Foundation: Core reasoning
    'self-ask-decomposer',     // Foundation: Query breakdown
    'dissertation-architect',   // Foundation: Structure
    'evidence-synthesizer',    // Synthesis: Evidence gathering
    'methodology-writer',      // Design: Method from local
    'adversarial-reviewer',    // Validation: Quality check
    'quality-assurance-checker', // Validation: Final QA
  ];

  return PHD_AGENTS.filter(a => LOCAL_CHAIN.includes(a.key));
}
```

**Modify init command**:
```typescript
// In initCommand handler (around line 1000+)
if (options.dataSource === 'local') {
  // Run Phase 9 REPORT first (existing)
  const reportJson = await runPhase9Report(topic);

  // NEW: Get local-only agent subset
  const localAgents = getLocalModeAgents();

  session.totalAgents = localAgents.length;
  session.agentSequence = localAgents.map(a => a.key);

  // Store Phase 9 report for agent injection
  session.phase9Report = reportJson;
}
```

**Update command documentation**:
```markdown
# god-research-local

Runs local-only research with:
- Phase 9 REPORT (corpus coverage diagnostic)
- 7 local-capable agents (no external tools)
- Phase 9 ANSWER (grounded synthesis)

Agent chain:
1. step-back-analyzer - Foundation reasoning
2. self-ask-decomposer - Query decomposition
3. dissertation-architect - Structure planning
4. evidence-synthesizer - Evidence synthesis
5. methodology-writer - Method design
6. adversarial-reviewer - Adversarial review
7. quality-assurance-checker - Final QA
```

---

### 3. Programmatic Tool Gate (GAP-H01)

**File**: `/home/dalton/projects/claudeflow-testing/src/god-agent/cli/session-manager.ts`

**Add to session state**:
```typescript
interface PipelineSession {
  // ...existing fields

  // NEW: Tool permissions
  toolPermissions: {
    webSearch: boolean;
    webFetch: boolean;
    perplexity: boolean;
  };

  // NEW: Tool usage audit log
  toolUsageLog: Array<{
    timestamp: string;
    agentKey: string;
    tool: string;
    justification: string;
    coverageGradeAtTime: string;
  }>;
}
```

**Add permission resolver**:
```typescript
function resolveToolPermissions(
  dataSourceMode: 'local' | 'hybrid' | 'external',
  coverageGrade: 'NONE' | 'LOW' | 'MED' | 'HIGH',
  queryIntent: { recencyRequired: boolean; outsideCorpusDomains: string[] }
): ToolPermissions {
  if (dataSourceMode === 'local') {
    return { webSearch: false, webFetch: false, perplexity: false };
  }

  if (dataSourceMode === 'external') {
    return { webSearch: true, webFetch: true, perplexity: true };
  }

  // Hybrid mode logic
  if (coverageGrade === 'NONE' || coverageGrade === 'LOW') {
    return { webSearch: true, webFetch: true, perplexity: true };
  }

  if (queryIntent.recencyRequired || queryIntent.outsideCorpusDomains.length > 0) {
    return { webSearch: true, webFetch: true, perplexity: true };
  }

  // HIGH/MED coverage, no recency/outside-corpus intent
  return { webSearch: false, webFetch: false, perplexity: false };
}
```

---

### 4. Phase 9 Report Injection (GAP-A03)

**File**: `/home/dalton/projects/claudeflow-testing/src/god-agent/cli/phd-cli.ts`

**Modify buildYourTaskSection** (around line 551):
```typescript
function buildYourTaskSection(
  agent: PhdAgentConfig,
  session: IPromptBuildSession,
  agentFileContent: string,
  phase9Report?: any  // NEW PARAMETER
): string {
  let taskSection = `## YOUR TASK

${agentFileContent.trim()}

---
**Research Topic**: ${session.query}
**Session ID**: ${session.sessionId}
`;

  // NEW: Inject Phase 9 coverage for hybrid/local modes
  if (phase9Report && session.dataSourceMode !== 'external') {
    const coverage = phase9Report.coverage_summary || {};
    const retrieval = phase9Report.retrieval?.stats || {};
    const kuHits = phase9Report.knowledge_units?.hits?.length || 0;
    const edgeHits = phase9Report.reasoning_edges?.stats?.n_hits || 0;

    taskSection += `
---
## LOCAL CORPUS COVERAGE (Phase 9 REPORT)

| Metric | Value |
|--------|-------|
| Coverage Grade | **${coverage.coverage_grade || 'UNKNOWN'}** |
| Retrieved Chunks | ${retrieval.n_returned || 0} |
| Distinct Documents | ${retrieval.distinct_docs || 0} |
| Knowledge Units | ${kuHits} |
| Reasoning Edges | ${edgeHits} |

**Gaps Identified**:
${(coverage.gaps || []).map((g: string) => `- ${g}`).join('\n') || '- None'}

**Mode Policy**: ${session.dataSourceMode === 'local' ? 'LOCAL ONLY - No external tools permitted' : 'HYBRID - External tools permitted with justification'}
`;
  }

  return taskSection;
}
```

---

### 5. Provenance Validation Script (GAP-H02)

**New File**: `/home/dalton/projects/claudeflow-testing/scripts/interaction/validate_provenance.py`

```python
#!/usr/bin/env python3
"""
Phase 9 Hybrid Provenance Validator

Ensures outputs correctly separate local and external provenance.
Run after Phase 9 ANSWER in hybrid mode.

Usage:
    python3 scripts/interaction/validate_provenance.py --answer answer.json
"""

import argparse
import json
import sys
from typing import Dict, List, Any, Tuple


def validate_claim_provenance(claim: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """
    Validate a single claim has correct provenance labeling.

    Returns: (is_valid, list_of_errors)
    """
    errors: List[str] = []
    claim_id = claim.get("claim_id", "unknown")
    supports = claim.get("supports", [])
    claim_type = claim.get("type", "")

    # Check if supports exist for assertions
    if claim_type == "assertion" and not supports:
        errors.append(f"Claim {claim_id}: assertion has no supports")
        return False, errors

    # Categorize supports
    local_supports = []
    external_supports = []
    unlabeled_supports = []

    for s in supports:
        if isinstance(s, str):
            # Local provenance patterns
            if s.startswith("ku_") or s.startswith("ru_") or ":" in s:
                local_supports.append(s)
            # External provenance patterns
            elif s.startswith("http://") or s.startswith("https://"):
                external_supports.append(s)
            else:
                unlabeled_supports.append(s)
        elif isinstance(s, dict):
            # Structured support object
            if s.get("type") == "local":
                local_supports.append(s)
            elif s.get("type") == "external":
                if not s.get("url") or not s.get("justification"):
                    errors.append(
                        f"Claim {claim_id}: external support missing url or justification"
                    )
                external_supports.append(s)
            else:
                unlabeled_supports.append(s)

    # Check for mixing (allowed but must be explicit)
    if local_supports and external_supports:
        # This is allowed but should be explicitly structured
        pass

    # Check for unlabeled supports
    if unlabeled_supports:
        errors.append(
            f"Claim {claim_id}: {len(unlabeled_supports)} unlabeled supports: {unlabeled_supports[:3]}"
        )

    return len(errors) == 0, errors


def validate_hybrid_output(answer_json: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate entire Phase 9 ANSWER output for hybrid mode compliance.
    """
    results = {
        "valid": True,
        "total_claims": 0,
        "local_only_claims": 0,
        "external_only_claims": 0,
        "mixed_claims": 0,
        "invalid_claims": 0,
        "errors": [],
    }

    # Get synthesis claims
    synthesis = answer_json.get("layers", {}).get("synthesis", {})
    if not synthesis.get("enabled"):
        results["notes"] = "Synthesis not enabled; no claims to validate"
        return results

    claims = synthesis.get("claims", [])
    results["total_claims"] = len(claims)

    for claim in claims:
        is_valid, errors = validate_claim_provenance(claim)
        if not is_valid:
            results["valid"] = False
            results["invalid_claims"] += 1
            results["errors"].extend(errors)

    return results


def main() -> int:
    ap = argparse.ArgumentParser(description="Validate hybrid provenance")
    ap.add_argument("--answer", required=True, help="Path to answer.json")
    ap.add_argument("--strict", action="store_true", help="Exit 2 on any error")
    args = ap.parse_args()

    with open(args.answer, "r") as f:
        answer_json = json.load(f)

    results = validate_hybrid_output(answer_json)

    print(json.dumps(results, indent=2))

    if args.strict and not results["valid"]:
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

---

## Implementation Checklist

### Week 1: Quick Wins
- [ ] Add `toolDependency` field to `AgentConfig` interface
- [ ] Classify first 20 agents by tool dependency
- [ ] Add `phase9Report` storage in session state
- [ ] Modify `buildYourTaskSection` to inject report
- [ ] Create `validate_provenance.py` script

### Week 2-3: Core Improvements
- [ ] Complete agent classification (all 46)
- [ ] Implement `getLocalModeAgents()` function
- [ ] Update local mode init to use agent subset
- [ ] Add `toolPermissions` to session state
- [ ] Implement `resolveToolPermissions()`
- [ ] Add query intent analyzer

### Week 4+: Strategic
- [ ] Integrate tool gate with claude-flow
- [ ] Add Phase 8B style validation
- [ ] Create swarm research mode prototype
- [ ] Add comprehensive audit trail

---

## Testing Strategy

### Unit Tests
```typescript
describe('LocalModeAgents', () => {
  it('should return only local-capable agents', () => {
    const agents = getLocalModeAgents();
    agents.forEach(a => {
      expect(a.toolDependency.canRunLocalOnly).toBe(true);
    });
  });

  it('should not include external-required agents', () => {
    const agents = getLocalModeAgents();
    const keys = agents.map(a => a.key);
    expect(keys).not.toContain('literature-mapper');
  });
});

describe('ToolPermissionResolver', () => {
  it('should deny all tools in local mode', () => {
    const perms = resolveToolPermissions('local', 'HIGH', { recencyRequired: false, outsideCorpusDomains: [] });
    expect(perms.webSearch).toBe(false);
    expect(perms.webFetch).toBe(false);
  });

  it('should allow tools in hybrid mode with LOW coverage', () => {
    const perms = resolveToolPermissions('hybrid', 'LOW', { recencyRequired: false, outsideCorpusDomains: [] });
    expect(perms.webSearch).toBe(true);
  });
});
```

### Integration Tests
```bash
# Test local mode with agent chain
npx tsx src/god-agent/cli/phd-cli.ts init "test query" --data-source local --json | \
  jq '.agentSequence | length'
# Expected: 7 (local agent chain)

# Test hybrid mode provenance validation
python3 scripts/interaction/answer.py --query "test" --enable_synthesis --format json > /tmp/answer.json
python3 scripts/interaction/validate_provenance.py --answer /tmp/answer.json --strict
# Expected: exit 0 if valid
```

---

## Conclusion

These recommendations provide a clear path from the current state (Phase 9-only local mode) to a fully agent-integrated research pipeline that:

1. **Respects local-only constraints** when specified
2. **Enforces hybrid policy programmatically**, not just via prompts
3. **Utilizes available agents** appropriately based on tool dependencies
4. **Maintains LLM boundaries** with validation

The priority order balances quick wins with strategic improvements, ensuring measurable progress each week.
