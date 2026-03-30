# TASK-AGT-007: Behavior Rule MemoryGraph Schema

```
Task ID:       TASK-AGT-007
Status:        BLOCKED
Implements:    REQ-BEHAV-003
Depends On:    TASK-AGT-001
Complexity:    Medium
Guardrails:    GR-003 (behavior changes require user approval)
NFRs:          NFR-005 (cost control), NFR-006 (MemoryGraph resilience)
Security:      Low risk — schema definitions and CRUD helpers only. Verify no default rule text contains executable patterns or user-controlled interpolation.
```

## Context

Before any behavior adjustment skill can exist, the MemoryGraph schema for behavior rules must be established. This task defines the exact data model, relationship types, query patterns, and CRUD helper functions that all subsequent behavior tasks (TASK-AGT-008 through TASK-AGT-010) and the behavior injection in `/run-agent` (TASK-AGT-009) depend on.

The behavior rule schema is the authoritative contract for how behavioral rules are stored, queried, versioned, and related to each other in MemoryGraph. Every field, every relationship type, and every priority semantic must be nailed down here so that downstream tasks can implement against a stable interface.

## Scope

### In Scope
- MemoryGraph node schema for `behavior_rule` type
- Three relationship types: `SUPERSEDES`, `CONFLICTS_WITH`, `APPLIES_TO`
- Priority semantics (1-100, higher wins, tiebreaker logic)
- CRUD helper functions: create, read (single + bulk), update, deactivate, list versions
- Query patterns: "get all active rules for agent X sorted by priority", "get version history for rule Y", "find conflicting rules"
- Constants: categories, sources, schema version
- Validation logic for all fields

### Out of Scope
- The `/adjust-behavior` skill itself (TASK-AGT-008)
- LLM-mediated merge logic (TASK-AGT-008)
- Behavior injection into `/run-agent` (TASK-AGT-009)
- Rollback logic (TASK-AGT-010)
- behavior.md file format (already defined in TASK-AGT-001)

## Key Design Decisions

1. **MemoryGraph is the source of truth for behavior rules**: `behavior.md` is a rendered snapshot; MemoryGraph stores the canonical versioned rules. If they diverge, `/run-agent` injects both but warns (EC-RUN-007).
2. **Soft delete, never hard delete**: Deactivating a rule sets `active: false` but retains the node. This preserves the SUPERSEDES chain for rollback and audit.
3. **Version as integer, monotonically increasing per rule**: Each update to a rule creates a new MemoryGraph node with `version` incremented. The old node is marked `active: false` and a `SUPERSEDES` relationship links new → old.
4. **Agent scope is a string, not a relationship**: `agent_scope` is stored as a field value ("global" or "{agent-name}") rather than a separate relationship, because MemoryGraph queries filter on field values efficiently and the cardinality is low.
5. **Priority tiebreaker**: When two rules have identical `priority`, the one with the most recent `modified_at` timestamp wins. If `modified_at` is also identical (unlikely), the rule with the higher `version` wins (deterministic fallback).

## Detailed Specifications

### Constants

```python
# File: .claude/agents/custom/_behavior_schema/constants.py
# (These will be used by the skill files as inline references —
#  skills are markdown, so constants are documented here for the
#  skill implementations to embed directly)

BEHAVIOR_RULE_TYPE = "behavior_rule"
BEHAVIOR_RULE_SCHEMA_VERSION = "1.0.0"

# Valid categories (REQ-BEHAV-003)
BEHAVIOR_CATEGORIES = frozenset({
    "communication",   # How the agent communicates (tone, format, verbosity)
    "coding",          # Code style, patterns, practices
    "delegation",      # How the agent delegates or avoids delegation
    "analysis",        # How the agent analyzes or reasons
    "quality",         # Quality standards, review practices
})

# Valid sources (REQ-BEHAV-003)
BEHAVIOR_SOURCES = frozenset({
    "user_request",    # Explicitly requested via /adjust-behavior
    "auto_extracted",  # Extracted from conversation (REQ-BEHAV-007, future)
    "correction",      # Derived from a correction the user made
})

# Priority range
BEHAVIOR_PRIORITY_MIN = 1
BEHAVIOR_PRIORITY_MAX = 100
BEHAVIOR_PRIORITY_DEFAULT = 50

# Relationship types
REL_SUPERSEDES = "SUPERSEDES"        # new_rule -> old_rule (versioning)
REL_CONFLICTS_WITH = "CONFLICTS_WITH" # rule_a <-> rule_b (bidirectional semantic)
REL_APPLIES_TO = "APPLIES_TO"        # rule -> agent_definition (scope binding)
```

