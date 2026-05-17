"""Drop legacy deck tables.

Revision ID: 0050
Revises: 0049
"""

from alembic import op

revision = "0050"
down_revision = "0049"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP TABLE IF EXISTS deck_share_page_views")
    op.execute("DROP TABLE IF EXISTS deck_share_views")
    op.execute("DROP TABLE IF EXISTS deck_shares")
    op.execute("DROP TABLE IF EXISTS decks")


def downgrade() -> None:
    pass
