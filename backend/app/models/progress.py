import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDMixin, utcnow


class DailyProgress(UUIDMixin, Base):
    """Actual completion state of a planned task, or of a goal check-in, on one date.

    completion_status: 1 = completed, 0 = explicitly not completed, NULL = not yet evaluated.
    """

    __tablename__ = "daily_progress"
    __table_args__ = (
        Index(
            "uq_progress_task_date", "task_id", "activity_date", unique=True,
            postgresql_where=text("task_id IS NOT NULL"), sqlite_where=text("task_id IS NOT NULL"),
        ),
        Index(
            "uq_progress_goal_date", "user_id", "goal_id", "activity_date", unique=True,
            postgresql_where=text("task_id IS NULL"), sqlite_where=text("task_id IS NULL"),
        ),
        Index("ix_progress_user_date", "user_id", "activity_date"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    goal_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("goals.id"), nullable=False, index=True)
    task_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("timetable_tasks.id"), index=True)
    activity_date: Mapped[date] = mapped_column(Date, nullable=False)
    completion_status: Mapped[int | None] = mapped_column(Integer)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
