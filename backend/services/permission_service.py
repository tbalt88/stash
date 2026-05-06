"""Permission service: Google Drive-like access checks for all object types.

Access logic:
1. Anonymous viewer (user_id=None) gets read iff visibility is 'link' or 'public'.
2. Workspace owner/admin always has access (bypass all checks).
3. visibility='public'/'link' → anyone can read. Write requires share entry.
4. visibility='private' → only users in object_shares.
5. visibility='inherit' (default) → workspace members + object_shares.
"""

from uuid import UUID

from ..database import get_pool


# Object types that live inside a workspace and don't have their own workspace_id
# column. resolve_workspace_id maps object_id → parent workspace via a join.
_WORKSPACE_LOOKUP = {
    "workspace": ("workspaces", "id"),
    "notebook": ("notebooks", "workspace_id"),
    "table": ("tables", "workspace_id"),
    "file": ("files", "workspace_id"),
    "history": ("histories", "workspace_id"),
    "view": ("views", "workspace_id"),
}


async def resolve_workspace_id(object_type: str, object_id: UUID) -> UUID | None:
    """Look up the workspace_id for an object. Pages walk through their notebook."""
    pool = get_pool()
    if object_type == "page":
        row = await pool.fetchrow(
            "SELECT n.workspace_id FROM notebook_pages p "
            "JOIN notebooks n ON n.id = p.notebook_id WHERE p.id = $1",
            object_id,
        )
        return row["workspace_id"] if row else None
    if object_type in _WORKSPACE_LOOKUP:
        table, col = _WORKSPACE_LOOKUP[object_type]
        row = await pool.fetchrow(f"SELECT {col} AS ws FROM {table} WHERE id = $1", object_id)
        return row["ws"] if row else None
    return None


async def _effective_read_visibility(
    object_type: str, object_id: UUID, workspace_id: UUID | None
) -> str:
    """Resolve `inherit` to the parent workspace's visibility so anonymous
    viewers can read items inside a public/link workspace by default."""
    vis = await get_visibility(object_type, object_id)
    if vis != "inherit":
        return vis
    if object_type == "workspace" or workspace_id is None:
        return "inherit"
    parent_vis = await get_visibility("workspace", workspace_id)
    return parent_vis


async def check_access(
    object_type: str,
    object_id: UUID,
    user_id: UUID | None,
    workspace_id: UUID | None = None,
    require_write: bool = False,
) -> bool:
    """Check if a user can access an object. user_id=None means anonymous viewer."""
    pool = get_pool()

    if workspace_id is None:
        workspace_id = await resolve_workspace_id(object_type, object_id)

    vis = await get_visibility(object_type, object_id)

    # Anonymous viewers only get read, and only when the effective visibility
    # (own row or — if 'inherit' — the parent workspace's row) is link or public.
    if user_id is None:
        if require_write:
            return False
        effective = await _effective_read_visibility(object_type, object_id, workspace_id)
        return effective in ("public", "link")

    # Owner of personal (workspace-less) items always has full access
    if workspace_id is None:
        table_map = {
            "chat": ("chats", "creator_id"),
            "notebook": ("notebooks", "created_by"),
            "history": ("histories", "created_by"),
            "deck": ("decks", "created_by"),
            "table": ("tables", "created_by"),
        }
        if object_type in table_map:
            table, col = table_map[object_type]
            row = await pool.fetchrow(
                f"SELECT 1 FROM {table} WHERE id = $1 AND {col} = $2 AND workspace_id IS NULL",
                object_id,
                user_id,
            )
            if row:
                return True

    role = await get_workspace_role(workspace_id, user_id) if workspace_id else None

    if role in ("owner", "admin"):
        return True

    # 'public' and 'link' grant anonymous read; write still requires a share entry.
    if vis in ("public", "link") and not require_write:
        return True

    if vis == "inherit" and workspace_id and role is not None:
        if not require_write:
            return True

    share = await pool.fetchrow(
        "SELECT permission FROM object_shares "
        "WHERE object_type = $1 AND object_id = $2 AND user_id = $3",
        object_type,
        object_id,
        user_id,
    )
    if share:
        if not require_write:
            return True
        return share["permission"] in ("write", "admin")

    return False


