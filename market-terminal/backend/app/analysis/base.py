"""Base methodology interface for the analysis engine.

Defines the abstract base class and shared data structures used by all
six methodology modules (Wyckoff, Elliott Wave, ICT Smart Money, CANSLIM,
Larry Williams, Sentiment) and the composite signal aggregator.

Full implementation: TASK-ANALYSIS-001
"""

from __future__ import annotations

import math
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any

import pandas as pd

# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class Direction(str, Enum):
    """Signal direction for an individual methodology."""

    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"


class Timeframe(str, Enum):
    """Analysis timeframe horizon."""

    SHORT = "short"  # Days
    MEDIUM = "medium"  # Weeks
    LONG = "long"  # Months


class OverallDirection(str, Enum):
    """Composite signal direction (includes strong variants)."""

    STRONG_BULLISH = "strong_bullish"
    BULLISH = "bullish"
    NEUTRAL = "neutral"
    BEARISH = "bearish"
    STRONG_BEARISH = "strong_bearish"


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

METHODOLOGY_NAMES: list[str] = [
    "wyckoff",
    "elliott_wave",
    "ict_smart_money",
    "canslim",
    "larry_williams",
    "sentiment",
]

DEFAULT_WEIGHTS: dict[str, float] = {
    "wyckoff": 0.20,
    "elliott_wave": 0.15,
    "ict_smart_money": 0.20,
    "canslim": 0.20,
    "larry_williams": 0.10,
    "sentiment": 0.15,
}

_MIN_ROWS = 20
_PRICE_COLUMNS = {"date", "open", "high", "low", "close"}
_VOLUME_COLUMNS = {"date", "volume"}


# ---------------------------------------------------------------------------
# MethodologySignal
# ---------------------------------------------------------------------------


@dataclass
class MethodologySignal:
    """Output of a single methodology analysis run."""

    ticker: str
    methodology: str
    direction: str
    confidence: float
    timeframe: str
    reasoning: str
    key_levels: dict[str, Any]
    timestamp: datetime

    def __post_init__(self) -> None:
        # ticker
        if not isinstance(self.ticker, str):
            raise TypeError("ticker must be a string")

        # timestamp
        if not isinstance(self.timestamp, datetime):
            raise TypeError("timestamp must be a datetime")

        # direction
        valid_directions = {d.value for d in Direction}
        if self.direction not in valid_directions:
            raise ValueError(
                f"direction must be one of {sorted(valid_directions)}"
            )

        # confidence — clamp to [0.0, 1.0], reject NaN/Inf
        if isinstance(self.confidence, bool) or not isinstance(self.confidence, (int, float)):
            raise TypeError("confidence must be a finite number")
        if math.isnan(self.confidence) or math.isinf(self.confidence):
            raise ValueError("confidence must be a finite number")
        self.confidence = max(0.0, min(1.0, float(self.confidence)))

        # timeframe
        valid_timeframes = {t.value for t in Timeframe}
        if self.timeframe not in valid_timeframes:
            raise ValueError(
                f"timeframe must be one of {sorted(valid_timeframes)}"
            )

        # methodology
        if self.methodology not in METHODOLOGY_NAMES:
            raise ValueError(
                f"methodology must be one of {METHODOLOGY_NAMES}"
            )

        # reasoning
        if not isinstance(self.reasoning, str) or not self.reasoning.strip():
            raise ValueError("reasoning must be a non-empty string")

        # key_levels
        if not isinstance(self.key_levels, dict):
            raise TypeError("key_levels must be a dict")

    # -- serialization ------------------------------------------------------

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable dict representation."""
        return {
            "ticker": self.ticker,
            "methodology": self.methodology,
            "direction": self.direction,
            "confidence": self.confidence,
            "timeframe": self.timeframe,
            "reasoning": self.reasoning,
            "key_levels": self.key_levels,
            "timestamp": self.timestamp.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> MethodologySignal:
        """Reconstruct a ``MethodologySignal`` from a dict (e.g. cached JSON)."""
        ts = data["timestamp"]
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts)
        return cls(
            ticker=data["ticker"],
            methodology=data["methodology"],
            direction=data["direction"],
            confidence=data["confidence"],
            timeframe=data["timeframe"],
            reasoning=data["reasoning"],
            key_levels=data["key_levels"],
            timestamp=ts,
        )


# ---------------------------------------------------------------------------
# CompositeSignal
# ---------------------------------------------------------------------------


@dataclass
class CompositeSignal:
    """Aggregated multi-methodology analysis result."""

    ticker: str
    overall_direction: str
    overall_confidence: float
    methodology_signals: list[MethodologySignal]
    confluence_count: int
    timeframe_breakdown: dict[str, Any]
    trade_thesis: str
    timestamp: datetime
    weights_used: dict[str, float]

    def __post_init__(self) -> None:
        # ticker
        if not isinstance(self.ticker, str):
            raise TypeError("ticker must be a string")

        # timestamp
        if not isinstance(self.timestamp, datetime):
            raise TypeError("timestamp must be a datetime")

        # overall_direction
        valid_directions = {d.value for d in OverallDirection}
        if self.overall_direction not in valid_directions:
            raise ValueError(
                f"overall_direction must be one of {sorted(valid_directions)}"
            )

        # overall_confidence — clamp to [0.0, 1.0], reject NaN/Inf
        if isinstance(self.overall_confidence, bool) or not isinstance(self.overall_confidence, (int, float)):
            raise TypeError("overall_confidence must be a finite number")
        if math.isnan(self.overall_confidence) or math.isinf(self.overall_confidence):
            raise ValueError("overall_confidence must be a finite number")
        self.overall_confidence = max(0.0, min(1.0, float(self.overall_confidence)))

        # methodology_signals
        if not isinstance(self.methodology_signals, list):
            raise TypeError("methodology_signals must be a list")

        # confluence_count
        if isinstance(self.confluence_count, bool) or not isinstance(self.confluence_count, int) or self.confluence_count < 0:
            raise ValueError("confluence_count must be a non-negative integer")

    # -- serialization ------------------------------------------------------

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable dict representation."""
        return {
            "ticker": self.ticker,
            "overall_direction": self.overall_direction,
            "overall_confidence": self.overall_confidence,
            "methodology_signals": [s.to_dict() for s in self.methodology_signals],
            "confluence_count": self.confluence_count,
            "timeframe_breakdown": self.timeframe_breakdown,
            "trade_thesis": self.trade_thesis,
            "timestamp": self.timestamp.isoformat(),
            "weights_used": self.weights_used,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> CompositeSignal:
        """Reconstruct a ``CompositeSignal`` from a dict (e.g. cached JSON)."""
        ts = data["timestamp"]
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts)
        signals = [
            MethodologySignal.from_dict(s) for s in data.get("methodology_signals", [])
        ]
        return cls(
            ticker=data["ticker"],
            overall_direction=data["overall_direction"],
            overall_confidence=data["overall_confidence"],
            methodology_signals=signals,
            confluence_count=data["confluence_count"],
            timeframe_breakdown=data["timeframe_breakdown"],
            trade_thesis=data["trade_thesis"],
            timestamp=ts,
            weights_used=data["weights_used"],
        )


