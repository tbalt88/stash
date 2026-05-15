"""Product Stashes: publishable subsets of a workspace."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse

from ..auth import get_current_user, get_current_user_optional
from ..config import settings
from ..models import (
    AddExternalStashRequest,
    StashCreateRequest,
    StashPublicResponse,
    StashResponse,
    StashUpdateRequest,
)
from ..services import permission_service, stash_service, workspace_service

ws_router = APIRouter(prefix="/api/v1/workspaces", tags=["stashes"])
public_router = APIRouter(prefix="/api/v1/stashes", tags=["stashes"])

async def _require_can_share_item(workspace_id: UUID, item, user_id: UUID) -> None:
    item_workspace_id = await permission_service.resolve_workspace_id(
        item.object_type, item.object_id
    )
    if item_workspace_id != workspace_id:
        raise HTTPException(status_code=400, detail="Stash items must be in the workspace")

    can_read = await permission_service.check_access(
        item.object_type,
        item.object_id,
        user_id,
        workspace_id=workspace_id,
        require_write=False,
    )
    if not can_read:
        raise HTTPException(status_code=403, detail="Not allowed to share one or more items")


@ws_router.post("/{workspace_id}/stashes", response_model=StashResponse, status_code=201)
async def create_stash(
    workspace_id: UUID,
    req: StashCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    if not await workspace_service.is_member(workspace_id, current_user["id"]):
        raise HTTPException(status_code=403, detail="Not a workspace member")
    if req.discoverable and req.access != "public":
        raise HTTPException(status_code=400, detail="Discover Stashes must be public")
    for item in req.items:
        await _require_can_share_item(workspace_id, item, current_user["id"])
    try:
        stash = await stash_service.create_stash(
            workspace_id=workspace_id,
            owner_id=current_user["id"],
            title=req.title,
            description=req.description,
            access=req.access,
            discoverable=req.discoverable,
            cover_image_url=req.cover_image_url,
            items=req.items,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return StashResponse(**stash)


@ws_router.post("/{workspace_id}/stashes/publish", status_code=201)
async def publish_stash(
    workspace_id: UUID,
    req: StashCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a public Stash and return its shareable URL."""
    if not await workspace_service.is_member(workspace_id, current_user["id"]):
        raise HTTPException(status_code=403, detail="Not a workspace member")
    if not req.items:
        raise HTTPException(status_code=400, detail="A shared bundle needs at least one item")

    for item in req.items:
        await _require_can_share_item(workspace_id, item, current_user["id"])

    try:
        stash = await stash_service.create_stash(
            workspace_id=workspace_id,
            owner_id=current_user["id"],
            title=req.title,
            description=req.description,
            access="public",
            discoverable=req.discoverable,
            cover_image_url=req.cover_image_url,
            items=req.items,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    base = settings.PUBLIC_URL.rstrip("/")
    return {
        "stash": StashResponse(**stash),
        "url": f"{base}/stashes/{stash['slug']}",
        "stash_id": stash["id"],
        "stash_slug": stash["slug"],
    }


@ws_router.get("/{workspace_id}/stashes")
async def list_stashes(
    workspace_id: UUID,
    current_user: dict = Depends(get_current_user),
):
    if not await workspace_service.is_member(workspace_id, current_user["id"]):
        raise HTTPException(status_code=403, detail="Not a workspace member")
    stashes = await stash_service.list_workspace_stashes(workspace_id)
    return {"stashes": [StashResponse(**stash) for stash in stashes]}


@ws_router.delete("/{workspace_id}/external-stashes/{stash_id}", status_code=204)
async def remove_external_stash(
    workspace_id: UUID,
    stash_id: UUID,
    current_user: dict = Depends(get_current_user),
):
    if not await workspace_service.is_member(workspace_id, current_user["id"]):
        raise HTTPException(status_code=403, detail="Not a workspace member")
    deleted = await stash_service.remove_external_stash(workspace_id, stash_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="External Stash not found")


@ws_router.get("/{workspace_id}/stashes/objects/{object_type}/{object_id}")
async def list_object_stashes(
    workspace_id: UUID,
    object_type: str,
    object_id: UUID,
    current_user: dict = Depends(get_current_user),
):
    if object_type not in {"folder", "page", "table", "file", "history", "session"}:
        raise HTTPException(status_code=400, detail="Unsupported Stash item type")
    if not await workspace_service.is_member(workspace_id, current_user["id"]):
        raise HTTPException(status_code=403, detail="Not a workspace member")
    item_workspace_id = await permission_service.resolve_workspace_id(object_type, object_id)
    if item_workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Object not found")
    stashes = await stash_service.list_object_stashes(workspace_id, object_type, object_id)
    return {"stashes": [StashResponse(**stash) for stash in stashes]}


@public_router.patch("/{stash_id}", response_model=StashResponse)
async def update_stash(
    stash_id: UUID,
    req: StashUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    if not await stash_service.user_can_manage(stash_id, current_user["id"]):
        raise HTTPException(status_code=403, detail="Not allowed to manage this stash")
    try:
        stash = await stash_service.update_stash(
            stash_id,
            current_user["id"],
            title=req.title,
            description=req.description,
            access=req.access,
            discoverable=req.discoverable,
            cover_image_url=req.cover_image_url,
            items=req.items,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not stash:
        raise HTTPException(status_code=404, detail="Stash not found")
    return StashResponse(**stash)


@public_router.delete("/{stash_id}", status_code=204)
async def delete_stash(
    stash_id: UUID,
    current_user: dict = Depends(get_current_user),
):
    if not await stash_service.user_can_manage(stash_id, current_user["id"]):
        raise HTTPException(status_code=403, detail="Not allowed to manage this stash")
    deleted = await stash_service.delete_stash(stash_id, current_user["id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Stash not found")


@public_router.get("/{slug}")
async def get_public_stash(
    slug: str,
    format: str = Query(None, alias="format"),
    current_user: dict | None = Depends(get_current_user_optional),
):
    viewer_id = current_user["id"] if current_user else None
    stash = await stash_service.get_public_stash(slug, viewer_id=viewer_id)
    if not stash:
        raise HTTPException(status_code=404, detail="Stash not found")
    items = await stash_service.inline_items(stash, viewer_id=viewer_id)

    if format == "text":
        return PlainTextResponse(
            stash_service.items_to_text(stash["title"], items),
            media_type="text/markdown",
        )

    workspace_name = stash.pop("_workspace_name", "")
    return StashPublicResponse(
        stash=StashResponse(**stash),
        workspace_name=workspace_name,
        items=items,
    )


@public_router.post("/{slug}/add-to-workspace", response_model=StashResponse, status_code=201)
async def add_stash_to_workspace(
    slug: str,
    req: AddExternalStashRequest,
    current_user: dict = Depends(get_current_user),
):
    if not await workspace_service.is_member(req.workspace_id, current_user["id"]):
        raise HTTPException(status_code=403, detail="Not a workspace member")
    stash = await stash_service.add_external_stash(req.workspace_id, slug, current_user["id"])
    if not stash:
        raise HTTPException(status_code=404, detail="Stash not found")
    return StashResponse(**stash)
