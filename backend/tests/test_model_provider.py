"""Managed model keys + paid-tier gating for the cloud agent."""

import uuid

import pytest
from fastapi import HTTPException

from backend.config import settings
from backend.services import billing_service, model_provider


@pytest.mark.asyncio
async def test_local_mode_needs_no_key(monkeypatch):
    monkeypatch.setattr(settings, "AGENT_EXEC_MODE", "local")
    env = await model_provider.turn_env(uuid.uuid4(), model_provider.ANTHROPIC)
    assert env == {}


@pytest.mark.asyncio
async def test_free_user_is_gated(monkeypatch):
    monkeypatch.setattr(settings, "AGENT_EXEC_MODE", "sprites")
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "sk-ant-managed")

    async def not_pro(_uid):
        return False

    monkeypatch.setattr(billing_service, "is_pro", not_pro)
    with pytest.raises(HTTPException) as exc:
        await model_provider.turn_env(uuid.uuid4(), model_provider.ANTHROPIC)
    assert exc.value.status_code == 402


@pytest.mark.asyncio
async def test_pro_user_gets_managed_key(monkeypatch):
    monkeypatch.setattr(settings, "AGENT_EXEC_MODE", "sprites")
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "sk-ant-managed")

    async def is_pro(_uid):
        return True

    monkeypatch.setattr(billing_service, "is_pro", is_pro)
    env = await model_provider.turn_env(uuid.uuid4(), model_provider.ANTHROPIC)
    assert env == {"ANTHROPIC_API_KEY": "sk-ant-managed"}


@pytest.mark.asyncio
async def test_pro_user_but_no_managed_key_is_503(monkeypatch):
    monkeypatch.setattr(settings, "AGENT_EXEC_MODE", "sprites")
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", None)

    async def is_pro(_uid):
        return True

    monkeypatch.setattr(billing_service, "is_pro", is_pro)
    with pytest.raises(HTTPException) as exc:
        await model_provider.turn_env(uuid.uuid4(), model_provider.ANTHROPIC)
    assert exc.value.status_code == 503


def test_provider_env_var_mapping():
    assert model_provider.ANTHROPIC.env_var == "ANTHROPIC_API_KEY"
    assert model_provider.OPENROUTER.env_var == "OPENROUTER_API_KEY"
    assert model_provider.OPENAI.env_var == "OPENAI_API_KEY"
