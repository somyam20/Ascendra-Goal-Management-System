import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.common import HHMM, ORM

FeedbackStyle = Literal["POSITIVE", "STRICT", "BALANCED"]
Weekday = int


def _check_days(v: list[int] | None) -> list[int] | None:
    if v is None:
        return v
    if any(d < 0 or d > 6 for d in v):
        raise ValueError("Weekdays must be between 0 (Monday) and 6 (Sunday)")
    return sorted(set(v))


class PreferencesOut(ORM):
    timezone: str
    wake_time: HHMM
    sleep_time: HHMM
    sleep_duration_hours: float = 0
    feedback_style: FeedbackStyle
    preferred_working_start: HHMM
    preferred_working_end: HHMM
    max_productive_hours: float
    break_minutes: int
    preferred_task_minutes: int
    unavailable_days: list[int]
    rest_days: list[int]
    is_configured: bool


class PreferencesIn(BaseModel):
    timezone: str | None = Field(None, max_length=64)
    wake_time: HHMM | None = None
    sleep_time: HHMM | None = None
    feedback_style: FeedbackStyle | None = None
    preferred_working_start: HHMM | None = None
    preferred_working_end: HHMM | None = None
    max_productive_hours: float | None = Field(None, gt=0, le=16)
    break_minutes: int | None = Field(None, ge=0, le=120)
    preferred_task_minutes: int | None = Field(None, ge=15, le=240)
    unavailable_days: list[int] | None = None
    rest_days: list[int] | None = None

    _days = field_validator("unavailable_days", "rest_days")(_check_days)

    @field_validator("timezone")
    @classmethod
    def _tz(cls, v):
        if v is None:
            return v
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
        try:
            ZoneInfo(v)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Unknown timezone")
        return v


class FeedbackStyleIn(BaseModel):
    feedback_style: FeedbackStyle


class ActivityIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    start_time: HHMM
    end_time: HHMM
    recurrence: Literal["DAILY", "WEEKLY", "ONCE"] = "WEEKLY"
    weekdays: list[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4])
    start_date: date | None = None
    end_date: date | None = None

    _days = field_validator("weekdays")(_check_days)

    @model_validator(mode="after")
    def _check(self):
        if self.start_time == self.end_time:
            raise ValueError("Start and end time cannot be equal")
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("End date cannot precede start date")
        if self.recurrence == "ONCE" and not self.start_date:
            raise ValueError("One-time activities need a date")
        if self.recurrence == "WEEKLY" and not self.weekdays:
            raise ValueError("Select at least one weekday")
        return self


class ActivityOut(ORM):
    id: uuid.UUID
    title: str
    start_time: HHMM
    end_time: HHMM
    recurrence: str
    weekdays: list[int]
    start_date: date | None
    end_date: date | None


class BudgetItem(BaseModel):
    category_id: uuid.UUID
    hours_per_week: float = Field(ge=0, le=112)


class BudgetsIn(BaseModel):
    budgets: list[BudgetItem]


class BudgetOut(BaseModel):
    category_id: uuid.UUID
    category_name: str
    category_color: str
    hours_per_week: float
