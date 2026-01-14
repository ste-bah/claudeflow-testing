"""
QA Reporting Module - Advanced reporting and dashboard building

Components:
- ReportGenerator: Comprehensive reports with trend analysis
- DashboardBuilder: Metrics aggregation and visualization
"""

from .report_generator import ReportGenerator, QAReportV2, TrendAnalysis, HealthScore
from .dashboard_builder import DashboardBuilder, DashboardData, MetricSummary

__all__ = [
    "ReportGenerator",
    "QAReportV2",
    "TrendAnalysis",
    "HealthScore",
    "DashboardBuilder",
    "DashboardData",
    "MetricSummary"
]
