# Quick Start: Phase 11 Implementation

**For**: Development team starting Phase 11 implementation
**Time to Complete**: Day 1 setup
**Prerequisites**: Phase 1-10 complete

---

## Step 1: Review Planning Documents (30 minutes)

Read in order:

1. **`.plan/SUMMARY.md`** (10 min)
   - Understand phase sequencing rationale
   - Review architectural principles
   - Note success criteria

2. **`.plan/phase-11-implementation-plan.md`** (15 min)
   - Detailed Phase 11 architecture
   - CLI command specifications
   - Testing strategy

3. **`.plan/IMPLEMENTATION_ROADMAP.md`** (5 min)
   - Overall timeline
   - Phase dependencies
   - Resource requirements

---

## Step 2: Verify Environment (15 minutes)

### Check Prerequisites

```bash
# Navigate to project root
cd /home/dalton/projects/claudeflow-testing

# Verify Python version (need 3.10+)
python3 --version

# Verify existing phases are complete
ls -la god-learn/knowledge.jsonl      # Phase 6 output
ls -la god-reason/reasoning.jsonl     # Phase 7 output (may not exist yet)

# Check vector database
ls -la vector_db_1536/

# Verify corpus
ls -la corpus/rhetorical_ontology/ | head
```

### Install Dependencies

```bash
# Create Phase 11 requirements file
cat > /tmp/phase11-requirements.txt << 'EOF'
networkx==3.2.1
graphviz==0.20.1
chromadb==0.4.22
pytest==7.4.3
pytest-cov==0.13.0
EOF

# Install
pip install -r /tmp/phase11-requirements.txt
```

### Verify GraphViz (optional, for exports)

```bash
# Check if GraphViz is installed
which dot

# If not installed:
# Ubuntu/Debian: sudo apt-get install graphviz
# macOS: brew install graphviz
# Windows: Download from https://graphviz.org/download/
```

---

## Step 3: Create Directory Structure (10 minutes)

```bash
# Navigate to project root
cd /home/dalton/projects/claudeflow-testing

# Create Phase 11 directory structure
mkdir -p scripts/explore/{core,cli/commands,visualization,verify,web,tests/fixtures}

# Create __init__.py files
touch scripts/explore/__init__.py
touch scripts/explore/core/__init__.py
touch scripts/explore/cli/__init__.py
touch scripts/explore/cli/commands/__init__.py
touch scripts/explore/visualization/__init__.py
touch scripts/explore/verify/__init__.py
touch scripts/explore/web/__init__.py
touch scripts/explore/tests/__init__.py

# Create placeholder files
touch scripts/explore/README.md
touch scripts/explore/core/{artifact_loader,graph_builder,filter_engine,navigation,cache}.py
touch scripts/explore/cli/explore.py
touch scripts/explore/cli/formatters.py
touch scripts/explore/cli/commands/{list,show,trace,graph,coverage,export}.py
touch scripts/explore/visualization/{graphviz_exporter,cytoscape_exporter,d3_exporter,coverage_heatmap}.py
touch scripts/explore/verify/{verify_readonly,verify_performance,verify_provenance}.py
touch scripts/explore/tests/{test_loader,test_navigation,test_filters,test_exports}.py

# Create requirements.txt
cat > scripts/explore/requirements.txt << 'EOF'
networkx==3.2.1
graphviz==0.20.1
chromadb==0.4.22
pytest==7.4.3
pytest-cov==0.13.0
EOF

# Verify structure
tree scripts/explore -L 2
```

---

## Step 4: Create Feature Branch (5 minutes)

```bash
# Create feature branch
git checkout -b feature/phase-11-introspection

# Create initial commit with structure
git add scripts/explore/
git add .plan/
git commit -m "feat(phase-11): Initialize directory structure and planning documents

- Add scripts/explore/ directory structure
- Add phase-11-implementation-plan.md
- Add IMPLEMENTATION_ROADMAP.md
- Add QUICKSTART.md
- Ready for Week 1 implementation"

# Push to remote
git push -u origin feature/phase-11-introspection
```

---

## Step 5: Create GitHub Project Board (10 minutes)

### Option A: GitHub Issues

Create issues for Week 1 tasks:

