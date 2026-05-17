"""Use privacy tags for all workspace data objects.

Revision ID: 0051
Revises: 0050
"""

from alembic import op

revision = "0051"
down_revision = "0050"
branch_labels = None
depends_on = None

TAG_OBJECT_TYPES = "('folder', 'page', 'session', 'table', 'file', 'history')"


def upgrade() -> None:
    op.execute(
        "ALTER TABLE privacy_tag_objects "
        "DROP CONSTRAINT IF EXISTS privacy_tag_objects_object_type_check"
    )
    op.execute(
        "ALTER TABLE privacy_tag_objects "
        "ADD CONSTRAINT privacy_tag_objects_object_type_check "
        f"CHECK (object_type IN {TAG_OBJECT_TYPES})"
    )

    op.execute("""
WITH permission_objects AS (
    SELECT op.object_type, op.object_id, op.visibility,
           CASE
             WHEN op.object_type = 'table' THEN t.workspace_id
             WHEN op.object_type = 'file' THEN f.workspace_id
             WHEN op.object_type = 'history' THEN h.workspace_id
           END AS workspace_id,
           CASE
             WHEN op.object_type = 'table' THEN t.created_by
             WHEN op.object_type = 'file' THEN f.uploaded_by
             WHEN op.object_type = 'history' THEN h.created_by
           END AS created_by
    FROM object_permissions op
    LEFT JOIN tables t ON op.object_type = 'table' AND t.id = op.object_id
    LEFT JOIN files f ON op.object_type = 'file' AND f.id = op.object_id
    LEFT JOIN history_events h ON op.object_type = 'history' AND h.id = op.object_id
    WHERE op.object_type IN ('table', 'file', 'history')
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
WITH share_objects AS (
    SELECT os.object_type, os.object_id, os.user_id, os.permission, os.granted_by,
           CASE
             WHEN os.object_type = 'table' THEN t.workspace_id
             WHEN os.object_type = 'file' THEN f.workspace_id
             WHEN os.object_type = 'history' THEN h.workspace_id
           END AS workspace_id
    FROM object_shares os
    LEFT JOIN tables t ON os.object_type = 'table' AND t.id = os.object_id
    LEFT JOIN files f ON os.object_type = 'file' AND f.id = os.object_id
    LEFT JOIN history_events h ON os.object_type = 'history' AND h.id = os.object_id
    WHERE os.object_type IN ('table', 'file', 'history')
),
inserted_tags AS (
    INSERT INTO privacy_tags (workspace_id, name, access, created_by)
    SELECT workspace_id,
           object_type || ':' || object_id || ':' || 'shared',
           'members',
           (ARRAY_AGG(granted_by))[1]
    FROM share_objects
    WHERE workspace_id IS NOT NULL
    GROUP BY workspace_id, object_type, object_id
    ON CONFLICT (workspace_id, name) DO UPDATE SET updated_at = now()
    RETURNING id, workspace_id, name
),
linked_objects AS (
    INSERT INTO privacy_tag_objects (tag_id, object_type, object_id)
    SELECT t.id, so.object_type, so.object_id
    FROM share_objects so
    JOIN inserted_tags t
      ON t.workspace_id = so.workspace_id
     AND t.name = so.object_type || ':' || so.object_id || ':' || 'shared'
    ON CONFLICT DO NOTHING
    RETURNING tag_id, object_type, object_id
)
INSERT INTO privacy_tag_members (tag_id, user_id, permission)
SELECT t.id, so.user_id, so.permission
FROM share_objects so
JOIN inserted_tags t
  ON t.workspace_id = so.workspace_id
 AND t.name = so.object_type || ':' || so.object_id || ':' || 'shared'
WHERE so.workspace_id IS NOT NULL
ON CONFLICT (tag_id, user_id) DO UPDATE SET permission = EXCLUDED.permission
""")

    op.execute("DELETE FROM object_permissions WHERE object_type IN ('table', 'file', 'history')")
    op.execute("DELETE FROM object_shares WHERE object_type IN ('table', 'file', 'history')")


def downgrade() -> None:
    op.execute(
        "DELETE FROM privacy_tag_members ptm "
        "USING privacy_tag_objects pto "
        "WHERE ptm.tag_id = pto.tag_id "
        "AND pto.object_type IN ('table', 'file', 'history')"
    )
    op.execute("DELETE FROM privacy_tag_objects WHERE object_type IN ('table', 'file', 'history')")
    op.execute(
        "ALTER TABLE privacy_tag_objects "
        "DROP CONSTRAINT IF EXISTS privacy_tag_objects_object_type_check"
    )
    op.execute(
        "ALTER TABLE privacy_tag_objects "
        "ADD CONSTRAINT privacy_tag_objects_object_type_check "
        "CHECK (object_type IN ('folder', 'page', 'session'))"
    )
