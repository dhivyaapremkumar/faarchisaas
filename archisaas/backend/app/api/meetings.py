import os
import tempfile
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.deps import get_scoped_db, get_current_user, CurrentUser, require_roles
from app.core.database import get_db_with_rls
from app.models.models import Meeting, ActionItem, Task, User
from app.schemas.hermes import MeetingReviewOut, ActionItemReviewOut, ActionItemUpdate
from app.services.storage import build_object_key, upload_file
from app.services.hermes import transcribe_audio, draft_mom
from app.services.matching import match_assignee
from app.services.notifications import notify_task_assigned
from app.services.audit import log_action

router = APIRouter(prefix="/meetings", tags=["meetings"])


async def process_meeting_pipeline(meeting_id: str, org_id: str, user_id: str, role: str, local_audio_path: str):
    """
    Runs as a background task after the upload responds to the user, since
    transcription + LLM drafting can take 30s-2min for a long site meeting.
    Opens its own RLS-scoped DB session since it runs outside the request cycle.
    """
    async for db in get_db_with_rls(org_id, user_id, role):
        try:
            result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
            meeting = result.scalar_one_or_none()
            if not meeting:
                return

            transcript = transcribe_audio(local_audio_path)
            meeting.transcript = transcript

            mom = draft_mom(transcript)
            meeting.mom_document = mom.model_dump_json(indent=2)

            for item in mom.action_items:
                assignee_id, confidence = await match_assignee(db, str(meeting.project_id), item.suggested_assignee_name)
                action_item = ActionItem(
                    meeting_id=meeting.id,
                    project_id=meeting.project_id,
                    org_id=org_id,
                    description=item.description,
                    suggested_assignee_name=item.suggested_assignee_name,
                    assignee_user_id=assignee_id,
                    due_date=item.due_date,
                    confidence_score=confidence,
                    status="assigned" if assignee_id else "unassigned",
                )
                db.add(action_item)

            meeting.mom_status = "pending_review"  # NEVER auto-publish - human review required
            await db.commit()

        except Exception as e:
            meeting.mom_status = "processing"  # leave visibly stuck rather than fake-succeed
            await db.commit()
            print(f"[hermes] Pipeline failed for meeting {meeting_id}: {e}")
        finally:
            if os.path.exists(local_audio_path):
                os.remove(local_audio_path)


@router.post("", dependencies=[Depends(require_roles("owner", "architect_admin", "architect_staff"))])
async def create_meeting(
    background_tasks: BackgroundTasks,
    project_id: str = Form(...),
    meeting_date: str = Form(...),
    audio: UploadFile = File(...),
    db: AsyncSession = Depends(get_scoped_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    audio_bytes = await audio.read()
    object_key = build_object_key(current_user.org_id, project_id, "meeting_audio", audio.filename)
    upload_file(audio_bytes, object_key, audio.content_type)

    meeting = Meeting(
        project_id=project_id,
        org_id=current_user.org_id,
        meeting_date=datetime.fromisoformat(meeting_date),
        recorded_by=current_user.user_id,
        audio_url=object_key,
        mom_status="processing",
    )
    db.add(meeting)
    await db.flush()
    meeting_id = str(meeting.id)

    # Save audio to a local temp file for Whisper (OpenAI SDK wants a file handle)
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio.filename)[1])
    tmp.write(audio_bytes)
    tmp.close()

    await log_action(db, current_user.org_id, current_user.user_id, "meeting.create",
                      entity_type="meeting", entity_id=meeting_id, project_id=project_id)

    background_tasks.add_task(
        process_meeting_pipeline, meeting_id, current_user.org_id, current_user.user_id, current_user.role, tmp.name
    )

    return {"meeting_id": meeting_id, "status": "processing", "message": "Transcription and MOM drafting started"}


