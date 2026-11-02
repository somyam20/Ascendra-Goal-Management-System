import uuid

from sqlalchemy import JSON, Boolean, ForeignKey, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedMixin, UUIDMixin


class Notification(UUIDMixin, CreatedMixin, Base):
    __tablename__ = "notifications"
    __table_args__ = (UniqueConstraint("user_id", "dedupe_key", name="uq_notification_dedupe"),)

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    message: Mapped[str] = mapped_column(Text, nullable=False)
    notification_type: Mapped[str] = mapped_column(String(32), nullable=False)
    dedupe_key: Mapped[str | None] = mapped_column(String(120))
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class AuditLog(UUIDMixin, CreatedMixin, Base):
    __tablename__ = "audit_logs"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    entity_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, index=True)
    action: Mapped[str] = mapped_column(String(40), nullable=False)
    old_value: Mapped[dict | None] = mapped_column(JSON)
    new_value: Mapped[dict | None] = mapped_column(JSON)


class AppSetting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)


DEFAULT_APP_SETTINGS = {
    "leaderboard_min_evaluated": 3,
    "ai_enabled": True,
    "signup_enabled": True,
    "morning_hour": 8,
    "evening_hour": 20,
    "weekly_review_day": 6,
}
