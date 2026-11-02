"""Thin data-access helpers. Ownership is always enforced here, never trusted from callers' input."""
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Category, Goal, Timetable, UserCategory
from app.utils.common import not_found


def get_owned_goal(db: Session, user_id: uuid.UUID, goal_id: uuid.UUID, *, include_deleted=False) -> Goal:
    goal = db.get(Goal, goal_id)
    if goal is None or goal.user_id != user_id or (goal.deleted_at and not include_deleted):
        raise not_found("Goal")
    return goal


def get_owned_timetable(db: Session, user_id: uuid.UUID, timetable_id: uuid.UUID) -> Timetable:
    tt = db.get(Timetable, timetable_id)
    if tt is None or tt.user_id != user_id:
        raise not_found("Timetable")
    return tt


def accessible_category(db: Session, user_id: uuid.UUID, category_id: uuid.UUID) -> Category:
    """A category is accessible if it is active and either global (default) or created by the user."""
    cat = db.get(Category, category_id)
    if cat is None or not cat.is_active or not (cat.is_default or cat.created_by == user_id):
        raise not_found("Category")
    return cat


def selected_category_ids(db: Session, user_id: uuid.UUID) -> set[uuid.UUID]:
    rows = db.scalars(
        select(UserCategory.category_id)
        .join(Category, Category.id == UserCategory.category_id)
        .where(UserCategory.user_id == user_id, UserCategory.is_active.is_(True), Category.is_active.is_(True))
    ).all()
    return set(rows)


def active_goals(db: Session, user_id: uuid.UUID) -> list[Goal]:
    return list(db.scalars(
        select(Goal).where(
            Goal.user_id == user_id, Goal.deleted_at.is_(None), Goal.status == "ACTIVE",
            Goal.approval_status == "APPROVED",
        ).order_by(Goal.end_date)
    ).unique().all())
