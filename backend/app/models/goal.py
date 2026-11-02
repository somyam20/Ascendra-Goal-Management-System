import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, CreatedMixin, UUIDMixin, utcnow


class Goal(UUIDMixin, CreatedMixin, Base):
    __tablename__ = "goals"
    __table_args__ = (CheckConstraint("end_date >= start_date", name="ck_goal_dates"),)

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("categories.id"), index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    start_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    end_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    importance: Mapped[str] = mapped_column(String(10), nullable=False, default="MEDIUM")
    status: Mapped[str] = mapped_column(String(12), nullable=False, default="ACTIVE", index=True)
    approval_status: Mapped[str] = mapped_column(String(16), nullable=False, default="APPROVED")
    notes: Mapped[str | None] = mapped_column(Text)
    ai_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    category = relationship("Category", lazy="joined")
    milestones = relationship(
        "GoalMilestone", cascade="all, delete-orphan", order_by="GoalMilestone.created_at", lazy="selectin"
    )


class GoalMilestone(UUIDMixin, CreatedMixin, Base):
    __tablename__ = "goal_milestones"

    goal_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("goals.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    due_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(12), nullable=False, default="PENDING")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
