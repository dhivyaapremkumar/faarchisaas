from pydantic import BaseModel, EmailStr
from uuid import UUID


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    org_id: str


class ProjectOut(BaseModel):
    id: UUID
    name: str
    status: str
    address: str | None = None

    class Config:
        from_attributes = True


class ProjectCreate(BaseModel):
    name: str
    address: str | None = None
    status: str = "planning"


class ProjectUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    status: str | None = None
