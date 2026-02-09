"""Analysis route stub.

AI-driven technical and fundamental analysis for a given symbol.
Full implementation: TASK-ANALYSIS-009
"""
import logging

from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analyze", tags=["analysis"])


@router.get("/{symbol}")
async def get_analysis(symbol: str) -> dict:
    """Return AI analysis for *symbol*.

    Stub -- returns not_implemented until TASK-ANALYSIS-009.
    """
    logger.info("Analysis request for %s (stub)", symbol)
    return {"status": "not_implemented", "task": "TASK-ANALYSIS-009", "symbol": symbol}
