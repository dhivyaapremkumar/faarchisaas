from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import verify_password, create_access_token
from app.models.models import User, OrgMembership, ProjectMembership
from app.schemas.auth import LoginRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    org_membership_result = await db.execute(
        select(OrgMembership).where(OrgMembership.user_id == user.id)
    )
    org_membership = org_membership_result.scalars().first()

    if org_membership:
        org_id, role = org_membership.org_id, org_membership.role
    else:
        project_membership_result = await db.execute(
            select(ProjectMembership).where(
                ProjectMembership.user_id == user.id, ProjectMembership.status == "active"
            )
        )
        project_membership = project_membership_result.scalars().first()
        if not project_membership:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account isn't enrolled in any project yet")
        org_id, role = project_membership.org_id, project_membership.role

    token = create_access_token(user_id=str(user.id), org_id=str(org_id), role=role)
    return TokenResponse(access_token=token, role=role, org_id=str(org_id))
