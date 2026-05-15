"""Seed local database data for a full product-like local dev state.

Usage:
    python scripts/seed_dev_data.py
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from uuid import UUID

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(REPO_ROOT / ".env")
load_dotenv(REPO_ROOT / "backend" / ".env")

sys.path.insert(0, str(REPO_ROOT))

from backend import database  # noqa: E402
from backend.services import (  # noqa: E402
    files_tree_service,
    memory_service,
    session_service,
    stash_service,
    storage_service,
    table_service,
    user_service,
    workspace_service,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    force=True,
)
log = logging.getLogger("seed")
if not log.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    log.addHandler(handler)
log.setLevel(logging.INFO)

SAMPLE_WORKSPACE_NAME = "Sample Product Studio"
SAMPLE_WORKSPACE_DESCRIPTION = (
    "Local development dataset used to preview the Sessions/Files/Stashes product "
    "UI with realistic sample content."
)
SAMPLE_EXTERNAL_WORKSPACE_NAME = "Sample Partner Workspace"
SAMPLE_EXTERNAL_WORKSPACE_DESCRIPTION = (
    "Small external workspace used to seed one attachable external stash."
)

SAMPLE_USERS = [
    {
        "name": "demo_aria",
        "display_name": "Aria Patel",
        "description": "Product strategist and meeting wrangler.",
    },
    {
        "name": "demo_devon",
        "display_name": "Devon Chen",
        "description": "Platform engineer focused on release reliability.",
    },
    {
        "name": "demo_maya",
        "display_name": "Maya Ortiz",
        "description": "Frontend engineer for dashboards and interactions.",
    },
]

SAMPLE_FOLDERS = [
    ("Product", None),
    ("Engineering", None),
    ("Research", None),
    ("Discovery", "Product"),
    ("Roadmap", "Product"),
    ("Services", "Engineering"),
    ("Observability", "Engineering"),
]

SAMPLE_PAGES = [
    {
        "name": "Vision and Principles",
        "folder": "Product / Discovery",
        "content": "# Vision and Principles\n\nShip confidently through strong context and reusable notes.",
    },
    {
        "name": "Launch Plan",
        "folder": "Product / Roadmap",
        "content": "# Launch Plan\n\n- Finalize pricing\n- Ship onboarding flow\n- Review privacy defaults",
    },
    {
        "name": "Team Working Agreement",
        "folder": "Product / Roadmap",
        "content": "# Team Working Agreement\n\nPairing windows, shared context, and explicit handoffs.",
    },
    {
        "name": "API Design Notes",
        "folder": "Engineering / Services",
        "content": "# API Design Notes\n\nKeep interfaces additive and versioned.",
    },
    {
        "name": "Reliability Runbook",
        "folder": "Engineering / Observability",
        "content": "# Reliability Runbook\n\nStandard recovery steps and escalation links.",
    },
    {
        "name": "Data Validation",
        "folder": "Research",
        "content": "# Data Validation\n\nChecklist for table/schema and ingestion checks.",
    },
]

SAMPLE_TABLES = [
    {
        "name": "Release Risks",
        "description": "Risk tracking for upcoming releases.",
        "columns": [
            {"name": "Risk", "type": "text", "required": True},
            {"name": "Owner", "type": "text", "required": True},
            {"name": "Probability", "type": "number", "required": True},
            {"name": "Impact", "type": "text", "required": True},
            {"name": "Mitigation", "type": "text", "required": False},
            {"name": "Resolved", "type": "boolean", "required": False},
        ],
        "rows": [
            {
                "Risk": "S3 permissions drift",
                "Owner": "devon",
                "Probability": 0.26,
                "Impact": "Upload failures during session seeding",
                "Mitigation": "Pin IAM policy in infra-as-code",
                "Resolved": False,
            },
            {
                "Risk": "Table schema mismatch",
                "Owner": "maya",
                "Probability": 0.14,
                "Impact": "Query mismatch in session materializer",
                "Mitigation": "Validate schema before runtime",
                "Resolved": False,
            },
            {
                "Risk": "Contributor context gaps",
                "Owner": "aria",
                "Probability": 0.09,
                "Impact": "Rework duplicated effort",
                "Mitigation": "Enforce session summaries and stashes",
                "Resolved": True,
            },
        ],
    },
    {
        "name": "Feature Readiness",
        "description": "What is ready, in progress, and blocked.",
        "columns": [
            {"name": "Feature", "type": "text", "required": True},
            {"name": "Priority", "type": "number", "required": True},
            {"name": "Status", "type": "text", "required": True},
            {"name": "Owner", "type": "text", "required": True},
            {"name": "Target Date", "type": "date", "required": False},
        ],
        "rows": [
            {
                "Feature": "Cross-workspace search",
                "Priority": 1,
                "Status": "In progress",
                "Owner": "aria",
                "Target Date": "2026-06-10",
            },
            {
                "Feature": "Session summary quality",
                "Priority": 2,
                "Status": "Planned",
                "Owner": "maya",
                "Target Date": "2026-06-17",
            },
            {
                "Feature": "File ingest hardening",
                "Priority": 3,
                "Status": "Done",
                "Owner": "devon",
                "Target Date": "2026-06-05",
            },
            {
                "Feature": "Stash sharing polish",
                "Priority": 4,
                "Status": "Backlog",
                "Owner": "aria",
                "Target Date": "2026-06-24",
            },
        ],
    },
]

SAMPLE_SESSIONS = [
    {
        "session_id": "session-design-architecture",
        "agent_name": "claude",
        "cwd": "/workspace/product",
        "created_by": "demo_aria",
        "summary": "Drafted architecture and rollout guardrails for the release.",
        "files_touched": ["docs/architecture.md", "product/vision.md"],
        "events": [
            ("prompt", "I need a production-safe rollout plan for this UI change."),
            ("assistant", "I drafted a staged rollout with canary and rollback points."),
            ("tool_call", "search_web"),
            ("assistant", "I found three comparable strategies and picked canary + manual smoke checks."),
        ],
    },
    {
        "session_id": "session-dashboard-overhaul",
        "agent_name": "copilot",
        "cwd": "/workspace/frontend",
        "created_by": "demo_maya",
        "summary": "Refined sidebar behavior and added richer grouping for files and sessions.",
        "files_touched": ["frontend/src/AppSidebar.tsx", "frontend/src/styles.css"],
        "events": [
            ("prompt", "Please implement a cleaner sidebar with fewer duplicates."),
            ("assistant", "I removed duplicate nav labels and adjusted defaults."),
            ("assistant", "I added grouping labels for sessions, files, and stashes."),
            ("tool_call", "git_commit"),
        ],
    },
    {
        "session_id": "session-file-pipeline",
        "agent_name": "assistant",
        "cwd": "/workspace/backend",
        "created_by": "demo_devon",
        "summary": "Validated storage pipeline and improved extraction fallback handling.",
        "files_touched": ["backend/routers/files.py", "backend/services/files_tree_service.py"],
        "events": [
            ("prompt", "Can we improve local file ingest reliability?"),
            ("assistant", "I reviewed upload flow and added better status defaults."),
            ("assistant", "I confirmed file rows remain queryable even before extraction completes."),
        ],
    },
    {
        "session_id": "session-session-index",
        "agent_name": "agent",
        "cwd": "/workspace/backend",
        "created_by": "demo_aria",
        "summary": "Checked session listing query shape and made sure latest activity is shown.",
        "files_touched": ["backend/services/memory_service.py", "backend/routers/workspace_knowledge.py"],
        "events": [
            ("prompt", "We need stable session list rendering with minimal payload."),
            ("assistant", "I aligned list query order by most recent activity."),
            ("assistant", "I verified count and size calculations still render quickly."),
            ("assistant", "I added summary fallback when no final answer exists."),
        ],
    },
    {
        "session_id": "session-permissions-path",
        "agent_name": "claude",
        "cwd": "/workspace/backend",
        "created_by": "demo_devon",
        "summary": "Reviewed workspace visibility rules for shared and private stash behavior.",
        "files_touched": ["backend/services/permission_service.py", "backend/services/stash_service.py"],
        "events": [
            ("prompt", "Can we test workspace/private/public access rules for stashes?"),
            ("assistant", "I mapped access checks and identified partition collisions."),
            ("assistant", "I confirmed private bundles reject cross-level items."),
            ("tool_call", "policy_test"),
        ],
    },
    {
        "session_id": "session-documenting-practices",
        "agent_name": "assistant",
        "cwd": "/workspace/docs",
        "created_by": "demo_maya",
        "summary": "Added practical onboarding and dev workflow notes.",
        "files_touched": ["README.md", "docs/notes.md", "notes/session-ops.md"],
        "events": [
            ("prompt", "Write practical onboarding notes for this project."),
            ("assistant", "I documented common local tasks and gotchas."),
            ("assistant", "I added a quick start path for seeded sample data."),
        ],
    },
    {
        "session_id": "session-query-quality",
        "agent_name": "copilot",
        "cwd": "/workspace/backend",
        "created_by": "demo_aria",
        "summary": "Benchmarked query paths and improved visibility for overview payload.",
        "files_touched": ["backend/routers/workspace_knowledge.py", "backend/services/memory_service.py"],
        "events": [
            ("prompt", "Any index changes needed for history session queries?"),
            ("assistant", "I validated current indexes and query shape with sessions join."),
            ("assistant", "I highlighted the key path as workspace+session_id group by."),
            ("assistant", "I kept results bounded but complete for overview endpoints."),
        ],
    },
    {
        "session_id": "session-observability",
        "agent_name": "assistant",
        "cwd": "/workspace/ops",
        "created_by": "demo_devon",
        "summary": "Set up sample incident checks and postmortem notes for reliability drills.",
        "files_touched": ["ops/checks.md", "ops/incident-template.md"],
        "events": [
            ("prompt", "Draft incident response playbook for a failed uploader."),
            ("assistant", "I captured escalation tiers and ownership boundaries."),
            ("assistant", "I added rollback checks to reduce MTTR."),
        ],
    },
    {
        "session_id": "session-qa-sanity",
        "agent_name": "claude",
        "cwd": "/workspace/tests",
        "created_by": "demo_maya",
        "summary": "Added a lightweight set of QA checks for seeded workflows.",
        "files_touched": ["backend/tests/test_history.py", "frontend/src/components/AppSidebar.tsx"],
        "events": [
            ("prompt", "What are the riskiest regressions in this area?"),
            ("assistant", "I added checks for session list shape and sidebar items."),
            ("assistant", "I included stashes edge cases for private/workspace/public mix."),
        ],
    },
    {
        "session_id": "session-product-feedback",
        "agent_name": "assistant",
        "cwd": "/workspace/product",
        "created_by": "demo_aria",
        "summary": "Captured user feedback themes and translated into next actions.",
        "files_touched": ["product/feedback.md", "docs/roadmap.md"],
        "events": [
            ("prompt", "Summarize recurring feedback from internal users."),
            ("assistant", "I grouped around navigation clarity and data discoverability."),
            ("assistant", "I prioritized three follow-up experiments."),
        ],
    },
    {
        "session_id": "session-oncall-playbook",
        "agent_name": "agent",
        "cwd": "/workspace/ops",
        "created_by": "demo_devon",
        "summary": "Built a sample on-call playbook and duty handoff steps.",
        "files_touched": ["ops/oncall.md", "ops/handoff-template.md"],
        "events": [
            ("prompt", "Draft a standard handoff format for on-call shifts."),
            ("assistant", "I proposed a concise update template with risks and next actions."),
            ("assistant", "I included checkboxes for validation and unresolved items."),
        ],
    },
    {
        "session_id": "session-release-triage",
        "agent_name": "assistant",
        "cwd": "/workspace/backend",
        "created_by": "demo_maya",
        "summary": "Triage plan for release blockers and cross-team sync points.",
        "files_touched": ["backend/routers/sessions.py", "backend/services/stash_service.py"],
        "events": [
            ("prompt", "Create a release triage list with top three blockers."),
            ("assistant", "I identified ownership, impact, and fallback plans."),
            ("assistant", "I added follow-up actions by priority for each blocker."),
        ],
    },
]


SAMPLE_FILES = [
    {
        "name": "release-notes.md",
        "folder": "Product",
        "content_type": "text/markdown",
        "content": "# Release Notes\n\nThis release adds sample data seeding and improved navigation.",
    },
    {
        "name": "design-principles.txt",
        "folder": "Product / Discovery",
        "content_type": "text/plain",
        "content": "Build for long-lived context and quick retrieval.",
    },
    {
        "name": "service-matrix.csv",
        "folder": "Engineering / Services",
        "content_type": "text/csv",
        "content": "service,owner,sla\napi,devon,99.95\nfrontend,maya,99.90",
    },
    {
        "name": "api-contract.yaml",
        "folder": "Engineering / Services",
        "content_type": "text/yaml",
        "content": "openapi: 3.0.0\ninfo:\n  title: Stash API",
    },
    {
        "name": "architecture-overview.md",
        "folder": "Engineering / Observability",
        "content_type": "text/markdown",
        "content": "# Architecture Overview\n\nShared context is built around sessions, pages, files, and stashes.",
    },
    {
        "name": "runbook.md",
        "folder": "Research",
        "content_type": "text/markdown",
        "content": "# Runbook\n\nIf storage is unavailable, continue with DB-only checks.",
    },
]


def _folder_path(parts: str) -> tuple[str, ...]:
    return tuple(part.strip() for part in parts.split("/") if part.strip())


def _folder_key(name: str, parent: str | None) -> str:
    if parent:
        return f"{parent} / {name}"
    return name


def _folder_hierarchy_from_templates() -> dict[str, tuple[str, str | None]]:
    values = {}
    for name, parent in SAMPLE_FOLDERS:
        values[_folder_key(name, parent)] = (name, parent)
    return values


def _item(
    object_type: str,
    object_id: UUID,
    position: int,
    label_override: str | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(object_type=object_type, object_id=object_id, position=position, label_override=label_override)


async def _ensure_user(pool, user: dict) -> tuple[dict, str | None, bool]:
    row = await pool.fetchrow("SELECT id, name, display_name FROM users WHERE name = $1", user["name"])
    if row:
        return dict(row), None, False

    new_user, api_key = await user_service.register_user(
        name=user["name"],
        display_name=user["display_name"],
        description=user["description"],
        password=None,
    )
    return new_user, api_key, True


async def _ensure_workspace(
    pool,
    owner: dict,
    workspace_name: str,
    workspace_description: str,
) -> tuple[dict, bool]:
    row = await pool.fetchrow(
        "SELECT id, name, description, creator_id, updated_at FROM workspaces "
        "WHERE name = $1 AND creator_id = $2 ORDER BY created_at DESC LIMIT 1",
        workspace_name,
        owner["id"],
    )
    if row:
        return dict(row), False
    ws = await workspace_service.create_workspace(
        name=workspace_name,
        description=workspace_description,
        creator_id=owner["id"],
    )
    return ws, True


async def _ensure_membership(workspace_id: UUID, users: list[dict], owner: dict) -> None:
    owner_id = owner["id"]
    for u in users:
        await workspace_service.join_workspace(workspace_id, u["id"])

    # Keep one user as viewer if we can set roles from workspace owner.
    if users and owner_id == users[0]["id"]:
        target = users[-1]
        await workspace_service.set_member_role(workspace_id, target["id"], owner_id, "viewer")


async def _get_folder(
    workspace_id: UUID,
    name: str,
    parent_id: UUID | None,
) -> dict | None:
    return await database.get_pool().fetchrow(
        "SELECT id, workspace_id, parent_folder_id, name, created_by, created_at, updated_at "
        "FROM folders WHERE workspace_id = $1 AND name = $2 "
        "AND parent_folder_id IS NOT DISTINCT FROM $3",
        workspace_id,
        name,
        parent_id,
    )


async def _ensure_folders(workspace_id: UUID, creator_id: UUID) -> dict[str, dict]:
    created: dict[str, dict] = {}
    folders_by_name: dict[str, UUID | None] = {}
    for item in SAMPLE_FOLDERS:
        name, parent_name = item
        if parent_name is None:
            parent_id = None
            key = name
        else:
            parent_key = parent_name
            parent_id = folders_by_name[parent_key]
            key = f"{parent_name} / {name}"

        row = await _get_folder(workspace_id, name, parent_id)
        if not row:
            row = await files_tree_service.create_folder(
                workspace_id=workspace_id,
                name=name,
                created_by=creator_id,
                parent_folder_id=parent_id,
            )
        created[key] = dict(row)
        folders_by_name[key] = row["id"]
    return created


async def _ensure_pages(workspace_id: UUID, creator_id: UUID, folders: dict[str, dict]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for spec in SAMPLE_PAGES:
        folder_key = spec["folder"]
        parent_parts = _folder_path(folder_key)
        if len(parent_parts) == 1:
            parent_id = None
            if folder_key in folders:
                parent_id = folders[folder_key]["id"]
            else:
                row = await _get_folder(workspace_id, parent_parts[0], None)
                if not row:
                    row = await files_tree_service.create_folder(
                        workspace_id=workspace_id,
                        name=parent_parts[0],
                        created_by=creator_id,
                        parent_folder_id=None,
                    )
                folders[parent_parts[0]] = dict(row)
                parent_id = row["id"]
        else:
            parent_id = folders[folder_key]["id"] if folder_key in folders else None

        existing = await database.get_pool().fetchrow(
            "SELECT id FROM pages WHERE workspace_id = $1 AND name = $2 AND folder_id IS NOT DISTINCT FROM $3 "
            "AND COALESCE(metadata->>'shared_in_stash_id', '') = ''",
            workspace_id,
            spec["name"],
            parent_id,
        )
        if existing:
            out[spec["name"]] = {"id": existing["id"]}
            continue

        page = await files_tree_service.create_page(
            workspace_id=workspace_id,
            name=spec["name"],
            created_by=creator_id,
            folder_id=parent_id,
            content=spec["content"],
        )
        out[spec["name"]] = page
    return out


async def _ensure_tables(workspace_id: UUID, creator_id: UUID) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for spec in SAMPLE_TABLES:
        table = await database.get_pool().fetchrow(
            "SELECT t.id, t.workspace_id, t.name, t.description, t.columns, t.created_by, "
            "t.updated_by, t.created_at, t.updated_at, "
            "(SELECT COUNT(*) FROM table_rows tr WHERE tr.table_id = t.id) AS row_count "
            "FROM tables t WHERE t.workspace_id = $1 AND t.name = $2",
            workspace_id,
            spec["name"],
        )
        if table:
            table_record = dict(table)
            if table_record["row_count"]:
                out[spec["name"]] = table_record
                continue
            table_id = table_record["id"]
            table_record["id"] = table_id
            new_rows = await table_service.create_rows_batch(
                table_id=table_id,
                rows_data=[dict(row) for row in spec["rows"]],
                created_by=creator_id,
            )
            table_record["rows_seeded"] = len(new_rows)
            out[spec["name"]] = table_record
            continue

        new_table = await table_service.create_table(
            workspace_id=workspace_id,
            name=spec["name"],
            description=spec["description"],
            columns=[dict(c) for c in spec["columns"]],
            created_by=creator_id,
        )
        new_rows = await table_service.create_rows_batch(
            table_id=new_table["id"],
            rows_data=[dict(row) for row in spec["rows"]],
            created_by=creator_id,
        )
        new_table["rows_seeded"] = len(new_rows)
        out[spec["name"]] = new_table
    return out


async def _session_time_offset(index: int, event_offset: int) -> datetime:
    base = datetime.now(UTC).replace(microsecond=0) - timedelta(days=6 - index, minutes=event_offset * 17)
    return base


async def _ensure_sessions(workspace_id: UUID, users: dict[str, dict], folders: dict[str, dict]) -> dict[str, dict]:
    created: dict[str, dict] = {}
    for i, spec in enumerate(SAMPLE_SESSIONS):
        existing = await session_service.get_session(workspace_id, spec["session_id"])
        if existing:
            created[spec["session_id"]] = existing
            continue

        created_by = users[spec["created_by"]]
        events: list[dict[str, Any]] = []
        for event_offset, event in enumerate(spec["events"]):
            agent_name = spec["agent_name"]
            if len(event) == 2:
                event_type, content = event
                tool = None
            elif len(event) == 3:
                event_type, tool, content = event
            else:
                continue
            events.append(
                {
                    "agent_name": agent_name,
                    "event_type": event_type,
                    "content": content,
                    "tool_name": tool,
                    "created_by": created_by["id"],
                    "session_id": spec["session_id"],
                    "metadata": {"cwd": spec["cwd"]},
                    "created_at": await _session_time_offset(i, event_offset),
                    "attachments": [],
                }
            )
        await memory_service.push_events_batch(workspace_id=workspace_id, created_by=created_by["id"], events=events)

        row = await session_service.get_session(workspace_id, spec["session_id"])
        if row:
            await session_service.set_files_touched(row["id"], spec["files_touched"])
            await session_service.set_summary(row["id"], spec["summary"])
            created[spec["session_id"]] = row
        else:
            log.warning("Could not load session after seeding: %s", spec["session_id"])
    return created


async def _ensure_files(
    workspace_id: UUID,
    creator_id: UUID,
    folders: dict[str, dict],
    tables: dict[str, dict],
) -> dict[str, dict]:
    if not storage_service.is_configured():
        log.warning(
            "Skipping files: S3 config missing. Set S3_* vars or S3_PUBLIC_URL to seed files."
        )
        return {}

    out: dict[str, dict] = {}
    for spec in SAMPLE_FILES:
        parent_id = folders.get(spec["folder"], {}).get("id")
        storage_key = await storage_service.upload_file(
            str(workspace_id),
            spec["name"],
            spec["content"].encode("utf-8"),
            spec["content_type"],
        )
        row = await database.get_pool().fetchrow(
            "INSERT INTO files (workspace_id, name, content_type, size_bytes, storage_key, uploaded_by, folder_id, "
            "extracted_text, extraction_status, extraction_attempts) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'done', 1) "
            "ON CONFLICT (storage_key) DO UPDATE SET "
            "name = EXCLUDED.name, size_bytes = EXCLUDED.size_bytes "
            "RETURNING id, name, size_bytes, content_type, folder_id, created_at, linked_table_id",
            workspace_id,
            spec["name"],
            spec["content_type"],
            len(spec["content"].encode("utf-8")),
            storage_key,
            creator_id,
            parent_id,
            spec["content"],
        )
        out[spec["name"]] = dict(row)
    # Link one seeded CSV-like file to a table to show richer table/file flow.
    csv_file = out.get("service-matrix.csv")
    table = tables.get("Feature Readiness")
    if csv_file and table:
        await database.get_pool().execute(
            "UPDATE files SET linked_table_id = $1 WHERE id = $2",
            table["id"],
            csv_file["id"],
        )
        csv_file["linked_table_id"] = table["id"]
    return out


async def _ensure_stashes(workspace_id: UUID, user: dict, folders: dict[str, dict], pages: dict[str, dict], tables: dict[str, dict], sessions: dict[str, dict], files: dict[str, dict]) -> None:
    stash_defs: list[dict[str, Any]] = [
        {
            "title": "Workspace Product Pack",
            "description": "Core product artifacts for sprint planning.",
            "access": "workspace",
            "discoverable": False,
            "items": [
                _item("page", pages["Vision and Principles"]["id"], 0),
                _item("page", pages["Launch Plan"]["id"], 1),
                _item("table", tables["Feature Readiness"]["id"], 2),
            ],
        },
        {
            "title": "Public Launch Bundle",
            "description": "Shareable launch-facing packet.",
            "access": "public",
            "discoverable": True,
            "items": [
                _item("table", tables["Release Risks"]["id"], 0),
                _item("page", pages["Team Working Agreement"]["id"], 1),
            ]
            + (
                [_item("file", files["release-notes.md"]["id"], 2)]
                if files
                else []
            ),
        },
        {
            "title": "Private Research Notes",
            "description": "Internal review notes not ready for public share.",
            "access": "private",
            "discoverable": False,
            "items": [
                _item("page", pages["Data Validation"]["id"], 0),
            ]
            + (
                [_item("file", files["runbook.md"]["id"], 1)] if files else []
            ),
        },
        {
            "title": "Session Story Bundle",
            "description": "A curated set of historical work sessions.",
            "access": "workspace",
            "discoverable": False,
            "items": [
                _item("session", sessions[session_key]["id"], position)
                for position, session_key in enumerate(sorted(sessions)[:6])
            ],
        },
    ]

    for spec in stash_defs:
        exists = await database.get_pool().fetchrow(
            "SELECT id FROM stashes WHERE workspace_id = $1 AND title = $2",
            workspace_id,
            spec["title"],
        )
        if exists:
            continue
        await stash_service.create_stash(
            workspace_id=workspace_id,
            owner_id=user["id"],
            title=spec["title"],
            description=spec["description"],
            access=spec["access"],
            discoverable=spec["discoverable"],
            cover_image_url=None,
            items=spec["items"],
        )


async def _ensure_external_stash_sample(
    workspace_id: UUID,
    workspace_owner: dict,
    users: dict[str, dict],
) -> None:
    external_owner = users["demo_devon"]
    external_workspace, _ = await _ensure_workspace(
        database.get_pool(),
        external_owner,
        workspace_name=SAMPLE_EXTERNAL_WORKSPACE_NAME,
        workspace_description=SAMPLE_EXTERNAL_WORKSPACE_DESCRIPTION,
    )
    external_workspace_id = external_workspace["id"]

    page_name = "External Contributor Brief"
    existing_page = await database.get_pool().fetchrow(
        "SELECT id FROM pages WHERE workspace_id = $1 AND name = $2 AND folder_id IS NOT DISTINCT FROM NULL "
        "AND COALESCE(metadata->>'shared_in_stash_id', '') = ''",
        external_workspace_id,
        page_name,
    )

    if existing_page:
        page = {"id": existing_page["id"]}
    else:
        page = await files_tree_service.create_page(
            workspace_id=external_workspace_id,
            name=page_name,
            created_by=external_owner["id"],
            content=(
                "# External collaborator brief\\n\\n"
                "This page lives in a different workspace and is intentionally attached as "
                "an external stash item.\n"
            ),
        )

    external_stash_title = "Partner Briefs"
    existing_external = await database.get_pool().fetchrow(
        "SELECT slug FROM stashes WHERE workspace_id = $1 AND title = $2",
        external_workspace_id,
        external_stash_title,
    )
    if existing_external:
        external_slug = existing_external["slug"]
    else:
        created_external = await stash_service.create_stash(
            workspace_id=external_workspace_id,
            owner_id=external_owner["id"],
            title=external_stash_title,
            description="Sample public stash from a different workspace.",
            access="public",
            discoverable=True,
            cover_image_url=None,
            items=[_item("page", page["id"], 0)],
        )
        external_slug = created_external["slug"]

    attached = await stash_service.add_external_stash(
        workspace_id,
        external_slug,
        workspace_owner["id"],
    )
    if attached:
        if not attached["is_external"]:
            log.warning("External stash %s is already local to workspace; skipping attachment.", external_slug)
        else:
            log.info("Attached external stash sample: %s", attached["title"])


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace-name", default=SAMPLE_WORKSPACE_NAME)
    args = parser.parse_args()

    workspace_name = args.workspace_name
    if not os.getenv("DATABASE_URL"):
        log.error("DATABASE_URL is required")
        return 2

    await database.init_db()
    try:
        pool = database.get_pool()
        print("Seeding local development dataset...")
        created_users: dict[str, dict] = {}
        created_api_keys: dict[str, str] = {}

        for user in SAMPLE_USERS:
            row, api_key, created = await _ensure_user(pool, user)
            created_users[row["name"]] = row
            if api_key:
                created_api_keys[row["name"]] = api_key
            log.info("User %s %s", "created" if created else "found", row["name"])

        workspace_owner = created_users[SAMPLE_USERS[0]["name"]]
        workspace, created = await _ensure_workspace(
            pool,
            workspace_owner,
            workspace_name=workspace_name,
            workspace_description=SAMPLE_WORKSPACE_DESCRIPTION,
        )
        workspace_name = workspace["name"]
        workspace_id = workspace["id"]
        await _ensure_membership(workspace_id, list(created_users.values()), workspace_owner)

        if created:
            log.info("Created workspace: %s", workspace_name)
        else:
            log.info("Reusing workspace: %s", workspace_name)

        workspace_id = workspace["id"]
        folders = await _ensure_folders(workspace_id, workspace_owner["id"])
        pages = await _ensure_pages(workspace_id, workspace_owner["id"], folders)
        tables = await _ensure_tables(workspace_id, workspace_owner["id"])
        files = await _ensure_files(workspace_id, workspace_owner["id"], folders, tables)
        sessions = await _ensure_sessions(workspace_id, created_users, folders)
        await _ensure_stashes(workspace_id, workspace_owner, folders, pages, tables, sessions, files)
        await _ensure_external_stash_sample(workspace_id, workspace_owner, created_users)

        log.info("Seed complete for workspace: %s", workspace_name)
        if created_api_keys:
            log.info("Sample API keys (new users):")
            for username, key in created_api_keys.items():
                log.info("  %s: %s", username, key)
        stash_count = await database.get_pool().fetchval(
            "SELECT count(*) FROM stashes WHERE workspace_id = $1",
            workspace_id,
        )
        print(
            "Seed complete: "
            f"users={len(created_users)} "
            f"sessions={len(sessions)} "
            f"files={len(files)} "
            f"stashes={stash_count}"
        )
    finally:
        await database.close_db()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
