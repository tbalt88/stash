"""Allow product Stashes to include sessions directly.

Revision ID: 0043
Revises: 0042
"""

from alembic import op

revision = "0043"
down_revision = "0042"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE view_items DROP CONSTRAINT IF EXISTS view_items_object_type_check")
    op.execute(
        "ALTER TABLE view_items ADD CONSTRAINT view_items_object_type_check "
        "CHECK (object_type IN ('folder', 'page', 'table', 'file', 'history', 'session'))"
    )
    op.execute(
        "ALTER TABLE object_permissions DROP CONSTRAINT IF EXISTS object_permissions_object_type_check"
    )
    op.execute(
        "ALTER TABLE object_permissions ADD CONSTRAINT object_permissions_object_type_check "
        "CHECK (object_type IN ('workspace', 'chat', 'notebook', 'page', 'history', 'deck', 'table', 'file', 'stash', 'session'))"
    )
    op.execute(
        "ALTER TABLE object_shares DROP CONSTRAINT IF EXISTS object_shares_object_type_check"
    )
    op.execute(
        "ALTER TABLE object_shares ADD CONSTRAINT object_shares_object_type_check "
        "CHECK (object_type IN ('workspace', 'chat', 'notebook', 'page', 'history', 'deck', 'table', 'file', 'stash', 'session'))"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE view_items DROP CONSTRAINT IF EXISTS view_items_object_type_check")
    op.execute(
        "ALTER TABLE view_items ADD CONSTRAINT view_items_object_type_check "
        "CHECK (object_type IN ('folder', 'page', 'table', 'file', 'history'))"
    )
    op.execute(
        "ALTER TABLE object_permissions DROP CONSTRAINT IF EXISTS object_permissions_object_type_check"
    )
    op.execute(
        "ALTER TABLE object_permissions ADD CONSTRAINT object_permissions_object_type_check "
        "CHECK (object_type IN ('workspace', 'chat', 'notebook', 'page', 'history', 'deck', 'table', 'file', 'stash'))"
    )
    op.execute(
        "ALTER TABLE object_shares DROP CONSTRAINT IF EXISTS object_shares_object_type_check"
    )
    op.execute(
        "ALTER TABLE object_shares ADD CONSTRAINT object_shares_object_type_check "
        "CHECK (object_type IN ('workspace', 'chat', 'notebook', 'page', 'history', 'deck', 'table', 'file', 'stash'))"
    )