```bash
# Use GitHub CLI (if available)
gh issue create --title "Phase 11 Week 1: Core Infrastructure" \
  --body "Implement artifact loaders, graph builders, and navigation engine. See .plan/phase-11-implementation-plan.md Week 1." \
  --label "phase-11,week-1"

gh issue create --title "Phase 11 Week 2: CLI Interface" \
  --body "Implement CLI commands: list, show, trace, graph, coverage, export." \
  --label "phase-11,week-2"

gh issue create --title "Phase 11 Week 3: Visualization Exports" \
  --body "Implement GraphViz, Cytoscape, D3 exporters and verification suite." \
  --label "phase-11,week-3"

gh issue create --title "Phase 11 Week 4: Polish and Documentation" \
  --body "Optional web UI, complete documentation, final testing." \
  --label "phase-11,week-4"
```

### Option B: Manual Project Board

1. Go to GitHub repository
2. Click "Projects" tab
3. Create new project: "Phase 11: Introspection Layer"
4. Add columns: "Week 1", "Week 2", "Week 3", "Week 4", "Done"
5. Create cards for each week's tasks

---

## Step 6: Week 1, Day 1 - Artifact Loader (2-3 hours)

### Create artifact_loader.py

```bash
cat > scripts/explore/core/artifact_loader.py << 'EOF'
#!/usr/bin/env python3
"""
Phase 11: Artifact Loader

Read-only loader for Phase 6-9 artifacts.
Implements caching and lazy loading.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime


@dataclass
class Source:
    """KU source citation"""
    author: str
    title: str
    path_rel: str
    pages: str
    chunk_id: str


@dataclass
class KnowledgeUnit:
    """Knowledge Unit from Phase 6"""
    id: str
    claim: str
    sources: List[Source]
    confidence: str
    tags: List[str]
    created_from_query: str
    debug: Dict[str, Any]


@dataclass
class ReasoningUnit:
    """Reasoning Unit from Phase 7"""
    id: str
    relation: str
    score: float
    source_id: str
    target_id: str
    evidence: List[str]
    created_at: str


class ArtifactLoader:
    """
    Load Phase 6-9 artifacts (read-only).

    Implements caching and lazy loading for performance.
    """

    def __init__(self, repo_root: Optional[Path] = None):
        """
        Initialize loader.

        Args:
            repo_root: Repository root path (defaults to auto-detect)
        """
        if repo_root is None:
            # Auto-detect repo root (look for god-learn/ directory)
            current = Path(__file__).resolve()
            while current != current.parent:
                if (current / "god-learn").exists():
                    repo_root = current
                    break
                current = current.parent
            else:
                raise RuntimeError("Could not auto-detect repository root")

        self.repo_root = repo_root
        self.knowledge_path = repo_root / "god-learn" / "knowledge.jsonl"
        self.reasoning_path = repo_root / "god-reason" / "reasoning.jsonl"

        # Cache
        self._kus: Optional[List[KnowledgeUnit]] = None
        self._rus: Optional[List[ReasoningUnit]] = None
        self._ku_index: Optional[Dict[str, KnowledgeUnit]] = None
        self._ru_index: Optional[Dict[str, ReasoningUnit]] = None
        self._last_load: Dict[str, float] = {}

    def _needs_reload(self, artifact_path: Path) -> bool:
        """Check if artifact needs reloading based on mtime"""
        if not artifact_path.exists():
            return False

        mtime = artifact_path.stat().st_mtime
        last_load = self._last_load.get(str(artifact_path), 0)

        return mtime > last_load

    def load_kus(self, force: bool = False) -> List[KnowledgeUnit]:
        """
        Load knowledge units from knowledge.jsonl

        Args:
            force: Force reload even if cached

        Returns:
            List of KnowledgeUnit objects
        """
        if self._kus is not None and not force and not self._needs_reload(self.knowledge_path):
            return self._kus

        if not self.knowledge_path.exists():
            raise FileNotFoundError(f"Knowledge file not found: {self.knowledge_path}")

        kus = []
        with open(self.knowledge_path, 'r') as f:
            for line in f:
                data = json.loads(line)
                sources = [Source(**s) for s in data.get('sources', [])]
                ku = KnowledgeUnit(
                    id=data['id'],
                    claim=data['claim'],
                    sources=sources,
                    confidence=data.get('confidence', 'unknown'),
                    tags=data.get('tags', []),
                    created_from_query=data.get('created_from_query', ''),
                    debug=data.get('debug', {})
                )
                kus.append(ku)

        self._kus = kus
        self._ku_index = {ku.id: ku for ku in kus}
        self._last_load[str(self.knowledge_path)] = self.knowledge_path.stat().st_mtime

        return kus

    def load_rus(self, force: bool = False) -> List[ReasoningUnit]:
        """
        Load reasoning units from reasoning.jsonl

        Args:
            force: Force reload even if cached

        Returns:
            List of ReasoningUnit objects
        """
        if self._rus is not None and not force and not self._needs_reload(self.reasoning_path):
            return self._rus

        if not self.reasoning_path.exists():
            # Reasoning file may not exist yet (Phase 7 optional)
            return []

        rus = []
        with open(self.reasoning_path, 'r') as f:
            for line in f:
                data = json.loads(line)
                ru = ReasoningUnit(
                    id=data['id'],
                    relation=data['relation'],
                    score=data['score'],
                    source_id=data['source_id'],
                    target_id=data['target_id'],
                    evidence=data.get('evidence', []),
                    created_at=data.get('created_at', '')
                )
                rus.append(ru)

        self._rus = rus
        self._ru_index = {ru.id: ru for ru in rus}
        self._last_load[str(self.reasoning_path)] = self.reasoning_path.stat().st_mtime

        return rus

    def get_ku_by_id(self, ku_id: str) -> Optional[KnowledgeUnit]:
        """Get KU by ID (loads if not cached)"""
        if self._ku_index is None:
            self.load_kus()
        return self._ku_index.get(ku_id)

    def get_ru_by_id(self, ru_id: str) -> Optional[ReasoningUnit]:
        """Get RU by ID (loads if not cached)"""
        if self._ru_index is None:
            self.load_rus()
        return self._ru_index.get(ru_id)

    def clear_cache(self):
        """Clear all cached data"""
        self._kus = None
        self._rus = None
        self._ku_index = None
        self._ru_index = None
        self._last_load.clear()


if __name__ == '__main__':
    # Quick test
    loader = ArtifactLoader()
    kus = loader.load_kus()
    print(f"Loaded {len(kus)} knowledge units")

    if kus:
        ku = kus[0]
        print(f"\nFirst KU: {ku.id}")
        print(f"Claim: {ku.claim[:80]}...")
        print(f"Sources: {len(ku.sources)}")

    rus = loader.load_rus()
    print(f"\nLoaded {len(rus)} reasoning units")
EOF

# Make executable
chmod +x scripts/explore/core/artifact_loader.py

# Test it
python3 scripts/explore/core/artifact_loader.py
```

