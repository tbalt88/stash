"""Privacy tag endpoints for shareable workspace content."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from ..auth import get_current_user
from ..config import settings
from ..database import get_pool
from ..models import (
    PermissionResponse,
    SetVisibilityRequest,
    ShareLinkResponse,
    ShareRequest,
    ShareResponse,
)
from ..services import permission_service, stash_service

router = APIRouter(prefix="/api/v1/objects", tags=["permissions"])


# Object types whose privacy is governed by tags.
_PRIVACY_TAG_TYPES = {"folder", "page", "session", "table", "file", "history"}
_SHAREABLE = {"folder", "page", "session", "table", "file", "history", "stash"}
_DIRECT_SHARE_TYPES = {"folder", "page", "session", "table", "file", "history"}


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
    if object_type not in _PRIVACY_TAG_TYPES:
        raise HTTPException(status_code=400, detail="Publish or add the Stash to share it")
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
    if object_type not in _PRIVACY_TAG_TYPES:
        raise HTTPException(status_code=400, detail="Publish or add the Stash to share it")
    await permission_service.set_privacy_visibility(
        object_type, object_id, req.visibility, current_user["id"]
    )
    return {"status": "ok", "visibility": req.visibility}


@router.post("/{object_type}/{object_id}/shares", response_model=ShareResponse)
async def add_share(
    object_type: str,
    object_id: UUID,
    req: ShareRequest,
    current_user: dict = Depends(get_current_user),
):
    await _require_can_share(object_type, object_id, current_user["id"])
    if object_type not in _DIRECT_SHARE_TYPES:
        raise HTTPException(status_code=400, detail="Publish or add the Stash to share it")
    share = await permission_service.add_share(
        object_type, object_id, req.user_id, req.permission, current_user["id"]
    )
    pool = get_pool()
    user = await pool.fetchrow("SELECT name FROM users WHERE id = $1", req.user_id)
    return ShareResponse(
        user_id=share["user_id"],
        user_name=user["name"] if user else "",
        permission=share["permission"],
        granted_by=share["granted_by"],
        created_at=share["created_at"],
    )


@router.delete("/{object_type}/{object_id}/shares/{user_id}", status_code=204)
async def remove_share(
    object_type: str,
    object_id: UUID,
    user_id: UUID,
    current_user: dict = Depends(get_current_user),
):
    await _require_can_share(object_type, object_id, current_user["id"])
    if object_type not in _DIRECT_SHARE_TYPES:
        raise HTTPException(status_code=400, detail="Publish or add the Stash to share it")
    await permission_service.remove_share(object_type, object_id, user_id)


_VISIBILITY_RANK = {"private": 0, "inherit": 0, "link": 1, "public": 2}


@router.post("/{object_type}/{object_id}/share-link", response_model=ShareLinkResponse)
async def create_share_link(
    object_type: str,
    object_id: UUID,
    ensure: str | None = Query(None, pattern=r"^(link|public)$"),
    current_user: dict = Depends(get_current_user),
):
    """Idempotently mint the URL for the share sheet's "Copy link" button.

    For shareable objects, this auto-creates (or reuses) a one-item Stash and
    returns /stashes/{slug}.
    The Product Stash is just the slugged shell — access is governed by the
    object's own permissions, not by the Stash.

    `ensure=link|public`: raise the underlying object's visibility to at
    least the requested level before returning the URL. Without this, an
    agent that calls share-link on an `inherit` object gets back a URL that
    immediately 404s for anonymous viewers — easy to forget, hard to debug."""
    await _require_can_share(object_type, object_id, current_user["id"])

    if ensure and object_type != "stash":
        current_vis = await permission_service.get_visibility(object_type, object_id)
        if _VISIBILITY_RANK.get(current_vis, 0) < _VISIBILITY_RANK[ensure]:
            await permission_service.set_visibility(object_type, object_id, ensure)

    base = settings.PUBLIC_URL.rstrip("/")

    if object_type == "stash":
        # Stashes already have their own public URL, so return it directly.
        stash = await stash_service.get_stash(object_id)
        if not stash:
            raise HTTPException(status_code=404, detail="Stash not found")
        if ensure:
            for item in stash["items"]:
                await _require_can_share(item["object_type"], item["object_id"], current_user["id"])
            for item in stash["items"]:
                current_vis = await permission_service.get_visibility(
                    item["object_type"], item["object_id"]
                )
                if _VISIBILITY_RANK.get(current_vis, 0) < _VISIBILITY_RANK[ensure]:
                    await permission_service.set_visibility(
                        item["object_type"], item["object_id"], ensure
                    )
        return ShareLinkResponse(
            url=f"{base}/stashes/{stash['slug']}",
            kind="stash",
            stash_id=stash["id"],
            stash_slug=stash["slug"],
        )

    workspace_id = await permission_service.resolve_workspace_id(object_type, object_id)
    if workspace_id is None:
        raise HTTPException(status_code=404, detail="Object not found")

    stash = await stash_service.find_or_create_share_link_stash(
        workspace_id=workspace_id,
        owner_id=current_user["id"],
        object_type=object_type,
        object_id=object_id,
    )
    return ShareLinkResponse(
        url=f"{base}/stashes/{stash['slug']}",
        kind="stash",
        stash_id=stash["id"],
        stash_slug=stash["slug"],
    )
