"""add team categories and file access grants

Revision ID: 0003_categories_sharing
Revises: 0002_enable_rls
Create Date: 2026-07-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0003_categories_sharing"
down_revision = "0002_enable_rls"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("project_memberships", sa.Column("category", sa.String, nullable=True))

    op.create_table(
        "file_access_grants",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("drawing_revision_id", UUID(as_uuid=True), sa.ForeignKey("drawing_revisions.id"), nullable=False),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("category", sa.String, nullable=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # RLS for the new table, same pattern as the other tenant-scoped tables
    op.execute("ALTER TABLE file_access_grants ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE file_access_grants FORCE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY org_isolation_file_access_grants ON file_access_grants
        USING (org_id = current_setting('app.current_org_id', true)::uuid)
        WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
    """)


def downgrade():
    op.execute("DROP POLICY IF EXISTS org_isolation_file_access_grants ON file_access_grants;")
    op.drop_table("file_access_grants")
    op.drop_column("project_memberships", "category")