### Create First Test

```bash
cat > scripts/explore/tests/test_loader.py << 'EOF'
#!/usr/bin/env python3
"""Tests for artifact_loader"""

import pytest
from pathlib import Path
from scripts.explore.core.artifact_loader import ArtifactLoader


def test_loader_initialization():
    """Test loader can find repo root"""
    loader = ArtifactLoader()
    assert loader.repo_root is not None
    assert (loader.repo_root / "god-learn").exists()


def test_load_kus():
    """Test loading knowledge units"""
    loader = ArtifactLoader()
    kus = loader.load_kus()

    assert isinstance(kus, list)
    # Should have at least one KU from existing corpus
    assert len(kus) > 0

    # Check structure
    ku = kus[0]
    assert hasattr(ku, 'id')
    assert hasattr(ku, 'claim')
    assert hasattr(ku, 'sources')
    assert len(ku.sources) > 0


def test_get_ku_by_id():
    """Test KU lookup by ID"""
    loader = ArtifactLoader()
    kus = loader.load_kus()

    if kus:
        ku_id = kus[0].id
        retrieved = loader.get_ku_by_id(ku_id)
        assert retrieved is not None
        assert retrieved.id == ku_id


def test_cache_invalidation():
    """Test cache invalidates on file change"""
    loader = ArtifactLoader()

    # Load once
    kus1 = loader.load_kus()

    # Load again (should use cache)
    kus2 = loader.load_kus()
    assert kus1 is kus2  # Same object (cached)

    # Clear cache
    loader.clear_cache()

    # Load again (should reload)
    kus3 = loader.load_kus()
    assert kus1 is not kus3  # Different object


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
EOF

# Run tests
cd /home/dalton/projects/claudeflow-testing
python3 -m pytest scripts/explore/tests/test_loader.py -v
```

### Commit Day 1 Work

```bash
git add scripts/explore/core/artifact_loader.py
git add scripts/explore/tests/test_loader.py
git commit -m "feat(phase-11): Implement artifact loader with caching

- Add ArtifactLoader class for read-only Phase 6-9 access
- Implement lazy loading and cache invalidation
- Add KnowledgeUnit and ReasoningUnit dataclasses
- Add comprehensive unit tests
- Week 1, Day 1 complete"

git push
```

