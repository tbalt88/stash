"""Anonymous read endpoints for the /s/{workspace} browse surface.

Every endpoint runs the same Drive-style ACL check the authenticated routes
do, but with an optional viewer (None = anonymous). The frontend nested
routes under /s/[workspaceId]/n/[nb]/p/[page] etc consume these.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse

from ..auth import get_current_user_optional
from ..database import get_pool
from ..services import permission_service

router = APIRouter(prefix="/api/v1/public", tags=["public"])

llms_router = APIRouter(tags=["public"])


def _viewer(current_user: dict | None) -> UUID | None:
    return current_user["id"] if current_user else None


async def _readable_rows(
    object_type: str,
    rows,
    viewer: UUID | None,
    *,
    workspace_id: UUID | None = None,
) -> list[dict]:
    out: list[dict] = []
    for row in rows:
        obj = dict(row)
        if await permission_service.check_access(
            object_type,
            obj["id"],
            viewer,
            workspace_id=workspace_id or obj.get("workspace_id"),
        ):
            out.append(obj)
    return out


async def _readable_notebook_pages(notebook_id: UUID, viewer: UUID | None) -> list[dict]:
    pool = get_pool()
    pages = await pool.fetch(
        "SELECT id, name, content_type, content_markdown, content_html, updated_at "
        "FROM notebook_pages WHERE notebook_id = $1 ORDER BY created_at, name",
        notebook_id,
    )
    return await _readable_rows("page", pages, viewer)


_LLMS_TXT = """# Stash

Stash is a shared memory system for AI coding agents. Workspaces contain
notebooks (collections of pages), tables, files, and history (agent
sessions). Pages can be shared as Views with slugged URLs.

## For browsing agents

Any /v/{slug} or /s/{ws}/n/{nb}/p/{page} URL returns HTML by default.
Append ?format=text to the corresponding API endpoint to get clean
markdown:

- View: GET /api/v1/views/{slug}?format=text
- Page: GET /api/v1/public/pages/{page_id}?format=text
- Notebook (all pages): GET /api/v1/public/notebooks/{notebook_id}?format=text
- Workspace overview: GET /api/v1/public/workspaces/{workspace_id}?format=text

All public endpoints are anonymous-readable when the underlying object's
visibility is `link` or `public`. No auth headers needed.

## Privacy

Items marked `private` or `inherit` (workspace-only) are never returned by
any public endpoint, regardless of how the URL is shaped.
"""


@llms_router.get("/llms.txt", include_in_schema=False)
async def llms_txt():
    from fastapi.responses import PlainTextResponse

    return PlainTextResponse(_LLMS_TXT, media_type="text/plain")


@router.get("/workspaces/{workspace_id}")
async def public_workspace(
    workspace_id: UUID,
    format: str | None = Query(None),
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

    notebook_rows = await pool.fetch(
        "SELECT nb.id, nb.name, nb.description, nb.updated_at, "
        "(SELECT COUNT(*) FROM notebook_pages p WHERE p.notebook_id = nb.id) AS page_count "
        "FROM notebooks nb WHERE nb.workspace_id = $1 ORDER BY nb.updated_at DESC",
        workspace_id,
    )
    table_rows = await pool.fetch(
        "SELECT t.id, t.name, t.updated_at, "
        "(SELECT COUNT(*) FROM table_rows tr WHERE tr.table_id = t.id) AS row_count "
        "FROM tables t WHERE t.workspace_id = $1 ORDER BY t.updated_at DESC",
        workspace_id,
    )
    file_rows = await pool.fetch(
        "SELECT id, name, content_type, COALESCE(size_bytes, 0) AS size_bytes, created_at "
        "FROM files WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 200",
        workspace_id,
    )
    notebooks = await _readable_rows("notebook", notebook_rows, viewer, workspace_id=workspace_id)
    for nb in notebooks:
        nb["page_count"] = len(await _readable_notebook_pages(nb["id"], viewer))
    tables = await _readable_rows("table", table_rows, viewer, workspace_id=workspace_id)
    files = await _readable_rows("file", file_rows, viewer, workspace_id=workspace_id)
    payload = {
        "workspace": dict(ws),
        "notebooks": notebooks,
        "tables": tables,
        "files": files,
    }
    if format == "text":
        ws_d = payload["workspace"]
        lines = [f"# {ws_d['name']}", ""]
        if ws_d.get("summary"):
            lines += [ws_d["summary"], ""]
        if ws_d.get("description"):
            lines += [ws_d["description"], ""]
        if payload["notebooks"]:
            lines.append("## Notebooks")
            for n in payload["notebooks"]:
                lines.append(f"- {n['name']} ({n['page_count']} pages)")
            lines.append("")
        if payload["tables"]:
            lines.append("## Tables")
            for t in payload["tables"]:
                lines.append(f"- {t['name']} ({t['row_count']} rows)")
            lines.append("")
        if payload["files"]:
            lines.append("## Files")
            for f in payload["files"]:
                lines.append(f"- {f['name']}")
            lines.append("")
        return PlainTextResponse("\n".join(lines), media_type="text/markdown")
    return payload


@router.get("/notebooks/{notebook_id}")
async def public_notebook(
    notebook_id: UUID,
    format: str | None = Query(None),
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

    pages = await _readable_notebook_pages(notebook_id, viewer)
    if format == "text":
        lines = [f"# {nb['name']}", ""]
        if nb.get("description"):
            lines += [nb["description"], ""]
        for p in pages:
            lines.append(f"## {p['name']}")
            if p["content_type"] == "html":
                lines.append("_(HTML content omitted in text format)_")
            else:
                lines.append((p["content_markdown"] or "").rstrip())
            lines.append("")
        return PlainTextResponse("\n".join(lines), media_type="text/markdown")

    # JSON form drops the heavy content_markdown/content_html unless a caller
    # specifically asked for full pages — keeps the index endpoint cheap.
    return {
        "notebook": dict(nb),
        "pages": [
            {
                "id": str(p["id"]),
                "name": p["name"],
                "content_type": p["content_type"],
                "updated_at": p["updated_at"].isoformat(),
            }
            for p in pages
        ],
    }


@router.get("/pages/{page_id}")
async def public_page(
    page_id: UUID,
    format: str | None = Query(None),
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
    if format == "text":
        if page["content_type"] == "html":
            # HTML pages don't have a clean text projection — return a hint
            # plus the raw HTML so the agent can decide what to do.
            return PlainTextResponse(
                f"# {page['name']}\n\n_(HTML page — raw markup follows)_\n\n{page['content_html']}",
                media_type="text/markdown",
            )
        return PlainTextResponse(
            f"# {page['name']}\n\n{page['content_markdown'] or ''}",
            media_type="text/markdown",
        )
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
