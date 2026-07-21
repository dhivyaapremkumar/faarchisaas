"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-07-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "organizations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String, unique=True, nullable=False),
        sa.Column("password_hash", sa.String, nullable=False),
        sa.Column("full_name", sa.String, nullable=False),
        sa.Column("phone", sa.String, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "org_memberships",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("role", sa.String, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "projects",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("address", sa.String, nullable=True),
        sa.Column("status", sa.String, server_default="active"),
        sa.Column("start_date", sa.Date, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "project_memberships",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("role", sa.String, nullable=False),
        sa.Column("trade", sa.String, nullable=True),
        sa.Column("status", sa.String, server_default="invited"),
        sa.Column("invited_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("project_id", "user_id"),
    )

    op.create_table(
        "drawings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("drawing_number", sa.String, nullable=False),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("discipline", sa.String, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "drawing_revisions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("drawing_id", UUID(as_uuid=True), sa.ForeignKey("drawings.id"), nullable=False),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("revision_label", sa.String, nullable=False),
        sa.Column("file_url", sa.String, nullable=False),
        sa.Column("status", sa.String, server_default="draft"),
        sa.Column("changelog", sa.Text, nullable=True),
        sa.Column("uploaded_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "meetings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("meeting_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recorded_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("audio_url", sa.String, nullable=True),
        sa.Column("transcript", sa.Text, nullable=True),
        sa.Column("mom_status", sa.String, server_default="processing"),
        sa.Column("mom_document", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "action_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("meeting_id", UUID(as_uuid=True), sa.ForeignKey("meetings.id"), nullable=False),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("suggested_assignee_name", sa.String, nullable=True),
        sa.Column("assignee_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("due_date", sa.Date, nullable=True),
        sa.Column("confidence_score", sa.Float, nullable=True),
        sa.Column("status", sa.String, server_default="unassigned"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "tasks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("action_item_id", UUID(as_uuid=True), sa.ForeignKey("action_items.id"), nullable=True),
        sa.Column("assigned_to", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("due_date", sa.Date, nullable=True),
        sa.Column("status", sa.String, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", UUID(as_uuid=True), nullable=True),
        sa.Column("actor_user_id", UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String, nullable=False),
        sa.Column("entity_type", sa.String, nullable=True),
        sa.Column("entity_id", UUID(as_uuid=True), nullable=True),
        sa.Column("log_metadata", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("audit_logs")
    op.drop_table("tasks")
    op.drop_table("action_items")
    op.drop_table("meetings")
    op.drop_table("drawing_revisions")
    op.drop_table("drawings")
    op.drop_table("project_memberships")
    op.drop_table("projects")
    op.drop_table("org_memberships")
    op.drop_table("users")
    op.drop_table("organizations")
