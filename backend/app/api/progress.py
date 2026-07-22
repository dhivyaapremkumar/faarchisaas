from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.deps import get_scoped_db, get_current_user, CurrentUser, require_roles
from app.models.models import ProgressPhoto, DailyUpdate, ProjectMembership, User, OrgMembership, Project
from app.schemas.progress import ProgressPhotoOut, DailyUpdateCreate, DailyUpdateOut, ContactOut
from app.services.storage import build_object_key, upload_file, get_signed_url
from app.services.audit import log_action

router = APIRouter(prefix="/projects", tags=["progress"])

ARCHITECT_ROLES = ("owner", "architect_admin", "architect_staff")
# Who can post photos/updates: anyone actively doing or overseeing site work.
# Clients are deliberately excluded from posting - view only, matching the
# original "limited access" design for the client role.
CAN_POST_ROLES = ARCHITECT_ROLES + ("vendor", "onboarding")


async def _user_name(db: AsyncSession, user_id) -> str | None:
    if not user_id:
        return None
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    return user.full_name if user else None


@router.post("/{project_id}/photos", response_model=ProgressPhotoOut, dependencies=[Depends(require_roles(*CAN_POST_ROLES))])
async def upload_progress_photo(
    project_id: str,
    room_or_area: str = Form(...),
    caption: str = Form(""),
    photo: UploadFile = File(...),
    db: AsyncSession = Depends(get_scoped_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    photo_bytes = await photo.read()
    object_key = build_object_key(current_user.org_id, project_id, "progress_photos", photo.filename)
    upload_file(photo_bytes, object_key, photo.content_type)

    record = ProgressPhoto(
        project_id=project_id,
        org_id=current_user.org_id,
        room_or_area=room_or_area,
        caption=caption,
        photo_url=object_key,
        uploaded_by=current_user.user_id,
    )
    db.add(record)
    await db.flush()

    await log_action(db, current_user.org_id, current_user.user_id, "progress_photo.upload",
                      entity_type="progress_photo", entity_id=str(record.id), project_id=project_id,
                      metadata={"room_or_area": room_or_area})

    return ProgressPhotoOut(
        id=str(record.id), room_or_area=room_or_area, caption=caption,
        signed_url=get_signed_url(object_key),
        uploaded_by_name=await _user_name(db, current_user.user_id),
        created_at=record.created_at,
    )


@router.get("/{project_id}/photos", response_model=list[ProgressPhotoOut])
async def list_progress_photos(
    project_id: str,
    db: AsyncSession = Depends(get_scoped_db),
):
    """Visible to everyone on the project, including clients - view-only for them, enforced by not exposing POST access."""
    result = await db.execute(
        select(ProgressPhoto).where(ProgressPhoto.project_id == project_id).order_by(ProgressPhoto.created_at.desc())
    )
    photos = result.scalars().all()
    output = []
    for p in photos:
        output.append(ProgressPhotoOut(
            id=str(p.id), room_or_area=p.room_or_area, caption=p.caption,
            signed_url=get_signed_url(p.photo_url),
            uploaded_by_name=await _user_name(db, p.uploaded_by),
            created_at=p.created_at,
        ))
    return output


@router.post("/{project_id}/updates", response_model=DailyUpdateOut, dependencies=[Depends(require_roles(*CAN_POST_ROLES))])
async def post_daily_update(
    project_id: str,
    payload: DailyUpdateCreate,
    db: AsyncSession = Depends(get_scoped_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    record = DailyUpdate(
        project_id=project_id,
        org_id=current_user.org_id,
        update_date=payload.update_date,
        done_today=payload.done_today,
        pending=payload.pending,
        posted_by=current_user.user_id,
    )
    db.add(record)
    await db.flush()

    await log_action(db, current_user.org_id, current_user.user_id, "daily_update.post",
                      entity_type="daily_update", entity_id=str(record.id), project_id=project_id)

    return DailyUpdateOut(
        id=str(record.id), update_date=record.update_date, done_today=record.done_today,
        pending=record.pending, posted_by_name=await _user_name(db, current_user.user_id),
        created_at=record.created_at,
    )


@router.get("/{project_id}/updates", response_model=list[DailyUpdateOut])
async def list_daily_updates(
    project_id: str,
    db: AsyncSession = Depends(get_scoped_db),
):
    result = await db.execute(
        select(DailyUpdate).where(DailyUpdate.project_id == project_id).order_by(DailyUpdate.update_date.desc())
    )
    updates = result.scalars().all()
    output = []
    for u in updates:
        output.append(DailyUpdateOut(
            id=str(u.id), update_date=u.update_date, done_today=u.done_today, pending=u.pending,
            posted_by_name=await _user_name(db, u.posted_by), created_at=u.created_at,
        ))
    return output


@router.get("/{project_id}/contacts", response_model=list[ContactOut])
async def list_project_contacts(
    project_id: str,
    db: AsyncSession = Depends(get_scoped_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    A simple phone/email directory of everyone on the project - visible to
    all roles including clients, since knowing who to call isn't sensitive
    the way file contents or costs are.

    Architects/owners are tracked at the org level (org_memberships), not as
    project_memberships, so they're merged in separately here - otherwise
    the firm's own team wouldn't appear in their own project's contact list.
    """
    result = await db.execute(
        select(ProjectMembership, User)
        .join(User, User.id == ProjectMembership.user_id)
        .where(ProjectMembership.project_id == project_id, ProjectMembership.status == "active")
    )
    rows = result.all()
    contacts = {
        str(user.id): ContactOut(
            full_name=user.full_name, email=user.email, phone=user.phone,
            role=membership.role, category=membership.category, trade=membership.trade,
        )
        for membership, user in rows
    }

    project_result = await db.execute(select(Project).where(Project.id == project_id))
    project = project_result.scalar_one_or_none()
    if project:
        org_result = await db.execute(
            select(OrgMembership, User)
            .join(User, User.id == OrgMembership.user_id)
            .where(OrgMembership.org_id == project.org_id)
        )
        for membership, user in org_result.all():
            if str(user.id) not in contacts:
                contacts[str(user.id)] = ContactOut(
                    full_name=user.full_name, email=user.email, phone=user.phone,
                    role=membership.role, category="Architect", trade=None,
                )

    return list(contacts.values())