### MemoryGraph Node Schema

Each behavior rule is stored as a single MemoryGraph memory with the following structure:

```json
{
  "name": "behavior_rule:{agent_scope}:{category}:{sanitized_rule_slug}:v{version}",
  "type": "behavior_rule",
  "metadata": {
    "schema_version": "1.0.0",
    "category": "communication",
    "rule": "Always cite specific section numbers when referencing SEC filings",
    "priority": 75,
    "source": "user_request",
    "version": 3,
    "active": true,
    "agent_scope": "sec-filing-analyzer",
    "rule_group_id": "brg-a1b2c3d4",
    "created_at": "2026-03-30T10:00:00Z",
    "modified_at": "2026-03-30T14:30:00Z",
    "modified_by": "user_request"
  },
  "tags": ["behavior-rule", "sec-filing-analyzer", "communication"]
}
```

**Field specifications:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `name` | string | `behavior_rule:{scope}:{category}:{slug}:v{version}` | Unique node name. `slug` is first 40 chars of rule text, lowercased, non-alphanum replaced with `-`, trailing hyphens stripped |
| `type` | string | Always `"behavior_rule"` | MemoryGraph type discriminator |
| `metadata.schema_version` | string | Semver, currently `"1.0.0"` | For future migrations |
| `metadata.category` | string | One of `BEHAVIOR_CATEGORIES` | Rule classification |
| `metadata.rule` | string | Non-empty, max 500 chars | The actual rule text |
| `metadata.priority` | integer | 1-100 inclusive | Higher number = higher priority |
| `metadata.source` | string | One of `BEHAVIOR_SOURCES` | How the rule was created |
| `metadata.version` | integer | >= 1, monotonically increasing per rule_group_id | Version within this rule's lineage |
| `metadata.active` | boolean | `true` or `false` | Whether the rule is currently in effect |
| `metadata.agent_scope` | string | `"global"` or a valid agent name | Which agent this rule applies to |
| `metadata.rule_group_id` | string | `"brg-"` + 8 hex chars | Groups all versions of the same logical rule |
| `metadata.created_at` | string | ISO 8601 UTC | When version 1 of this rule was first created |
| `metadata.modified_at` | string | ISO 8601 UTC | When this specific version was stored |
| `metadata.modified_by` | string | One of `BEHAVIOR_SOURCES` | What action created this version |

**Node naming convention:**

```
behavior_rule:global:coding:always-use-typescript-strict-mode:v1
behavior_rule:sec-filing-analyzer:analysis:cite-specific-section-numbers:v3
```

The `slug` is generated by:
```python
def _make_slug(rule_text: str) -> str:
    """Generate a deterministic slug from rule text for node naming."""
    import re
    slug = rule_text[:40].lower()
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    slug = slug.strip('-')
    return slug or "unnamed-rule"
```

### Relationship Types

**SUPERSEDES** (new_version → old_version):
```json
{
  "source": "behavior_rule:sec-filing-analyzer:analysis:cite-specific-section-numbers:v3",
  "target": "behavior_rule:sec-filing-analyzer:analysis:cite-specific-section-numbers:v2",
  "relationship_type": "SUPERSEDES",
  "context": "Updated via /adjust-behavior: added requirement for page numbers"
}
```
- Direction: new version → old version it replaces
- Created when: a rule is updated (new version created, old version deactivated)
- Invariant: the SUPERSEDES chain for a given `rule_group_id` must be linear (no branching)