# ---------------------------------------------------------------------------
# BaseMethodology (ABC)
# ---------------------------------------------------------------------------


class BaseMethodology(ABC):
    """Abstract base class for all methodology analysis modules.

    Subclasses must implement :meth:`analyze` and set the four class
    attributes (``name``, ``display_name``, ``default_timeframe``,
    ``version``).
    """

    name: str
    display_name: str
    default_timeframe: str
    version: str

    @abstractmethod
    async def analyze(
        self,
        ticker: str,
        price_data: pd.DataFrame,
        volume_data: pd.DataFrame,
        fundamentals: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> MethodologySignal:
        """Run methodology analysis and return a signal.

        Args:
            ticker: Stock/ETF symbol.
            price_data: DataFrame with columns [date, open, high, low, close].
            volume_data: DataFrame with columns [date, volume].
            fundamentals: Optional fundamental data (required by CANSLIM).
            **kwargs: Methodology-specific additional data.

        Returns:
            A :class:`MethodologySignal` with analysis results.
        """

    def validate_input(
        self,
        price_data: pd.DataFrame,
        volume_data: pd.DataFrame,
    ) -> None:
        """Validate that input DataFrames have required columns and data.

        Raises:
            ValueError: If validation fails, with a descriptive message.
        """
        # --- price_data checks ---
        if not isinstance(price_data, pd.DataFrame):
            raise ValueError("price_data must be a pandas DataFrame")

        missing_price = _PRICE_COLUMNS - set(price_data.columns)
        if missing_price:
            raise ValueError(
                f"price_data missing required columns: {sorted(missing_price)}"
            )

        if len(price_data) < _MIN_ROWS:
            raise ValueError(
                f"price_data must have at least {_MIN_ROWS} rows, "
                f"got {len(price_data)}"
            )

        ohlc = ["open", "high", "low", "close"]
        for col in ohlc:
            if price_data[col].isna().any():
                raise ValueError(f"price_data column '{col}' contains NaN values")

        # date sorted ascending
        dates = price_data["date"]
        if not dates.is_monotonic_increasing:
            raise ValueError("price_data 'date' column must be sorted ascending")

        # --- volume_data checks ---
        if not isinstance(volume_data, pd.DataFrame):
            raise ValueError("volume_data must be a pandas DataFrame")

        missing_volume = _VOLUME_COLUMNS - set(volume_data.columns)
        if missing_volume:
            raise ValueError(
                f"volume_data missing required columns: {sorted(missing_volume)}"
            )

        if len(volume_data) < _MIN_ROWS:
            raise ValueError(
                f"volume_data must have at least {_MIN_ROWS} rows, "
                f"got {len(volume_data)}"
            )

        vol_dates = volume_data["date"]
        if not vol_dates.is_monotonic_increasing:
            raise ValueError("volume_data 'date' column must be sorted ascending")

    def create_signal(
        self,
        ticker: str,
        direction: str,
        confidence: float,
        timeframe: str,
        reasoning: str,
        key_levels: dict[str, Any],
    ) -> MethodologySignal:
        """Convenience factory for creating a signal pre-filled with metadata.

        Automatically sets ``methodology`` to ``self.name`` and ``timestamp``
        to the current UTC time.
        """
        return MethodologySignal(
            ticker=ticker,
            methodology=self.name,
            direction=direction,
            confidence=confidence,
            timeframe=timeframe,
            reasoning=reasoning,
            key_levels=key_levels,
            timestamp=datetime.now(tz=timezone.utc),
        )
