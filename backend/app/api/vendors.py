from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.deps import get_scoped_db, require_roles
from app.models.models import ProjectMembership, User, Project
from app.schemas.progress import VendorDirectoryEntry, VendorProjectRef

router = APIRouter(prefix="/vendors", tags=["vendors"])

ARCHITECT_ROLES = ("owner", "architect_admin", "architect_staff")


@router.get("", response_model=list[VendorDirectoryEntry], dependencies=[Depends(require_roles(*ARCHITECT_ROLES))])
async def list_vendor_directory(db: AsyncSession = Depends(get_scoped_db)):
    """
    Every vendor ever added across ANY project in the firm's org, deduplicated
    by person, with the categories/trades they've worked in and which
    projects they've been on - a reusable reference so the architect doesn't
    have to re-enter a vendor's details each time a new project starts.
    RLS on project_memberships already scopes this to the firm's own org.
    """
    result = await db.execute(
        select(ProjectMembership, User, Project)
        .join(User, User.id == ProjectMembership.user_id)
        .join(Project, Project.id == ProjectMembership.project_id)
        .where(ProjectMembership.role == "vendor")
        .order_by(ProjectMembership.created_at.asc())
    )
    rows = result.all()

    directory: dict[str, VendorDirectoryEntry] = {}
    for membership, user, project in rows:
        uid = str(user.id)
        if uid not in directory:
            directory[uid] = VendorDirectoryEntry(
                user_id=uid, full_name=user.full_name, email=user.email, phone=user.phone,
                categories=[], trades=[], projects=[],
            )
        entry = directory[uid]
        if membership.category and membership.category not in entry.categories:
            entry.categories.append(membership.category)
        if membership.trade and membership.trade not in entry.trades:
            entry.trades.append(membership.trade)
        if not any(p.project_id == str(project.id) for p in entry.projects):
            entry.projects.append(VendorProjectRef(project_id=str(project.id), project_name=project.name))

    return list(directory.values())
