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
    status: str
