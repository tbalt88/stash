"""Granola integration — API-key auth (not OAuth).

Granola's official public API (https://docs.granola.ai) authenticates with a
personal API key (prefixed `grn_`) created in the Granola desktop app under
Settings → Connectors → API keys. There is no OAuth flow, so this provider is
`auth_kind = "api_key"`: the key is pasted in the UI and stored like any other
access token (no refresh, no expiry). The OAuth methods raise.
"""

from __future__ import annotations

import httpx
from fastapi import HTTPException

from ..base import AccountInfo, TokenSet

# https://docs.granola.ai — base URL + bearer `grn_` key.
API_BASE = "https://public-api.granola.ai/v1"

_NOT_OAUTH = "Granola connects with an API key, not OAuth."


class GranolaIntegration:
    name = "granola"
    display_name = "Granola"
    scopes: list[str] = []
    supports_refresh = False
    # The integration layer is OAuth-shaped; this flag tells the router and UI
    # to take the paste-an-API-key path instead of the OAuth redirect.
    auth_kind = "api_key"

    def authorize_url(self, state: str) -> str:
        raise HTTPException(status_code=400, detail=_NOT_OAUTH)

    async def exchange_code(self, code: str) -> TokenSet:
        raise HTTPException(status_code=400, detail=_NOT_OAUTH)

    async def refresh(self, refresh_token: str) -> TokenSet:
        raise HTTPException(status_code=400, detail="Granola API keys do not expire.")

    async def revoke(self, access_token: str) -> None:
        # Keys are revoked in the Granola desktop app; we only drop our copy.
        return None

    async def fetch_account(self, access_token: str) -> AccountInfo:
        """Validate the key by hitting the notes endpoint, so a bad key fails at
        connect time instead of storing a dead token."""
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{API_BASE}/notes",
                headers={"Authorization": f"Bearer {access_token}"},
            )
        if resp.status_code in (401, 403):
            raise HTTPException(status_code=401, detail="Invalid Granola API key.")
        resp.raise_for_status()
        return AccountInfo(email=None, display_name="Granola")