@router.get("/{meeting_id}", response_model=MeetingReviewOut)
async def get_meeting_for_review(
    meeting_id: str,
    db: AsyncSession = Depends(get_scoped_db),
):
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    items_result = await db.execute(select(ActionItem).where(ActionItem.meeting_id == meeting_id))
    items = items_result.scalars().all()

    action_items_out = []
    for item in items:
        resolved_name = None
        if item.assignee_user_id:
            user_result = await db.execute(select(User).where(User.id == item.assignee_user_id))
            user = user_result.scalar_one_or_none()
            resolved_name = user.full_name if user else None

        action_items_out.append(ActionItemReviewOut(
            id=str(item.id), description=item.description,
            suggested_assignee_name=item.suggested_assignee_name,
            assignee_user_id=str(item.assignee_user_id) if item.assignee_user_id else None,
            assignee_name_resolved=resolved_name,
            due_date=str(item.due_date) if item.due_date else None,
            confidence_score=item.confidence_score, status=item.status,
        ))

    return MeetingReviewOut(
        id=str(meeting.id), meeting_date=meeting.meeting_date.isoformat(),
        mom_status=meeting.mom_status, transcript=meeting.transcript,
        mom_document=meeting.mom_document, action_items=action_items_out,
    )


@router.patch(
    "/{meeting_id}/action-items/{action_item_id}",
    dependencies=[Depends(require_roles("owner", "architect_admin", "architect_staff"))],
)
async def update_action_item(
    meeting_id: str,
    action_item_id: str,
    payload: ActionItemUpdate,
    db: AsyncSession = Depends(get_scoped_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    This is the human-in-the-loop correction step: architect fixes a
    mis-transcribed name, adjusts a due date, or manually assigns an
    action item the AI left unassigned.
    """
    result = await db.execute(select(ActionItem).where(ActionItem.id == action_item_id, ActionItem.meeting_id == meeting_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Action item not found")

    if payload.assignee_user_id is not None:
        item.assignee_user_id = payload.assignee_user_id
        item.status = "confirmed"
    if payload.due_date is not None:
        item.due_date = payload.due_date
    if payload.description is not None:
        item.description = payload.description

    await log_action(db, current_user.org_id, current_user.user_id, "action_item.edit",
                      entity_type="action_item", entity_id=action_item_id)
    return {"status": "updated"}


@router.post(
    "/{meeting_id}/publish",
    dependencies=[Depends(require_roles("owner", "architect_admin", "architect_staff"))],
)
async def publish_meeting(
    meeting_id: str,
    db: AsyncSession = Depends(get_scoped_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Final confirmation step. Only NOW do action items become real Tasks
    pushed to people's dashboards. This is the guardrail boundary: nothing
    from the AI pipeline touches another user's task list until a human
    architect has reviewed and explicitly published.
    """
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    items_result = await db.execute(select(ActionItem).where(ActionItem.meeting_id == meeting_id))
    items = items_result.scalars().all()

    created_tasks = []
    for item in items:
        if not item.assignee_user_id:
            continue  # skip still-unassigned items; architect must resolve these first

        task = Task(
            project_id=meeting.project_id,
            org_id=current_user.org_id,
            action_item_id=item.id,
            assigned_to=item.assignee_user_id,
            title=item.description[:120],
            description=item.description,
            due_date=item.due_date,
            status="open",
        )
        db.add(task)
        await db.flush()
        created_tasks.append(task)

    meeting.mom_status = "published"
    await log_action(db, current_user.org_id, current_user.user_id, "meeting.publish",
                      entity_type="meeting", entity_id=meeting_id, project_id=str(meeting.project_id),
                      metadata={"tasks_created": len(created_tasks)})

    await db.flush()

    for task in created_tasks:
        await notify_task_assigned(
            str(task.id), str(task.assigned_to), task.title,
            str(task.due_date) if task.due_date else None,
        )

    unassigned_count = len(items) - len(created_tasks)
    return {
        "status": "published",
        "tasks_created": len(created_tasks),
        "unassigned_action_items": unassigned_count,
    }
