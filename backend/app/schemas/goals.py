import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import ORM

Importance = Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]
GoalStatus = Literal["DRAFT", "ACTIVE", "COMPLETED", "PAUSED", "CANCELLED"]
ApprovalStatus = Literal["APPROVED", "PENDING_REVIEW", "REJECTED"]
MilestoneStatus = Literal["PENDING", "COMPLETED"]


class MilestoneIn(BaseModel):
    id: uuid.UUID | None = None
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    due_date: date | None = None
    status: MilestoneStatus = "PENDING"


class MilestoneOut(ORM):
    id: uuid.UUID
    title: str
    description: str | None
    due_date: date | None
    status: MilestoneStatus


class GoalIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    category_id: uuid.UUID
    start_date: date
    end_date: date
    importance: Importance = "MEDIUM"
    status: GoalStatus | None = None
    notes: str | None = None
    milestones: list[MilestoneIn] | None = None
    ai_generated: bool = False

    @model_validator(mode="after")
    def _dates(self):
        if self.end_date < self.start_date:
            raise ValueError("End date cannot precede start date")
        for m in self.milestones or []:
            if m.due_date and not (self.start_date <= m.due_date <= self.end_date):
                raise ValueError(f"Milestone '{m.title}' due date must fall within the goal dates")
        return self


class GoalStatusIn(BaseModel):
    status: GoalStatus


class MilestoneStatusIn(BaseModel):
    status: MilestoneStatus


class GoalProgress(BaseModel):
    completed: int = 0
    not_completed: int = 0
    unmarked: int = 0
    completion_rate: float | None = None


class GoalOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    category_id: uuid.UUID
    category_name: str
    category_color: str
    title: str
    description: str | None
    start_date: date
    end_date: date
    importance: Importance
    status: GoalStatus
    approval_status: ApprovalStatus
    notes: str | None
    ai_generated: bool
    milestones: list[MilestoneOut]
    progress: GoalProgress
    is_overdue: bool
    days_remaining: int
    created_at: datetime
    updated_at: datetime


class GoalHistoryEntry(ORM):
    id: uuid.UUID
    action: str
    old_value: dict[str, Any] | None
    new_value: dict[str, Any] | None
    created_at: datetime


class DecomposeIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(None, max_length=4000)
    category_id: uuid.UUID | None = None
    start_date: date | None = None
    end_date: date | None = None
    prompt: str | None = Field(None, max_length=2000)


class SuggestedMilestone(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = ""
    due_date: date | None = None


class DecomposeOut(BaseModel):
    summary: str
    suggested_title: str
    suggested_description: str
    milestones: list[SuggestedMilestone]
    warnings: list[str] = []
    source: Literal["gemini", "fallback"]


class GoalApproveIn(BaseModel):
    approve: bool = True
    milestones: list[MilestoneIn] | None = None
