from pydantic import BaseModel
from datetime import datetime
from uuid import UUID


class MeetingListOut(BaseModel):
    id: UUID
    meeting_date: datetime
    mom_status: str

    class Config:
        from_attributes = True


class TeamMemberOut(BaseModel):
    id: str
    user_id: str
    full_name: str
    email: str
    role: str
    trade: str | None
    category: str | None
    status: str


class AddMemberRequest(BaseModel):
    full_name: str
    email: str
    role: str  # 'vendor', 'client', or 'onboarding'
    trade: str | None = None  # only meaningful for vendors
    category: str | None = None  # Architect/Client/Structural/Electrical/Plumbing/A-C/Others


class AddMemberResponse(BaseModel):
    user_id: str
    email: str
    full_name: str
    role: str
    temp_password: str | None  # only returned when a NEW user was created
    note: str
