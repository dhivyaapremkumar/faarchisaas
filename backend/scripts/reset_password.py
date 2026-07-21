"""
Reset a user's password by email. Useful if you forgot what you typed
during initial seeding, or just want to change your own password.

Run inside the backend container:

    docker compose exec backend python -m scripts.reset_password
"""
import asyncio
import getpass
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.models import User


async def reset_password():
    async with AsyncSessionLocal() as session:
        async with session.begin():
            email = input("Email of the account to reset: ").strip()

            result = await session.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()

            if not user:
                print(f"No user found with email {email}")
                return

            new_password = getpass.getpass("New password: ")
            confirm = getpass.getpass("Confirm new password: ")

            if new_password != confirm:
                print("Passwords didn't match. Nothing changed.")
                return

            user.password_hash = hash_password(new_password)
            print(f"\nPassword updated for {email}. You can log in with it now.")


if __name__ == "__main__":
    asyncio.run(reset_password())
