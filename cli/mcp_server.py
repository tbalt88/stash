"""MCP server exposing Stash workspace tools to any MCP client."""

import json

from mcp.server.fastmcp import FastMCP

from cli.client import StashClient
from cli.config import load_config, load_manifest

mcp = FastMCP("stash", instructions="Stash — shared memory for AI coding agents")


def _client() -> tuple[StashClient, str]:
    """Build a StashClient + resolve the active workspace id."""
    cfg = load_config()
    client = StashClient(cfg["base_url"], cfg.get("api_key", ""))
    manifest = load_manifest()
    ws_id = (manifest or {}).get("workspace_id", "")
    return client, ws_id


def _require_ws(ws_id: str | None) -> str:
    if not ws_id:
        raise ValueError("No workspace. Pass workspace_id or run `stash connect` in a repo first.")
    return ws_id


def _json(obj: object) -> str:
    return json.dumps(obj, default=str)


# ── History / search ──────────────────────────────────────────────


@mcp.tool()
def stash_search(query: str, limit: int = 20, workspace_id: str = "") -> str:
    """Full-text + semantic search across workspace history events."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    return _json(client.search_events(ws, query, limit=limit))


@mcp.tool()
def stash_query_events(
    limit: int = 20,
    agent_name: str = "",
    event_type: str = "",
    workspace_id: str = "",
) -> str:
    """Query recent history events, optionally filtered by agent or event type."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    return _json(
        client.query_events(
            ws,
            agent_name=agent_name or None,
            event_type=event_type or None,
            limit=limit,
        )
    )


@mcp.tool()
def stash_list_agents(workspace_id: str = "") -> str:
    """List distinct agent names that have pushed events to the workspace."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    return _json(client.list_agent_names(ws))


@mcp.tool()
def stash_push_event(
    agent_name: str,
    event_type: str,
    content: str,
    session_id: str = "",
    tool_name: str = "",
    workspace_id: str = "",
) -> str:
    """Push a new event into workspace history."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    return _json(
        client.push_event(
            ws,
            agent_name=agent_name,
            event_type=event_type,
            content=content,
            session_id=session_id or None,
            tool_name=tool_name or None,
        )
    )


# ── Folders + pages (wiki) ────────────────────────────────────────


@mcp.tool()
def stash_list_folders(workspace_id: str = "") -> str:
    """List folders in the workspace (flat)."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    return _json(client.list_folders(ws))


@mcp.tool()
def stash_create_folder(
    name: str,
    parent_folder_id: str = "",
    workspace_id: str = "",
) -> str:
    """Create a folder in the workspace. Pass parent_folder_id to nest."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    return _json(client.create_folder(ws, name, parent_folder_id=parent_folder_id or None))


@mcp.tool()
def stash_delete_folder(folder_id: str, workspace_id: str = "") -> str:
    """Delete a folder (and everything inside it) from the workspace."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    client.delete_folder(ws, folder_id)
    return _json({"deleted": folder_id})


@mcp.tool()
def stash_workspace_tree(workspace_id: str = "") -> str:
    """Nested folder/page tree for the workspace."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    return _json(client.get_workspace_tree(ws))


@mcp.tool()
def stash_list_pages(workspace_id: str = "") -> str:
    """Flat list of every page in the workspace."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    return _json(client.list_pages(ws))


@mcp.tool()
def stash_read_page(page_id: str, workspace_id: str = "") -> str:
    """Read a page's content."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    return _json(client.get_page(ws, page_id))


@mcp.tool()
def stash_create_page(
    name: str,
    content: str = "",
    folder_id: str = "",
    workspace_id: str = "",
) -> str:
    """Create a page. Pass folder_id to drop it into a folder; omit for the workspace root."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    return _json(client.create_page(ws, name=name, content=content, folder_id=folder_id or None))


@mcp.tool()
def stash_edit_page(
    page_id: str,
    content: str,
    name: str = "",
    workspace_id: str = "",
) -> str:
    """Update an existing page's content (and optionally rename)."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    kwargs: dict = {"content": content}
    if name:
        kwargs["name"] = name
    return _json(client.update_page(ws, page_id, **kwargs))


@mcp.tool()
def stash_delete_page(page_id: str, workspace_id: str = "") -> str:
    """Delete a page."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    client.delete_page(ws, page_id)
    return _json({"deleted": page_id})


# ── Tables ────────────────────────────────────────────────────────


@mcp.tool()
def stash_list_tables(workspace_id: str = "") -> str:
    """List tables in the workspace."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    return _json(client.list_tables(ws))


