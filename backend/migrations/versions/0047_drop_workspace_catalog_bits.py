"""Drop deprecated public workspace catalog fields.

Revision ID: 0047
Revises: 0046
"""

from alembic import op

revision = "0047"
down_revision = "0046"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP TABLE IF EXISTS workspace_join_requests")
    op.execute("DROP INDEX IF EXISTS workspaces_public_discoverable")
    op.execute("DROP INDEX IF EXISTS workspaces_public_category")
    op.execute("DROP INDEX IF EXISTS workspaces_public_featured")
    op.execute("DROP INDEX IF EXISTS workspaces_tags_gin")
    op.execute("ALTER TABLE workspaces DROP COLUMN IF EXISTS discoverable")
    op.execute("ALTER TABLE workspaces DROP COLUMN IF EXISTS featured")
    op.execute("ALTER TABLE workspaces DROP COLUMN IF EXISTS category")
    op.execute("ALTER TABLE workspaces DROP COLUMN IF EXISTS tags")
    op.execute("ALTER TABLE workspaces DROP COLUMN IF EXISTS summary")
    op.execute("ALTER TABLE workspaces DROP COLUMN IF EXISTS forked_from_workspace_id")
    op.execute("ALTER TABLE workspaces DROP COLUMN IF EXISTS fork_count")


def downgrade() -> None:
    pass