**CONFLICTS_WITH** (rule_a ↔ rule_b):
```json
{
  "source": "behavior_rule:global:coding:always-use-typescript-strict-mode:v1",
  "target": "behavior_rule:global:coding:allow-any-types-for-prototyping:v1",
  "relationship_type": "CONFLICTS_WITH",
  "context": "Strict mode prohibits 'any'; prototyping rule allows it"
}
```
- Direction: bidirectional (create relationship in both directions)
- Created when: `/adjust-behavior` diff validation detects a conflict (TASK-AGT-008)
- Advisory only — conflicts do not prevent rule creation, but are surfaced to the user

**APPLIES_TO** (rule → agent_definition):
```json
{
  "source": "behavior_rule:sec-filing-analyzer:analysis:cite-specific-section-numbers:v3",
  "target": "agent_definition:sec-filing-analyzer",
  "relationship_type": "APPLIES_TO",
  "context": "Agent-scoped behavior rule"
}
```
- Direction: rule → agent
- Created when: a rule with `agent_scope != "global"` is stored
- Not created for global rules (they apply to all agents implicitly)

### CRUD Helper Functions

These are implemented as utility functions that the skill markdown files reference. Since skills are markdown (not Python), these functions document the exact MemoryGraph MCP calls to make. The skill files will contain the inline logic.

#### create_behavior_rule

```
INPUTS:
  rule_text: string (non-empty, max 500 chars)
  category: string (one of BEHAVIOR_CATEGORIES)
  priority: integer (1-100, default 50)
  source: string (one of BEHAVIOR_SOURCES, default "user_request")
  agent_scope: string ("global" or valid agent name, default "global")

ALGORITHM:
  1. Validate inputs:
     - rule_text: non-empty after strip, len <= 500
     - category: in BEHAVIOR_CATEGORIES
     - priority: integer, 1 <= priority <= 100
     - source: in BEHAVIOR_SOURCES
     - agent_scope: "global" or matches ^[a-z0-9][a-z0-9-]*$ (agent name pattern)
  2. Generate rule_group_id: "brg-" + 8 random hex chars
  3. Generate slug: _make_slug(rule_text)
  4. Set version = 1
  5. Set now = current UTC ISO 8601
  6. Construct node name: f"behavior_rule:{agent_scope}:{category}:{slug}:v{version}"
  7. Call mcp__memorygraph__store_memory:
     name: {node_name}
     type: "behavior_rule"
     metadata: { all fields as specified above }
     tags: ["behavior-rule", agent_scope, category]
  8. If agent_scope != "global":
     Call mcp__memorygraph__create_relationship:
       source: {node_name}
       target: f"agent_definition:{agent_scope}"
       relationship_type: "APPLIES_TO"
       context: "Agent-scoped behavior rule"
  9. Return: { rule_group_id, node_name, version: 1 }
```

#### read_active_rules_for_agent

```
INPUTS:
  agent_name: string (a specific agent name)

ALGORITHM:
  1. Recall agent-scoped rules:
     Call mcp__memorygraph__search_memories:
       query: "behavior_rule active {agent_name}"
       type: "behavior_rule"
     Filter results: metadata.active == true AND metadata.agent_scope == agent_name
  2. Recall global rules:
     Call mcp__memorygraph__search_memories:
       query: "behavior_rule active global"
       type: "behavior_rule"
     Filter results: metadata.active == true AND metadata.agent_scope == "global"
  3. Merge:
     combined = agent_rules + global_rules
  4. Sort by:
     PRIMARY: metadata.priority DESC
     SECONDARY (tiebreaker): metadata.modified_at DESC (most recent first)
     TERTIARY (deterministic fallback): metadata.version DESC
  5. Deduplicate: if an agent-scoped rule and a global rule share the same
     rule_group_id (shouldn't happen, but defensive), keep the agent-scoped one
  6. Return: sorted list of rule objects

PRECEDENCE RULE:
  At the same priority level, agent-scoped rules appear before global rules.
  This is enforced by the sort: agent-scoped rules at priority N are listed
  before global rules at priority N (secondary sort: agent-scoped first,
  then by modified_at within each scope group).

  Adjusted sort key per rule:
    (-priority, 0 if agent_scope==agent_name else 1, -modified_at_epoch, -version)
```

