"""Granola integration (official API-key API). Mocks httpx so no live key is
needed: the indexer lists notes + fetches each note's transcript and copies the
rendered markdown into granola_notes; the api-key endpoint validates + stores."""

from uuid import UUID

import pytest
from httpx import AsyncClient

from backend.integrations.granola import indexer as granola_indexer
from backend.integrations.granola import provider as granola_provider
from backend.services import source_service

from .conftest import unique_name


class _FakeResp:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


class _FakeClient:
    """Routes GET calls to canned responses by URL substring."""

    def __init__(self, routes):
        self._routes = routes

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def get(self, url, params=None, headers=None):
        for needle, resp in self._routes:
            if needle in url:
                return resp
        raise AssertionError(f"unexpected GET {url}")


def _fake_client_factory(routes):
    def _factory(*args, **kwargs):
        return _FakeClient(routes)

    return _factory


async def _register(client: AsyncClient) -> tuple[str, UUID]:
    r = await client.post(
        "/api/v1/users/register",
        json={"name": unique_name("gr"), "password": "securepassword1"},
    )
    return r.json()["api_key"], UUID(r.json()["id"])


@pytest.mark.asyncio
async def test_granola_indexer_pulls_notes_and_transcripts(client: AsyncClient, monkeypatch):
    api_key, owner_id = await _register(client)
    ws_resp = await client.post(
        "/api/v1/workspaces",
        json={"name": unique_name("ws")},
        headers={"Authorization": f"Bearer {api_key}"},
    )
    ws = UUID(ws_resp.json()["id"])
    src = await source_service.create_source(
        workspace_id=ws,
        owner_user_id=owner_id,
        source_type="granola",
        external_ref="granola",
        display_name="Granola",
    )

    routes = [
        # /notes/{id} must be matched before /notes (substring order).
        (
            "/notes/not_1",
            _FakeResp(
                200,
                {
                    "id": "not_1",
                    "title": "Q3 Planning",
                    "summary": "Budget approved for Q3.",
                    "transcript": [
                        {"speaker": {"source": "microphone"}, "text": "Hello team"},
                        {"speaker": {"diarization_label": "Sam"}, "text": "Ship the sources work"},
                    ],
                },
            ),
        ),
        ("/notes/not_2", _FakeResp(404, {})),  # still processing → skipped
        (
            "/notes",
            _FakeResp(
                200,
                {
                    "notes": [{"id": "not_1", "title": "Q3 Planning"}, {"id": "not_2"}],
                    "hasMore": False,
                },
            ),
        ),
    ]
    monkeypatch.setattr(granola_indexer, "get_valid_token", lambda *a, **k: _async("grn_test"))
    monkeypatch.setattr(granola_indexer.httpx, "AsyncClient", _fake_client_factory(routes))

    await granola_indexer.index_granola(
        {
            "id": str(src["id"]),
            "workspace_id": str(ws),
            "owner_user_id": str(owner_id),
            "source_type": "granola",
            "external_ref": "granola",
        }
    )

    docs = await source_service.list_documents(src)
    assert {d["path"] for d in docs} == {"not_1"}  # not_2 (404) skipped
    note = await source_service.read_document(src, "not_1")
    assert "Budget approved for Q3." in note["content"]
    assert "**Sam:** Ship the sources work" in note["content"]


def _async(value):
    async def _coro():
        return value

    return _coro()


@pytest.mark.asyncio
async def test_granola_api_key_connect_validates_and_stores(client: AsyncClient, monkeypatch):
    api_key, _ = await _register(client)
    # fetch_account validates the key by GETting /notes — make that 200.
    monkeypatch.setattr(
        granola_provider.httpx,
        "AsyncClient",
        _fake_client_factory([("/notes", _FakeResp(200, {"notes": [], "hasMore": False}))]),
    )

    auth = {"Authorization": f"Bearer {api_key}"}
    resp = await client.post(
        "/api/v1/integrations/granola/api-key", json={"api_key": "grn_live"}, headers=auth
    )
    assert resp.status_code == 200

    # Granola now shows as a connected, api_key-kind provider.
    ints = await client.get("/api/v1/integrations", headers=auth)
    granola = next(p for p in ints.json()["providers"] if p["provider"] == "granola")
    assert granola["connected"] is True
    assert granola["auth_kind"] == "api_key"
