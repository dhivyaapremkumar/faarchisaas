from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    org_id: str


class ProjectOut(BaseModel):
    id: str
    name: str
    status: str
    address: str | None = None

    class Config:
        from_attributes = True
