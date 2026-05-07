"""Sharing primitives: extend object_permissions to cover every shareable
unit and add a 'link' visibility state.

The pre-existing object_type enum only covered chat/notebook/history/deck/table.
First-class sharing also needs workspace, page, file, and view (the View itself
gets shares so collaborators can edit its curation). The visibility enum gains
'link' — readable by anyone with the URL but not listed in Discover.

Revision ID: 0025
Revises: 0024
"""

from alembic import op

revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None


_NEW_OBJECT_TYPES = (
    "('workspace', 'chat', 'notebook', 'page', 'history', 'deck', 'table', 'file', 'view')"
)
_NEW_VISIBILITY = "('inherit', 'private', 'link', 'public')"


def upgrade() -> None:
    op.execute(
        "ALTER TABLE object_permissions DROP CONSTRAINT IF EXISTS object_permissions_object_type_check"
    )
    op.execute(
        "ALTER TABLE object_permissions DROP CONSTRAINT IF EXISTS object_permissions_visibility_check"
    )
    op.execute(
        f"ALTER TABLE object_permissions ADD CONSTRAINT object_permissions_object_type_check "
        f"CHECK (object_type IN {_NEW_OBJECT_TYPES})"
    )
    op.execute(
        f"ALTER TABLE object_permissions ADD CONSTRAINT object_permissions_visibility_check "
        f"CHECK (visibility IN {_NEW_VISIBILITY})"
    )

    op.execute(
        "ALTER TABLE object_shares DROP CONSTRAINT IF EXISTS object_shares_object_type_check"
    )
    op.execute(
        f"ALTER TABLE object_shares ADD CONSTRAINT object_shares_object_type_check "
        f"CHECK (object_type IN {_NEW_OBJECT_TYPES})"
    )

    # view_items can now point at individual pages, not just whole notebooks.
    op.execute("ALTER TABLE view_items DROP CONSTRAINT IF EXISTS view_items_object_type_check")
    op.execute(
        "ALTER TABLE view_items ADD CONSTRAINT view_items_object_type_check "
        "CHECK (object_type IN ('notebook', 'page', 'table', 'file', 'history'))"
    )

    # Backfill: every workspaces.is_public=true becomes object_permissions(workspace, id, 'public')
    op.execute(
        "INSERT INTO object_permissions (object_type, object_id, visibility) "
        "SELECT 'workspace', id, 'public' FROM workspaces WHERE is_public = true "
        "ON CONFLICT (object_type, object_id) DO UPDATE SET visibility = 'public'"
    )

    # Backfill: every views.is_public=true becomes object_permissions(view, id, 'public')
    # This lets the new permission-derived access logic produce the same answer
    # the old is_public boolean did, until the View ACL is fully removed in Phase 4.
    op.execute(
        "INSERT INTO object_permissions (object_type, object_id, visibility) "
        "SELECT 'view', id, 'public' FROM views WHERE is_public = true "
        "ON CONFLICT (object_type, object_id) DO UPDATE SET visibility = 'public'"
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM object_permissions WHERE object_type IN ('workspace', 'page', 'file', 'view') "
        "OR visibility = 'link'"
    )
    op.execute(
        "DELETE FROM object_shares WHERE object_type IN ('workspace', 'page', 'file', 'view')"
    )

    op.execute(
        "ALTER TABLE object_permissions DROP CONSTRAINT IF EXISTS object_permissions_object_type_check"
    )
    op.execute(
        "ALTER TABLE object_permissions DROP CONSTRAINT IF EXISTS object_permissions_visibility_check"
    )
    op.execute(
        "ALTER TABLE object_permissions ADD CONSTRAINT object_permissions_object_type_check "
        "CHECK (object_type IN ('chat', 'notebook', 'history', 'deck', 'table'))"
    )
    op.execute(
        "ALTER TABLE object_permissions ADD CONSTRAINT object_permissions_visibility_check "
        "CHECK (visibility IN ('inherit', 'private', 'public'))"
    )

    op.execute(
        "ALTER TABLE object_shares DROP CONSTRAINT IF EXISTS object_shares_object_type_check"
    )
    op.execute(
        "ALTER TABLE object_shares ADD CONSTRAINT object_shares_object_type_check "
        "CHECK (object_type IN ('chat', 'notebook', 'history', 'deck', 'table'))"
    )

    op.execute("DELETE FROM view_items WHERE object_type = 'page'")
    op.execute("ALTER TABLE view_items DROP CONSTRAINT IF EXISTS view_items_object_type_check")
    op.execute(
        "ALTER TABLE view_items ADD CONSTRAINT view_items_object_type_check "
        "CHECK (object_type IN ('notebook', 'table', 'file', 'history'))"
    )
