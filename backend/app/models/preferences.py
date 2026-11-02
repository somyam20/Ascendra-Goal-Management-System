import uuid
from datetime import date, datetime, time

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Time, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedMixin, UUIDMixin, utcnow


class UserPreferences(UUIDMixin, CreatedMixin, Base):
    __tablename__ = "user_preferences"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Asia/Kolkata")
    wake_time: Mapped[time] = mapped_column(Time, nullable=False, default=time(6, 30))
    sleep_time: Mapped[time] = mapped_column(Time, nullable=False, default=time(23, 0))
    feedback_style: Mapped[str] = mapped_column(String(10), nullable=False, default="BALANCED")
    preferred_working_start: Mapped[time] = mapped_column(Time, nullable=False, default=time(7, 0))
    preferred_working_end: Mapped[time] = mapped_column(Time, nullable=False, default=time(22, 0))
    max_productive_hours: Mapped[float] = mapped_column(Float, nullable=False, default=4)
    break_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    preferred_task_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    unavailable_days: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    rest_days: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    is_configured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class FixedActivity(UUIDMixin, CreatedMixin, Base):
    __tablename__ = "fixed_activities"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    recurrence: Mapped[str] = mapped_column(String(10), nullable=False, default="WEEKLY")
    weekdays: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
