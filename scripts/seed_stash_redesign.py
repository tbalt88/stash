"""Seed sample data for the stash redesign.

Creates a dedicated stash ('Acme Series A — Investor Diligence') owned by
``sam`` with henry as a member, populated with:

  - 2 session transcripts (synthetic agent runs)
  - 2 skills (wiki folders with SKILL.md + sibling files)
  - A few wiki pages flagged public_in_share, including a Narrative.md deck
    that the recipient share view will render as slides
  - 2 sample files (no real upload; just rows so the Drive bucket lights up)
  - One active share link with a 14-day TTL

Run:
    DATABASE_URL=postgresql://octopus:octopus@localhost:5432/octopus \\
        python scripts/seed_stash_redesign.py
"""

from __future__ import annotations

import asyncio
import os
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import asyncpg

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://octopus:octopus@localhost:5432/octopus"
)

SAM_ID = UUID("fc4d8f89-8d5f-41d6-91b8-5a8c965bbac0")
HENRY_ID = UUID("a0000000-0000-0000-0000-000000000099")
STASH_ID = UUID("d0000000-0000-0000-0000-000000000001")

NOW = datetime.now(timezone.utc)


NARRATIVE_DECK = """# Acme — Series A

Reinventing how mid-market teams handle accounts payable.

---

# The problem

AP teams at companies between $20M and $500M ARR live in a swamp of
PDF invoices, ad-hoc Slack approvals, and one-off ERP integrations.

- 4-7 day average invoice cycle
- 20% of approvals lost in DM threads
- $250B/yr in late-payment penalties (US, 2025)

---

# Our wedge

A one-click invoice-to-approval flow. Drop a PDF → an agent extracts
fields, routes to the right approver, and posts to NetSuite/QuickBooks
without anyone touching a form.

---

# Traction

- 32 paying customers, all between $20M-$200M ARR
- $1.4M ARR · 18% MoM net revenue growth (last 6 months)
- 92% gross margin
- Net retention 138%

---

# Team

- **Karri Ojala** (CEO) — ex-Stripe billing, MIT '14
- **Sam Liu** (CTO) — ex-Vercel infra, ML systems
- **Mei Tanaka** (Design) — ex-Linear, ex-Notion
- 4 eng, 2 GTM. All in NYC.

---

# The ask

$8M Series A at $48M post.

- 18 months runway → 8x ARR ($1.4M → $11M)
- Build the GL-side agent (NetSuite, QBO, Sage)
- Hire 4 eng, 2 AE, 1 design

Lead investor target: a fund that can write a $5M+ check and
go to $20M+ in B.
"""

DD_RESPOND_SKILL = """---
name: dd-respond
description: Draft response packets to investor diligence asks
when_to_use: When an investor sends a DD checklist
version: 2.1
mcp_exposed: true
---

# DD-respond

You handle inbound investor diligence asks. The pattern is always:

1. Pull the canonical fact from the stash's Drive (financial model,
   board deck, customer list).
2. Cite the source in the response so the investor can verify.
3. Use the tone set in `examples.md` — short, honest, no padding.

Never invent a number. If the stash doesn't have it, say so and
flag it for the founders.
"""

DD_RESPOND_EXAMPLES = """# Example responses

## Q: "What's your CAC payback?"

> 11 months blended; 7 months for the inbound channel.
> See `arr_forecast.csv` rows 14-22 for the breakdown.
> Caveat: outbound is only 4 months in so we don't have a clean cohort
> on that channel yet.

## Q: "What's your churn?"

> 1.2% monthly logo churn over the last 6 months. Net retention 138%.
> Source: `customer_health.csv`. The 138% is real — driven by usage-based
> billing on volume tiers, not seat expansion.
"""

POST_MORTEM_SKILL = """---
name: post-mortem
description: Run the standard incident post-mortem template
when_to_use: After any P0/P1 incident, within 48 hours of resolution
version: 1.0
mcp_exposed: false
---

# Post-mortem

Use the template in `template.md`. Fill it in within 48 hours.

The five required sections — non-negotiable:
- Timeline (UTC, minute granularity)
- Impact (customers affected, $$, SLA)
- Root cause (the actual one, not the proximate)
- Contributing factors
- Action items (each with an owner and a date)
"""

