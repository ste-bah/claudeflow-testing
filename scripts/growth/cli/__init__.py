"""
Phase 17 CLI - Corpus Growth Command-Line Interface

Commands:
    god-grow status    - Show corpus version and stats
    god-grow snapshot  - Create versioned snapshot
    god-grow list      - List all snapshots
    god-grow verify    - Verify corpus integrity
    god-grow rollback  - Rollback to previous version
    god-grow diff      - Compare versions
    god-grow add       - Add new documents
    god-grow process   - Process new documents
    god-grow rebalance - Rebalance reasoning density
    god-grow changelog - View/export changelog
"""

from .growth_cli import main, GrowthCLI

__all__ = ["main", "GrowthCLI"]
