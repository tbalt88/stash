# Stash redesign — Notion-style 3-pane shell, skills-as-markdown, Ask-the-stash agent

## Context

`../stash_share_mockup/stash-share-mockup.html` is a 3,271-line static prototype of where Stash is heading. It crystallizes three product bets that aren't reflected in the current code:

1. **Stashes are the unit, not workspaces.** A stash is a shared bundle a team works out of. The product, CLI, MCP server are already named "stash" — but the data model and routes still say `workspace`. The terminology drift is confusing for anyone reading the docs vs. the API.
2. **Every stash has the same three folders, mapped to how memory works for an agent**: Sessions (episodic — agent transcripts), Skills (procedural — what the agent can do), Drive (semantic — files we create or manipulate). This is the spine of the navigation tree, the stash home page, and the new-stash empty state.
3. **The right rail is "Ask this stash"** — a per-stash agent chat that grounds answers in the stash's content with citation chips. This is the primary way humans get value out of a stash without opening files one by one.
4. **A shared stash has a recipient view.** Sharing a stash produces a public link that lands on a Notion-like read-only view with a sharer banner ("Karri shared this with you · view-only · expires in 14 days"), `Request edit access` / `Fork` / `Present →` actions, and an "Ask this deck/stash" rail scoped to readable content only. Decks (stashes whose primary asset is a slide-style narrative) get a 16:9 stage + thumbnail strip + arrow-key presentation mode.

Current frontend is Next.js 16 / Tailwind 4 with a flat 4-link sidebar (Search, History, Wiki, Tables) and a floating bottom-right "CollectTray" — none of which matches the mockup. The backend has 95% of the data (`workspaces`, `wiki`, `transcripts`, `files`, `tables`, `discover`, `fork`) but no LLM client and no concept of "skill" beyond a single static `SKILL.md` describing the API itself.

Goal of this plan: **stage the migration in 4 phases** so each ships independently. End state matches the mockup: Notion-style 3-pane shell, stashes as the canonical unit, three-folder spine, real Ask-the-stash agent.

---

## Design decisions (locked with user)

**1. Full rename: workspace → stash everywhere** (UI, CLI, MCP, REST API). New routes added at `/api/v1/stashes/*` alongside existing `/workspaces/*`; old routes kept as thin aliases for one release, then deleted. CLI gets `stash stash *` subcommands (and shorthand) replacing `stash ws_*`. Per CLAUDE.md ("don't preserve backwards compat") we drop the old surfaces aggressively after the alias period.

**2. Skills are markdown files, not a new table.** A skill is a wiki folder containing a `SKILL.md` with YAML frontmatter (`name`, `description`, `when_to_use`) plus arbitrary supporting `.md` files. This is the **Claude Code skills format**, which is already a convention agents understand, so a stash's skills are immediately reusable across Claude Code, Cursor, and our MCP. No new schema. Detection logic = "any wiki folder whose direct child is a file named `SKILL.md`". MCP exposes them via `stash_list_skills` / `stash_read_skill`. The "Skills" bucket on the stash home page is a virtual view over the wiki tree filtered to these folders.

**3. Sessions / Drive are also virtual views over existing data.** `Sessions` = `transcripts` table grouped by `session_id`. `Drive` = `files` + non-skill wiki pages. No schema changes for the three-folder model — it's a UI-side grouping plus a thin backend helper that returns `{sessions, skills, drive}` for one stash.

**4. Ask-the-stash is a real agent loop.** New endpoint `POST /api/v1/stashes/{id}/ask` that runs an LLM (Anthropic SDK — needs to be added) in a tool-use loop with tools scoped to the stash: `search_history`, `read_page`, `grep_pages`, `list_files`, `read_file`, `query_table`. Streams via SSE; each tool call's result becomes a citation chip in the UI. Reuses `memory_service.search`, `wiki_service`, `file_extraction` etc. — no new retrieval infra.

**5. Phased delivery** so each phase is shippable on its own.

---

## Phase 1 — Shell, nav tree, rename, stash home

**Goal:** the static structure of the mockup. No agent chat, no skills logic yet, but the app *looks* like the mockup.

### Backend

