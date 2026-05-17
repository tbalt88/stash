"""Use product Stash as the shareable object type.

Revision ID: 0042
Revises: 0041
"""

from alembic import op

revision = "0042"
down_revision = "0041"
branch_labels = None
depends_on = None

_OBJECT_TYPES = (
    "('workspace', 'chat', 'notebook', 'page', 'history', 'deck', 'table', 'file', 'stash')"
)


def upgrade() -> None:
    op.execute(
        "ALTER TABLE object_permissions DROP CONSTRAINT IF EXISTS object_permissions_object_type_check"
    )
    op.execute(
        "ALTER TABLE object_shares DROP CONSTRAINT IF EXISTS object_shares_object_type_check"
    )
    op.execute("UPDATE object_permissions SET object_type = 'stash' WHERE object_type = 'view'")
    op.execute("UPDATE object_shares SET object_type = 'stash' WHERE object_type = 'view'")
    op.execute(
        "ALTER TABLE object_permissions ADD CONSTRAINT object_permissions_object_type_check "
        f"CHECK (object_type IN {_OBJECT_TYPES})"
    )
    op.execute(
        "ALTER TABLE object_shares ADD CONSTRAINT object_shares_object_type_check "
        f"CHECK (object_type IN {_OBJECT_TYPES})"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE object_permissions DROP CONSTRAINT IF EXISTS object_permissions_object_type_check"
    )
    op.execute(
        "ALTER TABLE object_shares DROP CONSTRAINT IF EXISTS object_shares_object_type_check"
    )
    op.execute("UPDATE object_permissions SET object_type = 'view' WHERE object_type = 'stash'")
    op.execute("UPDATE object_shares SET object_type = 'view' WHERE object_type = 'stash'")
    op.execute(
        "ALTER TABLE object_permissions ADD CONSTRAINT object_permissions_object_type_check "
        "CHECK (object_type IN ('workspace', 'chat', 'notebook', 'page', 'history', 'deck', 'table', 'file', 'view'))"
    )
    op.execute(
        "ALTER TABLE object_shares ADD CONSTRAINT object_shares_object_type_check "
        "CHECK (object_type IN ('workspace', 'chat', 'notebook', 'page', 'history', 'deck', 'table', 'file', 'view'))"
    )
