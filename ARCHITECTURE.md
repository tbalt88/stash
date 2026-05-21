# Stash Architecture

Stash is a workspace for AI-agent work. The product has three primary resource
surfaces:

- Sessions: coding-agent transcripts and their generated artifacts.
- Files: folders, markdown pages, HTML pages, uploads, and tables.
- Stashes: shareable bundles of sessions and Files. Stashes are also the privacy
  boundary for workspace content.

## Runtime

- Backend: FastAPI in `backend/`, PostgreSQL, Alembic migrations, S3-compatible
  object storage for uploads.
- Product UI: Next.js in `frontend/`.
- Landing/docs site: Next.js in `www/`.
- CLI/MCP: `cli/`, `stashai/plugin/`, and agent plugin assets under `plugins/`.

## Data Model

- `workspaces` contain members, sessions, Files, tables, and Stashes.
- `sessions` and `history_events` store agent transcript activity.
- `folders`, `pages`, and `files` form the Files surface.
- `tables` and `table_rows` store structured data that can be included in
  Stashes.
- `stashes` and `stash_items` define shareable bundles.
- `stash_members` grants explicit access to private Stashes.
- `external_stashes` attaches a public Stash from another workspace.

Object-level privacy tables and page-link graph tables are intentionally not part
of the current architecture. Privacy is mediated by Stashes.

## Access Rules

- Content with no containing Stash is visible to workspace members.
- Public Stashes are anonymously readable.
- Workspace Stashes are readable to workspace members.
- Private Stashes are readable only to their owner, workspace admins, and
  explicit Stash members.
- Items in a private Stash cannot also be included in workspace or public
  Stashes.
- Publishing is UI sugar for making a Stash public and returning its public URL.

## Main Backend Routers

- `backend/routers/workspaces.py`: workspace CRUD, membership, invites.
- `backend/routers/files_tree.py`: Files folders and pages.
- `backend/routers/files.py`: uploaded files and extraction.
- `backend/routers/sessions.py`: session listing, upload, and materialization.
- `backend/routers/stashes.py`: Stash CRUD, publish, public rendering, external
  Stash attachment.
- `backend/routers/workspace_knowledge.py`: workspace home/sidebar payloads.
- `backend/routers/publish.py`: Stash publish flow + public Stash URLs.
- `backend/routers/discover.py`: public Stash catalog (search, trending,
  fork-into-workspace).
- `backend/routers/memory.py`: per-session event push, query, search.
- `backend/routers/tables.py`: structured table CRUD + row search.
- `backend/routers/collab.py`: Yjs WebSocket sidecar for live page editing.
- `backend/routers/integrations/`: GitHub / Google Drive / Notion OAuth +
  imports.
- `backend/routers/trash.py`: soft-delete listing + restore/purge.

Object-level privacy is enforced inline in each router that returns a
resource — there is no separate permissions router. The `workspace_members`
table gates everything inside a workspace; the `stash_members` table gates
per-Stash sharing; the `visibility` column on stashes and pages controls
public exposure.

## Frontend Shell

The product sidebar is organized as:

- Home
- Sessions
- Files
- Stashes

Workspace home renders a newsfeed-like overview with quick actions to add
sessions, pages/files, and Stashes. Public Stash pages render as mini workspaces
with their own home, sidebar, and grouped Files/Sessions/Tables sections.

## Agent Surface

The CLI and MCP can create/read/update workspace resources, upload transcripts
and files, search history/pages, and create/publish Stashes. Agents should use
`stash files ...` for folders/pages and `stash stashes ...` for shareable
bundles.
