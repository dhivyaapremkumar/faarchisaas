from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.deps import get_scoped_db, get_current_user, CurrentUser, require_roles
from app.models.models import Task, ProjectMembership, User, Project
from app.schemas.tasks import TaskCreate, TaskUpdate, TaskOut
from app.services.audit import log_action
from app.services.notifications import notify_task_assigned

router = APIRouter(tags=["tasks"])
ARCHITECT_ROLES = ("owner", "architect_admin", "architect_staff")


async def _to_task_out(db: AsyncSession, task: Task, include_project_name: bool = False) -> TaskOut:
    assignee_name = None
    if task.assigned_to:
        result = await db.execute(select(User).where(User.id == task.assigned_to))
        user = result.scalar_one_or_none()
        assignee_name = user.full_name if user else None

    project_name = None
    if include_project_name:
        result = await db.execute(select(Project).where(Project.id == task.project_id))
        project = result.scalar_one_or_none()
        project_name = project.name if project else None

    return TaskOut(
        id=str(task.id), title=task.title, description=task.description, due_date=task.due_date,
        status=task.status, assigned_to=str(task.assigned_to) if task.assigned_to else None,
        assignee_name=assignee_name, project_name=project_name, created_at=task.created_at,
    )


@router.post(
    "/projects/{project_id}/tasks",
    response_model=TaskOut,
    dependencies=[Depends(require_roles(*ARCHITECT_ROLES))],
)
async def create_task(
    project_id: str,
    payload: TaskCreate,
    db: AsyncSession = Depends(get_scoped_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Directly assigns a task, independent of the Hermes/MOM pipeline - for
    anything that doesn't come out of a recorded site meeting (a quick
    ad-hoc assignment, a follow-up, etc.).
    """
    membership_result = await db.execute(
        select(ProjectMembership).where(
            ProjectMembership.project_id == project_id,
            ProjectMembership.user_id == payload.assigned_to,
            ProjectMembership.status == "active",
        )
    )
    if not membership_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="That person isn't an active member of this project")

    task = Task(
        project_id=project_id,
        org_id=current_user.org_id,
        assigned_to=payload.assigned_to,
        title=payload.title,
        description=payload.description,
        due_date=payload.due_date,
        status="open",
    )
    db.add(task)
    await db.flush()

    await log_action(db, current_user.org_id, current_user.user_id, "task.create",
                      entity_type="task", entity_id=str(task.id), project_id=project_id,
                      metadata={"title": payload.title, "assigned_to": payload.assigned_to})

    await notify_task_assigned(str(task.id), payload.assigned_to, task.title,
                                str(task.due_date) if task.due_date else None)

    return await _to_task_out(db, task)


@router.get("/projects/{project_id}/tasks", response_model=list[TaskOut])
async def list_project_tasks(
    project_id: str,
    db: AsyncSession = Depends(get_scoped_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Architects see every task on the project; anyone else sees only their own."""
    query = select(Task).where(Task.project_id == project_id).order_by(Task.due_date.asc().nulls_last())
    if current_user.role not in ARCHITECT_ROLES:
        query = query.where(Task.assigned_to == current_user.user_id)
    result = await db.execute(query)
    tasks = result.scalars().all()
    return [await _to_task_out(db, t) for t in tasks]


@router.get("/tasks/mine", response_model=list[TaskOut])
async def list_my_tasks(
    db: AsyncSession = Depends(get_scoped_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Every task assigned to the current user, across whichever projects
    they're on - this is what powers the vendor/onboarding 'My Tasks' view.
    """
    result = await db.execute(
        select(Task).where(Task.assigned_to == current_user.user_id).order_by(Task.due_date.asc().nulls_last())
    )
    tasks = result.scalars().all()
    return [await _to_task_out(db, t, include_project_name=True) for t in tasks]


@router.patch("/tasks/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: str,
    payload: TaskUpdate,
    db: AsyncSession = Depends(get_scoped_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Architects can edit anything on a task. Everyone else (the assignee)
    can only update its status - e.g. marking their own task in-progress or
    done, without being able to reassign or edit the description.
    """
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    is_architect = current_user.role in ARCHITECT_ROLES
    is_assignee = task.assigned_to and str(task.assigned_to) == current_user.user_id

    if not is_architect and not is_assignee:
        raise HTTPException(status_code=403, detail="You can only update tasks assigned to you")

    if not is_architect:
        if payload.title or payload.description or payload.assigned_to or payload.due_date:
            raise HTTPException(status_code=403, detail="You can only update the task's status")
        if payload.status:
            task.status = payload.status
    else:
        if payload.title is not None:
            task.title = payload.title
        if payload.description is not None:
            task.description = payload.description
        if payload.due_date is not None:
            task.due_date = payload.due_date
        if payload.status is not None:
            task.status = payload.status
        if payload.assigned_to is not None:
            task.assigned_to = payload.assigned_to

    await log_action(db, current_user.org_id, current_user.user_id, "task.update",
                      entity_type="task", entity_id=task_id, project_id=str(task.project_id))

    await db.flush()
    return await _to_task_out(db, task)