async def get_workspace_role(workspace_id: UUID, user_id: UUID) -> str | None:
    """Get a user's role in a workspace, or None if not a member."""
    pool = get_pool()
    row = await pool.fetchrow(
        "SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
        workspace_id,
        user_id,
    )
    return row["role"] if row else None


async def is_workspace_member(workspace_id: UUID, user_id: UUID) -> bool:
    return await get_workspace_role(workspace_id, user_id) is not None


async def get_visibility(object_type: str, object_id: UUID) -> str:
    """Get object visibility. Returns 'inherit' if no row exists."""
    pool = get_pool()
    row = await pool.fetchrow(
        "SELECT visibility FROM object_permissions " "WHERE object_type = $1 AND object_id = $2",
        object_type,
        object_id,
    )
    return row["visibility"] if row else "inherit"


async def set_visibility(object_type: str, object_id: UUID, visibility: str) -> None:
    """Set object visibility (inherit/private/link/public)."""
    pool = get_pool()
    if visibility == "inherit":
        await pool.execute(
            "DELETE FROM object_permissions WHERE object_type = $1 AND object_id = $2",
            object_type,
            object_id,
        )
    else:
        await pool.execute(
            "INSERT INTO object_permissions (object_type, object_id, visibility) "
            "VALUES ($1, $2, $3) "
            "ON CONFLICT (object_type, object_id) DO UPDATE SET visibility = $3",
            object_type,
            object_id,
            visibility,
        )

    # Workspaces have a legacy is_public column that the Discover catalog still
    # queries. Mirror visibility=public into it so /discover finds workspaces
    # shared via the new sheet, and clear it on demote.
    if object_type == "workspace":
        await pool.execute(
            "UPDATE workspaces SET is_public = $1 WHERE id = $2",
            visibility == "public",
            object_id,
        )


async def add_share(
    object_type: str,
    object_id: UUID,
    user_id: UUID,
    permission: str,
    granted_by: UUID,
) -> dict:
    """Grant a user access to an object."""
    pool = get_pool()
    row = await pool.fetchrow(
        "INSERT INTO object_shares (object_type, object_id, user_id, permission, granted_by) "
        "VALUES ($1, $2, $3, $4, $5) "
        "ON CONFLICT (object_type, object_id, user_id) DO UPDATE SET permission = $4 "
        "RETURNING *",
        object_type,
        object_id,
        user_id,
        permission,
        granted_by,
    )
    return dict(row)


async def remove_share(object_type: str, object_id: UUID, user_id: UUID) -> bool:
    """Remove a user's share. Returns True if removed."""
    pool = get_pool()
    result = await pool.execute(
        "DELETE FROM object_shares WHERE object_type = $1 AND object_id = $2 AND user_id = $3",
        object_type,
        object_id,
        user_id,
    )
    return result == "DELETE 1"


async def get_shares(object_type: str, object_id: UUID) -> list[dict]:
    """Get all shares for an object."""
    pool = get_pool()
    rows = await pool.fetch(
        "SELECT os.user_id, u.name AS user_name, os.permission, os.granted_by, os.created_at "
        "FROM object_shares os JOIN users u ON u.id = os.user_id "
        "WHERE os.object_type = $1 AND os.object_id = $2 "
        "ORDER BY os.created_at",
        object_type,
        object_id,
    )
    return [dict(r) for r in rows]


async def get_permissions(object_type: str, object_id: UUID) -> dict:
    """Get full permissions info for an object (visibility + shares)."""
    vis = await get_visibility(object_type, object_id)
    shares = await get_shares(object_type, object_id)
    return {
        "object_type": object_type,
        "object_id": object_id,
        "visibility": vis,
        "shares": shares,
    }
