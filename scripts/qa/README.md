# God-Learn QA Infrastructure

Phase 15 Quality Assurance infrastructure for the God-Learn corpus management system.

## Overview

The QA infrastructure provides automated detection of:
- **Coverage Regressions**: KU count drops, missing documents/authors
- **Reasoning Stability Issues**: Deleted RUs, relation changes, score drift
- **Consistency Problems**: Missing chunks, page mismatches, duplicates

## Architecture

```
scripts/qa/
├── core/                          # Core QA components
│   ├── baseline_manager.py        # Baseline CRUD operations
│   ├── regression_detector.py     # Regression detection logic
│   └── consistency_checker.py     # Consistency validation
│
├── cli/                           # Command-line tools
│   ├── qa_cli.py                  # Main CLI entry point
│   └── establish_baselines.py     # Baseline establishment
│
├── reporting/                     # Advanced reporting (Week 4)
│   ├── report_generator.py        # Reports with trend analysis
│   └── dashboard_builder.py       # Metrics dashboard
│
└── tests/                         # Unit tests
    └── test_consistency_checker.py

qa/
├── baselines/                     # Baseline snapshots
│   ├── coverage_baseline.json
│   ├── reasoning_baseline.json
│   └── metrics_baseline.json
│
└── reports/                       # Generated reports
    └── report_*.json
```

## Quick Start

### 1. Establish Baselines

Before running regression checks, establish baselines from the current corpus:

```bash
python3 scripts/qa/cli/establish_baselines.py
```

This creates snapshots in `qa/baselines/` for coverage, reasoning, and metrics.

### 2. Run QA Checks

Use the CLI to run individual or combined checks:

```bash
# Check coverage regression
python3 scripts/qa/cli/qa_cli.py check-coverage --fail-on-high

# Check reasoning stability
python3 scripts/qa/cli/qa_cli.py check-reasoning --fail-on-critical

# Check consistency (provenance, duplicates)
python3 scripts/qa/cli/qa_cli.py check-consistency --fail-on-high

# View dashboard
python3 scripts/qa/cli/qa_cli.py dashboard

# Generate comprehensive report
python3 scripts/qa/cli/qa_cli.py generate-report --output qa/reports/report.json
```

### 3. Advanced Reporting

Use the reporting module for trend analysis:

```bash
# Generate report with trends
python3 scripts/qa/reporting/report_generator.py --summary

# View dashboard with sparklines
python3 scripts/qa/reporting/dashboard_builder.py

# Compact single-line status
python3 scripts/qa/reporting/dashboard_builder.py --compact

# Growth rate analysis
python3 scripts/qa/reporting/dashboard_builder.py --growth
```

## CLI Reference

### `qa_cli.py check-coverage`

Check for coverage regressions against baseline.

**Options:**
- `--fail-on-high`: Exit code 2 if HIGH or CRITICAL severity
- `--fail-on-critical`: Exit code 2 if CRITICAL severity

**Detects:**
- KU count drops (>10% = low, >20% = high, >50% = critical)
- Missing documents from expected results
- Missing authors from expected results
- KU ID changes (informational)

### `qa_cli.py check-reasoning`

Check for reasoning stability issues against baseline.

**Options:**
- `--fail-on-high`: Exit code 2 if HIGH or CRITICAL severity
- `--fail-on-critical`: Exit code 2 if CRITICAL severity

**Detects:**
- Deleted RUs (critical - immutability violation)
- Relation changes (high - semantic drift)
- Score drift >0.3 (medium)
- Knowledge ID changes (medium)

### `qa_cli.py check-consistency`

Check for corpus consistency issues.

**Options:**
- `--fail-on-high`: Exit code 2 if HIGH or CRITICAL severity
- `--fail-on-critical`: Exit code 2 if CRITICAL severity
- `--show-low`: Include LOW severity in output

**Checks:**
- Chunk existence in ChromaDB
- Page boundary validation
- Semantic duplicate detection (threshold 0.95)
- Confidence level audit

### `qa_cli.py generate-report`

Generate comprehensive JSON report.

**Options:**
- `--output PATH`: Output file path (default: `qa/reports/report.json`)

**Includes:**
- Coverage regression results
- Reasoning stability results
- Consistency check results
- Severity summaries

### `qa_cli.py dashboard`

Display terminal UI dashboard.

**Shows:**
- KU/RU counts
- Baseline status
- Consistency summary
- Overall health status

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed |
| 1 | Warnings (MEDIUM severity) |
| 2 | Failures (HIGH/CRITICAL severity) |

## GitHub Actions Integration

The QA pipeline runs automatically on push/PR to `main`:

