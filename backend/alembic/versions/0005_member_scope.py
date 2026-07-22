"""restrict vendor/onboarding project visibility to their own memberships

Revision ID: 0005_member_scope
Revises: 0004_progress
Create Date: 2026-07-22
"""
from alembic import op

revision = "0005_member_scope"
down_revision = "0004_progress"
branch_labels = None
depends_on = None


def upgrade():
    # The original policy only restricted the 'client' role to their own
    # projects - vendors and onboarding staff could see every project in the
    # org via the API, not just ones they're actually assigned to. This
    # widens the same restriction to all non-architect roles.
    op.execute("DROP POLICY IF EXISTS client_project_scope ON projects;")
    op.execute("""
        CREATE POLICY member_project_scope ON projects
        USING (
            current_setting('app.current_role', true) IN ('owner', 'architect_admin', 'architect_staff')
            OR id IN (
                SELECT project_id FROM project_memberships
                WHERE user_id = current_setting('app.current_user_id', true)::uuid
                AND status = 'active'
            )
        );
    """)


def downgrade():
    op.execute("DROP POLICY IF EXISTS member_project_scope ON projects;")
    op.execute("""
        CREATE POLICY client_project_scope ON projects
        USING (
            current_setting('app.current_role', true) != 'client'
            OR id IN (
                SELECT project_id FROM project_memberships
                WHERE user_id = current_setting('app.current_user_id', true)::uuid
            )
        );
    """)