- `backend/routers/stashes.py` (new): aliases the workspaces router under `/api/v1/stashes/*`. Endpoints: `GET /stashes`, `GET /stashes/{id}`, `POST /stashes`, `POST /stashes/{id}/fork`, `GET /stashes/{id}/members`, etc. Implementation re-exports the existing handlers from `workspaces.py` — same DB queries, just a different URL prefix. Also rename in response DTOs: `WorkspaceResponse` → `StashResponse` (keep `Workspace*` as a deprecated alias type for one release).
- `backend/routers/stashes.py`: new endpoint `GET /api/v1/stashes/{id}/spine` that returns `{sessions: [{session_id, title, agent_name, message_count, last_at}], skills: [{folder_id, name, description, file_count}], drive: {files: [...], folders: [...]}}`. Sessions reads from `transcripts` (grouped); skills reads from `wiki` (filtered to folders containing `SKILL.md`); drive reads from `files` + non-skill wiki pages. Critical files: `backend/services/wiki_service.py`, `backend/services/storage_service.py`, `backend/routers/transcripts.py:get_transcripts`.
- DB: no migrations. The `workspaces` table is the source of truth; the rename is purely at the API/CLI/UI layer.

### CLI / MCP

- `cli/main.py`: introduce a top-level `stash stash` command group (`stash stash list|create|fork|members|info|join|leave`) that calls the new `/api/v1/stashes/*` endpoints. Mark the old `ws_*` commands as deprecated in their `--help`. Single source of truth for HTTP calls is in `cli/api.py` — switch the URL builder there.
- `cli/mcp_server.py`: rename the `stash_*workspace*` tool names to `stash_*stash*` (`stash_list_workspaces` → `stash_list_stashes`, `stash_workspace_info` → `stash_stash_info`, etc.). Keep the old names as aliases for one release. Add `stash_list_skills(stash_id)` and `stash_read_skill(stash_id, skill_name)` for Phase 2 wiring (no-ops on Phase 1 ship if needed).

### Frontend (the bulk of Phase 1)

Match the mockup's 3-column grid: `260px sidebar | 1fr center | 360px right rail`.

- `frontend/src/components/AppShell.tsx`: replace the current 2-column flex layout with a 3-column grid. Keep `<TopBar />` sticky at top. Drop `<CollectTray />` entirely (its bundling-share flow is replaced by the per-stash share modal in Phase 4).
- `frontend/src/components/AppSidebar.tsx` → rewrite to match mockup. Reuse the existing workspace switcher logic (lines 77–123). Sections in order:
  1. Wordmark + workspace search button (⌘K)
  2. Top nav: `Discover`, `Activity`
  3. **Shared with me** group — for each stash the user is a member of, render a collapsible tree: stash → Sessions / Skills / Drive (each expandable from `GET /stashes/{id}/spine`).
  4. **My stashes** group — same structure for stashes the user owns.
  5. Settings / user menu at bottom (already exists).
  - Pull the nested-tree primitive from `frontend/src/components/workspace/FileTree.tsx` (it already does collapsible folders + chevrons). Promote a generic `<TreeNode>` primitive next to it; the existing FileTree becomes a consumer of it.
- `frontend/src/components/AskRail.tsx` (new): the right rail. For Phase 1 it's a UI shell only — header (`Ask this stash`), suggestion chips, composer with textarea + scope selector + Ask button. Submit is a no-op stub. Match the markup at mockup lines 744–861 (the `askStashRail` template).
- `frontend/src/components/AskRail.tsx`: also implement collapsed strip variant (mockup lines 663–679) toggled by ⌘.
- Routes:
  - `frontend/src/app/page.tsx` → renders `<DiscoverPage />` for logged-out, `<StashesHome />` (the "your stashes" landing) for logged-in.
  - `frontend/src/app/stashes/[id]/page.tsx` (new): the stash home page (mockup lines 1125–1208) — banner + title + 3 buckets. Replaces `frontend/src/app/workspaces/[id]/page.tsx` content. Old workspace route becomes a redirect to `/stashes/[id]` for one release.
  - Existing pages (`memory`, `tables`, `wiki`, `files`, `search`) get re-skinned to render inside the new shell with the right rail visible. No content changes — just the shell.
- Brand tokens (`frontend/src/app/globals.css`): swap the orange brand for the mockup's olive/forest palette (`#527559` / `#43614a` / `#36503c`). Keep the existing semantic tokens (`--color-brand`, `--color-brand-muted`); just point them at the new hex. Add display font: Space Grotesk via `next/font` (replaces Satoshi for headlines). Keep Inter for body (already loaded).

### Verification (Phase 1)

