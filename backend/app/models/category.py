import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedMixin, UUIDMixin, utcnow


class Category(UUIDMixin, CreatedMixin, Base):
    __tablename__ = "categories"

    name: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    icon: Mapped[str] = mapped_column(String(40), nullable=False, default="target")
    color: Mapped[str] = mapped_column(String(9), nullable=False, default="#6366f1")
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class UserCategory(UUIDMixin, CreatedMixin, Base):
    __tablename__ = "user_categories"
    __table_args__ = (UniqueConstraint("user_id", "category_id", name="uq_user_category"),)

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("categories.id", ondelete="CASCADE"), index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class CategoryBudget(UUIDMixin, CreatedMixin, Base):
    __tablename__ = "category_budgets"
    __table_args__ = (UniqueConstraint("user_id", "category_id", name="uq_category_budget"),)

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("categories.id", ondelete="CASCADE"), index=True
    )
    hours_per_week: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