POST_MORTEM_TEMPLATE = """# Incident: <short title>

**Date:** YYYY-MM-DD
**Severity:** P0 | P1 | P2
**Owner:** @name
**Status:** Open | Resolved

## Timeline

- 14:02 UTC — first alert fired
- 14:05 UTC — on-call paged
- ...

## Impact

## Root cause

## Contributing factors

## Action items

| Item | Owner | Due |
|------|-------|-----|
"""


SESSION_1_TRANSCRIPT = b"""{"type":"summary","summary":"Drafted DD response packet for Sequoia"}
{"type":"user","content":"investors asked for our CAC payback breakdown"}
{"type":"assistant","content":"Pulling arr_forecast.csv to get the channel-level breakdown..."}
"""

SESSION_2_TRANSCRIPT = b"""{"type":"summary","summary":"Reviewed Q3 customer health data"}
{"type":"user","content":"summarize churn by segment"}
{"type":"assistant","content":"1.2% monthly logo churn overall; SMB at 2.1%, mid-market at 0.6%"}
"""


async def main() -> None:
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        async with conn.transaction():
            await _seed(conn)
    finally:
        await conn.close()
    print("\n✓ Seed complete.")
    print(f"  Stash:    http://localhost:3457/stashes/{STASH_ID}")
    print("  Login:    sam (use your existing credentials)")


