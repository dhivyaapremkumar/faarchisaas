from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.deps import get_scoped_db, get_current_user, CurrentUser
from app.models.models import Project, Drawing, Meeting, ProjectMembership, User
from app.schemas.auth import ProjectOut
from app.schemas.drawings import DrawingOut
from app.schemas.projects import MeetingListOut, TeamMemberOut

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
async def list_projects(
    db: AsyncSession = Depends(get_scoped_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    No manual 'WHERE org_id = ...' needed here - Postgres RLS policies
    (set via get_scoped_db's session variables) already restrict the rows
    returned to this user's org, and further to their own projects if
    their role is 'client'. This is the multi-tenant safety net in action.
    """
    result = await db.execute(select(Project))
    return result.scalars().all()


@router.get("/{project_id}/drawings", response_model=list[DrawingOut])
async def list_project_drawings(
    project_id: str,
    db: AsyncSession = Depends(get_scoped_db),
):
    """
    Lists drawing metadata (number, title, discipline) for a project.
    Note: this is metadata only, not revision files - revision access is
    separately gated by role/trade in app/api/drawings.py, since the actual
    file content is the sensitive part, not the fact that a drawing exists.
    """
    result = await db.execute(select(Drawing).where(Drawing.project_id == project_id))
    return result.scalars().all()


@router.get("/{project_id}/meetings", response_model=list[MeetingListOut])
async def list_project_meetings(
    project_id: str,
    db: AsyncSession = Depends(get_scoped_db),
):
    result = await db.execute(
        select(Meeting).where(Meeting.project_id == project_id).order_by(Meeting.meeting_date.desc())
    )
    return result.scalars().all()


@router.get("/{project_id}/members", response_model=list[TeamMemberOut])
async def list_project_members(
    project_id: str,
    db: AsyncSession = Depends(get_scoped_db),
):
    result = await db.execute(
        select(ProjectMembership, User)
        .join(User, User.id == ProjectMembership.user_id)
        .where(ProjectMembership.project_id == project_id)
    )
    rows = result.all()
    return [
        TeamMemberOut(
            id=str(membership.id),
            user_id=str(user.id),
            full_name=user.full_name,
            email=user.email,
            role=membership.role,
            trade=membership.trade,
            status=membership.status,
        )
        for membership, user in rows
    ]
