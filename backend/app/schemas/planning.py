import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import HHMM


class PlanningRequestIn(BaseModel):
    user_prompt: str = Field("", max_length=4000)
    week_start: date | None = None


class PlanningRequestOut(BaseModel):
    id: uuid.UUID
    user_prompt: str
    status: str
    week_start: date
    error: str | None
    timetable_id: uuid.UUID | None = None
    created_at: datetime


class TaskInput(BaseModel):
    id: uuid.UUID | None = None
    goal_id: uuid.UUID
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    scheduled_date: date
    start_time: HHMM
    end_time: HHMM

    @model_validator(mode="after")
    def _times(self):
        if self.end_time <= self.start_time:
            raise ValueError(f"'{self.title}': end time must be after start time")
        return self


class TasksIn(BaseModel):
    tasks: list[TaskInput]


class TaskOut(BaseModel):
    id: uuid.UUID
    timetable_id: uuid.UUID
    goal_id: uuid.UUID
    goal_title: str
    category_id: uuid.UUID
    category_name: str
    category_color: str
    task_type: str
    title: str
    description: str | None
    scheduled_date: date
    start_time: HHMM
    end_time: HHMM
    importance: str
    status: str


class TimetableOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    planning_request_id: uuid.UUID | None
    week_start: date
    week_end: date
    version: int
    status: Literal["DRAFT", "APPROVED", "REJECTED", "ARCHIVED"]
    approved_at: datetime | None
    created_at: datetime
    planning_summary: str | None
    warnings: list[str]
    source: str
    task_count: int
    tasks: list[TaskOut]


class ValidationOut(BaseModel):
    valid: bool
    conflicts: list[str]


class ReviewIn(BaseModel):
    comments: str | None = Field(None, max_length=2000)


class RegenerateIn(BaseModel):
    user_prompt: str | None = Field(None, max_length=4000)


class RescheduleIn(BaseModel):
    scheduled_date: date
    start_time: HHMM
    end_time: HHMM

    @model_validator(mode="after")
    def _times(self):
        if self.end_time <= self.start_time:
            raise ValueError("End time must be after start time")
        return self


# ---- Gemini structured output (validated before anything touches the DB) ----

class AIPlannedTask(BaseModel):
    goal_id: str
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    duration_minutes: int = Field(ge=15, le=240)
    sessions_per_week: int = Field(ge=1, le=14)
    preferred_days: list[str] = []
    preferred_time_of_day: Literal["morning", "afternoon", "evening", "any"] = "any"


class AIPlanOutput(BaseModel):
    planning_summary: str = ""
    warnings: list[str] = []
    clarifications_needed: list[str] = []
    tasks: list[AIPlannedTask] = []


class AIDecomposeOutput(BaseModel):
    summary: str = ""
    suggested_title: str = ""
    suggested_description: str = ""
    milestones: list[dict] = []
    warnings: list[str] = []
