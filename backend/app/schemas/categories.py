import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str | None = Field(None, max_length=500)
    icon: str | None = Field(None, max_length=40)
    color: str | None = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")


class CategoryUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=80)
    description: str | None = Field(None, max_length=500)
    icon: str | None = Field(None, max_length=40)
    color: str | None = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")
    is_active: bool | None = None


class CategoryOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    icon: str
    color: str
    is_default: bool
    created_by: uuid.UUID | None
    is_active: bool
    is_selected: bool
    created_at: datetime
    goal_count: int = 0
    active_goal_count: int = 0
    completed_goal_count: int = 0
    completion_rate: float | None = None
    evaluated: int = 0
    hours_per_week: float = 0
