from pydantic import BaseModel


class MyProfileOut(BaseModel):
    full_name: str
    email: str
    phone: str | None
    role: str


class MyProfileUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
