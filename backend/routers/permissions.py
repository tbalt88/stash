"""Unified permissions router: one endpoint surface for every shareable object.

Sits at /api/v1/objects/{object_type}/{object_id} and gives the share sheet a
single API to talk to regardless of whether it's sharing a workspace, a
notebook, a single page, a table, a file, a history event, or a View itself.

The legacy notebook-scoped endpoints under /api/v1/workspaces/.../notebooks/...
keep working — this is additive.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

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
from ..services import permission_service, view_service, workspace_service

router = APIRouter(prefix="/api/v1/objects", tags=["permissions"])


# Object types the share sheet can operate on. 'view' is included so that a
# View's curation can be co-edited via object_shares.
_SHAREABLE = {"workspace", "notebook", "page", "table", "file", "history", "view"}


async def _require_admin(object_type: str, object_id: UUID, user_id: UUID) -> None:
    """Caller must be workspace owner/admin (or, for personal items, the creator)."""
    if object_type not in _SHAREABLE:
        raise HTTPException(status_code=400, detail=f"Unsupported object_type: {object_type}")

    workspace_id = await permission_service.resolve_workspace_id(object_type, object_id)
    if workspace_id is None:
        raise HTTPException(status_code=404, detail="Object not found")

    if object_type == "workspace":
        # Sharing the workspace itself: must be a workspace owner/admin.
        role = await workspace_service.get_member_role(workspace_id, user_id)
        if role not in ("owner", "admin"):
            raise HTTPException(status_code=403, detail="Only workspace owner/admin can share")
        return

    role = await workspace_service.get_member_role(workspace_id, user_id)
    if role in ("owner", "admin"):
        return

    # Members can manage shares on objects they have write access to (Drive-style).
    can_write = await permission_service.check_access(
        object_type, object_id, user_id, workspace_id=workspace_id, require_write=True
    )
    if not can_write:
        raise HTTPException(status_code=403, detail="Not allowed to manage permissions for this object")


@router.get("/{object_type}/{object_id}/permissions", response_model=PermissionResponse)
async def get_permissions(
    object_type: str,
    object_id: UUID,
    current_user: dict = Depends(get_current_user),
):
    await _require_admin(object_type, object_id, current_user["id"])
    perms = await permission_service.get_permissions(object_type, object_id)
    return PermissionResponse(**perms)


@router.patch("/{object_type}/{object_id}/permissions")
async def set_visibility(
    object_type: str,
    object_id: UUID,
    req: SetVisibilityRequest,
    current_user: dict = Depends(get_current_user),
):
    await _require_admin(object_type, object_id, current_user["id"])
    await permission_service.set_visibility(object_type, object_id, req.visibility)
    return {"status": "ok", "visibility": req.visibility}


@router.post("/{object_type}/{object_id}/shares", response_model=ShareResponse)
async def add_share(
    object_type: str,
    object_id: UUID,
    req: ShareRequest,
    current_user: dict = Depends(get_current_user),
):
    await _require_admin(object_type, object_id, current_user["id"])
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
    await _require_admin(object_type, object_id, current_user["id"])
    await permission_service.remove_share(object_type, object_id, user_id)


@router.post("/{object_type}/{object_id}/share-link", response_model=ShareLinkResponse)
async def create_share_link(
    object_type: str,
    object_id: UUID,
    current_user: dict = Depends(get_current_user),
):
    """Idempotently mint the URL for the share sheet's "Copy link" button.

    For a workspace the URL is /s/{id}. For every other shareable object we
    auto-create (or reuse) a one-item View pointing at it and return /v/{slug}.
    The View is just the slugged shell — access is governed by the object's
    own permissions, not by the View."""
    await _require_admin(object_type, object_id, current_user["id"])

    base = settings.PUBLIC_URL.rstrip("/")

    if object_type == "workspace":
        return ShareLinkResponse(url=f"{base}/s/{object_id}", kind="workspace")

    workspace_id = await permission_service.resolve_workspace_id(object_type, object_id)
    if workspace_id is None:
        raise HTTPException(status_code=404, detail="Object not found")

    view = await view_service.find_or_create_share_link_view(
        workspace_id=workspace_id,
        owner_id=current_user["id"],
        object_type=object_type,
        object_id=object_id,
    )
    return ShareLinkResponse(
        url=f"{base}/v/{view['slug']}",
        kind="view",
        view_id=view["id"],
        view_slug=view["slug"],
    )
