"""Add folder_id to files so files can live inside wiki folders.

Wiki collapse PR: folders should hold both pages AND files (PDFs, CSVs,
HTML uploads, etc.) — same mental model as a file system. Before this
migration, files were always workspace-root; folders held pages only.

Revision ID: 0035
Revises: 0034
"""

from alembic import op

revision = "0035"
down_revision = "0034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE files "
        "ADD COLUMN IF NOT EXISTS folder_id UUID "
        "REFERENCES folders(id) ON DELETE SET NULL"
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_files_folder")
    op.execute("ALTER TABLE files DROP COLUMN IF EXISTS folder_id")
