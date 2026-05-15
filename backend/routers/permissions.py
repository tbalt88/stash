"""Share-link endpoints for workspace content."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from ..auth import get_current_user
from ..config import settings
from ..models import (
    PermissionResponse,
    SetVisibilityRequest,
    ShareLinkResponse,
    ShareRequest,
    ShareResponse,
    StashItem,
)
from ..services import permission_service, stash_service

router = APIRouter(prefix="/api/v1/objects", tags=["permissions"])


_SHAREABLE = {"folder", "page", "session", "table", "file", "history", "stash"}


async def _require_can_share(object_type: str, object_id: UUID, user_id: UUID) -> None:
    """Caller can share this object if they can read it.

    Per project intent: read access implies share. Edit access implies share + edit.
    Owner-only gates (members, delete, transfer) live elsewhere."""
    if object_type not in _SHAREABLE:
        raise HTTPException(status_code=400, detail=f"Unsupported object_type: {object_type}")

    workspace_id = await permission_service.resolve_workspace_id(object_type, object_id)
    if workspace_id is None:
        raise HTTPException(status_code=404, detail="Object not found")

    if object_type == "stash":
        if await stash_service.user_can_manage(object_id, user_id):
            return
        raise HTTPException(status_code=403, detail="Not allowed to manage this stash")

    can_read = await permission_service.check_access(
        object_type, object_id, user_id, workspace_id=workspace_id, require_write=False
    )
    if not can_read:
        raise HTTPException(status_code=403, detail="Not allowed to share this object")


@router.get("/{object_type}/{object_id}/permissions", response_model=PermissionResponse)
async def get_permissions(
    object_type: str,
    object_id: UUID,
    current_user: dict = Depends(get_current_user),
):
    await _require_can_share(object_type, object_id, current_user["id"])
    perms = await permission_service.get_permissions(object_type, object_id)
    return PermissionResponse(**perms)


@router.patch("/{object_type}/{object_id}/permissions")
async def set_visibility(
    object_type: str,
    object_id: UUID,
    req: SetVisibilityRequest,
    current_user: dict = Depends(get_current_user),
):
    await _require_can_share(object_type, object_id, current_user["id"])
    raise HTTPException(status_code=400, detail="Create or update a Stash to change privacy")


@router.post("/{object_type}/{object_id}/shares", response_model=ShareResponse)
async def add_share(
    object_type: str,
    object_id: UUID,
    req: ShareRequest,
    current_user: dict = Depends(get_current_user),
):
    await _require_can_share(object_type, object_id, current_user["id"])
    raise HTTPException(status_code=400, detail="Share a Stash instead of sharing individual objects")


@router.delete("/{object_type}/{object_id}/shares/{user_id}", status_code=204)
async def remove_share(
    object_type: str,
    object_id: UUID,
    user_id: UUID,
    current_user: dict = Depends(get_current_user),
):
    await _require_can_share(object_type, object_id, current_user["id"])
    raise HTTPException(status_code=400, detail="Share a Stash instead of sharing individual objects")


@router.post("/{object_type}/{object_id}/share-link", response_model=ShareLinkResponse)
async def create_stash_url(
    object_type: str,
    object_id: UUID,
    access: str = Query("public", pattern=r"^(workspace|private|public)$"),
    current_user: dict = Depends(get_current_user),
):
    """Idempotently mint the URL for the share sheet's "Copy link" button.

    For shareable objects, this auto-creates (or reuses) a one-item Stash and
    returns /stashes/{slug}.
    The Stash is just the slugged shell — access is governed by the
    object's own permissions, not by the Stash.

    The returned URL is always a Stash URL. For non-Stash objects, this creates
    a one-item Stash with the requested access."""
    await _require_can_share(object_type, object_id, current_user["id"])

    base = settings.PUBLIC_URL.rstrip("/")

    if object_type == "stash":
        # Stashes already have their own public URL, so return it directly.
        stash = await stash_service.get_stash(object_id)
        if not stash:
            raise HTTPException(status_code=404, detail="Stash not found")
        if stash["access"] != access:
            stash = await stash_service.update_stash(stash["id"], current_user["id"], access=access)
        return ShareLinkResponse(
            url=f"{base}/stashes/{stash['slug']}",
            kind="stash",
            stash_id=stash["id"],
            stash_slug=stash["slug"],
        )

    workspace_id = await permission_service.resolve_workspace_id(object_type, object_id)
    if workspace_id is None:
        raise HTTPException(status_code=404, detail="Object not found")

    title = await stash_service._object_title(object_type, object_id)
    try:
        stash = await stash_service.create_stash(
            workspace_id=workspace_id,
            owner_id=current_user["id"],
            title=title,
            description="",
            access=access,
            discoverable=False,
            cover_image_url=None,
            items=[StashItem(object_type=object_type, object_id=object_id, position=0)],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ShareLinkResponse(
        url=f"{base}/stashes/{stash['slug']}",
        kind="stash",
        stash_id=stash["id"],
        stash_slug=stash["slug"],
    )