async def _seed(conn: asyncpg.Connection) -> None:
    print("→ creating stash 'Acme Series A — Investor Diligence'")
    await conn.execute("DELETE FROM share_links WHERE workspace_id = $1", STASH_ID)
    await conn.execute("DELETE FROM workspaces WHERE id = $1", STASH_ID)
    await conn.execute(
        "INSERT INTO workspaces (id, name, description, summary, creator_id, "
        "invite_code, is_public, tags, category) "
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        STASH_ID,
        "Acme Series A — Investor Diligence",
        "All the artifacts we share with potential Series A leads. Decks, "
        "financial model, customer references, and the agent skills that "
        "draft our diligence responses.",
        "Series A diligence stash — pitch deck, financials, customer "
        "references, and the dd-respond skill our agents use to draft "
        "investor responses.",
        SAM_ID,
        "acme" + secrets.token_hex(4),
        False,
        ["fundraise", "series-a", "demo"],
        "fundraising",
    )
    await conn.execute(
        "INSERT INTO workspace_members (workspace_id, user_id, role) "
        "VALUES ($1, $2, 'owner') ON CONFLICT DO NOTHING",
        STASH_ID,
        SAM_ID,
    )
    await conn.execute(
        "INSERT INTO workspace_members (workspace_id, user_id, role) "
        "VALUES ($1, $2, 'admin') ON CONFLICT DO NOTHING",
        STASH_ID,
        HENRY_ID,
    )

    print("→ creating skills (wiki folders with SKILL.md frontmatter)")
    await _create_skill(
        conn,
        folder_name="dd-respond",
        files={"SKILL.md": DD_RESPOND_SKILL, "examples.md": DD_RESPOND_EXAMPLES},
    )
    await _create_skill(
        conn,
        folder_name="post-mortem",
        files={"SKILL.md": POST_MORTEM_SKILL, "template.md": POST_MORTEM_TEMPLATE},
    )

    print("→ creating narrative deck page (public_in_share=true)")
    narrative_id = uuid4()
    await conn.execute(
        "INSERT INTO pages "
        "(id, workspace_id, folder_id, name, content_markdown, content_html, "
        " content_type, content_hash, metadata, created_by, updated_by, public_in_share) "
        "VALUES ($1, $2, NULL, 'Narrative.md', $3, '', 'markdown', $4, '{}'::jsonb, $5, $5, TRUE)",
        narrative_id,
        STASH_ID,
        NARRATIVE_DECK,
        f"sha-{narrative_id}",
        SAM_ID,
    )

    print("→ creating supplementary wiki pages (Drive)")
    for name, body, public in [
        (
            "FAQ.md",
            "# FAQ\n\n## Why now?\nAP automation is finally a problem AI can solve end-to-end.\n",
            True,
        ),
        (
            "Customer References.md",
            "# Reference customers\n\n- Mercury Bank\n- Plaid\n- Linear\n",
            False,
        ),
    ]:
        await conn.execute(
            "INSERT INTO pages "
            "(id, workspace_id, folder_id, name, content_markdown, content_html, "
            " content_type, content_hash, metadata, created_by, updated_by, public_in_share) "
            "VALUES (gen_random_uuid(), $1, NULL, $2, $3, '', 'markdown', $4, '{}'::jsonb, $5, $5, $6) "
            "ON CONFLICT DO NOTHING",
            STASH_ID,
            name,
            body,
            f"hash-{name}",
            SAM_ID,
            public,
        )

    print("→ creating session transcripts")
    for sess_id, agent_name, transcript in [
        ("acme-dd-2026-05-04", "claude-opus", SESSION_1_TRANSCRIPT),
        ("acme-finance-review-2026-05-06", "claude-sonnet", SESSION_2_TRANSCRIPT),
    ]:
        await conn.execute(
            "INSERT INTO session_transcripts "
            "(workspace_id, session_id, agent_name, storage_key, size_bytes, cwd, uploaded_by) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7) "
            "ON CONFLICT (workspace_id, session_id) DO NOTHING",
            STASH_ID,
            sess_id,
            agent_name,
            f"local/seed/{sess_id}.jsonl",
            len(transcript),
            "/Users/sam/code/acme",
            SAM_ID,
        )

    print("→ creating sample file rows (no real upload)")
    for name, ct, size in [
        ("arr_forecast.csv", "text/csv", 8421),
        ("acme_pitch_2026.pdf", "application/pdf", 1843200),
    ]:
        await conn.execute(
            "INSERT INTO files "
            "(id, workspace_id, name, content_type, size_bytes, storage_key, uploaded_by, public_in_share) "
            "VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, FALSE) "
            "ON CONFLICT DO NOTHING",
            STASH_ID,
            name,
            ct,
            size,
            f"local/seed/{name}",
            SAM_ID,
        )

    print("→ minting an active share link (14d TTL)")
    token = secrets.token_urlsafe(16)
    await conn.execute(
        "INSERT INTO share_links (token, workspace_id, created_by, expires_at, permission) "
        "VALUES ($1, $2, $3, $4, 'view')",
        token,
        STASH_ID,
        SAM_ID,
        NOW + timedelta(days=14),
    )
    print(f"   share URL: http://localhost:3457/share/{token}")


async def _create_skill(
    conn: asyncpg.Connection, *, folder_name: str, files: dict[str, str]
) -> None:
    folder_id = uuid4()
    # Drop any prior seed of this skill folder for idempotency.
    await conn.execute(
        "DELETE FROM folders WHERE workspace_id = $1 AND name = $2 AND parent_folder_id IS NULL",
        STASH_ID,
        folder_name,
    )
    await conn.execute(
        "INSERT INTO folders (id, workspace_id, parent_folder_id, name, created_by) "
        "VALUES ($1, $2, NULL, $3, $4)",
        folder_id,
        STASH_ID,
        folder_name,
        SAM_ID,
    )
    for fname, body in files.items():
        await conn.execute(
            "INSERT INTO pages "
            "(id, workspace_id, folder_id, name, content_markdown, content_html, "
            " content_type, content_hash, metadata, created_by, updated_by) "
            "VALUES (gen_random_uuid(), $1, $2, $3, $4, '', 'markdown', $5, '{}'::jsonb, $6, $6)",
            STASH_ID,
            folder_id,
            fname,
            body,
            f"hash-{folder_name}-{fname}",
            SAM_ID,
        )


if __name__ == "__main__":
    asyncio.run(main())