```yaml
# .github/workflows/god-learn-qa.yml
name: God-Learn QA
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

### CI Jobs

1. **verify-integrity**: Runs Phase 6, 7, 11 verification scripts
2. **regression-detection**: Runs QA checks with fail flags
3. **generate-report**: Auto-commits timestamped reports (main only)

### PR Blocking

Pull requests are blocked if:
- Any verification script fails
- HIGH severity issues with `--fail-on-high`
- CRITICAL severity issues with `--fail-on-critical`

## Reporting Module

### Report Generator

Advanced reports with trend analysis:

```python
from scripts.qa.reporting import ReportGenerator

generator = ReportGenerator()
report = generator.generate_report(
    include_trends=True,
    include_health=True,
    trend_days=30
)

# Save report
path = generator.save_report(report)

# Get summary
summary = generator.format_report_summary(report)
print(summary)
```

### Dashboard Builder

Real-time metrics dashboard:

```python
from scripts.qa.reporting import DashboardBuilder

builder = DashboardBuilder()

# Full dashboard
print(builder.display_dashboard())

# Compact status
print(builder.display_compact_dashboard())

# Growth rates
growth = builder.calculate_growth_rates(days=30)
print(builder.format_growth_report(growth))
```

### Health Scoring

Reports include health scores (0-100) based on:

| Factor | Weight | Description |
|--------|--------|-------------|
| Coverage | 25 pts | Regression severity |
| Reasoning | 25 pts | Stability issues |
| Consistency | 30 pts | Issue severity/count |
| Corpus Size | 10 pts | KU/RU thresholds |
| Baseline Freshness | 10 pts | Active baselines |

Grades: A (90+), B (80+), C (70+), D (60+), F (<60)

## Baseline Management

### Creating Baselines

```bash
# Full baseline establishment
python3 scripts/qa/cli/establish_baselines.py

# Individual baselines
python3 scripts/qa/cli/establish_baselines.py --coverage-only
python3 scripts/qa/cli/establish_baselines.py --reasoning-only
python3 scripts/qa/cli/establish_baselines.py --metrics-only
```

### Baseline Files

**coverage_baseline.json:**
```json
{
  "version": "1.0",
  "created": "2026-01-13T21:53:48Z",
  "queries": [
    {
      "query": "aristotle rhetoric",
      "expected_ku_count": 15,
      "expected_min_ku_count": 12,
      "expected_documents": ["Rhetoric"],
      "expected_authors": ["Aristotle"],
      "ku_ids_snapshot": ["ku_001", "ku_002", ...]
    }
  ]
}
```

**reasoning_baseline.json:**
```json
{
  "version": "1.0",
  "created": "2026-01-13T21:53:48Z",
  "reasoning_units": {
    "ru_001": {
      "relation": "supports",
      "topic": "epistemology",
      "knowledge_ids": ["ku_001", "ku_002"],
      "score": 0.847
    }
  },
  "stats": {
    "total_rus": 138,
    "relations": {"supports": 45, "contradicts": 23, ...}
  }
}
```

## Severity Levels

| Level | Description | Impact |
|-------|-------------|--------|
| CRITICAL | Immutability violations, deleted content | Blocks CI |
| HIGH | Missing documents, relation changes | Blocks CI (with flag) |
| MEDIUM | Score drift, minor inconsistencies | Warning |
| LOW | Informational changes | Logged |

## Best Practices

1. **Run baselines after corpus updates**: Re-establish baselines when adding new documents
2. **Use fail flags in CI**: `--fail-on-high` for PRs, `--fail-on-critical` for main
3. **Monitor trends**: Use dashboard to track corpus health over time
4. **Review reports**: Check generated reports in `qa/reports/` for detailed analysis
5. **Address CRITICAL immediately**: Immutability violations indicate data corruption

## Troubleshooting

### "No coverage baseline found"

Run `establish_baselines.py` to create initial baselines.

### "ChromaDB connection failed"

Ensure the embedder service is running:
```bash
python3 scripts/embedder/embedder_service.py
```

### High consistency issue count

Many LOW severity issues are normal (confidence audits). Focus on CRITICAL and HIGH severity.

### Trends showing "no data"

Generate reports regularly to build trend history:
```bash
python3 scripts/qa/reporting/report_generator.py
```

## Development

### Adding New Checks

1. Add detection logic to `regression_detector.py` or `consistency_checker.py`
2. Add CLI command in `qa_cli.py`
3. Update `report_generator.py` to include results
4. Update GitHub Actions workflow if needed

### Running Tests

```bash
pytest scripts/qa/tests/ -v
```

---

**Phase 15 Status**: Complete (Weeks 1-4)

- Week 1: Baseline Manager & Regression Detector ✅
- Week 2: Consistency Checker ✅
- Week 3: CI/CD Integration ✅
- Week 4: Reporting & Dashboard ✅
