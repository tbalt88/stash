"""Permission service for workspace content objects.

Cartridges are the only privacy boundary for files, pages, folders, sessions,
and tables. Content with no Stash membership is workspace-visible.
"""

from uuid import UUID

from ..database import get_pool

_WORKSPACE_LOOKUP = {
    "table": ("tables", "workspace_id"),
    "file": ("files", "workspace_id"),
    "session": ("sessions", "workspace_id"),
    "stash": ("cartridges", "workspace_id"),
    "folder": ("folders", "workspace_id"),
    "page": ("pages", "workspace_id"),
}

_CONTENT_TYPES = {"folder", "page", "session", "table", "file"}


def _folder_chain_sql(folder_id_expr: str) -> str:
    return (
        "WITH RECURSIVE folder_chain AS ("
        "  SELECT folder_node.id, folder_node.parent_folder_id "
        f"  FROM folders folder_node WHERE folder_node.id = {folder_id_expr}"
        "  UNION ALL"
        "  SELECT parent_folder.id, parent_folder.parent_folder_id FROM folders parent_folder "
        "  JOIN folder_chain c ON parent_folder.id = c.parent_folder_id"
        ") SELECT id FROM folder_chain"
    )


def _cartridge_item_target_condition(object_type: str, object_alias: str, cartridge_item_alias: str) -> str:
    if object_type == "page":
        folder_chain = _folder_chain_sql(f"{object_alias}.folder_id")
        return (
            f"(({cartridge_item_alias}.object_type = 'page' "
            f"AND {cartridge_item_alias}.object_id = {object_alias}.id) "
            f"OR ({cartridge_item_alias}.object_type = 'folder' "
            f"AND {object_alias}.folder_id IS NOT NULL "
            f"AND {cartridge_item_alias}.object_id IN ({folder_chain})))"
        )
    if object_type == "file":
        folder_chain = _folder_chain_sql(f"{object_alias}.folder_id")
        return (
            f"(({cartridge_item_alias}.object_type = 'file' "
            f"AND {cartridge_item_alias}.object_id = {object_alias}.id) "
            f"OR ({cartridge_item_alias}.object_type = 'folder' "
            f"AND {object_alias}.folder_id IS NOT NULL "
            f"AND {cartridge_item_alias}.object_id IN ({folder_chain})))"
        )
    if object_type in _CONTENT_TYPES:
        return (
            f"({cartridge_item_alias}.object_type = '{object_type}' "
            f"AND {cartridge_item_alias}.object_id = {object_alias}.id)"
        )
    return "FALSE"


def readable_content_condition(object_type: str, object_alias: str, user_arg: int) -> str:
    target_condition = _cartridge_item_target_condition(object_type, object_alias, "content_cartridge_item")
    return f"""
        (
          NOT EXISTS (
            SELECT 1
            FROM cartridge_items content_cartridge_item
            WHERE {target_condition}
          )
          OR EXISTS (
            SELECT 1
            FROM cartridge_items content_cartridge_item
            JOIN cartridges content_cartridge ON content_cartridge.id = content_cartridge_item.cartridge_id
            LEFT JOIN workspace_members content_workspace_member
              ON content_workspace_member.workspace_id = content_cartridge.workspace_id
             AND content_workspace_member.user_id = ${user_arg}
            LEFT JOIN cartridge_members content_cartridge_member
              ON content_cartridge_member.cartridge_id = content_cartridge.id
             AND content_cartridge_member.user_id = ${user_arg}
            WHERE {target_condition}
              AND (
                content_cartridge.public_permission != 'none'
                OR (
                  content_cartridge.workspace_permission != 'none'
                  AND content_workspace_member.user_id IS NOT NULL
                )
                OR content_cartridge.owner_id = ${user_arg}
                OR content_cartridge_member.user_id IS NOT NULL
              )
          )
        )
    """


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
            "SELECT s.id, s.workspace_id, s.owner_id, "
            "s.workspace_permission, s.public_permission "
            "FROM cartridges s "
            "JOIN cartridge_items si ON si.cartridge_id = s.id "
            "WHERE si.object_type = $1 AND si.object_id = $2",
            target_type,
            target_id,
        )
        rows.extend(dict(row) for row in target_rows)
    return rows


async def _cartridge_member_permission(cartridge_id: UUID, user_id: UUID) -> str | None:
    pool = get_pool()
    row = await pool.fetchrow(
        "SELECT permission FROM cartridge_members WHERE cartridge_id = $1 AND user_id = $2",
        cartridge_id,
        user_id,
    )
    return row["permission"] if row else None


async def _cartridge_allows(stash: dict, user_id: UUID | None, require_write: bool) -> bool:
    workspace_permission = stash["workspace_permission"]
    public_permission = stash["public_permission"]
    if public_permission != "none" and not require_write:
        return True
    if user_id is None:
        return False
    if stash["owner_id"] == user_id:
        return True

    role = await get_workspace_role(stash["workspace_id"], user_id)
    permission = await _cartridge_member_permission(stash["id"], user_id)
    if role is not None and workspace_permission != "none" and not require_write:
        return True
    if role is not None and workspace_permission == "write" and require_write:
        return True
    if require_write and public_permission == "write":
        return True
    if permission:
        if not require_write:
            return True
        return permission in ("write", "admin")
    return False


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
            "SELECT id, workspace_id, owner_id, workspace_permission, public_permission "
            "FROM cartridges WHERE id = $1",
            object_id,
        )
        if not row:
            return False
        return await _cartridge_allows(dict(row), user_id, require_write)

    if object_type not in _CONTENT_TYPES:
        return False

    cartridges = await _containing_stashes(object_type, object_id)
    if cartridges:
        for stash in cartridges:
            if await _cartridge_allows(stash, user_id, require_write):
                return True
        return False

    if user_id is None or workspace_id is None:
        return False
    role = await get_workspace_role(workspace_id, user_id)
    if require_write:
        return role in ("owner", "admin", "editor")
    return role is not None


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
    cartridges = await _containing_stashes(object_type, object_id)
    if any(
        stash["workspace_permission"] == "none" and stash["public_permission"] == "none"
        for stash in cartridges
    ):
        return "private"
    if any(stash["public_permission"] != "none" for stash in cartridges):
        return "public"
    return "workspace"
