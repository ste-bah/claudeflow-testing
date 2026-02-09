"""Query route stub.

Natural-language query interface powered by the God Agent orchestrator.
Full implementation: TASK-GOD-005
"""
import logging

from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/query", tags=["query"])


@router.post("/")
async def post_query() -> dict:
    """Process a natural-language query.

    Stub -- returns not_implemented until TASK-GOD-005.
    """
    logger.info("Query POST request (stub)")
    return {"status": "not_implemented", "task": "TASK-GOD-005"}
