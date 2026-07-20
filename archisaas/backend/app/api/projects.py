from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.deps import get_scoped_db, get_current_user, CurrentUser
from app.models.models import Project
from app.schemas.auth import ProjectOut

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
