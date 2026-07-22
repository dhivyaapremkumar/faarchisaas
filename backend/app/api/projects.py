from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
import secrets
from app.core.deps import get_scoped_db, get_current_user, CurrentUser, require_roles
from app.core.security import hash_password
from app.core.categories import TEAM_CATEGORIES
from app.models.models import (
    Project, Drawing, DrawingRevision, Meeting, ProjectMembership, User, FileAccessGrant,
)
from app.schemas.auth import ProjectOut, ProjectCreate, ProjectUpdate
from app.schemas.drawings import DrawingOut, ProjectFileOut
from app.schemas.projects import (
    MeetingListOut, TeamMemberOut, AddMemberRequest, AddMemberResponse,
    UpdateMemberRequest, ResetPasswordResponse,
)
from app.services.audit import log_action
from app.services.storage import get_signed_url

router = APIRouter(prefix="/projects", tags=["projects"])
ARCHITECT_ROLES = ("owner", "architect_admin", "architect_staff")


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


@router.post("", response_model=ProjectOut, dependencies=[Depends(require_roles(*ARCHITECT_ROLES))])
async def create_project(
    payload: ProjectCreate,
    db: AsyncSession = Depends(get_scoped_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = Project(
        org_id=current_user.org_id,
        name=payload.name,
        address=payload.address,
        status=payload.status,
        created_by=current_user.user_id,
    )
    db.add(project)
    await db.flush()

    await log_action(db, current_user.org_id, current_user.user_id, "project.create",
                      entity_type="project", entity_id=str(project.id),
                      metadata={"name": payload.name})

    return project


@router.patch("/{project_id}", response_model=ProjectOut, dependencies=[Depends(require_roles(*ARCHITECT_ROLES))])
async def update_project(
    project_id: str,
    payload: ProjectUpdate,
    db: AsyncSession = Depends(get_scoped_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if payload.name is not None:
        project.name = payload.name
    if payload.address is not None:
        project.address = payload.address
    if payload.status is not None:
        project.status = payload.status

    await log_action(db, current_user.org_id, current_user.user_id, "project.update",
                      entity_type="project", entity_id=project_id)

    await db.flush()
    return project


@router.get("/{project_id}/drawings", response_model=list[DrawingOut])
async def list_project_drawings(
    project_id: str,
    db: AsyncSession = Depends(get_scoped_db),
):
    """
    Lists drawings with a summary of their latest revision, so the list view
    shows each drawing's current status without needing to open it. The
    first upload for a drawing IS its base/original version - every later
    upload is a new revision on top of it, not a separate concept.
    """
    result = await db.execute(select(Drawing).where(Drawing.project_id == project_id))
    drawings = result.scalars().all()

    output = []
    for drawing in drawings:
        rev_result = await db.execute(
            select(DrawingRevision)
            .where(DrawingRevision.drawing_id == drawing.id)
            .order_by(DrawingRevision.created_at.desc())
        )
        revisions = rev_result.scalars().all()
        latest = revisions[0] if revisions else None

        output.append(DrawingOut(
            id=drawing.id,
            drawing_number=drawing.drawing_number,
            title=drawing.title,
            discipline=drawing.discipline,
            created_at=drawing.created_at,
            latest_revision_label=latest.revision_label if latest else None,
            latest_revision_status=latest.status if latest else None,
            revision_count=len(revisions),
        ))
    return output


@router.get("/{project_id}/files", response_model=list[ProjectFileOut])
async def list_project_files(
    project_id: str,
    db: AsyncSession = Depends(get_scoped_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Flat, project-wide list of every uploaded file across all drawings -
    the consolidated 'CAD Files' view. Architects see everything; everyone
    else only sees files their category or user_id has been explicitly
    granted access to (same access rule as the per-drawing revisions list).
    """
    is_architect = current_user.role in ARCHITECT_ROLES

    membership_category = None
    if not is_architect:
        membership_result = await db.execute(
            select(ProjectMembership).where(
                ProjectMembership.project_id == project_id, ProjectMembership.user_id == current_user.user_id
            )
        )
        membership = membership_result.scalar_one_or_none()
        membership_category = membership.category if membership else None

    result = await db.execute(
        select(DrawingRevision, Drawing)
        .join(Drawing, Drawing.id == DrawingRevision.drawing_id)
        .where(DrawingRevision.project_id == project_id)
        .order_by(DrawingRevision.created_at.desc())
    )
    rows = result.all()

    output = []
    for revision, drawing in rows:
        grants_result = await db.execute(
            select(FileAccessGrant).where(FileAccessGrant.drawing_revision_id == revision.id)
        )
        grants = grants_result.scalars().all()
        categories = [g.category for g in grants if g.category]
        granted_user_ids = [str(g.user_id) for g in grants if g.user_id]

        if not is_architect:
            has_access = (membership_category and membership_category in categories) or (
                current_user.user_id in granted_user_ids
            )
            if not has_access:
                continue

        output.append(ProjectFileOut(
            drawing_id=str(drawing.id),
            drawing_number=drawing.drawing_number,
            drawing_title=drawing.title,
            discipline=drawing.discipline,
            revision_id=str(revision.id),
            revision_label=revision.revision_label,
            status=revision.status,
            signed_url=get_signed_url(revision.file_url),
            shared_categories=categories,
            created_at=revision.created_at,
        ))
    return output


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
            phone=user.phone,
            role=membership.role,
            trade=membership.trade,
            category=membership.category,
            status=membership.status,
        )
        for membership, user in rows
    ]


@router.post(
    "/{project_id}/members",
    response_model=AddMemberResponse,
    dependencies=[Depends(require_roles(*ARCHITECT_ROLES))],
)
async def add_project_member(
    project_id: str,
    payload: AddMemberRequest,
    db: AsyncSession = Depends(get_scoped_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Directly enrolls someone on a project. For a real production flow this
    would send an email invite with a signup link instead of generating a
    password server-side - this direct-creation version exists so you can
    test multi-role login right now without email/SMS infrastructure set up
    yet. The generated password is shown ONCE in the response; there's no
    way to retrieve it again afterward - if it's lost, use the
    reset_password script instead.
    """
    if payload.role not in ("vendor", "client", "onboarding"):
        raise HTTPException(status_code=400, detail="role must be 'vendor', 'client', or 'onboarding'")

    category = payload.category
    if category and category not in TEAM_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"category must be one of {TEAM_CATEGORIES}")
    if not category:
        category = "Client" if payload.role == "client" else "Others"

    project_result = await db.execute(select(Project).where(Project.id == project_id))
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    user_result = await db.execute(select(User).where(User.email == payload.email))
    user = user_result.scalar_one_or_none()
    temp_password = None
    note = ""

    if not user:
        temp_password = secrets.token_urlsafe(9)
        user = User(
            email=payload.email,
            full_name=payload.full_name,
            phone=payload.phone,
            password_hash=hash_password(temp_password),
        )
        db.add(user)
        await db.flush()
        note = "New account created. Share this password with them securely - it will not be shown again."
    else:
        note = "This email already has an account - they were added to the project with their existing login."

    existing_membership = await db.execute(
        select(ProjectMembership).where(
            ProjectMembership.project_id == project_id, ProjectMembership.user_id == user.id
        )
    )
    if existing_membership.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="This person is already on this project")

    membership = ProjectMembership(
        project_id=project_id,
        user_id=user.id,
        org_id=current_user.org_id,
        role=payload.role,
        trade=payload.trade,
        category=category,
        status="active",
        invited_by=current_user.user_id,
        joined_at=datetime.now(timezone.utc),
    )
    db.add(membership)

    await log_action(db, current_user.org_id, current_user.user_id, "project_member.add",
                      entity_type="project_membership", project_id=project_id,
                      metadata={"added_email": payload.email, "role": payload.role, "category": category})

    return AddMemberResponse(
        user_id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=payload.role,
        temp_password=temp_password,
        note=note,
    )


@router.patch(
    "/{project_id}/members/{membership_id}",
    response_model=TeamMemberOut,
    dependencies=[Depends(require_roles(*ARCHITECT_ROLES))],
)
async def update_project_member(
    project_id: str,
    membership_id: str,
    payload: UpdateMemberRequest,
    db: AsyncSession = Depends(get_scoped_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Edits a team member's details. full_name/phone live on the User record
    (shared across every project that person's on); category/trade are
    per-project, since the same person could work a different category on
    a different job.
    """
    result = await db.execute(
        select(ProjectMembership).where(ProjectMembership.id == membership_id, ProjectMembership.project_id == project_id)
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="Team member not found on this project")

    if payload.category is not None and payload.category not in TEAM_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"category must be one of {TEAM_CATEGORIES}")

    user_result = await db.execute(select(User).where(User.id == membership.user_id))
    user = user_result.scalar_one_or_none()

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.phone is not None:
        user.phone = payload.phone
    if payload.category is not None:
        membership.category = payload.category
    if payload.trade is not None:
        membership.trade = payload.trade

    await log_action(db, current_user.org_id, current_user.user_id, "project_member.update",
                      entity_type="project_membership", entity_id=membership_id, project_id=project_id)

    await db.flush()
    return TeamMemberOut(
        id=str(membership.id), user_id=str(user.id), full_name=user.full_name, email=user.email,
        phone=user.phone, role=membership.role, trade=membership.trade, category=membership.category,
        status=membership.status,
    )


@router.post(
    "/{project_id}/members/{membership_id}/reset-password",
    response_model=ResetPasswordResponse,
    dependencies=[Depends(require_roles(*ARCHITECT_ROLES))],
)
async def reset_member_password(
    project_id: str,
    membership_id: str,
    db: AsyncSession = Depends(get_scoped_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Lets an architect generate a fresh password for a team member directly
    from the UI, without needing VPS/terminal access - the same operation
    the reset_password script does, exposed as a proper in-app action.
    Shown once in the response; if lost, just reset again.
    """
    result = await db.execute(
        select(ProjectMembership).where(ProjectMembership.id == membership_id, ProjectMembership.project_id == project_id)
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="Team member not found on this project")

    user_result = await db.execute(select(User).where(User.id == membership.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_password = secrets.token_urlsafe(9)
    user.password_hash = hash_password(new_password)

    await log_action(db, current_user.org_id, current_user.user_id, "project_member.reset_password",
                      entity_type="user", entity_id=str(user.id), project_id=project_id)

    return ResetPasswordResponse(
        email=user.email, temp_password=new_password,
        note="Share this password with them securely - it will not be shown again.",
    )
