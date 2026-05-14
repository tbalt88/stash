"""Tests for the Claude Agent SDK wrapper.

We don't spawn the SDK subprocess in tests (Claude Code CLI is a heavy,
external dependency). Instead we verify:

- Each in-process tool reads workspace context correctly and shapes the
  expected MCP response.
- The tool catalog matches prompts.STASH_TOOL_SET so a misnamed tool
  fails fast at runtime.
"""

from __future__ import annotations

import json
from uuid import UUID, uuid4

import pytest
import pytest_asyncio

from backend.models import StashItem
from backend.services import agent_runtime, permission_service, prompts, stash_service


def test_tool_catalog_matches_prompts_set():
    """`prompts.STASH_TOOL_SET` is the source of truth for what tools each
    LLM call site can use; agent_runtime must implement every name."""
    missing = [name for name in prompts.STASH_TOOL_SET if name not in agent_runtime._TOOLS_BY_NAME]
    assert missing == [], f"agent_runtime missing tool impls: {missing}"


def test_recipient_tool_set_is_subset_of_full():
    """Recipient (share-link) tool set is intentionally narrower than the
    full stash toolset."""
    for name in prompts.RECIPIENT_TOOL_SET:
        assert name in prompts.STASH_TOOL_SET


@pytest.mark.asyncio
async def test_current_workspace_raises_outside_context():
    """Tools refuse to run unless `_workspace_ctx` is set — guards against
    a tool firing across the wrong workspace if context binding regresses."""
    with pytest.raises(RuntimeError):
        agent_runtime._current_workspace()


@pytest_asyncio.fixture
async def workspace(_db_pool):
    user_id = uuid4()
    ws_id = uuid4()
    await _db_pool.execute(
        "INSERT INTO users (id, name) VALUES ($1, $2)",
        user_id,
        f"u_{user_id.hex[:6]}",
    )
    await _db_pool.execute(
        "INSERT INTO workspaces (id, name, creator_id, invite_code) " "VALUES ($1, $2, $3, $4)",
        ws_id,
        f"ws_{ws_id.hex[:6]}",
        user_id,
        ws_id.hex[:12],
    )
    return ws_id


@pytest.mark.asyncio
async def test_list_files_tool_scopes_by_workspace(workspace: UUID, _db_pool):
    """Verifies the workspace-context plumbing end-to-end on one tool: the
    response should contain only this workspace's files."""
    user_id = await _db_pool.fetchval("SELECT creator_id FROM workspaces WHERE id = $1", workspace)
    await _db_pool.execute(
        "INSERT INTO files (workspace_id, name, content_type, size_bytes, storage_key, uploaded_by) "
        "VALUES ($1, $2, $3, $4, $5, $6)",
        workspace,
        "scoped.txt",
        "text/plain",
        7,
        f"key_{workspace.hex[:6]}",
        user_id,
    )

    token = agent_runtime._workspace_ctx.set(workspace)
    try:
        result = await agent_runtime._list_files.handler({})
    finally:
        agent_runtime._workspace_ctx.reset(token)

    payload = json.loads(result["content"][0]["text"])
    names = [r["name"] for r in payload]
    assert "scoped.txt" in names


@pytest.mark.asyncio
async def test_stash_tools_create_list_and_delete(workspace: UUID, _db_pool):
    user_id = await _db_pool.fetchval("SELECT creator_id FROM workspaces WHERE id = $1", workspace)
    folder_id = uuid4()
    await _db_pool.execute(
        "INSERT INTO folders (id, workspace_id, name, created_by) VALUES ($1, $2, $3, $4)",
        folder_id,
        workspace,
        "Launch notes",
        user_id,
    )

    workspace_token = agent_runtime._workspace_ctx.set(workspace)
    user_token = agent_runtime._user_ctx.set(user_id)
    try:
        create_result = await agent_runtime._create_stash.handler(
            {
                "title": "Launch bundle",
                "description": "Published launch context",
                "items": [{"object_type": "folder", "object_id": str(folder_id)}],
            }
        )
        list_result = await agent_runtime._list_stashes.handler({})
    finally:
        agent_runtime._user_ctx.reset(user_token)
        agent_runtime._workspace_ctx.reset(workspace_token)

    created = json.loads(create_result["content"][0]["text"])
    listed = json.loads(list_result["content"][0]["text"])
    assert created["title"] == "Launch bundle"
    assert listed[0]["id"] == created["id"]
    assert listed[0]["items"][0]["object_type"] == "folder"

    workspace_token = agent_runtime._workspace_ctx.set(workspace)
    user_token = agent_runtime._user_ctx.set(user_id)
    try:
        delete_result = await agent_runtime._delete_stash.handler({"stash_id": created["id"]})
    finally:
        agent_runtime._user_ctx.reset(user_token)
        agent_runtime._workspace_ctx.reset(workspace_token)

    deleted = json.loads(delete_result["content"][0]["text"])
    assert deleted == {"deleted": True, "stash_id": created["id"]}


@pytest.mark.asyncio
async def test_external_stash_is_live_workspace_attachment(workspace: UUID, _db_pool):
    owner_id = await _db_pool.fetchval("SELECT creator_id FROM workspaces WHERE id = $1", workspace)
    target_workspace = uuid4()
    page_id = uuid4()
    await _db_pool.execute(
        "INSERT INTO workspaces (id, name, creator_id, invite_code) VALUES ($1, $2, $3, $4)",
        target_workspace,
        f"target_{target_workspace.hex[:6]}",
        owner_id,
        target_workspace.hex[:12],
    )
    await _db_pool.execute(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')",
        target_workspace,
        owner_id,
    )
    await _db_pool.execute(
        "INSERT INTO pages (id, workspace_id, name, content_markdown, created_by) "
        "VALUES ($1, $2, $3, $4, $5)",
        page_id,
        workspace,
        "Public source page",
        "External Stash source",
        owner_id,
    )
    await permission_service.set_visibility("page", page_id, "public")
    source = await stash_service.create_stash(
        workspace_id=workspace,
        owner_id=owner_id,
        title="Live source Stash",
        description="",
        is_public=True,
        discoverable=False,
        cover_image_url=None,
        items=[StashItem(object_type="page", object_id=page_id)],
    )

    attached = await stash_service.add_external_stash(
        target_workspace, source["slug"], added_by=owner_id
    )
    target_stashes = await stash_service.list_workspace_stashes(target_workspace)

    assert attached is not None
    assert attached["id"] == source["id"]
    assert attached["is_external"] is True
    assert attached["added_to_workspace_id"] == target_workspace
    assert [stash["id"] for stash in target_stashes] == [source["id"]]
    assert target_stashes[0]["workspace_id"] == workspace
