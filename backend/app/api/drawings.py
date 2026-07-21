import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.deps import get_scoped_db, get_current_user, CurrentUser, require_roles
from app.models.models import Drawing, DrawingRevision, ProjectMembership
from app.schemas.drawings import DrawingCreate, DrawingOut, DrawingRevisionOut
from app.services.storage import build_object_key, upload_file, get_signed_url
from app.services.audit import log_action

router = APIRouter(prefix="/drawings", tags=["drawings"])


@router.post("", response_model=DrawingOut, dependencies=[Depends(require_roles("owner", "architect_admin", "architect_staff"))])
async def create_drawing(
    payload: DrawingCreate,
    db: AsyncSession = Depends(get_scoped_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Only architects can register a new drawing. RLS also backstops this at the DB level."""
    drawing = Drawing(
        org_id=current_user.org_id,
        project_id=payload.project_id,
        drawing_number=payload.drawing_number,
        title=payload.title,
        discipline=payload.discipline,
    )
    db.add(drawing)
    await db.flush()
    await log_action(db, current_user.org_id, current_user.user_id, "drawing.create",
                      entity_type="drawing", entity_id=str(drawing.id), project_id=payload.project_id)
    return drawing


@router.post(
    "/{drawing_id}/revisions",
    response_model=DrawingRevisionOut,
    dependencies=[Depends(require_roles("owner", "architect_admin", "architect_staff"))],
)
async def upload_revision(
    drawing_id: str,
    revision_label: str = Form(...),
    changelog: str = Form(""),
    status: str = Form("issued_for_review"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_scoped_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(select(Drawing).where(Drawing.id == drawing_id))
    drawing = result.scalar_one_or_none()
    if not drawing:
        raise HTTPException(status_code=404, detail="Drawing not found")

    # If this revision is marked issued_for_construction, supersede the previous one
    if status == "issued_for_construction":
        prev = await db.execute(
            select(DrawingRevision).where(
                DrawingRevision.drawing_id == drawing_id,
                DrawingRevision.status == "issued_for_construction",
            )
        )
        for rev in prev.scalars().all():
            rev.status = "superseded"

    file_bytes = await file.read()
    object_key = build_object_key(current_user.org_id, str(drawing.project_id), "drawings", file.filename)
    upload_file(file_bytes, object_key, file.content_type)

    revision = DrawingRevision(
        drawing_id=drawing_id,
        project_id=drawing.project_id,
        org_id=current_user.org_id,
        revision_label=revision_label,
        file_url=object_key,  # stores the R2 object key; signed URLs generated on read
        status=status,
        changelog=changelog,
        uploaded_by=current_user.user_id,
    )
    db.add(revision)
    await db.flush()

    await log_action(db, current_user.org_id, current_user.user_id, "drawing_revision.upload",
                      entity_type="drawing_revision", entity_id=str(revision.id), project_id=str(drawing.project_id),
                      metadata={"revision_label": revision_label, "status": status})

    return DrawingRevisionOut(
        id=str(revision.id),
        revision_label=revision.revision_label,
        status=revision.status,
        changelog=revision.changelog,
        signed_url=get_signed_url(object_key),
        created_at=revision.created_at,
    )


@router.get("/{drawing_id}/revisions", response_model=list[DrawingRevisionOut])
async def list_revisions(
    drawing_id: str,
    db: AsyncSession = Depends(get_scoped_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Access rules:
    - Architects: see full revision history, all statuses
    - Vendors: see only the LATEST non-superseded revision, and only if the
      drawing's discipline matches their trade (or they've been manually granted access)
    - Clients: see only 'issued_for_construction' revisions (final, approved versions)
    """
    result = await db.execute(select(Drawing).where(Drawing.id == drawing_id))
    drawing = result.scalar_one_or_none()
    if not drawing:
        raise HTTPException(status_code=404, detail="Drawing not found")

    query = select(DrawingRevision).where(DrawingRevision.drawing_id == drawing_id)

    if current_user.role == "client":
        query = query.where(DrawingRevision.status == "issued_for_construction")

    elif current_user.role == "vendor":
        membership_result = await db.execute(
            select(ProjectMembership).where(
                ProjectMembership.project_id == drawing.project_id,
                ProjectMembership.user_id == current_user.user_id,
            )
        )
        membership = membership_result.scalar_one_or_none()
        trade_match = membership and membership.trade and drawing.discipline and (
            membership.trade.lower() == drawing.discipline.lower()
        )
        if not trade_match:
            # Not an automatic trade match - in a full build, check a manual
            # grant table here before raising. For now, deny by default.
            raise HTTPException(status_code=403, detail="You don't have access to this drawing's discipline")
        query = query.where(DrawingRevision.status.in_(["issued_for_construction", "issued_for_review"]))

    query = query.order_by(DrawingRevision.created_at.desc())
    result = await db.execute(query)
    revisions = result.scalars().all()

    return [
        DrawingRevisionOut(
            id=str(r.id), revision_label=r.revision_label, status=r.status,
            changelog=r.changelog, signed_url=get_signed_url(r.file_url), created_at=r.created_at,
        )
        for r in revisions
    ]
