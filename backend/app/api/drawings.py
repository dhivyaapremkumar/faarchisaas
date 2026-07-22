from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.deps import get_scoped_db, get_current_user, CurrentUser, require_roles
from app.core.categories import TEAM_CATEGORIES, DRAWING_STATUSES
from app.core.config import settings
from app.models.models import Drawing, DrawingRevision, ProjectMembership, FileAccessGrant, User
from app.schemas.drawings import (
    DrawingCreate, DrawingOut, DrawingRevisionOut, ShareRevisionRequest, EmailRevisionRequest,
)
from app.services.storage import build_object_key, upload_file, get_signed_url, delete_file
from app.services.audit import log_action
from app.services.email import send_email

router = APIRouter(prefix="/drawings", tags=["drawings"])

ARCHITECT_ROLES = ("owner", "architect_admin", "architect_staff")


async def _get_membership(db: AsyncSession, project_id: str, user_id: str) -> ProjectMembership | None:
    result = await db.execute(
        select(ProjectMembership).where(
            ProjectMembership.project_id == project_id, ProjectMembership.user_id == user_id
        )
    )
    return result.scalar_one_or_none()


async def _get_grant_categories(db: AsyncSession, revision_id: str) -> list[str]:
    result = await db.execute(
        select(FileAccessGrant).where(FileAccessGrant.drawing_revision_id == revision_id)
    )
    grants = result.scalars().all()
    return [g.category for g in grants if g.category]


async def _has_access(db: AsyncSession, revision: DrawingRevision, current_user: CurrentUser) -> bool:
    """
    Architects always have access. Everyone else needs an explicit grant -
    either on their category (e.g. all Electrical vendors) or on their
    specific user_id. No grant at all means no access - default deny,
    especially important for the Client category per the original design.

    Additionally: clients only ever see files marked "issued_for_construction"
    (the final approved stage), regardless of category grants - intermediate
    stages (Scheme, Revisions, Working Drawings) stay hidden from clients
    even if a file is otherwise shared with the Client category, since those
    stages aren't meant for client-facing review.
    """
    if current_user.role in ARCHITECT_ROLES:
        return True

    if current_user.role == "client" and revision.status != "issued_for_construction":
        return False

    result = await db.execute(
        select(FileAccessGrant).where(FileAccessGrant.drawing_revision_id == revision.id)
    )
    grants = result.scalars().all()
    if any(g.user_id and str(g.user_id) == current_user.user_id for g in grants):
        return True

    membership = await _get_membership(db, str(revision.project_id), current_user.user_id)
    if membership and membership.category:
        if any(g.category == membership.category for g in grants):
            return True
    return False


