"""
Bootstrap script: creates your firm's Organization, your admin User account,
and one pilot Project, so you can log in and start testing immediately.

Run this ONCE, inside the backend container, after migrations are applied:

    docker compose exec backend python -m scripts.seed

It's idempotent-ish (checks for existing email before creating), but meant
for one-time setup, not repeated production use. Delete or restrict access
to this script before opening the app to real signups.
"""
import asyncio
import getpass
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.models import Organization, User, OrgMembership, Project


async def seed():
    async with AsyncSessionLocal() as session:
        async with session.begin():

            print("=== ArchiSaaS: First-time setup ===")
            org_name = input("Your firm's name: ").strip() or "My Architecture Firm"
            admin_name = input("Your full name: ").strip() or "Admin"
            admin_email = input("Your login email: ").strip()
            admin_password = getpass.getpass("Choose a password: ")

            existing = await session.execute(select(User).where(User.email == admin_email))
            if existing.scalar_one_or_none():
                print(f"User {admin_email} already exists. Aborting to avoid duplicates.")
                return

            org = Organization(name=org_name)
            session.add(org)
            await session.flush()  # so org.id is populated

            admin_user = User(
                email=admin_email,
                password_hash=hash_password(admin_password),
                full_name=admin_name,
            )
            session.add(admin_user)
            await session.flush()

            membership = OrgMembership(org_id=org.id, user_id=admin_user.id, role="owner")
            session.add(membership)

            project_name = input("Name of your first (pilot) project: ").strip() or "Pilot Project"
            project = Project(org_id=org.id, name=project_name, status="active", created_by=admin_user.id)
            session.add(project)

        print("\nDone. You can now log in:")
        print(f"  POST /api/auth/login")
        print(f"  {{ \"email\": \"{admin_email}\", \"password\": \"<what you typed>\" }}")
        print(f"\nOrganization ID: {org.id}")
        print(f"Project ID:      {project.id}")


if __name__ == "__main__":
    asyncio.run(seed())
