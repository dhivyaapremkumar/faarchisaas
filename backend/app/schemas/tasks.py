from pydantic import BaseModel
from datetime import date, datetime


class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    assigned_to: str  # user_id of the assignee - must be an active member of this project
    due_date: date | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    assigned_to: str | None = None
    due_date: date | None = None
    status: str | None = None


class TaskOut(BaseModel):
    id: str
    title: str
    description: str | None
    due_date: date | None
    status: str
    assigned_to: str | None
    assignee_name: str | None
    project_name: str | None = None
    created_at: datetime
