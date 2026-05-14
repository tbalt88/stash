"""Public catalog of Product Stashes — no auth required."""

from fastapi import APIRouter, Query

from ..services import stash_service

router = APIRouter(prefix="/api/v1/discover", tags=["discover"])


@router.get("/stashes")
async def list_public_stashes(
    q: str | None = Query(None, max_length=128),
    sort: str = Query("trending", pattern="^(trending|newest|popular)$"),
    limit: int = Query(48, ge=1, le=100),
):
    """All Stashes whose every item is publicly readable."""
    items = await stash_service.list_public_stashes(query=q, sort=sort, limit=limit)
    return {"stashes": items}
