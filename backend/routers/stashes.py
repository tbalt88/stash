"""Stash router: aliases workspace endpoints under /api/v1/stashes/* and adds the
three-folder spine endpoint that the new sidebar/home pages consume."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from starlette.responses import StreamingResponse

from ..auth import get_current_user, get_current_user_optional
from ..database import get_pool
from ..models import (
    InviteTokenCreateRequest,
    InviteTokenCreateResponse,
    InviteTokenListResponse,
    InviteTokenSummary,
    JoinRequestListResponse,
    JoinRequestResponse,
    RedeemInviteAuthedRequest,
    WorkspaceCreateRequest,
    WorkspaceForkRequest,
    WorkspaceListResponse,
    WorkspaceMember,
    WorkspacePublicInfo,
    WorkspaceResponse,
    WorkspaceUpdateRequest,
)
from ..services import ask_service, skill_service, workspace_service
from . import workspaces as ws_router_module

router = APIRouter(prefix="/api/v1/stashes", tags=["stashes"])

# Re-export handlers from workspaces.py — same DB queries, same response shapes,
# different URL prefix. Path params are renamed in the route decorator only.

StashResponse = WorkspaceResponse
StashListResponse = WorkspaceListResponse
StashCreateRequest = WorkspaceCreateRequest
StashUpdateRequest = WorkspaceUpdateRequest
StashForkRequest = WorkspaceForkRequest
StashMember = WorkspaceMember
StashPublicInfo = WorkspacePublicInfo


@router.post("", response_model=StashResponse, status_code=201)
async def create_stash(req: StashCreateRequest, current_user: dict = Depends(get_current_user)):
    return await ws_router_module.create_workspace(req, current_user)


@router.get("", response_model=StashListResponse)
async def list_stashes(current_user: dict | None = Depends(get_current_user_optional)):
    return await ws_router_module.list_workspaces(current_user)


@router.get("/mine", response_model=StashListResponse)
async def list_my_stashes(current_user: dict = Depends(get_current_user)):
    return await ws_router_module.list_my_workspaces(current_user)


@router.post("/redeem-invite", response_model=StashResponse)
async def redeem_invite(
    req: RedeemInviteAuthedRequest, current_user: dict = Depends(get_current_user)
):
    return await ws_router_module.redeem_invite_authed(req, current_user)


@router.get("/{stash_id}", response_model=StashResponse)
async def get_stash(
    stash_id: UUID, current_user: dict | None = Depends(get_current_user_optional)
):
    return await ws_router_module.get_workspace(stash_id, current_user)


@router.patch("/{stash_id}", response_model=StashResponse)
async def update_stash(
    stash_id: UUID, req: StashUpdateRequest, current_user: dict = Depends(get_current_user)
):
    return await ws_router_module.update_workspace(stash_id, req, current_user)


@router.delete("/{stash_id}", status_code=204)
async def delete_stash(stash_id: UUID, current_user: dict = Depends(get_current_user)):
    await ws_router_module.delete_workspace(stash_id, current_user)


@router.post("/{stash_id}/fork", response_model=StashResponse, status_code=201)
async def fork_stash(
    stash_id: UUID, req: StashForkRequest, current_user: dict = Depends(get_current_user)
):
    return await ws_router_module.fork_workspace(stash_id, req, current_user)


@router.post("/join/{invite_code}", response_model=StashResponse)
async def join_stash(invite_code: str, current_user: dict = Depends(get_current_user)):
    return await ws_router_module.join_workspace(invite_code, current_user)


@router.post("/{stash_id}/invite-code/rotate", response_model=StashResponse)
async def rotate_stash_invite_code(stash_id: UUID, current_user: dict = Depends(get_current_user)):
    return await ws_router_module.rotate_invite_code(stash_id, current_user)


@router.post("/{stash_id}/leave", status_code=204)
async def leave_stash(stash_id: UUID, current_user: dict = Depends(get_current_user)):
    await ws_router_module.leave_workspace(stash_id, current_user)


@router.get("/{stash_id}/members", response_model=list[StashMember])
async def get_stash_members(stash_id: UUID, current_user: dict = Depends(get_current_user)):
    return await ws_router_module.get_members(stash_id, current_user)


@router.post("/{stash_id}/members")
async def add_stash_member(
    stash_id: UUID, req: dict, current_user: dict = Depends(get_current_user)
):
    return await ws_router_module.add_member(stash_id, req, current_user)


@router.post("/{stash_id}/kick/{user_id}", status_code=204)
async def kick_stash_member(
    stash_id: UUID, user_id: UUID, current_user: dict = Depends(get_current_user)
):
    await ws_router_module.kick_member(stash_id, user_id, current_user)


@router.get("/{stash_id}/public-info", response_model=StashPublicInfo)
async def get_stash_public_info(stash_id: UUID):
    return await ws_router_module.get_workspace_public_info(stash_id)


@router.post("/{stash_id}/join-requests", response_model=JoinRequestResponse, status_code=201)
async def create_stash_join_request(
    stash_id: UUID, current_user: dict = Depends(get_current_user)
):
    return await ws_router_module.create_join_request(stash_id, current_user)


@router.get("/{stash_id}/join-requests", response_model=JoinRequestListResponse)
async def list_stash_join_requests(stash_id: UUID, current_user: dict = Depends(get_current_user)):
    return await ws_router_module.list_join_requests(stash_id, current_user)


@router.post(
    "/{stash_id}/join-requests/{request_id}/approve", response_model=JoinRequestResponse
)
async def approve_stash_join_request(
    stash_id: UUID, request_id: UUID, current_user: dict = Depends(get_current_user)
):
    return await ws_router_module.approve_join_request(stash_id, request_id, current_user)


@router.post("/{stash_id}/join-requests/{request_id}/deny", response_model=JoinRequestResponse)
async def deny_stash_join_request(
    stash_id: UUID, request_id: UUID, current_user: dict = Depends(get_current_user)
):
    return await ws_router_module.deny_join_request(stash_id, request_id, current_user)


@router.get("/{stash_id}/join-requests/mine", response_model=JoinRequestResponse)
async def get_my_stash_join_request(
    stash_id: UUID, current_user: dict = Depends(get_current_user)
):
    return await ws_router_module.get_my_join_request(stash_id, current_user)


@router.post(
    "/{stash_id}/invite-tokens", response_model=InviteTokenCreateResponse, status_code=201
)
async def create_stash_invite_token(
    stash_id: UUID,
    req: InviteTokenCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    return await ws_router_module.create_invite_token(stash_id, req, current_user)


@router.get("/{stash_id}/invite-tokens", response_model=InviteTokenListResponse)
async def list_stash_invite_tokens(
    stash_id: UUID, current_user: dict = Depends(get_current_user)
):
    return await ws_router_module.list_invite_tokens(stash_id, current_user)


@router.delete("/{stash_id}/invite-tokens/{token_id}", status_code=204)
async def revoke_stash_invite_token(
    stash_id: UUID, token_id: UUID, current_user: dict = Depends(get_current_user)
):
    await ws_router_module.revoke_invite_token(stash_id, token_id, current_user)


# ---------------------------------------------------------------------------
# Spine — the three-folder view (Sessions / Skills / Drive) for one stash
# ---------------------------------------------------------------------------


async def _spine_sessions(stash_id: UUID) -> list[dict]:
    pool = get_pool()
    rows = await pool.fetch(
        "SELECT session_id, agent_name, size_bytes, uploaded_at "
        "FROM session_transcripts WHERE workspace_id = $1 "
        "ORDER BY uploaded_at DESC",
        stash_id,
    )
    return [
        {
            "session_id": r["session_id"],
            "title": r["session_id"],
            "agent_name": r["agent_name"],
            "size_bytes": r["size_bytes"],
            "last_at": r["uploaded_at"],
            "updated_at": r["uploaded_at"],
        }
        for r in rows
    ]


async def _spine_skills(stash_id: UUID) -> list[dict]:
    """A skill is any folder whose immediate children include a SKILL.md page."""
    skills = await skill_service.list_skills(stash_id)
    pool = get_pool()
    out = []
    for s in skills:
        files = await pool.fetch(
            "SELECT name FROM pages WHERE folder_id = $1 ORDER BY (name = 'SKILL.md') DESC, name",
            UUID(s["folder_id"]),
        )
        out.append(
            {
                "folder_id": s["folder_id"],
                "name": s["name"],
                "description": s["description"],
                "file_count": s["file_count"],
                "files": [r["name"] for r in files],
            }
        )
    return out


async def _spine_drive(stash_id: UUID) -> dict:
    from ..services import storage_service

    pool = get_pool()
    skill_folder_ids = await pool.fetch(
        "SELECT f.id FROM folders f "
        "WHERE f.workspace_id = $1 "
        "  AND EXISTS (SELECT 1 FROM pages p WHERE p.folder_id = f.id AND p.name = 'SKILL.md')",
        stash_id,
    )
    skill_ids = [r["id"] for r in skill_folder_ids]
    files = await pool.fetch(
        "SELECT id, name, size_bytes, content_type, storage_key, created_at, linked_table_id "
        "FROM files WHERE workspace_id = $1 ORDER BY created_at DESC",
        stash_id,
    )
    folders = await pool.fetch(
        "SELECT id, name, parent_folder_id FROM folders "
        "WHERE workspace_id = $1 "
        + (" AND id <> ALL($2::uuid[])" if skill_ids else "")
        + " ORDER BY name",
        *([stash_id, skill_ids] if skill_ids else [stash_id]),
    )

    file_payload = []
    for f in files:
        try:
            url = await storage_service.get_file_url(f["storage_key"])
        except Exception:
            url = None
        file_payload.append(
            {
                "id": str(f["id"]),
                "name": f["name"],
                "size_bytes": f["size_bytes"],
                "content_type": f["content_type"],
                "url": url,
                "created_at": f["created_at"],
                "linked_table_id": (
                    str(f["linked_table_id"]) if f["linked_table_id"] else None
                ),
            }
        )

    return {
        "files": file_payload,
        "folders": [
            {
                "id": str(f["id"]),
                "name": f["name"],
                "parent_folder_id": str(f["parent_folder_id"]) if f["parent_folder_id"] else None,
            }
            for f in folders
        ],
    }


# ---------------------------------------------------------------------------
# Skills (Phase 2) — markdown folders with a SKILL.md frontmatter file
# ---------------------------------------------------------------------------


@router.get("/{stash_id}/skills")
async def list_stash_skills(stash_id: UUID, current_user: dict = Depends(get_current_user)):
    if not await workspace_service.is_member(stash_id, current_user["id"]):
        raise HTTPException(status_code=403, detail="Not a stash member")
    return await skill_service.list_skills(stash_id)


@router.get("/{stash_id}/skills/{name}")
async def get_stash_skill(
    stash_id: UUID, name: str, current_user: dict = Depends(get_current_user)
):
    if not await workspace_service.is_member(stash_id, current_user["id"]):
        raise HTTPException(status_code=403, detail="Not a stash member")
    skill = await skill_service.read_skill(stash_id, name)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill


# ---------------------------------------------------------------------------
# Ask-the-stash agent (Phase 3)
# ---------------------------------------------------------------------------


class AskMessage(BaseModel):
    role: str
    content: str


class AskRequest(BaseModel):
    messages: list[AskMessage]
    scope: str = "stash"


@router.post("/{stash_id}/ask")
async def ask_stash(
    stash_id: UUID,
    req: AskRequest,
    current_user: dict = Depends(get_current_user),
):
    if not await workspace_service.is_member(stash_id, current_user["id"]):
        raise HTTPException(status_code=403, detail="Not a stash member")
    stash = await workspace_service.get_workspace(stash_id)
    if not stash:
        raise HTTPException(status_code=404, detail="Stash not found")

    convo = [{"role": m.role, "content": m.content} for m in req.messages]

    return StreamingResponse(
        ask_service.stream_ask(stash_id, stash["name"], convo),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def _spine_narrative(stash_id: UUID) -> dict | None:
    """The 'README' page — first match by name='Narrative.md', else first
    public_in_share root page, else first root page. Returns id + name."""
    pool = get_pool()
    row = await pool.fetchrow(
        "SELECT id, name FROM pages "
        "WHERE workspace_id = $1 AND folder_id IS NULL "
        "ORDER BY (name = 'Narrative.md') DESC, public_in_share DESC, name ASC LIMIT 1",
        stash_id,
    )
    if not row:
        return None
    return {"id": str(row["id"]), "name": row["name"]}


async def _spine_root_pages(stash_id: UUID) -> list[dict]:
    pool = get_pool()
    rows = await pool.fetch(
        "SELECT id, name, public_in_share FROM pages "
        "WHERE workspace_id = $1 AND folder_id IS NULL ORDER BY name",
        stash_id,
    )
    return [
        {"id": str(r["id"]), "name": r["name"], "public_in_share": r["public_in_share"]}
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Activity feed (Phase D) — synthesized from real timestamps, no history_events
# ---------------------------------------------------------------------------


@router.get("/{stash_id}/activity")
async def get_stash_activity(
    stash_id: UUID,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
):
    """Recent activity across transcripts, pages, files, and members."""
    if not await workspace_service.is_member(stash_id, current_user["id"]):
        raise HTTPException(status_code=403, detail="Not a stash member")
    pool = get_pool()
    events = await pool.fetch(
        """
        (
          SELECT 'session.uploaded' AS kind, uploaded_at AS ts,
                 uploaded_by AS actor_id, session_id AS target_id,
                 agent_name || ': ' || session_id AS target_label
          FROM session_transcripts WHERE workspace_id = $1
        )
        UNION ALL
        (
          SELECT 'page.updated' AS kind, updated_at AS ts,
                 COALESCE(updated_by, created_by) AS actor_id, id::text AS target_id,
                 name AS target_label
          FROM pages WHERE workspace_id = $1
        )
        UNION ALL
        (
          SELECT 'file.uploaded' AS kind, created_at AS ts,
                 uploaded_by AS actor_id, id::text AS target_id,
                 name AS target_label
          FROM files WHERE workspace_id = $1
        )
        UNION ALL
        (
          SELECT 'member.joined' AS kind, joined_at AS ts,
                 user_id AS actor_id, user_id::text AS target_id,
                 '' AS target_label
          FROM workspace_members WHERE workspace_id = $1
        )
        ORDER BY ts DESC LIMIT $2
        """,
        stash_id,
        min(limit, 200),
    )
    user_ids = list({r["actor_id"] for r in events if r["actor_id"]})
    users = {}
    if user_ids:
        rows = await pool.fetch(
            "SELECT id, name, display_name FROM users WHERE id = ANY($1::uuid[])",
            user_ids,
        )
        users = {r["id"]: {"name": r["name"], "display_name": r["display_name"]} for r in rows}

    return [
        {
            "kind": r["kind"],
            "ts": r["ts"],
            "actor": users.get(r["actor_id"], {"name": "unknown", "display_name": None}),
            "target_id": r["target_id"],
            "target_label": r["target_label"],
        }
        for r in events
    ]


@router.get("/{stash_id}/spine")
async def get_stash_spine(stash_id: UUID, current_user: dict = Depends(get_current_user)):
    """Returns {sessions, skills, drive, narrative, root_pages} for the new
    stash home + sidebar tree."""
    if not await workspace_service.is_member(stash_id, current_user["id"]):
        ws = await workspace_service.get_workspace(stash_id)
        if not ws or not ws.get("is_public"):
            raise HTTPException(status_code=404, detail="Stash not found")

    sessions = await _spine_sessions(stash_id)
    skills = await _spine_skills(stash_id)
    drive = await _spine_drive(stash_id)
    narrative = await _spine_narrative(stash_id)
    root_pages = await _spine_root_pages(stash_id)
    return {
        "sessions": sessions,
        "skills": skills,
        "drive": drive,
        "narrative": narrative,
        "root_pages": root_pages,
    }
