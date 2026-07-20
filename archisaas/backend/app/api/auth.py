from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import verify_password, create_access_token
from app.models.models import User, OrgMembership
from app.schemas.auth import LoginRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    # Determine org + role. NOTE: this simple version assumes one org per user.
    # For vendors/clients on multiple projects across multiple orgs, extend this
    # to let the user pick which org context to log into.
    membership_result = await db.execute(
        select(OrgMembership).where(OrgMembership.user_id == user.id)
    )
    membership = membership_result.scalars().first()

    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User has no organization membership")

    token = create_access_token(
        user_id=str(user.id), org_id=str(membership.org_id), role=membership.role
    )
    return TokenResponse(access_token=token, role=membership.role, org_id=str(membership.org_id))