@router.post("", response_model=DrawingOut, dependencies=[Depends(require_roles(*ARCHITECT_ROLES))])
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
    dependencies=[Depends(require_roles(*ARCHITECT_ROLES))],
)
async def upload_revision(
    drawing_id: str,
    revision_label: str = Form(...),
    changelog: str = Form(""),
    status: str = Form("scheme"),
    shared_categories: str = Form(""),  # comma-separated, e.g. "Structural,Client"
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_scoped_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Uploading is where sharing is set: the architect picks which categories
    can see this specific file at upload time. Nothing is shared by default -
    an empty shared_categories means only architects can see it until
    explicitly shared (via this field, or later through the /share endpoint).
    """
    if status not in DRAWING_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {DRAWING_STATUSES}")

    result = await db.execute(select(Drawing).where(Drawing.id == drawing_id))
    drawing = result.scalar_one_or_none()
    if not drawing:
        raise HTTPException(status_code=404, detail="Drawing not found")

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
        file_url=object_key,
        status=status,
        changelog=changelog,
        uploaded_by=current_user.user_id,
    )
    db.add(revision)
    await db.flush()

    categories = [c.strip() for c in shared_categories.split(",") if c.strip() in TEAM_CATEGORIES]
    for category in categories:
        db.add(FileAccessGrant(
            drawing_revision_id=revision.id, org_id=current_user.org_id, category=category,
        ))

    await log_action(db, current_user.org_id, current_user.user_id, "drawing_revision.upload",
                      entity_type="drawing_revision", entity_id=str(revision.id), project_id=str(drawing.project_id),
                      metadata={"revision_label": revision_label, "status": status, "shared_with": categories})

    return DrawingRevisionOut(
        id=str(revision.id), revision_label=revision.revision_label, status=revision.status,
        changelog=revision.changelog, signed_url=get_signed_url(object_key), created_at=revision.created_at,
        shared_categories=categories,
    )


@router.get("/{drawing_id}/revisions", response_model=list[DrawingRevisionOut])
async def list_revisions(
    drawing_id: str,
    db: AsyncSession = Depends(get_scoped_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Architects see everything. Everyone else only sees revisions where an
    explicit FileAccessGrant matches their category or their specific user_id -
    default deny, set by the architect at upload/share time.
    """
    result = await db.execute(select(Drawing).where(Drawing.id == drawing_id))
    drawing = result.scalar_one_or_none()
    if not drawing:
        raise HTTPException(status_code=404, detail="Drawing not found")

    rev_result = await db.execute(
        select(DrawingRevision).where(DrawingRevision.drawing_id == drawing_id)
        .order_by(DrawingRevision.created_at.desc())
    )
    all_revisions = rev_result.scalars().all()

    visible = []
    for r in all_revisions:
        if await _has_access(db, r, current_user):
            visible.append(r)

    return [
        DrawingRevisionOut(
            id=str(r.id), revision_label=r.revision_label, status=r.status,
            changelog=r.changelog, signed_url=get_signed_url(r.file_url), created_at=r.created_at,
            shared_categories=await _get_grant_categories(db, str(r.id)),
        )
        for r in visible
    ]


@router.post(
    "/{drawing_id}/revisions/{revision_id}/share",
    dependencies=[Depends(require_roles(*ARCHITECT_ROLES))],
)
async def share_revision(
    drawing_id: str,
    revision_id: str,
    payload: ShareRevisionRequest,
    db: AsyncSession = Depends(get_scoped_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Replaces all sharing grants for this revision with the given set - lets an architect change access after the fact."""
    result = await db.execute(select(DrawingRevision).where(DrawingRevision.id == revision_id, DrawingRevision.drawing_id == drawing_id))
    revision = result.scalar_one_or_none()
    if not revision:
        raise HTTPException(status_code=404, detail="Revision not found")

    existing = await db.execute(select(FileAccessGrant).where(FileAccessGrant.drawing_revision_id == revision_id))
    for grant in existing.scalars().all():
        await db.delete(grant)

    valid_categories = [c for c in payload.categories if c in TEAM_CATEGORIES]
    for category in valid_categories:
        db.add(FileAccessGrant(drawing_revision_id=revision_id, org_id=current_user.org_id, category=category))
    for user_id in payload.user_ids:
        db.add(FileAccessGrant(drawing_revision_id=revision_id, org_id=current_user.org_id, user_id=user_id))

    await log_action(db, current_user.org_id, current_user.user_id, "drawing_revision.share",
                      entity_type="drawing_revision", entity_id=revision_id,
                      metadata={"categories": valid_categories, "user_ids": payload.user_ids})

    return {"status": "updated", "shared_categories": valid_categories, "shared_user_ids": payload.user_ids}


@router.post("/{drawing_id}/revisions/{revision_id}/email")
async def email_revision(
    drawing_id: str,
    revision_id: str,
    payload: EmailRevisionRequest,
    db: AsyncSession = Depends(get_scoped_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Emails a secure link to the file - not the raw file itself, since CAD
    files can be large and email attachment limits are unreliable. The link
    is valid for 7 days. Anyone with view access to this revision can send
    it onward (not just architects), matching how file sharing works in
    practice, but the access check still applies first.
    """
    result = await db.execute(select(DrawingRevision).where(DrawingRevision.id == revision_id, DrawingRevision.drawing_id == drawing_id))
    revision = result.scalar_one_or_none()
    if not revision:
        raise HTTPException(status_code=404, detail="Revision not found")

    if not await _has_access(db, revision, current_user):
        raise HTTPException(status_code=403, detail="You don't have access to this file")

    drawing_result = await db.execute(select(Drawing).where(Drawing.id == drawing_id))
    drawing = drawing_result.scalar_one_or_none()

    link = get_signed_url(revision.file_url, expires_in=7 * 24 * 3600)
    if not link.startswith("http"):
        # Local storage returns a relative path (/api/files/...) - fine inside
        # the app, but meaningless in an email with no domain context. Prefix
        # with PUBLIC_BASE_URL to make it a real, clickable absolute link.
        link = f"{settings.PUBLIC_BASE_URL}{link}"
    sender_result = await db.execute(select(User).where(User.id == current_user.user_id))
    sender = sender_result.scalar_one_or_none()

    subject = f"{drawing.drawing_number} - {revision.revision_label} shared with you"
    body = f"""
        <p>{sender.full_name if sender else 'A team member'} shared a drawing file with you.</p>
        <p><strong>{drawing.drawing_number} — {drawing.title}</strong><br/>
        Revision: {revision.revision_label} ({revision.status.replace('_', ' ')})</p>
        {f'<p>{payload.message}</p>' if payload.message else ''}
        <p>Copy and paste this link into your browser to view/download the file (expires in 7 days):</p>
        <p style="font-family: monospace; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px;">{link}</p>
    """
    sent = await send_email(payload.recipient_email, subject, body)

    await log_action(db, current_user.org_id, current_user.user_id, "drawing_revision.email_sent",
                      entity_type="drawing_revision", entity_id=revision_id,
                      metadata={"recipient": payload.recipient_email, "sent": sent})

    if not sent:
        raise HTTPException(status_code=502, detail="Email could not be sent - check EMAIL_API_KEY is configured correctly")
    return {"status": "sent", "recipient": payload.recipient_email}


@router.delete(
    "/{drawing_id}/revisions/{revision_id}",
    dependencies=[Depends(require_roles(*ARCHITECT_ROLES))],
)
async def delete_revision(
    drawing_id: str,
    revision_id: str,
    db: AsyncSession = Depends(get_scoped_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Permanently deletes an uploaded file - both the stored file itself and
    its database record, plus any sharing grants attached to it. This is
    irreversible; the frontend confirms with the person before calling this.
    """
    result = await db.execute(
        select(DrawingRevision).where(DrawingRevision.id == revision_id, DrawingRevision.drawing_id == drawing_id)
    )
    revision = result.scalar_one_or_none()
    if not revision:
        raise HTTPException(status_code=404, detail="Revision not found")

    grants = await db.execute(select(FileAccessGrant).where(FileAccessGrant.drawing_revision_id == revision_id))
    for grant in grants.scalars().all():
        await db.delete(grant)

    delete_file(revision.file_url)  # remove from disk/R2 - if this fails, we still remove the DB record below

    await log_action(db, current_user.org_id, current_user.user_id, "drawing_revision.delete",
                      entity_type="drawing_revision", entity_id=revision_id, project_id=str(revision.project_id),
                      metadata={"revision_label": revision.revision_label})

    await db.delete(revision)
    return {"status": "deleted"}