- `pnpm dev` from `frontend/`. Hit `/`, `/stashes/{id}`, `/discover`. The shell should look pixel-close to the mockup at three breakpoints (260+360 cols, sidebar collapsed, rail collapsed).
- `stash stash list` returns the same data as `stash ws_list`.
- `curl /api/v1/stashes/{id}/spine` returns `{sessions, skills, drive}` arrays with realistic data on a stash that has transcripts + wiki + files.
- No backend tests should regress. Add `backend/tests/test_stashes_router.py` covering the spine endpoint.

---

## Phase 2 — Skills as markdown files

**Goal:** authoring + browsing + invoking skills as markdown folders. Reuses wiki storage; no new tables.

### Convention

- A **skill** is a wiki folder where the immediate children include a file named `SKILL.md`.
- `SKILL.md` has YAML frontmatter:
  ```yaml
  ---
  name: dd-respond
  description: Draft response packets to investor diligence asks
  when_to_use: When an investor sends a DD checklist
  version: 2.1
  mcp_exposed: true
  ---
  ```
- The folder may contain arbitrary supporting `.md` files (`examples.md`, `dd-checklist.md`, etc.). The skill is the folder, not the entry file.
- Skills typically live under a `skills/` parent folder per stash, but the detection rule doesn't require that — any folder with a `SKILL.md` qualifies.

### Backend

- `backend/services/skill_service.py` (new, ~150 lines): `list_skills(stash_id)`, `read_skill(stash_id, skill_name)`, `parse_frontmatter(md)`. Walks the wiki tree (uses `wiki_service.list_folders`), filters to folders containing `SKILL.md`, parses frontmatter with `python-frontmatter` (already idiomatic, add as dep). Returns `[{folder_id, name, description, when_to_use, files: [...], mcp_exposed}]`.
- `backend/routers/stashes.py`: add `GET /stashes/{id}/skills` and `GET /stashes/{id}/skills/{name}` endpoints calling the service. Skills are not their own resource — they're a *view* over wiki, so reads/writes still go through wiki endpoints.
- Update `GET /stashes/{id}/spine` from Phase 1 to use the real skill detection.
- `backend/static/SKILL.md`: rewrite to teach agents about the new model — "to give your agents a skill, create a wiki folder under /skills with a SKILL.md frontmatter file."

### CLI / MCP

- `cli/main.py`: `stash skill list <stash>`, `stash skill show <stash> <name>`, `stash skill add <stash> <local-folder>` (uploads a local skill folder as a wiki folder). The `add` command is the pivotal authoring move — local Claude Code skill folders can be `cd`'d into and pushed in one shot.
- `cli/mcp_server.py`: implement the Phase-1 stubs `stash_list_skills` and `stash_read_skill`. These let any MCP-aware agent (Claude Code, Cursor, etc.) discover and load a stash's skills at runtime — same surface as Claude Code's own skill system, so a skill authored once works everywhere.
- Critical: when an agent calls `stash_read_skill`, it gets back the *full text of SKILL.md plus all sibling files concatenated*, so the agent can load the skill in one tool call. This matches Claude Code's skill loader behavior.

### Frontend

- `frontend/src/app/stashes/[id]/skills/[name]/page.tsx` (new): renders a skill (mockup lines 1693–1723 / `skillPage`). Header with frontmatter, body markdown, "Files in this skill" sidebar listing siblings, "Copy as markdown" + "Drop this file into any agent's skills directory" CTAs.
- `frontend/src/components/AppSidebar.tsx`: when expanding a stash's `Skills` group, fetch from `/api/v1/stashes/{id}/skills` and render each skill as a collapsible folder with an `⚙︎` icon (mockup lines 333–358).
- `frontend/src/app/stashes/[id]/page.tsx`: the "⚡ Skills · procedural" bucket on the stash home pulls real data.

### Verification (Phase 2)

- Drop a Claude Code skill folder (e.g. `~/.claude/skills/loop/`) into a stash via `stash skill add`. It appears in the sidebar tree, on the stash home, and in `mcp__stash__list_skills` from any MCP client.
- Add `backend/tests/test_skill_service.py` covering: detection rule, frontmatter parsing, edge cases (folder with no SKILL.md, malformed frontmatter, deeply nested skill).
- Authoring loop: edit `examples.md` in the UI → save → `stash_read_skill` reflects the change.

---

## Phase 3 — Ask-the-stash agent

**Goal:** the right rail's composer actually works. Real LLM, real retrieval, citations link back to source.

### Backend

