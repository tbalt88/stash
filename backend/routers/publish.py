"""One-call publish endpoint for AI agents.

Collapses the create-page → set-visibility → mint-share-link sequence into a
single POST. Optionally find-or-creates an "AI Drafts" notebook so the agent
doesn't need to know the workspace's folder structure.
"""

from fastapi import APIRouter, Depends, HTTPException

from ..auth import get_current_user
from ..config import settings
from ..database import get_pool
from ..models import PublishRequest, PublishResponse
from ..services import notebook_service, permission_service, view_service, workspace_service

router = APIRouter(prefix="/api/v1", tags=["publish"])

AI_DRAFTS_NOTEBOOK_NAME = "AI Drafts"


async def _find_or_create_drafts_notebook(workspace_id, user_id) -> dict:
    pool = get_pool()
    row = await pool.fetchrow(
        "SELECT id, workspace_id, name, description, created_by, created_at, updated_at "
        "FROM notebooks WHERE workspace_id = $1 AND name = $2 LIMIT 1",
        workspace_id,
        AI_DRAFTS_NOTEBOOK_NAME,
    )
    if row:
        return dict(row)
    return await notebook_service.create_notebook(
        workspace_id=workspace_id,
        name=AI_DRAFTS_NOTEBOOK_NAME,
        description="Pages published by agents via the /publish endpoint. Auto-created.",
        created_by=user_id,
    )


@router.post("/publish", response_model=PublishResponse)
async def publish(
    req: PublishRequest,
    current_user: dict = Depends(get_current_user),
):
    if not await workspace_service.is_member(req.workspace_id, current_user["id"]):
        raise HTTPException(status_code=403, detail="Not a workspace member")

    notebook = (
        await notebook_service.get_notebook(req.notebook_id)
        if req.notebook_id
        else await _find_or_create_drafts_notebook(req.workspace_id, current_user["id"])
    )
    if not notebook or notebook.get("workspace_id") != req.workspace_id:
        raise HTTPException(status_code=404, detail="Notebook not found in this workspace")

    page = await notebook_service.create_page(
        notebook_id=notebook["id"],
        name=req.title,
        created_by=current_user["id"],
        content=req.content if req.content_type == "markdown" else "",
        content_type=req.content_type,
        content_html=req.content if req.content_type == "html" else "",
    )

    await permission_service.set_visibility("page", page["id"], req.audience)

    view = await view_service.find_or_create_share_link_view(
        workspace_id=req.workspace_id,
        owner_id=current_user["id"],
        object_type="page",
        object_id=page["id"],
    )

    base = settings.PUBLIC_URL.rstrip("/")
    return PublishResponse(
        page_id=page["id"],
        notebook_id=notebook["id"],
        workspace_id=req.workspace_id,
        visibility=req.audience,
        url=f"{base}/v/{view['slug']}",
        view_id=view["id"],
        view_slug=view["slug"],
    )
