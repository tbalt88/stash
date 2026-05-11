"""Public share links for stashes (Phase 5).

A share link mints a URL-safe token that resolves to a read-only public
projection of a stash. The token rate-limits view counts at the IP level so
incognito refreshes don't inflate stats.

Revision ID: 0028
Revises: 0027
"""

from alembic import op

revision = "0028"
down_revision = "0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "CREATE TABLE share_links ("
        "  token TEXT PRIMARY KEY,"
        "  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,"
        "  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,"
        "  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),"
        "  expires_at TIMESTAMPTZ,"
        "  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'comment', 'edit-request')),"
        "  view_count INT NOT NULL DEFAULT 0,"
        "  last_viewed_at TIMESTAMPTZ,"
        "  last_viewed_by UUID REFERENCES users(id) ON DELETE SET NULL,"
        "  revoked_at TIMESTAMPTZ"
        ")"
    )
    op.execute("CREATE INDEX idx_share_links_workspace ON share_links(workspace_id)")
    op.execute(
        "CREATE INDEX idx_share_links_created_by ON share_links(created_by, created_at DESC)"
    )

    # Per-resource public-in-share toggles: every wiki page or file can opt
    # into the recipient projection. Default is OFF — narrative pages opt in
    # via this flag.
    op.execute("ALTER TABLE pages ADD COLUMN public_in_share BOOLEAN NOT NULL DEFAULT FALSE")
    op.execute("ALTER TABLE files ADD COLUMN public_in_share BOOLEAN NOT NULL DEFAULT FALSE")


def downgrade() -> None:
    op.execute("ALTER TABLE pages DROP COLUMN IF EXISTS public_in_share")
    op.execute("ALTER TABLE files DROP COLUMN IF EXISTS public_in_share")
    op.execute("DROP TABLE IF EXISTS share_links")
