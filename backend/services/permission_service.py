"""Permission service for workspace content objects.

Stashes are the only privacy boundary for files, pages, folders, sessions,
and tables. Content with no Stash membership is workspace-visible.
"""

from uuid import UUID

from ..database import get_pool

_WORKSPACE_LOOKUP = {
    "table": ("tables", "workspace_id"),
    "file": ("files", "workspace_id"),
    "session": ("sessions", "workspace_id"),
    "stash": ("stashes", "workspace_id"),
    "folder": ("folders", "workspace_id"),
    "page": ("pages", "workspace_id"),
}

_CONTENT_TYPES = {"folder", "page", "session", "table", "file"}


async def resolve_workspace_id(object_type: str, object_id: UUID) -> UUID | None:
    pool = get_pool()
    if object_type not in _WORKSPACE_LOOKUP:
        return None
    table, col = _WORKSPACE_LOOKUP[object_type]
    row = await pool.fetchrow(f"SELECT {col} AS ws FROM {table} WHERE id = $1", object_id)
    return row["ws"] if row else None


async def _folder_chain_for_page(page_id: UUID) -> list[UUID]:
    pool = get_pool()
    rows = await pool.fetch(
        "WITH RECURSIVE chain AS ("
        "  SELECT f.id, f.parent_folder_id FROM folders f "
        "  JOIN pages p ON p.folder_id = f.id WHERE p.id = $1"
        "  UNION ALL"
        "  SELECT f.id, f.parent_folder_id FROM folders f "
        "  JOIN chain c ON f.id = c.parent_folder_id"
        ") SELECT id FROM chain",
        page_id,
    )
    return [row["id"] for row in rows]


async def _folder_chain_for_file(file_id: UUID) -> list[UUID]:
    pool = get_pool()
    rows = await pool.fetch(
        "WITH RECURSIVE chain AS ("
        "  SELECT f.id, f.parent_folder_id FROM folders f "
        "  JOIN files fi ON fi.folder_id = f.id WHERE fi.id = $1"
        "  UNION ALL"
        "  SELECT f.id, f.parent_folder_id FROM folders f "
        "  JOIN chain c ON f.id = c.parent_folder_id"
        ") SELECT id FROM chain",
        file_id,
    )
    return [row["id"] for row in rows]


async def _object_targets(object_type: str, object_id: UUID) -> list[tuple[str, UUID]]:
    if object_type == "page":
        return [("page", object_id)] + [
            ("folder", folder_id) for folder_id in await _folder_chain_for_page(object_id)
        ]
    if object_type == "file":
        return [("file", object_id)] + [
            ("folder", folder_id) for folder_id in await _folder_chain_for_file(object_id)
        ]
    return [(object_type, object_id)]


async def _containing_stashes(object_type: str, object_id: UUID) -> list[dict]:
    if object_type not in _CONTENT_TYPES:
        return []

    pool = get_pool()
    rows = []
    for target_type, target_id in await _object_targets(object_type, object_id):
        target_rows = await pool.fetch(
            "SELECT s.id, s.workspace_id, s.owner_id, s.access "
            "FROM stashes s "
            "JOIN stash_items si ON si.stash_id = s.id "
            "WHERE si.object_type = $1 AND si.object_id = $2",
            target_type,
            target_id,
        )
        rows.extend(dict(row) for row in target_rows)
    return rows


async def _stash_member_permission(stash_id: UUID, user_id: UUID) -> str | None:
    pool = get_pool()
    row = await pool.fetchrow(
        "SELECT permission FROM stash_members WHERE stash_id = $1 AND user_id = $2",
        stash_id,
        user_id,
    )
    return row["permission"] if row else None


async def _stash_allows(stash: dict, user_id: UUID | None, require_write: bool) -> bool:
    access = stash["access"]
    if access == "public" and not require_write:
        return True
    if user_id is None:
        return False
    if stash["owner_id"] == user_id:
        return True

    role = await get_workspace_role(stash["workspace_id"], user_id)
    if role in ("owner", "admin"):
        return True
    if access == "workspace":
        return role is not None and not require_write

    permission = await _stash_member_permission(stash["id"], user_id)
    if not permission:
        return False
    if not require_write:
        return True
    return permission in ("write", "admin")


async def check_access(
    object_type: str,
    object_id: UUID,
    user_id: UUID | None,
    workspace_id: UUID | None = None,
    require_write: bool = False,
) -> bool:
    if workspace_id is None:
        workspace_id = await resolve_workspace_id(object_type, object_id)

    if object_type == "stash":
        pool = get_pool()
        row = await pool.fetchrow(
            "SELECT id, workspace_id, owner_id, access FROM stashes WHERE id = $1",
            object_id,
        )
        if not row:
            return False
        return await _stash_allows(dict(row), user_id, require_write)

    if object_type not in _CONTENT_TYPES:
        return False

    if user_id is not None and workspace_id is not None:
        role = await get_workspace_role(workspace_id, user_id)
        if role in ("owner", "admin"):
            return True

    stashes = await _containing_stashes(object_type, object_id)
    if stashes:
        for stash in stashes:
            if await _stash_allows(stash, user_id, require_write):
                return True
        return False

    if user_id is None or workspace_id is None:
        return False
    role = await get_workspace_role(workspace_id, user_id)
    return role is not None and not require_write


async def get_workspace_role(workspace_id: UUID, user_id: UUID) -> str | None:
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
    stashes = await _containing_stashes(object_type, object_id)
    if any(stash["access"] == "private" for stash in stashes):
        return "private"
    if any(stash["access"] == "public" for stash in stashes):
        return "public"
    return "workspace"


async def set_visibility(object_type: str, object_id: UUID, visibility: str) -> None:
    raise ValueError("Privacy is managed by Stashes, not individual objects")


async def set_privacy_visibility(
    object_type: str,
    object_id: UUID,
    visibility: str,
    created_by: UUID | None = None,
) -> None:
    raise ValueError("Privacy is managed by Stashes, not individual objects")


async def add_share(
    object_type: str,
    object_id: UUID,
    user_id: UUID,
    permission: str,
    granted_by: UUID,
) -> dict:
    raise ValueError("Share a Stash instead of sharing individual objects")


async def remove_share(object_type: str, object_id: UUID, user_id: UUID) -> bool:
    raise ValueError("Share a Stash instead of sharing individual objects")


async def get_shares(object_type: str, object_id: UUID) -> list[dict]:
    return []


async def get_permissions(object_type: str, object_id: UUID) -> dict:
    return {
        "object_type": object_type,
        "object_id": object_id,
        "visibility": await get_visibility(object_type, object_id),
        "shares": [],
    }
