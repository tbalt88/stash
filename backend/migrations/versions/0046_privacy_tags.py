"""Use privacy tags for page, folder, and session access.

Revision ID: 0046
Revises: 0045
"""

from alembic import op

revision = "0046"
down_revision = "0045"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
CREATE TABLE IF NOT EXISTS privacy_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    access VARCHAR(16) NOT NULL CHECK(access IN ('workspace', 'members', 'public')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, name)
)
""")
    op.execute("""
CREATE TABLE IF NOT EXISTS privacy_tag_members (
    tag_id UUID NOT NULL REFERENCES privacy_tags(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR(8) NOT NULL DEFAULT 'read' CHECK(permission IN ('read', 'write', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tag_id, user_id)
)
""")
    op.execute("""
CREATE TABLE IF NOT EXISTS privacy_tag_objects (
    tag_id UUID NOT NULL REFERENCES privacy_tags(id) ON DELETE CASCADE,
    object_type VARCHAR(16) NOT NULL CHECK(object_type IN ('folder', 'page', 'session')),
    object_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tag_id, object_type, object_id)
)
""")
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_privacy_tag_objects_object "
        "ON privacy_tag_objects(object_type, object_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_privacy_tags_workspace ON privacy_tags(workspace_id)"
    )

    op.execute("""
WITH permission_objects AS (
    SELECT op.object_type, op.object_id, op.visibility,
           CASE
             WHEN op.object_type = 'folder' THEN f.workspace_id
             WHEN op.object_type = 'page' THEN p.workspace_id
             WHEN op.object_type = 'session' THEN s.workspace_id
           END AS workspace_id,
           CASE
             WHEN op.object_type = 'folder' THEN f.created_by
             WHEN op.object_type = 'page' THEN p.created_by
             WHEN op.object_type = 'session' THEN s.created_by
           END AS created_by
    FROM object_permissions op
    LEFT JOIN folders f ON op.object_type = 'folder' AND f.id = op.object_id
    LEFT JOIN pages p ON op.object_type = 'page' AND p.id = op.object_id
    LEFT JOIN sessions s ON op.object_type = 'session' AND s.id = op.object_id
    WHERE op.object_type IN ('folder', 'page', 'session')
      AND op.visibility IN ('private', 'link', 'public')
),
inserted_tags AS (
    INSERT INTO privacy_tags (workspace_id, name, access, created_by)
    SELECT workspace_id,
           object_type || ':' || object_id || ':' || visibility,
           CASE WHEN visibility IN ('link', 'public') THEN 'public' ELSE 'members' END,
           created_by
    FROM permission_objects
    WHERE workspace_id IS NOT NULL
    ON CONFLICT (workspace_id, name) DO UPDATE SET access = EXCLUDED.access
    RETURNING id, workspace_id, name
)
INSERT INTO privacy_tag_objects (tag_id, object_type, object_id)
SELECT t.id, po.object_type, po.object_id
FROM permission_objects po
JOIN inserted_tags t
  ON t.workspace_id = po.workspace_id
 AND t.name = po.object_type || ':' || po.object_id || ':' || po.visibility
ON CONFLICT DO NOTHING
""")

    op.execute("""
INSERT INTO privacy_tag_members (tag_id, user_id, permission)
SELECT t.id, os.user_id, os.permission
FROM object_shares os
JOIN privacy_tag_objects pto
  ON pto.object_type = os.object_type
 AND pto.object_id = os.object_id
JOIN privacy_tags t ON t.id = pto.tag_id
WHERE os.object_type IN ('folder', 'page', 'session')
ON CONFLICT (tag_id, user_id) DO UPDATE SET permission = EXCLUDED.permission
""")

    op.execute("DELETE FROM object_permissions WHERE object_type IN ('folder', 'page', 'session')")
    op.execute("DELETE FROM object_shares WHERE object_type IN ('folder', 'page', 'session')")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_privacy_tags_workspace")
    op.execute("DROP INDEX IF EXISTS idx_privacy_tag_objects_object")
    op.execute("DROP TABLE IF EXISTS privacy_tag_objects")
    op.execute("DROP TABLE IF EXISTS privacy_tag_members")
    op.execute("DROP TABLE IF EXISTS privacy_tags")
