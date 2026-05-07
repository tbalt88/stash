"""Public catalog of Stashes — no auth required."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from ..models import (
    CatalogListResponse,
    WorkspaceCatalogCard,
    WorkspacePublicDetail,
    WorkspacePublicFileSummary,
    WorkspacePublicFolderSummary,
    WorkspacePublicRootPageSummary,
    WorkspacePublicTableSummary,
)
from ..services import discover_service, view_service

router = APIRouter(prefix="/api/v1/discover", tags=["discover"])


@router.get("/workspaces", response_model=CatalogListResponse)
async def list_catalog(
    q: str | None = Query(None, max_length=128),
    category: str | None = Query(None, max_length=32),
    tag: str | None = Query(None, max_length=64),
    sort: str = Query("trending", pattern="^(trending|newest|forks)$"),
    cursor: str | None = Query(None, max_length=128),
):
    items, next_cursor = await discover_service.list_catalog(
        query=q, category=category, tag=tag, sort=sort, cursor=cursor
    )
    return CatalogListResponse(
        workspaces=[WorkspaceCatalogCard(**i) for i in items],
        next_cursor=next_cursor,
    )


@router.get("/featured", response_model=CatalogListResponse)
async def featured():
    items = await discover_service.get_featured()
    return CatalogListResponse(workspaces=[WorkspaceCatalogCard(**i) for i in items])


@router.get("/workspaces/{workspace_id}", response_model=WorkspacePublicDetail)
async def public_workspace(workspace_id: UUID):
    detail = await discover_service.get_public_detail(workspace_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return WorkspacePublicDetail(
        workspace=WorkspaceCatalogCard(**detail["workspace"]),
        folders=[WorkspacePublicFolderSummary(**f) for f in detail["folders"]],
        root_pages=[WorkspacePublicRootPageSummary(**p) for p in detail["root_pages"]],
        tables=[WorkspacePublicTableSummary(**t) for t in detail["tables"]],
        files=[WorkspacePublicFileSummary(**f) for f in detail["files"]],
    )


@router.get("/views")
async def list_public_views(
    q: str | None = Query(None, max_length=128),
    sort: str = Query("trending", pattern="^(trending|newest|popular)$"),
    limit: int = Query(48, ge=1, le=100),
):
    """All Views whose every item is publicly readable."""
    items = await view_service.list_public_views(query=q, sort=sort, limit=limit)
    return {"views": items}