---

## Step 7: Daily Workflow (ongoing)

### Morning Routine (15 minutes)

```bash
# 1. Pull latest changes
git pull origin feature/phase-11-introspection

# 2. Review today's tasks
cat .plan/phase-11-implementation-plan.md | grep -A 5 "Day X"

# 3. Run existing tests
python3 -m pytest scripts/explore/tests/ -v

# 4. Check artifact status
python3 scripts/explore/core/artifact_loader.py
```

### During Development

- **Write tests first** (TDD approach)
- **Commit frequently** (every 1-2 hours)
- **Run verification scripts** before commits
- **Update documentation** as you go

### End of Day (15 minutes)

```bash
# 1. Run full test suite
python3 -m pytest scripts/explore/ -v --cov=scripts/explore

# 2. Commit day's work
git add scripts/explore/
git commit -m "feat(phase-11): [Summary of day's work]

- [Bullet point 1]
- [Bullet point 2]
- Week 1, Day X complete"

# 3. Push to remote
git push

# 4. Update GitHub project board
# (Mark tasks complete, update status)

# 5. Document blockers/questions
# (Add to .plan/BLOCKERS.md if needed)
```

---

## Step 8: Weekly Reviews (Friday afternoons)

### End of Week Checklist

```bash
# 1. Run full test suite
python3 -m pytest scripts/explore/ -v --cov=scripts/explore

# 2. Run verification scripts
python3 scripts/explore/verify/verify_readonly.py
python3 scripts/explore/verify/verify_performance.py

# 3. Update documentation
# Review and update README.md with week's progress

# 4. Create weekly summary
git log --oneline --since="1 week ago" > .plan/week-X-summary.txt

# 5. Plan next week
# Review next week's tasks in phase-11-implementation-plan.md
```

---

## Troubleshooting

### Problem: Can't find god-learn/knowledge.jsonl

**Solution**:
```bash
# Check if Phase 6 has been run
ls -la god-learn/

# If missing, you may need to run Phase 6 first
# Or create test fixtures:
mkdir -p scripts/explore/tests/fixtures
cp god-learn/knowledge.jsonl scripts/explore/tests/fixtures/test-knowledge.jsonl
```

### Problem: Import errors

**Solution**:
```bash
# Ensure PYTHONPATH includes project root
export PYTHONPATH=/home/dalton/projects/claudeflow-testing:$PYTHONPATH

# Or add to scripts/explore/__init__.py:
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
```

### Problem: Performance issues

**Solution**:
- Check cache is working: `loader._kus should not be None` after first load
- Profile with: `python3 -m cProfile -o profile.stats script.py`
- Optimize hot paths identified in profiling

---

## Resources

### Planning Documents
- `.plan/SUMMARY.md` - Phase overview and rationale
- `.plan/phase-11-implementation-plan.md` - Detailed architecture
- `.plan/IMPLEMENTATION_ROADMAP.md` - Overall timeline

### Existing Code
- `scripts/interaction/report.py` - Phase 9A example
- `scripts/interaction/answer.py` - Phase 9B example
- `scripts/retrieval/query_chunks.py` - Phase 4 example

### External Documentation
- NetworkX: https://networkx.org/documentation/stable/
- GraphViz: https://graphviz.org/documentation/
- Cytoscape: https://js.cytoscape.org/

---

## Success Indicators

After completing Day 1, you should have:

- ✅ Planning documents reviewed
- ✅ Environment verified and dependencies installed
- ✅ Directory structure created
- ✅ Feature branch created and pushed
- ✅ `artifact_loader.py` implemented and tested
- ✅ First unit tests passing
- ✅ First commit pushed

You are now ready for Day 2: Graph Builder implementation.

---

## Next Steps

**Tomorrow (Day 2)**: Implement `graph_builder.py`
- Build graph index structures
- Implement adjacency lists (KU→RUs, RU→KUs)
- Add query/author indexes
- Write comprehensive tests

**See**: `.plan/phase-11-implementation-plan.md` Week 1, Days 3-4

---

**Questions?**
- Check `.plan/phase-11-implementation-plan.md` for details
- Review existing Phase 9 scripts for patterns
- Document blockers in `.plan/BLOCKERS.md`

Good luck! 🚀
