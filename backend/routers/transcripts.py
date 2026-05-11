"""Session transcripts: parse uploaded .jsonl[.gz] into history_events rows.

PR 1 of the duplication cleanup. The legacy R2 blob + session_transcripts
row are gone — a session's transcript is now reconstructed from the rows
in `history_events` that the CLI streamed live during the session.

Upload is treated as a backstop: if a session already has events streamed
in, the upload is a no-op. If it doesn't (e.g., a backfilled session, or
a CLI that lost connectivity mid-session), the upload parses the JSONL
and inserts the missing events.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Form, HTTPException, Response, UploadFile

from ..auth import get_current_user
from ..database import get_pool
from ..services import memory_service, transcript_import, workspace_service

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}/transcripts", tags=["transcripts"])

MAX_TRANSCRIPT_SIZE = 50 * 1024 * 1024


async def _check_member(workspace_id: UUID, user_id: UUID) -> None:
    if not await workspace_service.is_member(workspace_id, user_id):
        raise HTTPException(status_code=403, detail="Not a workspace member")


@router.post("", status_code=201)
async def upload_transcript(
    workspace_id: UUID,
    file: UploadFile,
    session_id: str = Form(...),
    agent_name: str = Form(...),
    cwd: str | None = Form(None),
    current_user: dict = Depends(get_current_user),
):
    """Parse the uploaded JSONL into history_events rows. No-op if the
    session already has events."""
    await _check_member(workspace_id, current_user["id"])
    if not session_id.strip():
        raise HTTPException(status_code=400, detail="session_id is required")

    body = await file.read()
    if len(body) > MAX_TRANSCRIPT_SIZE:
        raise HTTPException(status_code=413, detail="Transcript too large (max 50 MB)")

    pool = get_pool()
    existing = await pool.fetchval(
        "SELECT COUNT(*) FROM history_events " "WHERE workspace_id = $1 AND session_id = $2",
        workspace_id,
        session_id,
    )
    if existing:
        return {
            "session_id": session_id,
            "imported": 0,
            "skipped": True,
            "reason": "session already has events",
        }

    events = transcript_import.parse_jsonl_to_events(
        body, session_id=session_id, agent_name=agent_name
    )
    if cwd:
        for e in events:
            e["metadata"] = {**(e.get("metadata") or {}), "cwd": cwd}

    inserted = await memory_service.push_events_batch(workspace_id, current_user["id"], events)
    return {
        "session_id": session_id,
        "imported": len(inserted),
        "skipped": False,
    }


def _events_to_jsonl(events: list[dict]) -> bytes:
    """Render events as JSONL in a shape the chat viewer can parse —
    matches the Anthropic transcript format the viewer already understands.
    """
    import json

    lines: list[str] = []
    for ev in events:
        et = ev.get("event_type") or ""
        if et == "user_message":
            entry_type = "user"
        elif et == "assistant_message":
            entry_type = "assistant"
        elif et == "tool_use":
            # Tool calls are folded into the assistant turn shape so the
            # existing viewer logic that filters to user/assistant doesn't
            # silently drop them.
            entry_type = "assistant"
        else:
            continue
        line = {
            "type": entry_type,
            "message": {"content": ev.get("content") or ""},
            "timestamp": ev["created_at"].isoformat() if ev.get("created_at") else None,
        }
        if ev.get("tool_name"):
            line["tool_name"] = ev["tool_name"]
        lines.append(json.dumps(line, ensure_ascii=False))
    return ("\n".join(lines) + ("\n" if lines else "")).encode("utf-8")


@router.get("/{session_id}")
async def get_transcript_metadata(
    workspace_id: UUID,
    session_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Metadata-only response. The frontend follows up with /download for
    the bytes."""
    await _check_member(workspace_id, current_user["id"])
    events = await memory_service.read_session_events(workspace_id, session_id)
    if not events:
        raise HTTPException(status_code=404, detail="Transcript not found")
    agent_name = events[0]["agent_name"] or ""
    cwd = ""
    for e in events:
        meta = e.get("metadata") or {}
        if isinstance(meta, dict) and meta.get("cwd"):
            cwd = meta["cwd"]
            break
    size_bytes = sum(len(e.get("content") or "") for e in events)
    return {
        "session_id": session_id,
        "workspace_id": str(workspace_id),
        "agent_name": agent_name,
        "event_count": len(events),
        "size_bytes": size_bytes,
        "cwd": cwd or None,
        "started_at": events[0]["created_at"],
        "last_at": events[-1]["created_at"],
    }


@router.get("/{session_id}/download")
async def download_transcript(
    workspace_id: UUID,
    session_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Stream the chat thread as JSONL. Reconstructed from history_events
    rows — there is no R2 blob to fetch."""
    await _check_member(workspace_id, current_user["id"])
    events = await memory_service.read_session_events(workspace_id, session_id)
    if not events:
        raise HTTPException(status_code=404, detail="Transcript not found")
    return Response(
        content=_events_to_jsonl(events),
        media_type="application/jsonl",
        headers={"Cache-Control": "private, max-age=60"},
    )
