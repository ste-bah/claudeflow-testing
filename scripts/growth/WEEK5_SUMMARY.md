# Phase 17 Week 5: Skew Detection & Calibration

## Overview

Week 5 implements the skew detection and calibration infrastructure:
- Density analysis with domain and source metrics
- Statistical skew detection with health scoring
- Manual calibration tools with auto-calibration
- CLI integration for analysis and rebalancing

## Components Created

### Core Modules (`scripts/growth/core/`)

#### 1. DensityAnalyzer (`density_analyzer.py`)
Analyzes reasoning density metrics across the knowledge base.

**Key Classes:**
- `DomainMetrics`: Metrics for a domain (ku_count, density_score, quality_score)
- `SourceMetrics`: Metrics for a source document (density, coverage)
- `DensityReport`: Complete analysis report
- `DensityAnalyzer`: Main analyzer class

**Key Methods:**
```python
analyzer = DensityAnalyzer()

# Analyze domains
domain_metrics = analyzer.analyze_domains()

# Analyze sources
source_metrics = analyzer.analyze_sources()

# Full analysis
report = analyzer.analyze()

# Export report
path = analyzer.export_report("density_report.json")
```

#### 2. SkewDetector (`skew_detector.py`)
Detects knowledge distribution imbalances.

**Key Classes:**
- `SkewType`: Enum (DOMAIN_IMBALANCE, DENSITY_VARIANCE, COVERAGE_GAP, QUALITY_DRIFT)
- `SkewSeverity`: Enum (CRITICAL, HIGH, MEDIUM, LOW)
- `SkewAlert`: Alert with recommendations
- `SkewReport`: Complete detection report
- `SkewDetector`: Main detector class

**Key Methods:**
```python
detector = SkewDetector()

# Detect all issues
report = detector.detect_all()

# Get quick summary
summary = detector.get_summary()

# Calculate health score
health = detector.calculate_health_score(alerts)

# Save/load alerts
detector.save_alerts(report)
```

**Detection Algorithms:**
- Domain imbalance: Gini coefficient, entropy, size ratios
- Density variance: Coefficient of variation
- Coverage gaps: Low-coverage source detection
- Quality drift: Confidence threshold checking

#### 3. CalibrationTools (`calibration.py`)
Manual and automatic calibration for corpus rebalancing.

**Key Classes:**
- `CalibrationAction`: Enum (BOOST_DOMAIN, SUPPRESS_DOMAIN, PRIORITIZE_SOURCE, etc.)
- `CalibrationRule`: A rule to apply
- `CalibrationPlan`: Collection of rules with skew report
- `CalibrationTools`: Main tools class

**Key Methods:**
```python
calibration = CalibrationTools()

# Domain weights
calibration.set_domain_weight("philosophy", 1.5, "Boost underrepresented")
weights = calibration.get_effective_weights()

# Source priorities
calibration.set_source_priority("/path/to/doc.pdf", 10)
queue = calibration.get_priority_queue()

# KU adjustments
calibration.adjust_ku_confidence("ku-123", 0.1, "High quality")
calibration.archive_ku("ku-456", "Duplicate")

# Auto-calibration
plan = calibration.generate_plan()
result = calibration.execute_plan(plan, dry_run=True)

# History
history = calibration.get_history(limit=10)
```

## CLI Commands

### Rebalance Command
```bash
# Show rebalance status
god-grow rebalance

# Full density analysis
god-grow rebalance --analyze

# Detect skew issues
god-grow rebalance --detect

# Auto-calibrate (preview)
god-grow rebalance --calibrate --dry-run

# Apply calibration
god-grow rebalance --calibrate
```

## Health Scoring

```
Health Score = 100 - Σ(penalties)

Penalties:
- Critical alert: -25 points
- High alert:     -15 points
- Medium alert:   -8 points
- Low alert:      -3 points
```

## Detection Flow

```
┌─────────────────┐
│ knowledge.jsonl │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ DensityAnalyzer │
│ - domains       │
│ - sources       │
│ - metrics       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SkewDetector    │
│ - imbalances    │
│ - gaps          │
│ - quality       │
│ - health score  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ CalibrationTools│
│ - auto-plan     │
│ - manual adjust │
│ - execute       │
└─────────────────┘
```

## Testing Results

```
$ python -m scripts.growth.cli.growth_cli rebalance --analyze
============================================================
DENSITY ANALYSIS
============================================================

Summary:
  Total KUs: 45
  Total Sources: 1
  Average Density: 45.000 KUs/page
  Average Quality: 22.500

Domain Distribution:
  unknown                 45 (100.0%) ████████████████████
    Density: 45.000, Quality: 22.500, Sources: 1

$ python -m scripts.growth.cli.growth_cli rebalance --detect
============================================================
SKEW DETECTION
============================================================

Corpus Health Score: 100.0/100
Total Alerts: 0
```

## Files Created

| File | Lines | Description |
|------|-------|-------------|
| `core/density_analyzer.py` | ~400 | Density analysis and metrics |
| `core/skew_detector.py` | ~380 | Skew detection with health scoring |
| `core/calibration.py` | ~380 | Manual and auto-calibration tools |

**Week 5 Total: ~1,160 lines of code**
**Cumulative Phase 17: ~4,115 lines of code**

## Next Steps (Week 6)

Week 6 will complete Phase 17 with:
- Comprehensive test suite
- Integration validation
- Documentation
- Phase summary and review
