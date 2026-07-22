"""add progress photos and daily updates

Revision ID: 0004_progress
Revises: 0003_categories_sharing
Create Date: 2026-07-22
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0004_progress"
down_revision = "0003_categories_sharing"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "progress_photos",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("room_or_area", sa.String, nullable=False),
        sa.Column("caption", sa.Text, nullable=True),
        sa.Column("photo_url", sa.String, nullable=False),
        sa.Column("uploaded_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "daily_updates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("update_date", sa.Date, nullable=False),
        sa.Column("done_today", sa.Text, nullable=True),
        sa.Column("pending", sa.Text, nullable=True),
        sa.Column("posted_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    for table in ["progress_photos", "daily_updates"]:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;")
        op.execute(f"""
            CREATE POLICY org_isolation_{table} ON {table}
            USING (org_id = current_setting('app.current_org_id', true)::uuid)
            WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
        """)


def downgrade():
    for table in ["progress_photos", "daily_updates"]:
        op.execute(f"DROP POLICY IF EXISTS org_isolation_{table} ON {table};")
    op.drop_table("daily_updates")
    op.drop_table("progress_photos")