@mcp.tool()
def stash_create_table(
    name: str,
    description: str = "",
    columns: str = "[]",
    workspace_id: str = "",
) -> str:
    """Create a new table. columns is a JSON array of {name, type} objects."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    cols = json.loads(columns) if isinstance(columns, str) else columns
    return _json(client.create_table(ws, name, description=description, columns=cols))


@mcp.tool()
def stash_delete_table(table_id: str, workspace_id: str = "") -> str:
    """Delete a table from the workspace."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    client.delete_table(ws, table_id)
    return _json({"deleted": table_id})


@mcp.tool()
def stash_table_schema(table_id: str, workspace_id: str = "") -> str:
    """Get a table's schema (columns and types)."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    return _json(client.get_table(ws, table_id))


@mcp.tool()
def stash_query_table(
    table_id: str,
    limit: int = 50,
    offset: int = 0,
    sort_by: str = "",
    sort_order: str = "asc",
    filters: str = "",
    workspace_id: str = "",
) -> str:
    """Query rows from a table with optional sorting and filtering."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    return _json(
        client.list_table_rows(
            ws,
            table_id,
            limit=limit,
            offset=offset,
            sort_by=sort_by,
            sort_order=sort_order,
            filters=filters,
        )
    )


@mcp.tool()
def stash_insert_row(table_id: str, data: str, workspace_id: str = "") -> str:
    """Insert a row into a table. data is a JSON object mapping column names to values."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    row_data = json.loads(data) if isinstance(data, str) else data
    return _json(client.insert_table_row(ws, table_id, row_data))


@mcp.tool()
def stash_update_row(table_id: str, row_id: str, data: str, workspace_id: str = "") -> str:
    """Update a row in a table. data is a JSON object of column values to update."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    row_data = json.loads(data) if isinstance(data, str) else data
    return _json(client.update_table_row(ws, table_id, row_id, row_data))


@mcp.tool()
def stash_delete_row(table_id: str, row_id: str, workspace_id: str = "") -> str:
    """Delete a row from a table."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    client.delete_table_row(ws, table_id, row_id)
    return _json({"deleted": row_id})


@mcp.tool()
def stash_add_column(
    table_id: str,
    name: str,
    col_type: str = "text",
    options: str = "[]",
    workspace_id: str = "",
) -> str:
    """Add a column to a table. col_type: text, number, boolean, date, select, url."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    opts = json.loads(options) if isinstance(options, str) else options
    return _json(
        client.add_table_column(ws, table_id, name, col_type=col_type, options=opts or None)
    )


@mcp.tool()
def stash_delete_column(table_id: str, column_id: str, workspace_id: str = "") -> str:
    """Delete a column from a table."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    return _json(client.delete_table_column(ws, table_id, column_id))


# ── Workspaces ────────────────────────────────────────────────────


@mcp.tool()
def stash_list_workspaces() -> str:
    """List workspaces you are a member of."""
    client, _ = _client()
    return _json(client.list_workspaces(mine=True))


@mcp.tool()
def stash_workspace_info(workspace_id: str = "") -> str:
    """Get detailed info about a workspace."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    return _json(client.get_workspace(ws))


@mcp.tool()
def stash_create_workspace(name: str, description: str = "", is_public: bool = False) -> str:
    """Create a new workspace."""
    client, _ = _client()
    return _json(client.create_workspace(name, description=description, is_public=is_public))


