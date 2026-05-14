"""Drop auto-curated handoff storage.

Revision ID: 0049
Revises: 0048
"""

from alembic import op

revision = "0049"
down_revision = "0048"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_stash_handoffs_stale")
    op.execute("DROP TABLE IF EXISTS stash_handoffs")


def downgrade() -> None:
    pass
