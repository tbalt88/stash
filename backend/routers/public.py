"""Anonymous read endpoints for the /s/{workspace} browse surface.

Every endpoint runs the same Drive-style ACL check the authenticated routes
do, but with an optional viewer (None = anonymous). The frontend nested
routes under /s/[workspaceId]/n/[nb]/p/[page] etc consume these.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from ..auth import get_current_user_optional
from ..database import get_pool
from ..services import permission_service

router = APIRouter(prefix="/api/v1/public", tags=["public"])


def _viewer(current_user: dict | None) -> UUID | None:
    return current_user["id"] if current_user else None


@router.get("/workspaces/{workspace_id}")
async def public_workspace(
    workspace_id: UUID,
    current_user: dict | None = Depends(get_current_user_optional),
):
    pool = get_pool()
    viewer = _viewer(current_user)
    if not await permission_service.check_access("workspace", workspace_id, viewer):
        raise HTTPException(status_code=404, detail="Workspace not found")

    ws = await pool.fetchrow(
        "SELECT w.id, w.name, w.summary, w.description, w.cover_image_url, w.is_public, "
        "w.creator_id, u.name AS creator_name, u.display_name AS creator_display_name, "
        "w.tags, w.category, w.featured, w.fork_count, w.forked_from_workspace_id, "
        "w.created_at, w.updated_at, "
        "(SELECT COUNT(*) FROM workspace_members wm WHERE wm.workspace_id = w.id) AS member_count, "
        "(SELECT COUNT(*) FROM notebooks nb WHERE nb.workspace_id = w.id) AS notebook_count, "
        "(SELECT COUNT(*) FROM tables t WHERE t.workspace_id = w.id) AS table_count, "
        "(SELECT COUNT(*) FROM files f WHERE f.workspace_id = w.id) AS file_count, "
        "(SELECT COUNT(*) FROM history_events he WHERE he.workspace_id = w.id) AS history_event_count "
        "FROM workspaces w JOIN users u ON u.id = w.creator_id WHERE w.id = $1",
        workspace_id,
    )
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    notebooks = await pool.fetch(
        "SELECT nb.id, nb.name, nb.description, nb.updated_at, "
        "(SELECT COUNT(*) FROM notebook_pages p WHERE p.notebook_id = nb.id) AS page_count "
        "FROM notebooks nb WHERE nb.workspace_id = $1 ORDER BY nb.updated_at DESC",
        workspace_id,
    )
    tables = await pool.fetch(
        "SELECT t.id, t.name, t.updated_at, "
        "(SELECT COUNT(*) FROM table_rows tr WHERE tr.table_id = t.id) AS row_count "
        "FROM tables t WHERE t.workspace_id = $1 ORDER BY t.updated_at DESC",
        workspace_id,
    )
    files = await pool.fetch(
        "SELECT id, name, content_type, COALESCE(size_bytes, 0) AS size_bytes, created_at "
        "FROM files WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 200",
        workspace_id,
    )
    return {
        "workspace": dict(ws),
        "notebooks": [dict(n) for n in notebooks],
        "tables": [dict(t) for t in tables],
        "files": [dict(f) for f in files],
    }


@router.get("/notebooks/{notebook_id}")
async def public_notebook(
    notebook_id: UUID,
    current_user: dict | None = Depends(get_current_user_optional),
):
    pool = get_pool()
    viewer = _viewer(current_user)
    if not await permission_service.check_access("notebook", notebook_id, viewer):
        raise HTTPException(status_code=404, detail="Notebook not found")

    nb = await pool.fetchrow(
        "SELECT id, name, description, workspace_id, updated_at FROM notebooks WHERE id = $1",
        notebook_id,
    )
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")

    pages = await pool.fetch(
        "SELECT id, name, content_type, updated_at FROM notebook_pages "
        "WHERE notebook_id = $1 ORDER BY created_at, name",
        notebook_id,
    )
    return {"notebook": dict(nb), "pages": [dict(p) for p in pages]}


@router.get("/pages/{page_id}")
async def public_page(
    page_id: UUID,
    current_user: dict | None = Depends(get_current_user_optional),
):
    pool = get_pool()
    viewer = _viewer(current_user)
    if not await permission_service.check_access("page", page_id, viewer):
        raise HTTPException(status_code=404, detail="Page not found")

    page = await pool.fetchrow(
        "SELECT p.id, p.name, p.content_type, p.content_markdown, p.content_html, "
        "p.notebook_id, p.updated_at, n.workspace_id, n.name AS notebook_name "
        "FROM notebook_pages p JOIN notebooks n ON n.id = p.notebook_id WHERE p.id = $1",
        page_id,
    )
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return dict(page)


@router.get("/tables/{table_id}")
async def public_table(
    table_id: UUID,
    current_user: dict | None = Depends(get_current_user_optional),
):
    pool = get_pool()
    viewer = _viewer(current_user)
    if not await permission_service.check_access("table", table_id, viewer):
        raise HTTPException(status_code=404, detail="Table not found")

    t = await pool.fetchrow(
        "SELECT id, name, description, columns, workspace_id, updated_at FROM tables WHERE id = $1",
        table_id,
    )
    if not t:
        raise HTTPException(status_code=404, detail="Table not found")
    rows = await pool.fetch(
        "SELECT data, row_order FROM table_rows WHERE table_id = $1 "
        "ORDER BY row_order LIMIT 500",
        table_id,
    )
    return {
        "table": dict(t),
        "rows": [{"data": r["data"], "row_order": r["row_order"]} for r in rows],
    }


@router.get("/files/{file_id}")
async def public_file(
    file_id: UUID,
    current_user: dict | None = Depends(get_current_user_optional),
):
    pool = get_pool()
    viewer = _viewer(current_user)
    if not await permission_service.check_access("file", file_id, viewer):
        raise HTTPException(status_code=404, detail="File not found")

    f = await pool.fetchrow(
        "SELECT id, name, content_type, size_bytes, workspace_id, created_at FROM files WHERE id = $1",
        file_id,
    )
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    return dict(f)