@mcp.tool()
def stash_workspace_members(workspace_id: str = "") -> str:
    """List members of a workspace."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    return _json(client.workspace_members(ws))


@mcp.tool()
def stash_join_workspace(invite_code: str) -> str:
    """Join a workspace using an invite code."""
    client, _ = _client()
    return _json(client.join_workspace(invite_code))


@mcp.tool()
def stash_leave_workspace(workspace_id: str) -> str:
    """Leave a workspace."""
    client, _ = _client()
    client.leave_workspace(workspace_id)
    return _json({"left": workspace_id})


@mcp.tool()
def stash_fork_workspace(workspace_id: str, name: str = "") -> str:
    """Fork a public workspace into your account."""
    client, _ = _client()
    return _json(client.fork_workspace(workspace_id, name=name))


# ── Stash-named aliases (canonical going forward) ─────────────────


@mcp.tool()
def stash_list_stashes() -> str:
    """List stashes you are a member of."""
    return stash_list_workspaces()


@mcp.tool()
def stash_stash_info(stash_id: str = "") -> str:
    """Get detailed info about a stash."""
    return stash_workspace_info(stash_id)


@mcp.tool()
def stash_create_stash(name: str, description: str = "", is_public: bool = False) -> str:
    """Create a new stash."""
    return stash_create_workspace(name, description=description, is_public=is_public)


@mcp.tool()
def stash_stash_members(stash_id: str = "") -> str:
    """List members of a stash."""
    return stash_workspace_members(stash_id)


@mcp.tool()
def stash_join_stash(invite_code: str) -> str:
    """Join a stash using an invite code."""
    return stash_join_workspace(invite_code)


@mcp.tool()
def stash_leave_stash(stash_id: str) -> str:
    """Leave a stash."""
    return stash_leave_workspace(stash_id)


@mcp.tool()
def stash_fork_stash(stash_id: str, name: str = "") -> str:
    """Fork a public stash into your account."""
    return stash_fork_workspace(stash_id, name=name)


@mcp.tool()
def stash_stash_tree(stash_id: str = "") -> str:
    """Nested folder/page tree for the stash."""
    return stash_workspace_tree(stash_id)


# ── Skills (Phase 2 wiring; Phase 1 stubs return empty until skill_service lands) ──


@mcp.tool()
def stash_list_skills(stash_id: str = "") -> str:
    """List skills (wiki folders containing SKILL.md) in the stash."""
    client, default_ws = _client()
    ws = _require_ws(stash_id or default_ws)
    try:
        data = client._get(f"/api/v1/stashes/{ws}/skills")
    except Exception:
        data = []
    return _json(data)


@mcp.tool()
def stash_read_skill(skill_name: str, stash_id: str = "") -> str:
    """Read a skill by name. Returns SKILL.md frontmatter + body + sibling files concatenated."""
    client, default_ws = _client()
    ws = _require_ws(stash_id or default_ws)
    try:
        data = client._get(f"/api/v1/stashes/{ws}/skills/{skill_name}")
    except Exception as e:
        data = {"error": str(e)}
    return _json(data)


# ── Files ─────────────────────────────────────────────────────────


@mcp.tool()
def stash_list_files(workspace_id: str = "") -> str:
    """List files uploaded to the workspace."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    return _json(client.list_ws_files(ws))


@mcp.tool()
def stash_file_text(file_id: str, workspace_id: str = "") -> str:
    """Extract text content from a workspace file (PDF, doc, etc.)."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    return _json(client.get_ws_file_text(ws, file_id))


@mcp.tool()
def stash_upload_file(file_path: str, workspace_id: str = "") -> str:
    """Upload a local file to the workspace."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    return _json(client.upload_ws_file(ws, file_path))


@mcp.tool()
def stash_delete_file(file_id: str, workspace_id: str = "") -> str:
    """Delete a file from the workspace."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    client.delete_ws_file(ws, file_id)
    return _json({"deleted": file_id})


# ── Views ─────────────────────────────────────────────────────────


@mcp.tool()
def stash_list_views(workspace_id: str = "") -> str:
    """List views in the workspace."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    return _json(client.list_views(ws))


@mcp.tool()
def stash_create_view(
    title: str,
    description: str = "",
    is_public: bool = False,
    items: str = "[]",
    workspace_id: str = "",
) -> str:
    """Create a curated view. items is a JSON array of object references."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    item_list = json.loads(items) if isinstance(items, str) else items
    return _json(
        client.create_view(ws, title, description=description, is_public=is_public, items=item_list)
    )


@mcp.tool()
def stash_delete_view(view_id: str) -> str:
    """Delete a view."""
    client, _ = _client()
    client.delete_view(view_id)
    return _json({"deleted": view_id})


@mcp.tool()
def stash_get_view(slug: str) -> str:
    """Get a public view by its slug."""
    client, _ = _client()
    return _json(client.get_public_view(slug))


@mcp.tool()
def stash_fork_view(slug: str, name: str = "") -> str:
    """Fork a view into your workspace."""
    client, _ = _client()
    return _json(client.fork_view(slug, name=name))


# ── Invites ───────────────────────────────────────────────────────


@mcp.tool()
def stash_create_invite(max_uses: int = 1, ttl_days: int = 7, workspace_id: str = "") -> str:
    """Create an invite token for the workspace."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    return _json(client.create_invite_token(ws, max_uses=max_uses, ttl_days=ttl_days))


@mcp.tool()
def stash_list_invites(workspace_id: str = "") -> str:
    """List active invite tokens for the workspace."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    return _json(client.list_invite_tokens(ws))


@mcp.tool()
def stash_revoke_invite(token_id: str, workspace_id: str = "") -> str:
    """Revoke an invite token."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    client.revoke_invite_token(ws, token_id)
    return _json({"revoked": token_id})


