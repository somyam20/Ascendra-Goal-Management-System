import re
import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, Field

from app.schemas.common import ORM

Role = Literal["ADMIN", "USER"]
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _email(v: str) -> str:
    v = v.strip().lower()
    if len(v) > 255 or not _EMAIL_RE.match(v):
        raise ValueError("Enter a valid email address")
    return v


# Permissive on purpose: internal domains such as *.local are allowed.
EmailStr = Annotated[str, AfterValidator(_email)]


class UserOut(ORM):
    id: uuid.UUID
    name: str
    email: str
    role: Role
    is_active: bool
    avatar_color: str
    created_at: datetime


class DirectoryEntry(ORM):
    id: uuid.UUID
    name: str
    avatar_color: str
    role: Role


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: Role = "USER"
    avatar_color: str | None = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")


class UserUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    email: EmailStr | None = None
    role: Role | None = None
    avatar_color: str | None = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")


class UserStatusUpdate(BaseModel):
    is_active: bool


class ResetTokenOut(BaseModel):
    reset_token: str
    expires_at: datetime


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class RefreshIn(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)
