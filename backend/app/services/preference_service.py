import uuid
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Category, CategoryBudget, FixedActivity, User, UserPreferences
from app.repositories.base import accessible_category, selected_category_ids
from app.schemas.preferences import ActivityIn, BudgetItem, PreferencesIn
from app.services import scheduling_service as sched
from app.utils.common import audit, monday_of, not_found


def get_prefs(db: Session, user_id: uuid.UUID) -> UserPreferences:
    prefs = db.scalar(select(UserPreferences).where(UserPreferences.user_id == user_id))
    if prefs is None:
        prefs = UserPreferences(user_id=user_id)
        db.add(prefs)
        db.commit()
    return prefs


def prefs_out(prefs: UserPreferences) -> dict:
    data = {c: getattr(prefs, c) for c in (
        "timezone", "wake_time", "sleep_time", "feedback_style", "preferred_working_start",
        "preferred_working_end", "max_productive_hours", "break_minutes", "preferred_task_minutes",
        "unavailable_days", "rest_days", "is_configured",
    )}
    data["sleep_duration_hours"] = sched.sleep_hours(prefs)
    return data


def update_prefs(db: Session, user: User, data: PreferencesIn) -> dict:
    prefs = get_prefs(db, user.id)
    changes = data.model_dump(exclude_unset=True, exclude_none=True)
    old = {k: getattr(prefs, k) for k in changes}
    for k, v in changes.items():
        setattr(prefs, k, v)
    if prefs.wake_time == prefs.sleep_time:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Wake-up and sleep time cannot be the same")
    if prefs.preferred_working_start == prefs.preferred_working_end:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Working start and end cannot be the same")
    prefs.is_configured = True
    audit(db, user.id, "preferences", prefs.id, "UPDATED", old, changes)
    db.commit()
    return prefs_out(prefs)


def list_activities(db: Session, user_id: uuid.UUID) -> list[FixedActivity]:
    return list(db.scalars(
        select(FixedActivity).where(FixedActivity.user_id == user_id).order_by(FixedActivity.start_time)
    ))


def _owned_activity(db: Session, user_id, activity_id) -> FixedActivity:
    act = db.get(FixedActivity, activity_id)
    if act is None or act.user_id != user_id:
        raise not_found("Activity")
    return act


def create_activity(db: Session, user: User, data: ActivityIn) -> FixedActivity:
    act = FixedActivity(user_id=user.id, **data.model_dump())
    db.add(act)
    db.flush()
    audit(db, user.id, "activity", act.id, "CREATED", new=data.model_dump())
    db.commit()
    return act


def update_activity(db: Session, user: User, activity_id, data: ActivityIn) -> FixedActivity:
    act = _owned_activity(db, user.id, activity_id)
    for k, v in data.model_dump().items():
        setattr(act, k, v)
    audit(db, user.id, "activity", act.id, "UPDATED", new=data.model_dump())
    db.commit()
    return act


def delete_activity(db: Session, user: User, activity_id) -> None:
    act = _owned_activity(db, user.id, activity_id)
    audit(db, user.id, "activity", act.id, "DELETED", old={"title": act.title})
    db.delete(act)
    db.commit()


def budgets(db: Session, user_id: uuid.UUID) -> list[dict]:
    selected = selected_category_ids(db, user_id)
    cats = db.scalars(select(Category).where(Category.id.in_(selected)).order_by(Category.name)).all() if selected else []
    stored = dict(db.execute(
        select(CategoryBudget.category_id, CategoryBudget.hours_per_week).where(CategoryBudget.user_id == user_id)
    ).all())
    return [{"category_id": c.id, "category_name": c.name, "category_color": c.color,
             "hours_per_week": float(stored.get(c.id, 0) or 0)} for c in cats]


def budget_map(db: Session, user_id: uuid.UUID) -> dict[uuid.UUID, float]:
    """Only budgets that were explicitly set (> 0) cap the planner."""
    return {cid: h for cid, h in db.execute(
        select(CategoryBudget.category_id, CategoryBudget.hours_per_week)
        .where(CategoryBudget.user_id == user_id, CategoryBudget.hours_per_week > 0)
    ).all()}


def set_budgets(db: Session, user: User, items: list[BudgetItem]) -> list[dict]:
    total = sum(i.hours_per_week for i in items)
    if total > 112:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Total weekly allocation exceeds 112 hours")
    for item in items:
        accessible_category(db, user.id, item.category_id)
        row = db.scalar(select(CategoryBudget).where(
            CategoryBudget.user_id == user.id, CategoryBudget.category_id == item.category_id
        ))
        if row is None:
            db.add(CategoryBudget(user_id=user.id, category_id=item.category_id, hours_per_week=item.hours_per_week))
        else:
            row.hours_per_week = item.hours_per_week
    audit(db, user.id, "category_budget", None, "UPDATED", new={"budgets": [i.model_dump() for i in items]})
    db.commit()
    return budgets(db, user.id)


def availability(db: Session, user: User, week_start: date | None) -> dict:
    prefs = get_prefs(db, user.id)
    week_start = monday_of(week_start or date.today())
    days = sched.availability(prefs, list_activities(db, user.id), week_start)
    free_total = sum(d["free_minutes"] for d in days)
    budget_total = int(sum(budget_map(db, user.id).values()) * 60)
    warnings = []
    if not prefs.is_configured:
        warnings.append("You have not saved your sleep schedule and working hours yet; defaults are used.")
    if budget_total > free_total:
        warnings.append(
            f"Your category allocations ({budget_total / 60:.1f} h) exceed your free focus time "
            f"({free_total / 60:.1f} h) this week."
        )
    if budget_total == 0:
        warnings.append("No weekly hours allocated to categories yet.")
    return {"week_start": week_start, "free_minutes_total": free_total, "budget_minutes_total": budget_total,
            "days": days, "warnings": warnings}
