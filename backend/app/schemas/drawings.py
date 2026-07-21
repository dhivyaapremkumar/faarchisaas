from pydantic import BaseModel
from datetime import datetime
from uuid import UUID


class DrawingCreate(BaseModel):
    project_id: str
    drawing_number: str
    title: str
    discipline: str | None = None


class DrawingOut(BaseModel):
    id: UUID
    drawing_number: str
    title: str
    discipline: str | None
    created_at: datetime
    latest_revision_label: str | None = None
    latest_revision_status: str | None = None
    revision_count: int = 0

    class Config:
        from_attributes = True


class DrawingRevisionOut(BaseModel):
    id: str
    revision_label: str
    status: str
    changelog: str | None
    signed_url: str
    created_at: datetime
    shared_categories: list[str] = []

    class Config:
        from_attributes = True


class ShareRevisionRequest(BaseModel):
    categories: list[str] = []
    user_ids: list[str] = []


class EmailRevisionRequest(BaseModel):
    recipient_email: str
    message: str | None = None


class ProjectFileOut(BaseModel):
    drawing_id: str
    drawing_number: str
    drawing_title: str
    discipline: str | None
    revision_id: str
    revision_label: str
    status: str
    signed_url: str
    shared_categories: list[str] = []
    created_at: datetime