#### update_behavior_rule

```
INPUTS:
  rule_group_id: string
  new_rule_text: string (optional, max 500 chars)
  new_priority: integer (optional, 1-100)
  new_category: string (optional, one of BEHAVIOR_CATEGORIES)
  source: string (one of BEHAVIOR_SOURCES, default "user_request")

ALGORITHM:
  1. Find current active version:
     Call mcp__memorygraph__search_memories:
       query: f"behavior_rule {rule_group_id}"
       type: "behavior_rule"
     Filter: metadata.active == true AND metadata.rule_group_id == rule_group_id
     If no active version found: error "Rule group {rule_group_id} not found or already deactivated"
  2. Deactivate current version:
     Call mcp__memorygraph__update_memory:
       name: {current_node_name}
       metadata: { ...current_metadata, active: false }
  3. Create new version:
     new_version = current_metadata.version + 1
     Merge fields: use new_* if provided, else carry forward from current
     Generate new slug if rule_text changed
     new_node_name = f"behavior_rule:{scope}:{category}:{slug}:v{new_version}"
     Call mcp__memorygraph__store_memory with new node
  4. Create SUPERSEDES relationship:
     Call mcp__memorygraph__create_relationship:
       source: {new_node_name}
       target: {current_node_name}
       relationship_type: "SUPERSEDES"
       context: f"Updated via {source}"
  5. If agent_scope != "global":
     Create APPLIES_TO relationship for new node
  6. Return: { rule_group_id, new_node_name, version: new_version }
```

#### deactivate_behavior_rule

```
INPUTS:
  rule_group_id: string

ALGORITHM:
  1. Find current active version (same as update step 1)
  2. Set active = false:
     Call mcp__memorygraph__update_memory:
       name: {current_node_name}
       metadata: { ...current_metadata, active: false, modified_at: now, modified_by: "user_request" }
  3. Return: { rule_group_id, deactivated_node_name, version }
  NOTE: No new version created. The rule is simply turned off.
```

#### get_version_history

```
INPUTS:
  rule_group_id: string

ALGORITHM:
  1. Search all versions:
     Call mcp__memorygraph__search_memories:
       query: f"behavior_rule {rule_group_id}"
       type: "behavior_rule"
     Filter: metadata.rule_group_id == rule_group_id
  2. Sort by metadata.version ASC
  3. Return: list of all versions (active and inactive) with full metadata
```

### Query Pattern: Token Budget Estimation

```
ALGORITHM for estimating token cost of behavior rules:

  1. rules = read_active_rules_for_agent(agent_name)
  2. For each rule, estimate tokens:
     - Rule header line ("- [{priority}] [{category}] "): ~10 tokens
     - Rule text: len(rule.metadata.rule) / 4  (rough 4-chars-per-token estimate)
     - Scope annotation (" (global)" or ""): ~2 tokens
  3. total_tokens = sum of per-rule estimates + 20 (section header overhead)
  4. If total_tokens > 500:
     Log warning: "Agent has {n} behavior rules consuming ~{total_tokens} tokens"
  5. Return: { rules, estimated_tokens: total_tokens }
```

## Files to Create

- `.claude/skills/behavior-schema-reference.md` — Reference document embedded in skill files that documents the schema, constants, and CRUD patterns above. Not a user-facing skill, but a reference for TASK-AGT-008/009/010 to include inline.

The "files to create" for this task are minimal because the schema is defined in MemoryGraph (not in code files). The deliverable is:
1. The reference document above
2. Verification that the schema can be stored/retrieved/queried in MemoryGraph
3. Test script that validates the CRUD operations

- `tests/agent-creation/test_behavior_schema.sh` — Shell script that exercises all CRUD operations against real MemoryGraph

## Files to Modify

- None (MemoryGraph schema is defined by usage, not by DDL)

## Validation Criteria

### Unit Tests (test_behavior_schema.sh)

