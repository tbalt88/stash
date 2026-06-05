"""Session folders become shareable bundles (like Cartridges) + a Default folder.

Folders graduate from a plain grouping into the unit of sharing for sessions:
they get the same access model as cartridges — a workspace_permission +
public_permission pair (computed into private/workspace/public), a unique slug
for public links, discoverable for Discover, a cover, and a view counter. Each
workspace also gets exactly one is_default folder that catches sessions not
pushed to a specific folder (chat-UI sessions and un-targeted CLI sessions).

Revision ID: 0092
Revises: 0091
"""

from alembic import op

revision = "0092"
down_revision = "0091"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE session_folders "
        "ADD COLUMN slug varchar(96), "
        "ADD COLUMN workspace_permission varchar(16) NOT NULL DEFAULT 'read', "
        "ADD COLUMN public_permission varchar(16) NOT NULL DEFAULT 'none', "
        "ADD COLUMN discoverable boolean NOT NULL DEFAULT false, "
        "ADD COLUMN cover_image_url text, "
        "ADD COLUMN view_count int NOT NULL DEFAULT 0, "
        "ADD COLUMN is_default boolean NOT NULL DEFAULT false"
    )
    # Backfill a slug for existing folders: normalized name + a short random
    # suffix for uniqueness, mirroring cartridge_service._slugify.
    op.execute(
        "UPDATE session_folders SET slug = "
        "NULLIF(trim(both '-' from left(regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'), 64)), '') "
        "|| '-' || left(replace(gen_random_uuid()::text, '-', ''), 6)"
    )
    op.execute(
        "UPDATE session_folders SET slug = 'folder-' || left(replace(gen_random_uuid()::text, '-', ''), 6) "
        "WHERE slug IS NULL OR slug LIKE '-%'"
    )
    op.execute("ALTER TABLE session_folders ALTER COLUMN slug SET NOT NULL")
    op.execute("CREATE UNIQUE INDEX session_folders_slug_key ON session_folders (slug)")
    # At most one Default folder per workspace.
    op.execute(
        "CREATE UNIQUE INDEX session_folders_one_default "
        "ON session_folders (workspace_id) WHERE is_default"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS session_folders_one_default")
    op.execute("DROP INDEX IF EXISTS session_folders_slug_key")
    op.execute(
        "ALTER TABLE session_folders "
        "DROP COLUMN slug, "
        "DROP COLUMN workspace_permission, "
        "DROP COLUMN public_permission, "
        "DROP COLUMN discoverable, "
        "DROP COLUMN cover_image_url, "
        "DROP COLUMN view_count, "
        "DROP COLUMN is_default"
    )
