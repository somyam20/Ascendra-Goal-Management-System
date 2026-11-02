import uuid
from datetime import date, datetime, time

from sqlalchemy import JSON, Date, DateTime, ForeignKey, Integer, String, Text, Time, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, CreatedMixin, UUIDMixin


class PlanningRequest(UUIDMixin, CreatedMixin, Base):
    __tablename__ = "planning_requests"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    user_prompt: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="PENDING")
    week_start: Mapped[date] = mapped_column(Date, nullable=False)
    preferences_snapshot: Mapped[dict | None] = mapped_column(JSON)
    ai_response: Mapped[dict | None] = mapped_column(JSON)
    error: Mapped[str | None] = mapped_column(Text)


class Timetable(UUIDMixin, CreatedMixin, Base):
    __tablename__ = "timetables"
    __table_args__ = (UniqueConstraint("user_id", "week_start", "version", name="uq_timetable_version"),)

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    planning_request_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("planning_requests.id", ondelete="SET NULL"), index=True
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("timetables.id", ondelete="SET NULL"))
    week_start: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    week_end: Mapped[date] = mapped_column(Date, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="DRAFT", index=True)
    planning_summary: Mapped[str | None] = mapped_column(Text)
    warnings: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    source: Mapped[str] = mapped_column(String(10), nullable=False, default="gemini")
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    tasks = relationship(
        "TimetableTask",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="(TimetableTask.scheduled_date, TimetableTask.start_time)",
    )


class TimetableTask(UUIDMixin, CreatedMixin, Base):
    __tablename__ = "timetable_tasks"

    timetable_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("timetables.id", ondelete="CASCADE"), index=True
    )
    goal_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("goals.id"), index=True)
    task_type: Mapped[str] = mapped_column(String(10), nullable=False, default="AI")
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    status: Mapped[str] = mapped_column(String(12), nullable=False, default="PLANNED")

    goal = relationship("Goal", lazy="joined")


class Approval(UUIDMixin, CreatedMixin, Base):
    __tablename__ = "approvals"

    timetable_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("timetables.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(10), nullable=False)
    comments: Mapped[str | None] = mapped_column(Text)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