# ── Decks ─────────────────────────────────────────────────────────


@mcp.tool()
def stash_list_decks(workspace_id: str = "") -> str:
    """List decks in the workspace."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    return _json(client.list_decks(ws))


@mcp.tool()
def stash_create_deck(
    name: str,
    description: str = "",
    html_content: str = "",
    deck_type: str = "freeform",
    workspace_id: str = "",
) -> str:
    """Create a new deck in the workspace."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    return _json(
        client.create_deck(
            ws, name, description=description, html_content=html_content, deck_type=deck_type
        )
    )


@mcp.tool()
def stash_get_deck(deck_id: str, workspace_id: str = "") -> str:
    """Get a deck by ID."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    return _json(client.get_deck(ws, deck_id))


@mcp.tool()
def stash_update_deck(deck_id: str, updates: str = "{}", workspace_id: str = "") -> str:
    """Update a deck. updates is a JSON object of fields to change."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    fields = json.loads(updates) if isinstance(updates, str) else updates
    return _json(client.update_deck(ws, deck_id, **fields))


@mcp.tool()
def stash_delete_deck(deck_id: str, workspace_id: str = "") -> str:
    """Delete a deck from the workspace."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    client.delete_deck(ws, deck_id)
    return _json({"deleted": deck_id})


# ── User ──────────────────────────────────────────────────────────


@mcp.tool()
def stash_whoami() -> str:
    """Get info about the currently authenticated user."""
    client, _ = _client()
    return _json(client.whoami())


# ── Sharing (unified ACL + share-link + publish) ──────────────────


@mcp.tool()
def stash_get_permissions(object_type: str, object_id: str) -> str:
    """Get visibility + shares for any object (workspace|folder|page|table|file|history|view)."""
    client, _ = _client()
    return _json(client.get_object_permissions(object_type, object_id))


@mcp.tool()
def stash_set_visibility(object_type: str, object_id: str, visibility: str) -> str:
    """Set visibility on an object. Allowed: inherit | private | link | public."""
    client, _ = _client()
    return _json(client.set_object_visibility(object_type, object_id, visibility))


@mcp.tool()
def stash_add_share(
    object_type: str, object_id: str, user_id: str, permission: str = "read"
) -> str:
    """Grant a specific user access to an object. permission: read | write | admin."""
    client, _ = _client()
    return _json(client.add_object_share(object_type, object_id, user_id, permission))


@mcp.tool()
def stash_remove_share(object_type: str, object_id: str, user_id: str) -> str:
    """Revoke a specific user's access to an object."""
    client, _ = _client()
    client.remove_object_share(object_type, object_id, user_id)
    return _json({"removed": user_id})


@mcp.tool()
def stash_share(object_type: str, object_id: str, ensure: str = "link") -> str:
    """Mint or fetch a share URL for any object. ensure: '' | 'link' | 'public'.

    With ensure='link' (default), the underlying object's visibility is raised
    to at least 'link' if it isn't already, so the returned URL is guaranteed
    to be readable to anyone with it. Pass ensure='' to skip the visibility
    bump (use when you want the URL but plan to set permissions separately)."""
    client, _ = _client()
    return _json(client.share_link(object_type, object_id, ensure or None))


@mcp.tool()
def stash_publish_html(
    title: str,
    html: str,
    workspace_id: str = "",
    audience: str = "link",
    folder_id: str = "",
) -> str:
    """Single-call publish: create an HTML page and return a share URL.

    If folder_id is omitted, the page lands in the workspace's auto-created
    'AI Drafts' folder. audience: 'link' (anyone with URL) or 'public'
    (also listed in /discover)."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    return _json(
        client.publish(
            workspace_id=ws,
            title=title,
            content=html,
            content_type="html",
            audience=audience,
            folder_id=folder_id or None,
        )
    )


@mcp.tool()
def stash_publish_markdown(
    title: str,
    markdown: str,
    workspace_id: str = "",
    audience: str = "link",
    folder_id: str = "",
) -> str:
    """Single-call publish: create a markdown page and return a share URL.
    Same flow as stash_publish_html but for markdown content."""
    client, default_ws = _client()
    ws = _require_ws(workspace_id or default_ws)
    return _json(
        client.publish(
            workspace_id=ws,
            title=title,
            content=markdown,
            content_type="markdown",
            audience=audience,
            folder_id=folder_id or None,
        )
    )


# ── Entry point ───────────────────────────────────────────────────


def main():
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
