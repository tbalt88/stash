# Duplication-cleanup roadmap

PR 1 (transcript collapse) lands first. Everything below is the follow-up
work that comes out of the May 10 audit of duplicated state. Each section
is a sketch — flesh it out into a real plan when you pick it up.

## Context

A repo audit found seven places where the same conceptual data is written
into multiple tables or storage layers. PR 1 fixes the worst one
(transcripts in three places). Pulling the rest is hygiene — each kept its
own bug surface (CORS, gzip, ACL drift) until it was consolidated.

The pattern is consistent: a feature got built, a similar feature was
needed later, and instead of extending the first surface, a parallel
surface was added. Each PR collapses one of those splits.

---

## PR 2 — Collapse `is_public` columns into `object_permissions`

Two ACL stores for the same access decision.

**Affected:**
- `workspaces.is_public` (boolean) + `object_permissions(object_type='workspace', visibility='public')`
- `views.is_public` (boolean) + `object_permissions(object_type='view')`

**Where they're touched:**
- `backend/services/workspace_service.py:127-134` — manually syncs `is_public` toggle to `object_permissions`
- `backend/services/view_service.py:56, 66, 158, 173` — writes both
- `backend/services/discover_service.py:70` — still queries `workspaces.is_public` directly (bypasses ACL)
- Migration `backend/migrations/versions/0025_share_primitives.py` already backfilled `object_permissions` from the booleans

**Plan sketch:**
1. Migration: re-run the backfill defensively, drop `workspaces.is_public` and `views.is_public` columns
2. Update `workspace_service`, `view_service`, `discover_service` to query `object_permissions` only
3. Update any frontend code that reads `is_public` on these resources

**Risk:** discover catalog visibility decisions touch unauthenticated
traffic — verify the ACL query returns the same set before flipping.

---

## PR 3 — Per-resource share flags → permissions

`pages.public_in_share` and `files.public_in_share` (added in migration
`0028_share_links.py`) are a shortcut around the permission model. They're
only consulted by `backend/services/share_service.py:155-168` when
building the share-link projection.

**Plan sketch:**
1. Migration: for each row with `public_in_share = TRUE`, write an
   `object_permissions` entry (object_type=page/file, visibility=public)
2. Rewrite `share_service` to query permissions instead of the flag
3. Drop both `public_in_share` columns
4. Audit frontend: any UI that exposes "Visible in share" toggle (see
   `frontend/src/app/stashes/[stashId]/p/[pageId]/page.tsx` checkbox)
   should call the same permission endpoint that everything else uses

---

## PR 4 — Disambiguate "stash"

`/api/v1/stashes/` is overloaded:

- `backend/routers/stashes.py:44-200` — workspace-alias router. Here
  "stash" means "workspace". POST `/api/v1/stashes` creates a workspace.
- `backend/routers/stashes.py:493+` — session-bundle router. Here "stash"
  means a publicly-shareable session. GET `/api/v1/stashes/{slug}` fetches
  that bundle.

Same URL prefix, different entities. After PR 1, the session-bundle table
mostly carries sharing metadata (slug + summary + files_touched).

**Options to pick during PR 4:**
- **(a)** Rename session-bundles to `/api/v1/shares` (or `/bundles`).
  Closer to what they actually are post-PR-1. Breaks any external API
  consumers — CLI client included (`stashai/plugin/stash_client.py`).
- **(b)** Drop the workspace-alias router entirely; tell clients to use
  `/api/v1/workspaces`. The alias was added during the rename — most
  clients should already be on the canonical path.
- **(c)** Document the overload and move on. Cheapest.

Recommend **(b)** unless there's a known CLI version pinned to `/stashes`.

---

## PR 5 — Unify `files` and `stash_artifacts`

Two tables storing uploaded-file metadata:

- `files` (`0001_initial_schema.py`) — workspace-scoped, has
  `storage_key`, `content_type`, `size_bytes`, `linked_table_id` (CSV→table
  link from `0029`)
- `stash_artifacts` (`0030_session_bundles.py`) — session-bundle-scoped,
  has `storage_key`, `size_bytes`, `file_path`

Artifacts could be references into `files` rather than duplicate
metadata.

**Plan sketch:**
1. Migration: add `stash_artifacts.file_id UUID REFERENCES files(id)`
2. Backfill: for each `stash_artifacts` row, find or create the matching
   `files` row (matched by `storage_key` if it's the same blob;
   uploaded into `files` if not) and write the FK
3. Drop redundant columns (`storage_key`, `size_bytes`) from
   `stash_artifacts`
4. Update `backend/services/stash_service.py` artifact handling to join
   through `file_id`

**Risk:** the two upload paths may have stored under different
`storage_key` prefixes. Verify before assuming dedup.

---

## PR 6 — Embedding cache audit

Three places carry embedding-derived data:

- Source-row columns: `history_events.embedding`,
  `table_rows.embedding`, `pages.embedding`
- `embedding_projections` table (`0001` + `0018_workspace_scoped_viz_cache.py`)
- `knowledge_density_cache` (`0017_knowledge_density_cache.py`)

Some of these are real caches (precomputed projections for fast viz);
some may be leftover.

**Plan sketch:**
1. Read each cache's writer + reader. Confirm something live reads each.
2. If `knowledge_density_cache` or `embedding_projections` has no
   active reader, drop it.
3. Document the survivors as "derived caches of the source-row
   embeddings" so future people don't add a fourth.

Expected net change: small. Mostly inventory + drop dead caches.

---

## PR 7 — Permission model consolidation

Three concurrent access-control mechanisms:

- `workspace_members` table — role-based workspace membership
- `object_permissions` table — ACL with `object_type`, `visibility`,
  `inherit` semantics
- Folder-chain walk in `backend/services/permission_service.py:43-100`
  — recursive permission inheritance up the folder tree

The folder walk is custom logic that should live inside the ACL model.
`workspace_members` overlaps with `object_permissions(object_type='workspace')`.

**Plan sketch (rough):**
1. Audit every permission check site. Which model does it use?
2. Pick one canonical model. Likely `object_permissions` extended to
   express role (owner/editor/viewer) alongside visibility.
3. Reimplement the folder-chain walk as a recursive CTE inside the ACL
   model, or denormalize the inheritance into the table.
4. Backfill, swap callers, drop `workspace_members`.

**Risk:** deepest change in the roadmap. Touches every authenticated
endpoint. Do this last, when everything else has been simplified.

---

## When to do each

- **PR 2-3** are low-risk and high-clarity (column drops backed by
  existing backfills). Do them after PR 1 has baked a week.
- **PR 4** is a naming/API decision — schedule when the CLI version-skew
  story is comfortable.
- **PR 5** depends on PR 1 being settled (stashes table shape stabilizes).
- **PR 6** is an audit, not a refactor. Quick pass any time.
- **PR 7** is the keystone. Do last; don't try to rush it.
