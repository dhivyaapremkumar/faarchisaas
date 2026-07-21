"""enable row level security for tenant isolation

Revision ID: 0002_enable_rls
Revises: 0001_initial
Create Date: 2026-07-20
"""
from alembic import op

revision = "0002_enable_rls"
down_revision = "0001_initial"
branch_labels = None
depends_on = None

# Every table that carries an org_id column and holds tenant data
TENANT_TABLES = [
    "projects",
    "project_memberships",
    "drawings",
    "drawing_revisions",
    "meetings",
    "action_items",
    "tasks",
]


def upgrade():
    for table in TENANT_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;")  # applies even to table owner
        op.execute(f"""
            CREATE POLICY org_isolation_{table} ON {table}
            USING (org_id = current_setting('app.current_org_id', true)::uuid)
            WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
        """)

    # Extra policy layer: clients can only see projects/tasks they're a member of,
    # not just anything in their org. Architects see everything in their org.
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


def downgrade():
    for table in TENANT_TABLES:
        op.execute(f"DROP POLICY IF EXISTS org_isolation_{table} ON {table};")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
    op.execute("DROP POLICY IF EXISTS client_project_scope ON projects;")
