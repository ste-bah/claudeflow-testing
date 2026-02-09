"""Scan route stub.

Market screening and scanning based on technical/fundamental criteria.
Full implementation: TASK-API-009
"""
import logging

from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scan", tags=["scan"])


@router.post("/")
async def run_scan() -> dict:
    """Execute a market scan with given criteria.

    Stub -- returns not_implemented until TASK-API-009.
    """
    logger.info("Scan request (stub)")
    return {"status": "not_implemented", "task": "TASK-API-009"}
