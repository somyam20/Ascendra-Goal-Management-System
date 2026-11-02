from enum import StrEnum


class Role(StrEnum):
    ADMIN = "ADMIN"
    USER = "USER"


class Importance(StrEnum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


IMPORTANCE_WEIGHT = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}


class GoalStatus(StrEnum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    PAUSED = "PAUSED"
    CANCELLED = "CANCELLED"


class ApprovalStatus(StrEnum):
    APPROVED = "APPROVED"
    PENDING_REVIEW = "PENDING_REVIEW"
    REJECTED = "REJECTED"


class MilestoneStatus(StrEnum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"


class FeedbackStyle(StrEnum):
    POSITIVE = "POSITIVE"
    STRICT = "STRICT"
    BALANCED = "BALANCED"


class Recurrence(StrEnum):
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    ONCE = "ONCE"


class PlanningStatus(StrEnum):
    PENDING = "PENDING"
    GENERATED = "GENERATED"
    FAILED = "FAILED"
    NEEDS_CLARIFICATION = "NEEDS_CLARIFICATION"


class TimetableStatus(StrEnum):
    DRAFT = "DRAFT"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    ARCHIVED = "ARCHIVED"


class TaskStatus(StrEnum):
    PLANNED = "PLANNED"
    RESCHEDULED = "RESCHEDULED"


class TaskType(StrEnum):
    AI = "AI"
    MANUAL = "MANUAL"
