"""Named agents: CRUD, defaults, channel binding, scheduling, resolver override."""

from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient

from backend.services import agent_service
from backend.tasks.agent_schedules import _is_due

from .conftest import unique_name


async def _register(client: AsyncClient) -> str:
    r = await client.post(
        "/api/v1/users/register",
        json={"name": unique_name("agents"), "password": "securepassword1"},
    )
    return r.json()["api_key"]


def _auth(k: str) -> dict:
    return {"Authorization": f"Bearer {k}"}


@pytest.mark.asyncio
async def test_default_agent_autocreated_and_listed(client: AsyncClient):
    key = await _register(client)
    r = await client.get("/api/v1/me/agents", headers=_auth(key))
    assert r.status_code == 200
    agents = r.json()["agents"]
    assert len(agents) == 1 and agents[0]["is_default"] is True


@pytest.mark.asyncio
async def test_create_update_delete_agent(client: AsyncClient):
    key = await _register(client)
    await client.get("/api/v1/me/agents", headers=_auth(key))  # seed default

    created = (
        await client.post(
            "/api/v1/me/agents",
            json={"name": "Researcher", "model_provider": "openrouter",
                  "system_prompt": "Be terse."},
            headers=_auth(key),
        )
    ).json()
    assert created["name"] == "Researcher" and created["model_provider"] == "openrouter"

    updated = (
        await client.patch(
            f"/api/v1/me/agents/{created['id']}",
            json={"name": "Researcher 2", "model_provider": "anthropic"},
            headers=_auth(key),
        )
    ).json()
    assert updated["name"] == "Researcher 2" and updated["model_provider"] == "anthropic"

    r = await client.delete(f"/api/v1/me/agents/{created['id']}", headers=_auth(key))
    assert r.status_code == 200
    remaining = (await client.get("/api/v1/me/agents", headers=_auth(key))).json()["agents"]
    assert all(a["id"] != created["id"] for a in remaining)


@pytest.mark.asyncio
async def test_cannot_delete_default(client: AsyncClient):
    key = await _register(client)
    default = (await client.get("/api/v1/me/agents", headers=_auth(key))).json()["agents"][0]
    r = await client.delete(f"/api/v1/me/agents/{default['id']}", headers=_auth(key))
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_invalid_model_provider_and_schedule(client: AsyncClient):
    key = await _register(client)
    bad = await client.post(
        "/api/v1/me/agents", json={"name": "x", "model_provider": "bogus"}, headers=_auth(key)
    )
    assert bad.status_code == 400
    no_cron = await client.post(
        "/api/v1/me/agents", json={"name": "x", "run_mode": "scheduled"}, headers=_auth(key)
    )
    assert no_cron.status_code == 400


@pytest.mark.asyncio
async def test_channel_binding_is_unique_and_resolves(client: AsyncClient, _db_pool):
    key = await _register(client)
    agents = (await client.get("/api/v1/me/agents", headers=_auth(key))).json()["agents"]
    default_id = agents[0]["id"]
    a = (await client.post("/api/v1/me/agents", json={"name": "Slackbot"}, headers=_auth(key))).json()
    b = (await client.post("/api/v1/me/agents", json={"name": "Other"}, headers=_auth(key))).json()

    await client.patch(f"/api/v1/me/agents/{a['id']}", json={"name": "Slackbot", "slack_bound": True}, headers=_auth(key))
    # Binding a second agent clears the first (unique per user).
    await client.patch(f"/api/v1/me/agents/{b['id']}", json={"name": "Other", "slack_bound": True}, headers=_auth(key))
    listed = (await client.get("/api/v1/me/agents", headers=_auth(key))).json()["agents"]
    bound = [x for x in listed if x["slack_bound"]]
    assert len(bound) == 1 and bound[0]["id"] == b["id"]

    user_id = (await client.get("/api/v1/users/me", headers=_auth(key))).json()["id"]
    from uuid import UUID

    resolved = await agent_service.channel_agent(UUID(user_id), "slack")
    assert resolved["id"] == b["id"]
    # Telegram is unbound → falls back to the default agent.
    tg = await agent_service.channel_agent(UUID(user_id), "telegram")
    assert tg["id"] == default_id


def test_cron_due_check():
    now = datetime(2026, 7, 6, 9, 0, tzinfo=UTC)
    # A daily 9am job whose last run was yesterday is due.
    assert _is_due("0 9 * * *", now - timedelta(days=1), now) is True
    # First sight (no last run) baselines at now → not due yet.
    assert _is_due("0 9 * * *", None, now) is False
    # Last run 08:59; the 09:00 tick hasn't run yet → due now.
    assert _is_due("0 9 * * *", now - timedelta(minutes=1), now) is True
    # Just ran at 09:00; next tick is tomorrow → not due (no double-fire).
    assert _is_due("0 9 * * *", now, now) is False
    # Bad cron → never due, no crash.
    assert _is_due("not a cron", None, now) is False
