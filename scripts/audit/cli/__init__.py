"""
Phase 16 Audit CLI - Unified command-line interface for provenance auditing.

Commands:
    god-audit chain    - Trace and validate provenance chains
    god-audit gaps     - Detect missing links and orphans
    god-audit coverage - Analyze source document coverage
    god-audit report   - Generate comprehensive audit reports
    god-audit fix      - Auto-fix common issues
    god-audit full     - Run complete audit suite

Dashboard Integration:
    god-audit dashboard - Show integrated QA + Audit dashboard

Remediation:
    god-audit remediate - Auto-fix common provenance issues
"""

from .audit_cli import main, AuditCLI
from .remediation import RemediationEngine, Fix, FixType, FixStatus, RemediationReport
from .dashboard_integration import (
    AuditDashboardIntegration,
    AuditMetrics,
    IntegratedDashboard
)

__all__ = [
    # Main CLI
    "main",
    "AuditCLI",

    # Remediation
    "RemediationEngine",
    "Fix",
    "FixType",
    "FixStatus",
    "RemediationReport",

    # Dashboard Integration
    "AuditDashboardIntegration",
    "AuditMetrics",
    "IntegratedDashboard"
]
