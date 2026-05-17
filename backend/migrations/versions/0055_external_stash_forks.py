"""Make external Stashes workspace-local forks.

Revision ID: 0055
Revises: 0054
"""

from alembic import op

revision = "0055"
down_revision = "0054"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE stashes "
        "ADD COLUMN IF NOT EXISTS forked_from_stash_id UUID "
        "REFERENCES stashes(id) ON DELETE SET NULL"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_stashes_one_fork_per_workspace "
        "ON stashes(workspace_id, forked_from_stash_id) "
        "WHERE forked_from_stash_id IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_stashes_one_fork_per_workspace")
    op.execute("ALTER TABLE stashes DROP COLUMN IF EXISTS forked_from_stash_id")
