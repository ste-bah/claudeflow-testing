"""
Phase 17 Integration Tests - Corpus Growth & Rebalancing

Run with: python -m scripts.growth.tests.test_phase17
"""

import sys
import json
import tempfile
import shutil
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


class TestResult:
    """Result of a single test."""
    def __init__(self, name: str, passed: bool, message: str = "", duration: float = 0):
        self.name = name
        self.passed = passed
        self.message = message
        self.duration = duration


class Phase17TestSuite:
    """Comprehensive test suite for Phase 17."""

    def __init__(self):
        self.results: List[TestResult] = []
        self.temp_dir: Path = None

    def setup(self):
        """Set up test environment."""
        self.temp_dir = Path(tempfile.mkdtemp(prefix="phase17_test_"))

        # Create minimal corpus structure
        corpus_dir = self.temp_dir / "corpus" / "test_domain"
        corpus_dir.mkdir(parents=True)

        # Create dummy PDF files (empty for testing)
        for i in range(3):
            pdf_path = corpus_dir / f"test_doc_{i}.pdf"
            pdf_path.write_bytes(b"%PDF-1.4\n" + bytes([i] * 100))

        # Create god-learn directory
        god_learn_dir = self.temp_dir / "god-learn"
        god_learn_dir.mkdir(parents=True)

        # Create sample knowledge.jsonl
        knowledge_file = god_learn_dir / "knowledge.jsonl"
        kus = [
            {
                "id": f"ku-{i}",
                "claim": f"Test knowledge unit {i}",
                "sources": [{"source": f"test_domain/test_doc_{i % 3}.pdf", "page": i}],
                "confidence": 0.7 + (i * 0.05),
                "tags": ["test_domain"]
            }
            for i in range(10)
        ]
        with open(knowledge_file, "w") as f:
            for ku in kus:
                f.write(json.dumps(ku) + "\n")

    def teardown(self):
        """Clean up test environment."""
        if self.temp_dir and self.temp_dir.exists():
            shutil.rmtree(self.temp_dir)

    def run_test(self, name: str, test_func):
        """Run a single test and record result."""
        start = datetime.now()
        try:
            test_func()
            duration = (datetime.now() - start).total_seconds()
            self.results.append(TestResult(name, True, "PASSED", duration))
            print(f"  ✓ {name}")
        except AssertionError as e:
            duration = (datetime.now() - start).total_seconds()
            self.results.append(TestResult(name, False, str(e), duration))
            print(f"  ✗ {name}: {e}")
        except Exception as e:
            duration = (datetime.now() - start).total_seconds()
            self.results.append(TestResult(name, False, f"ERROR: {e}", duration))
            print(f"  ✗ {name}: ERROR - {e}")

    # =========================================================================
    # Week 1-2: Versioning Tests
    # =========================================================================

    def test_corpus_version_manager_init(self):
        """Test CorpusVersionManager initialization."""
        from scripts.growth.core import CorpusVersionManager

        manager = CorpusVersionManager(self.temp_dir)
        assert manager.current_version is not None
        assert manager.current_version.major == 1

    def test_create_snapshot(self):
        """Test snapshot creation."""
        from scripts.growth.core import CorpusVersionManager

        manager = CorpusVersionManager(self.temp_dir)
        snapshot = manager.create_snapshot("Test snapshot", "patch")

        assert snapshot is not None
        assert "snapshot-" in snapshot.snapshot_id
        assert snapshot.description == "Test snapshot"
        assert len(snapshot.document_hashes) == 3

    def test_list_snapshots(self):
        """Test snapshot listing."""
        from scripts.growth.core import CorpusVersionManager

        manager = CorpusVersionManager(self.temp_dir)
        manager.create_snapshot("Snapshot 1")
        manager.create_snapshot("Snapshot 2")

        snapshots = manager.list_snapshots()
        assert len(snapshots) >= 2

    def test_verify_integrity(self):
        """Test integrity verification."""
        from scripts.growth.core import CorpusVersionManager

        manager = CorpusVersionManager(self.temp_dir)
        snapshot = manager.create_snapshot("Test snapshot")

        result = manager.verify_integrity(snapshot)
        assert result["verified"] == True

    def test_changelog_operations(self):
        """Test changelog recording and retrieval."""
        from scripts.growth.core import CorpusChangelog, ChangeType

        changelog = CorpusChangelog(self.temp_dir)

        # Record entry
        entry = changelog.record_document_add(
            "test/doc.pdf",
            "Added test document"
        )

        assert entry is not None
        assert entry.change_type == ChangeType.ADD_DOCUMENT

        # Retrieve entries
        entries = changelog.get_entries()
        assert len(entries) >= 1

    # =========================================================================
    # Week 3-4: Reprocessing Tests
    # =========================================================================

    def test_document_tracker_init(self):
        """Test DocumentTracker initialization."""
        from scripts.growth.core import DocumentTracker

        tracker = DocumentTracker(self.temp_dir)
        summary = tracker.get_summary()

        assert "total_tracked" in summary
        assert "status_counts" in summary

    def test_document_tracker_scan(self):
        """Test corpus scanning."""
        from scripts.growth.core import DocumentTracker

        tracker = DocumentTracker(self.temp_dir)
        result = tracker.scan_corpus()

        assert "documents" in result
        assert result["documents"] == 3

    def test_document_tracker_change_detection(self):
        """Test change detection."""
        from scripts.growth.core import DocumentTracker, CorpusVersionManager

        manager = CorpusVersionManager(self.temp_dir)
        snapshot = manager.create_snapshot("Baseline")

        tracker = DocumentTracker(self.temp_dir)
        tracker.clear_state()
        changes = tracker.detect_changes(snapshot.document_hashes)

        assert "unchanged" in changes
        assert len(changes["unchanged"]) == 3

    def test_incremental_processor_dry_run(self):
        """Test incremental processor dry run."""
        from scripts.growth.core import IncrementalProcessor, ProcessingMode

        processor = IncrementalProcessor(self.temp_dir)
        result = processor.dry_run(mode=ProcessingMode.ALL_CHANGED)

        assert "would_process" in result
        assert "mode" in result

    def test_merge_strategy_stats(self):
        """Test merge strategy statistics."""
        from scripts.growth.core import MergeStrategy

        strategy = MergeStrategy(self.temp_dir)
        stats = strategy.get_merge_stats()

        assert "total_kus" in stats
        assert stats["total_kus"] == 10

    def test_merge_strategy_duplicate_check(self):
        """Test duplicate checking."""
        from scripts.growth.core import MergeStrategy, KnowledgeUnit

        strategy = MergeStrategy(self.temp_dir)

        # Create a test KU
        ku = KnowledgeUnit(
            ku_id="test-ku",
            content="Unique test content",
            source_path="test.pdf"
        )

        is_dup, existing_id = strategy.is_duplicate(ku)
        assert is_dup == False

    # =========================================================================
    # Week 5: Skew Detection Tests
    # =========================================================================

    def test_density_analyzer_domains(self):
        """Test domain analysis."""
        from scripts.growth.core import DensityAnalyzer

        analyzer = DensityAnalyzer(self.temp_dir)
        domains = analyzer.analyze_domains()

        assert len(domains) >= 1
        assert domains[0].ku_count == 10

    def test_density_analyzer_sources(self):
        """Test source analysis."""
        from scripts.growth.core import DensityAnalyzer

        analyzer = DensityAnalyzer(self.temp_dir)
        sources = analyzer.analyze_sources()

        assert len(sources) >= 1

    def test_density_analyzer_full_report(self):
        """Test full density report."""
        from scripts.growth.core import DensityAnalyzer

        analyzer = DensityAnalyzer(self.temp_dir)
        report = analyzer.analyze()

        assert report.total_kus == 10
        assert report.total_sources >= 1
        assert len(report.domains) >= 1

    def test_skew_detector_health(self):
        """Test skew detection and health scoring."""
        from scripts.growth.core import SkewDetector

        detector = SkewDetector(self.temp_dir)
        report = detector.detect_all()

        assert report.health_score >= 0
        assert report.health_score <= 100

    def test_skew_detector_summary(self):
        """Test skew detector summary."""
        from scripts.growth.core import SkewDetector

        detector = SkewDetector(self.temp_dir)
        summary = detector.get_summary()

        assert "health_score" in summary
        assert "needs_attention" in summary

    def test_calibration_tools_init(self):
        """Test calibration tools initialization."""
        from scripts.growth.core import CalibrationTools

        calibration = CalibrationTools(self.temp_dir)
        status = calibration.get_status()

        assert "corpus_health" in status
        assert "domain_weights" in status

    def test_calibration_domain_weights(self):
        """Test domain weight management."""
        from scripts.growth.core import CalibrationTools

        calibration = CalibrationTools(self.temp_dir)

        # Set weight
        calibration.set_domain_weight("test_domain", 1.5, "Test boost")

        # Get weight
        weights = calibration.get_domain_weights()
        assert weights.get("test_domain") == 1.5

        # Reset
        calibration.reset_domain_weight("test_domain")
        weights = calibration.get_domain_weights()
        assert "test_domain" not in weights

    def test_calibration_auto_plan(self):
        """Test auto-calibration plan generation."""
        from scripts.growth.core import CalibrationTools

        calibration = CalibrationTools(self.temp_dir)
        plan = calibration.generate_plan()

        assert plan is not None
        assert plan.skew_report is not None
        assert plan.auto_generated == True

    # =========================================================================
    # CLI Tests
    # =========================================================================

    def test_cli_status(self):
        """Test CLI status command."""
        from scripts.growth.cli import GrowthCLI
        from argparse import Namespace

        cli = GrowthCLI(self.temp_dir)
        args = Namespace()

        result = cli.cmd_status(args)
        assert result == 0

    def test_cli_snapshot(self):
        """Test CLI snapshot command."""
        from scripts.growth.cli import GrowthCLI
        from argparse import Namespace

        cli = GrowthCLI(self.temp_dir)
        args = Namespace(
            description="Test snapshot",
            bump="patch",
            no_artifacts=True
        )

        result = cli.cmd_snapshot(args)
        assert result == 0

    # =========================================================================
    # Run All Tests
    # =========================================================================

    def run_all(self):
        """Run all tests."""
        print("\n" + "=" * 60)
        print("PHASE 17 TEST SUITE")
        print("=" * 60)

        self.setup()

        try:
            # Week 1-2: Versioning
            print("\n--- Week 1-2: Versioning Tests ---")
            self.run_test("CorpusVersionManager Init", self.test_corpus_version_manager_init)
            self.run_test("Create Snapshot", self.test_create_snapshot)
            self.run_test("List Snapshots", self.test_list_snapshots)
            self.run_test("Verify Integrity", self.test_verify_integrity)
            self.run_test("Changelog Operations", self.test_changelog_operations)

            # Week 3-4: Reprocessing
            print("\n--- Week 3-4: Reprocessing Tests ---")
            self.run_test("DocumentTracker Init", self.test_document_tracker_init)
            self.run_test("DocumentTracker Scan", self.test_document_tracker_scan)
            self.run_test("Change Detection", self.test_document_tracker_change_detection)
            self.run_test("Incremental Processor Dry Run", self.test_incremental_processor_dry_run)
            self.run_test("Merge Strategy Stats", self.test_merge_strategy_stats)
            self.run_test("Duplicate Check", self.test_merge_strategy_duplicate_check)

            # Week 5: Skew Detection
            print("\n--- Week 5: Skew Detection Tests ---")
            self.run_test("Density Analyzer Domains", self.test_density_analyzer_domains)
            self.run_test("Density Analyzer Sources", self.test_density_analyzer_sources)
            self.run_test("Density Full Report", self.test_density_analyzer_full_report)
            self.run_test("Skew Detector Health", self.test_skew_detector_health)
            self.run_test("Skew Detector Summary", self.test_skew_detector_summary)
            self.run_test("Calibration Tools Init", self.test_calibration_tools_init)
            self.run_test("Domain Weights", self.test_calibration_domain_weights)
            self.run_test("Auto Calibration Plan", self.test_calibration_auto_plan)

            # CLI Tests
            print("\n--- CLI Tests ---")
            self.run_test("CLI Status", self.test_cli_status)
            self.run_test("CLI Snapshot", self.test_cli_snapshot)

        finally:
            self.teardown()

        # Summary
        passed = sum(1 for r in self.results if r.passed)
        failed = sum(1 for r in self.results if not r.passed)

        print("\n" + "=" * 60)
        print(f"RESULTS: {passed} passed, {failed} failed")
        print("=" * 60)

        if failed > 0:
            print("\nFailed Tests:")
            for r in self.results:
                if not r.passed:
                    print(f"  - {r.name}: {r.message}")

        return failed == 0


def main():
    """Run test suite."""
    suite = Phase17TestSuite()
    success = suite.run_all()
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
