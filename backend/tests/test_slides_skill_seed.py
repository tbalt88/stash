"""Tests for the default slides skill seeded into every workspace."""

import pytest
from httpx import AsyncClient

from .conftest import unique_name


async def _register_and_create_workspace(client: AsyncClient) -> tuple[str, str]:
    """Returns (api_key, workspace_id) for a freshly registered user."""
    resp = await client.post(
        "/api/v1/users/register",
        json={"name": unique_name(), "password": "securepassword1"},
    )
    assert resp.status_code == 201
    api_key = resp.json()["api_key"]
    auth = {"Authorization": f"Bearer {api_key}"}
    ws = await client.post(
        "/api/v1/workspaces",
        json={"name": "Slide Studio", "description": ""},
        headers=auth,
    )
    assert ws.status_code == 201
    return api_key, ws.json()["id"]


@pytest.mark.asyncio
async def test_new_workspace_has_slides_skill(client: AsyncClient):
    api_key, workspace_id = await _register_and_create_workspace(client)
    auth = {"Authorization": f"Bearer {api_key}"}

    resp = await client.get(
        f"/api/v1/workspaces/{workspace_id}/skills",
        headers=auth,
    )
    assert resp.status_code == 200
    skills = resp.json()
    names = [s["name"] for s in skills]
    assert "slides" in names, f"slides skill missing from new workspace: {names}"


@pytest.mark.asyncio
async def test_slides_skill_body_covers_canvas(client: AsyncClient):
    """The seeded SKILL.md should teach the 1920x1080 canvas — that's the
    whole reason the skill exists. Guard against an accidental edit that
    drops the dimension constraint."""
    api_key, workspace_id = await _register_and_create_workspace(client)
    auth = {"Authorization": f"Bearer {api_key}"}

    resp = await client.get(
        f"/api/v1/workspaces/{workspace_id}/skills/slides",
        headers=auth,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    combined = body.get("combined", "") or body.get("body", "")
    assert "1920" in combined and "1080" in combined, (
        "slides skill must spell out the canvas dimensions so agents "
        "stop overflowing"
    )
    assert "<section class=\"slide\">" in combined or "section.slide" in combined, (
        "slides skill must spell out the slide element format"
    )