- [ ] **Store a rule**: Call `mcp__memorygraph__store_memory` with a valid behavior_rule node; verify it returns success
- [ ] **Retrieve a rule**: Call `mcp__memorygraph__get_memory` with the node name; verify all metadata fields match
- [ ] **Search active rules**: Store 3 rules (2 active, 1 inactive) for the same agent; search and filter; verify only 2 returned
- [ ] **Priority sort**: Store rules with priorities 30, 80, 50; retrieve and sort; verify order is 80, 50, 30
- [ ] **Tiebreaker sort**: Store 2 rules with priority 50, different modified_at; verify most recent first
- [ ] **Agent scope precedence**: Store 1 global rule at priority 50, 1 agent rule at priority 50; verify agent rule appears first
- [ ] **Update a rule (version increment)**: Update a v1 rule; verify v2 created, v1 deactivated, SUPERSEDES relationship exists
- [ ] **SUPERSEDES chain**: Create v1, update to v2, update to v3; verify chain v3→v2→v1 via `mcp__memorygraph__get_related_memories`
- [ ] **Deactivate a rule**: Deactivate an active rule; verify active=false, no new version created
- [ ] **Version history**: Create v1, update to v2, update to v3; call get_version_history; verify 3 entries sorted by version ASC
- [ ] **CONFLICTS_WITH relationship**: Create two conflicting rules, create bidirectional CONFLICTS_WITH; verify both directions retrievable
- [ ] **APPLIES_TO relationship**: Create agent-scoped rule; verify APPLIES_TO relationship to agent definition exists
- [ ] **Global rule has no APPLIES_TO**: Create global rule; verify no APPLIES_TO relationship created
- [ ] **Slug generation**: Verify slug for "Always cite specific section numbers" is "always-cite-specific-section-number" (truncated at 40 chars)
- [ ] **Slug edge cases**: Empty after sanitize (e.g., "!!!") → "unnamed-rule"; all spaces → "unnamed-rule"
- [ ] **Validation: empty rule text** → error
- [ ] **Validation: rule text > 500 chars** → error
- [ ] **Validation: priority 0** → error (below minimum)
- [ ] **Validation: priority 101** → error (above maximum)
- [ ] **Validation: invalid category** → error
- [ ] **Validation: invalid source** → error
- [ ] **Token budget estimation**: 10 rules with ~50 char text each → estimate ~150 tokens (10 * (10 + 12.5 + 2) + 20 section overhead)

### Sherlock Gates

- [ ] **OPERATIONAL READINESS**: `mcp__memorygraph__store_memory` with a behavior_rule node succeeds in a live Claude Code session
- [ ] **OPERATIONAL READINESS**: `mcp__memorygraph__search_memories` with query "behavior_rule active global" returns stored rules
- [ ] **OPERATIONAL READINESS**: `mcp__memorygraph__create_relationship` with SUPERSEDES type succeeds
- [ ] **SCHEMA PARITY**: All fields in the stored node match REQ-BEHAV-003 schema exactly (category values, priority range, source values)
- [ ] **RELATIONSHIP INTEGRITY**: SUPERSEDES chain is traversable via `mcp__memorygraph__get_related_memories`

### Live Smoke Test

- [ ] Store a behavior rule for agent "test-agent" with priority 75, category "coding", rule "Use TypeScript strict mode"
- [ ] Update the rule to "Use TypeScript strict mode with no-implicit-any" — verify v2 created, v1 deactivated
- [ ] Retrieve all active rules for "test-agent" — verify only v2 returned
- [ ] Store a global rule with priority 75 — verify agent rule appears before global rule in sorted results
- [ ] Retrieve version history — verify v1 and v2 both present, sorted by version
- [ ] Clean up: deactivate all test rules

## Test Commands

```bash
# Manual MemoryGraph verification (run in Claude Code session)
# Step 1: Store a test rule
# mcp__memorygraph__store_memory with behavior_rule node

# Step 2: Verify retrieval
# mcp__memorygraph__get_memory with node name

# Step 3: Verify search
# mcp__memorygraph__search_memories with query "behavior_rule active test-agent"

# Step 4: Verify relationship
# mcp__memorygraph__get_related_memories with node name

# Automated shell test
bash tests/agent-creation/test_behavior_schema.sh
```
