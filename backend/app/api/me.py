from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.deps import get_scoped_db, get_current_user, CurrentUser
from app.models.models import User
from app.schemas.me import MyProfileOut, MyProfileUpdate

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=MyProfileOut)
async def get_my_profile(
    db: AsyncSession = Depends(get_scoped_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Every role's own profile, including the firm owner/chief architect -
    who otherwise has no way to set a phone number, since that's only ever
    been editable for people added as project team members.
    """
    result = await db.execute(select(User).where(User.id == current_user.user_id))
    user = result.scalar_one_or_none()
    return MyProfileOut(full_name=user.full_name, email=user.email, phone=user.phone, role=current_user.role)


@router.patch("", response_model=MyProfileOut)
async def update_my_profile(
    payload: MyProfileUpdate,
    db: AsyncSession = Depends(get_scoped_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.id == current_user.user_id))
    user = result.scalar_one_or_none()
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.phone is not None:
        user.phone = payload.phone
    await db.flush()
    return MyProfileOut(full_name=user.full_name, email=user.email, phone=user.phone, role=current_user.role)
