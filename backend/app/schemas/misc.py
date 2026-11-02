import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.common import ORM


class ProgressIn(BaseModel):
    goal_id: uuid.UUID
    task_id: uuid.UUID | None = None
    activity_date: date
    completion_status: Literal[0, 1] | None


class ProgressUpdate(BaseModel):
    completion_status: Literal[0, 1] | None


class ProgressOut(ORM):
    id: uuid.UUID
    goal_id: uuid.UUID
    task_id: uuid.UUID | None
    activity_date: date
    completion_status: int | None
    updated_at: datetime


class NotificationOut(ORM):
    id: uuid.UUID
    title: str
    message: str
    notification_type: str
    is_read: bool
    created_at: datetime


class NotificationPage(BaseModel):
    items: list[NotificationOut]
    total: int
    page: int
    page_size: int
    unread_count: int


class GenerateIn(BaseModel):
    kind: Literal["DAILY", "EVENING", "WEEKLY"] = "DAILY"


class AuditOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None
    user_name: str | None
    entity_type: str
    entity_id: uuid.UUID | None
    action: str
    old_value: Any
    new_value: Any
    created_at: datetime


class AppSettingsModel(BaseModel):
    leaderboard_min_evaluated: int = Field(3, ge=0, le=100)
    ai_enabled: bool = True
    signup_enabled: bool = True
    morning_hour: int = Field(8, ge=0, le=23)
    evening_hour: int = Field(20, ge=0, le=23)
    weekly_review_day: int = Field(6, ge=0, le=6)