- Add Anthropic SDK: `anthropic` to `backend/pyproject.toml`. Env: `ANTHROPIC_API_KEY` from `backend/config.py`. (Check existing `config.py` — there's no LLM key today.)
- `backend/services/ask_service.py` (new): the agent loop.
  - System prompt: "You're an expert assistant for the {stash_name} stash. Use tools to ground every claim. Cite sources by ID — UI will resolve them to chips."
  - Tools (Anthropic tool-use schema):
    - `search_history(query, limit)` → wraps `memory_service.search`
    - `read_page(page_id)` → wraps `wiki_service.get_page`
    - `grep_pages(pattern)` → wraps `wiki_service` full-text scan
    - `list_files()` → wraps `storage_service.list_files`
    - `read_file(file_id)` → wraps `file_extraction.extract_text`
    - `query_table(table_id, sql_or_filters)` → wraps `table_service.query`
    - `list_skills()` / `read_skill(name)` → from Phase 2
  - Loop: send messages → if response has tool_use blocks, execute, append tool_result blocks, send again. Stop on `stop_reason == "end_turn"` or `max_turns = 8`.
  - Model: `claude-sonnet-4-6` (per the model guidance in this session's environment notes — fast and cheap enough for chat).
  - Streaming: SSE. Forward Anthropic's text delta events as `data: {"type":"text","delta":"..."}`. Forward each tool call as `data: {"type":"tool","name":"search_history","args":{...},"result_summary":"3 hits"}` so the UI can render citation chips as they happen.
- `backend/routers/stashes.py`: `POST /api/v1/stashes/{id}/ask` accepting `{messages: [...], scope: "stash" | "session-id"}`. Permission check: caller must be a member of the stash (use existing `permission_service`). Returns SSE stream.
- Persist threads: new `ask_threads` and `ask_messages` tables (alembic migration). Each thread is owned by `(user_id, stash_id)`. Lets the right rail show history.

### Frontend

- `frontend/src/components/AskRail.tsx`: wire the composer to `POST /api/v1/stashes/{id}/ask`, parse the SSE stream, render messages as in the mockup (Q bubbles right-aligned, agent A bubbles left-aligned with tool-call chips). Copy the visual design from mockup lines 770–833.
- Citation chips: each tool result becomes a small button (`▦ arr_forecast.csv · rows 14–22`). Clicking it routes the center pane to that resource and scrolls to the relevant range. Reuses the existing `<BreadcrumbContext>` for the route change.
- `frontend/src/lib/sse.ts` (new): minimal SSE parser hook (Next.js's fetch + `ReadableStream`). 50 lines max.
- Suggestion chips: pull a hard-coded list from the page's data (e.g. "Top 3 risks?", "Best customer quote?"). A future improvement is server-suggested prompts based on stash content; out of scope here.

### Verification (Phase 3)

- End-to-end: open a real stash, ask "what's our ARR?" — agent calls `query_table`/`grep_pages`, returns answer with chips. Click a chip → center pane navigates to the source.
- Latency budget: first text token within 1.5s on a warm worker. Add `backend/tests/test_ask_service.py` with a recorded VCR-style cassette for the Anthropic call so CI doesn't hit the API.
- Permission test: a non-member calling `/ask` for a private stash gets 403.

---

## Phase 4 — Discover, share modal (sender side), narrative pages, polish

**Goal:** the public-facing surfaces from the mockup that aren't hot paths. This phase is the **sender's** half of sharing — the receiver's view is Phase 5.

- `frontend/src/app/discover/page.tsx`: rewrite to match mockup lines 2253–2402 (hero search, filter chips, featured card, trending grid, categories, top contributors). Backend `discover_service` already provides featured/trending lists; just wire them.
- `frontend/src/components/ShareModal.tsx`: replaces the deleted CollectTray. Triggered by the `Share` button in the top bar. Members + visibility + copyable share link, matching the mockup's share modal (lines 2755–2811). Modal is the *producer* of the share link; the link's destination is built in Phase 5.
- `frontend/src/app/stashes/new/page.tsx`: the empty-stash onboarding (mockup lines 2405–2562) — three-folder pre-creation, drop zone, agent transcript imports.
- Narrative / README pattern: any wiki page named `Narrative.md` or marked as a stash's README in frontmatter gets the gradient-banner treatment (mockup lines 1211–1283). Implement as a presentation flag in the page renderer; no schema change. **This same flag also drives Phase 5's "deck-mode" detection** — a stash whose home page is a narrative becomes a deck candidate.
- Drop the orange brand color and `CollectTray.tsx` entirely.
- Delete deprecated `/workspaces/*` routes and `ws_*` CLI commands. Update `README.md`, `CLAUDE.md`, `docs/`.

### Verification (Phase 4)

- Discover page renders with real data from a seeded set of public stashes.
- Share modal sets visibility + emits a token-bearing share link. (Opening it in incognito is verified in Phase 5.)
- `rg "workspace" frontend/src` returns nothing user-facing.

---

## Phase 5 — Recipient view + deck/presentation mode

**Goal:** the *other side* of the share modal. When someone follows a public share link, they land on a Notion-like read-only stash view with a sharer banner, scoped Ask rail, and (for decks) a 16:9 presentation stage. Reference: mockup lines 2563–2684 (`shared-deck`).

### Backend

- New table `share_links` (alembic migration): `(token, stash_id, created_by, created_at, expires_at, permission, view_count, last_viewed_at, last_viewed_by)`. `permission` is enum `view | comment | edit-request`. Token is a 22-char URL-safe random string.
- `backend/routers/shares.py` (new):
  - `POST /api/v1/stashes/{id}/shares` — sender creates a link from the share modal. Returns `{token, url, expires_at}`. Used by Phase 4's `ShareModal`.
  - `GET /api/v1/shares/{token}` — public, no auth. Returns the stash's *public projection*: name, description, narrative/deck content, slides (if applicable), member-visible files/pages flagged `public_in_share=true`, view stats. Records a view (rate-limited by IP+token to avoid inflating counts on refresh).
  - `POST /api/v1/shares/{token}/request-edit` — recipient asks for edit access; creates a notification for the sharer. Anonymous if not logged in (captures email from the request body).
  - `POST /api/v1/shares/{token}/fork` — recipient clones the stash into their account (requires login; reuses existing `POST /workspaces/{id}/fork` plumbing).
  - `POST /api/v1/shares/{token}/ask` — same agent loop as Phase 3 but with a **recipient-scoped tool set**: only `read_page`, `grep_pages`, `list_files`, `read_file` over content marked public-in-share. No `search_history` (private transcripts), no `read_skill` (procedural IP). System prompt is the "Ask this deck" persona from mockup lines 2660–2666 (offers IC-memo summaries, top risks, source citations).
- `backend/services/share_service.py` (new, ~120 lines): `create_link`, `resolve_token`, `record_view`, `public_projection(stash_id)` (the gate that decides what's visible to recipients).
- Deck detection: `public_projection` returns a `deck` field when the stash's narrative page contains slide-delimited markdown (e.g., H1s with a `---` rule between them, or a `slides:` frontmatter array). The slide model is just a parsed view of one markdown file — **no separate slides table.**
- Permission scoping: Phase 3's `ask_service` is refactored to take an explicit `tool_set` parameter so the recipient endpoint can pass a restricted list. Existing `/stashes/{id}/ask` keeps the full set.

### Frontend

- `frontend/src/app/share/[token]/page.tsx` (new): public route, no auth required. Fetches `GET /api/v1/shares/{token}` and renders one of two layouts based on whether the projection includes a `deck`.
- `frontend/src/components/share/RecipientShell.tsx` (new): the chrome shared by both layouts. Reuses the 3-col grid from `AppShell` but with the left sidebar replaced by the recipient banner (mockup lines 2578–2591) — sharer avatar + "X shared this with you" + email + date + "view-only · expires in N days" + `Request edit access` / `Fork` / `Present →` buttons. The right rail is `<AskRail mode="recipient">`.
- `frontend/src/components/share/DeckStage.tsx` (new): mockup lines 2608–2630. 16:9 gradient stage, slide kicker + title + body, slide counter, "← → to navigate" hint, thumbnail strip with prev/next buttons. Keyboard handlers: `←/→` advance, `Esc` exits present mode, `f` toggles fullscreen.
- `frontend/src/components/share/PresentMode.tsx` (new): triggered by the `Present →` button. Full-viewport overlay using the Fullscreen API; same `DeckStage` rendered larger; thumbnail strip hidden; cursor auto-hides after 2s of inactivity.
- `AskRail.tsx` (extended): add a `mode: "stash" | "recipient"` prop. In `recipient` mode the header reads `Ask this deck` (mockup line 2647), the suggestion chips are recipient-flavored (`⏱ 30-sec summary`, `📊 Best stat for my IC memo`, `⚠ Top 3 risks`, `💬 Source the customer quote` — mockup lines 2663–2666), the footnote reads `View-only — agent reads the deck but doesn't modify it.` (line 2681), and submit hits the recipient endpoint with the share token instead of the stash ID.
- Login wall handling: `Fork` and `Request edit access` open a lightweight auth modal if the recipient is anonymous; the share token is preserved across the auth bounce so they land back on the same page.
- Non-deck recipient view: when `public_projection` has no `deck`, the center pane renders the stash's narrative + visible-in-share files/pages using the existing wiki/file viewers from Phase 1 — same shell, no presentation mode, no thumbnail strip.

### Sender side (small additions to Phase 4's ShareModal)

- After Phase 5 lands, `ShareModal` calls `POST /stashes/{id}/shares` to mint a token, shows the resulting URL with a copy button, and lists previously-issued links with revoke + view-count. `expires_at` defaults to 14 days (matches the mockup's banner copy); user can pick `7d / 14d / 30d / never`.
- Per-resource public-in-share toggles live on the wiki-page and file detail pages (a checkbox in the page actions menu). `public_projection` reads this flag.

### Verification (Phase 5)

- End-to-end happy path: from a stash, open Share modal → copy link → open in incognito → recipient view loads with banner, deck stage, and Ask rail. Press `→` advances slides; click thumbnail jumps to that slide; click `Present →` enters fullscreen.
- Recipient Ask agent: ask "summarize the ask" → answer cites slides only; ask "search history for X" → tool isn't available, agent says it can't.
- Permission tests: `GET /shares/{token}` after `expires_at` returns 410 Gone; `POST /shares/{token}/ask` for an expired link returns 410; revoking a link from the sender's modal → recipient gets 404 on next request.
- Anonymous fork triggers auth flow then lands the user on the forked stash in their account.
- `pnpm exec playwright test e2e/share-recipient.spec.ts`: covers the slide nav, the request-edit flow, and the fork flow.

---

## Critical files (cheat sheet)

**Frontend**
- `frontend/src/components/AppShell.tsx` — 3-col grid rewrite (Phase 1)
- `frontend/src/components/AppSidebar.tsx` — Notion-tree rewrite (Phase 1)
- `frontend/src/components/AskRail.tsx` — new (Phase 1 shell, Phase 3 wired, Phase 5 recipient mode)
- `frontend/src/components/workspace/FileTree.tsx` — extract `<TreeNode>` primitive
- `frontend/src/app/stashes/[id]/page.tsx` — new stash home (Phase 1)
- `frontend/src/app/stashes/[id]/skills/[name]/page.tsx` — skill page (Phase 2)
- `frontend/src/app/discover/page.tsx` — discover rewrite (Phase 4)
- `frontend/src/components/ShareModal.tsx` — new, sender side (Phase 4)
- `frontend/src/app/share/[token]/page.tsx` — recipient route (Phase 5)
- `frontend/src/components/share/RecipientShell.tsx` — recipient chrome (Phase 5)
- `frontend/src/components/share/DeckStage.tsx` — 16:9 stage + thumbs (Phase 5)
- `frontend/src/components/share/PresentMode.tsx` — fullscreen presenter (Phase 5)
- `frontend/src/app/globals.css` — brand tokens + display font (Phase 1)

**Backend**
- `backend/routers/stashes.py` — new alias router (Phase 1)
- `backend/routers/shares.py` — new public share + recipient-ask router (Phase 5)
- `backend/services/skill_service.py` — new (Phase 2)
- `backend/services/ask_service.py` — new (Phase 3); refactored to accept a `tool_set` (Phase 5)
- `backend/services/share_service.py` — new, public projection + token resolution (Phase 5)
- `backend/static/SKILL.md` — rewrite (Phase 2)
- `backend/pyproject.toml` — add `anthropic`, `python-frontmatter` (Phases 3, 2)
- `backend/migrations/versions/000X_ask_threads.py` — new (Phase 3)
- `backend/migrations/versions/000Y_share_links.py` — new (Phase 5)

**CLI / MCP**
- `cli/main.py` — `stash stash *`, `stash skill *` command groups (Phases 1, 2)
- `cli/mcp_server.py` — rename tools, add skill tools (Phases 1, 2)

---

## Phase ordering / dependencies

```
Phase 1 (shell + rename + spine endpoint) ──┬── Phase 2 (skills) ──┐
                                            │                     │
                                            └── Phase 3 (ask)  ───┴── Phase 4 (polish) ── Phase 5 (recipient + deck)
```

Phase 2 and Phase 3 are independent and can run in parallel after Phase 1 lands. Phase 4 depends on Phase 1 surface stability. Phase 5 depends on Phase 3 (reuses the agent loop with a restricted tool set) and Phase 4 (the share modal mints the tokens Phase 5's recipient route resolves).
