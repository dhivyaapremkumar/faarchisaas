from pydantic import BaseModel
from datetime import datetime, date


class ProgressPhotoOut(BaseModel):
    id: str
    room_or_area: str
    caption: str | None
    signed_url: str
    uploaded_by_name: str | None
    created_at: datetime


class DailyUpdateCreate(BaseModel):
    update_date: date
    done_today: str | None = None
    pending: str | None = None


class DailyUpdateOut(BaseModel):
    id: str
    update_date: date
    done_today: str | None
    pending: str | None
    posted_by_name: str | None
    created_at: datetime


class ContactOut(BaseModel):
    full_name: str
    email: str
    phone: str | None
    role: str
    category: str | None
    trade: str | None


class VendorProjectRef(BaseModel):
    project_id: str
    project_name: str


class VendorDirectoryEntry(BaseModel):
    user_id: str
    full_name: str
    email: str
    phone: str | None
    categories: list[str]
    trades: list[str]
    projects: list[VendorProjectRef]
