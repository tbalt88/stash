"""Granola → granola_notes indexer (scheduled pull, official API).

Uses Granola's public API (https://docs.granola.ai): GET /notes paginates the
notes the key can see (only notes with a generated AI summary + transcript are
returned); GET /notes/{id}?include=transcript returns the summary and the
speaker/text transcript. We copy each note's rendered markdown into
granola_notes (FTS + embeddings), keyed by note id. Idempotent re-sync is
handled upstream (content-hash dedupe + soft-delete of vanished notes).
"""

from __future__ import annotations

import logging
from uuid import UUID

import httpx

from ...services import source_service
from ..storage import get_valid_token
from .provider import API_BASE

logger = logging.getLogger(__name__)

MAX_NOTES = 1000
# Granola allows 25 req / 5s burst; a Get-per-note can approach that on large
# accounts, so stop after MAX_NOTES rather than hammering the API.


def _render_note(detail: dict) -> str:
    """A note's markdown: title + AI summary + the speaker-labelled transcript."""
    title = detail.get("title") or "Untitled note"
    lines = [f"# {title}", ""]
    summary = (detail.get("summary") or "").strip()
    if summary:
        lines += [summary, ""]
    transcript = detail.get("transcript") or []
    if transcript:
        lines.append("## Transcript")
        lines.append("")
        for entry in transcript:
            text = (entry.get("text") or "").strip()
            if not text:
                continue
            speaker = entry.get("speaker") or {}
            label = speaker.get("diarization_label") or speaker.get("source") or "speaker"
            lines.append(f"**{label}:** {text}")
    return "\n".join(lines).strip()


async def index_granola(source: dict) -> str | None:
    source_id = UUID(source["id"])
    workspace_id = UUID(source["workspace_id"])
    owner_user_id = UUID(source["owner_user_id"])

    token = await get_valid_token(owner_user_id, "granola")
    headers = {"Authorization": f"Bearer {token}"}
    present: list[str] = []

    async with httpx.AsyncClient(timeout=30.0, headers=headers) as client:
        cursor: str | None = None
        while len(present) < MAX_NOTES:
            params: dict = {}
            if cursor:
                params["cursor"] = cursor
            resp = await client.get(f"{API_BASE}/notes", params=params)
            resp.raise_for_status()
            payload = resp.json()

            for note in payload.get("notes", []):
                note_id = note.get("id")
                if not note_id:
                    continue
                detail_resp = await client.get(
                    f"{API_BASE}/notes/{note_id}", params={"include": "transcript"}
                )
                if detail_resp.status_code != 200:
                    # 404 = still processing / no summary; 429 = rate limited.
                    # Skip this note; a later sync picks it up.
                    continue
                detail = detail_resp.json()
                title = detail.get("title") or note.get("title") or "Untitled note"
                await source_service.upsert_content_document(
                    table="granola_notes",
                    source_id=source_id,
                    workspace_id=workspace_id,
                    path=note_id,
                    name=title,
                    kind="note",
                    content=_render_note(detail),
                    external_ref=note_id,
                )
                present.append(note_id)

            if not payload.get("hasMore"):
                break
            cursor = payload.get("cursor")
            if not cursor:
                break

    await source_service.soft_delete_missing("granola_notes", source_id, present)
    logger.info("granola source %s: indexed %d note(s)", source_id, len(present))
    return None
