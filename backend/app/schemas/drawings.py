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

    class Config:
        from_attributes = True
