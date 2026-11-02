import uuid

from fastapi import HTTPException, status
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import Session

from app.models import Category, CategoryBudget, DailyProgress, Goal, User, UserCategory
from app.repositories.base import accessible_category, selected_category_ids
from app.schemas.categories import CategoryIn, CategoryUpdate
from app.utils.common import audit, not_found, rate

PALETTE = ["#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444", "#0ea5e9", "#22c55e", "#f97316"]


def list_categories(db: Session, target: User, *, is_self: bool, include_inactive: bool = False) -> list[dict]:
    selected = selected_category_ids(db, target.id)
    stmt = select(Category).where(or_(Category.is_default.is_(True), Category.created_by == target.id))
    if not include_inactive:
        stmt = stmt.where(Category.is_active.is_(True))
    cats = list(db.scalars(stmt.order_by(Category.is_default.desc(), Category.name)))
    if not is_self:
        cats = [c for c in cats if c.id in selected]

    goal_stats = {
        row.category_id: row for row in db.execute(
            select(
                Goal.category_id,
                func.count(Goal.id).label("total"),
                func.sum(case((Goal.status == "ACTIVE", 1), else_=0)).label("active"),
                func.sum(case((Goal.status == "COMPLETED", 1), else_=0)).label("completed"),
            ).where(Goal.user_id == target.id, Goal.deleted_at.is_(None)).group_by(Goal.category_id)
        )
    }
    progress_stats = {
        row.category_id: row for row in db.execute(
            select(
                Goal.category_id,
                func.sum(case((DailyProgress.completion_status == 1, 1), else_=0)).label("done"),
                func.sum(case((DailyProgress.completion_status == 0, 1), else_=0)).label("missed"),
            ).join(Goal, Goal.id == DailyProgress.goal_id)
            .where(DailyProgress.user_id == target.id).group_by(Goal.category_id)
        )
    }
    budgets = dict(db.execute(
        select(CategoryBudget.category_id, CategoryBudget.hours_per_week).where(CategoryBudget.user_id == target.id)
    ).all())

    out = []
    for c in cats:
        g = goal_stats.get(c.id)
        p = progress_stats.get(c.id)
        done, missed = (int(p.done or 0), int(p.missed or 0)) if p else (0, 0)
        out.append({
            "id": c.id, "name": c.name, "description": c.description, "icon": c.icon, "color": c.color,
            "is_default": c.is_default, "created_by": c.created_by, "is_active": c.is_active,
            "is_selected": c.id in selected, "created_at": c.created_at,
            "goal_count": int(g.total) if g else 0,
            "active_goal_count": int(g.active or 0) if g else 0,
            "completed_goal_count": int(g.completed or 0) if g else 0,
            "completion_rate": rate(done, missed), "evaluated": done + missed,
            "hours_per_week": float(budgets.get(c.id, 0) or 0),
        })
    return out


def _category_out(db: Session, user: User, cat_id: uuid.UUID) -> dict:
    for c in list_categories(db, user, is_self=True, include_inactive=True):
        if c["id"] == cat_id:
            return c
    raise not_found("Category")


def create_category(db: Session, user: User, data: CategoryIn) -> dict:
    is_admin = user.role == "ADMIN"
    dup = db.scalar(select(Category.id).where(
        func.lower(Category.name) == data.name.strip().lower(), Category.is_active.is_(True),
        or_(Category.is_default.is_(True), Category.created_by == user.id),
    ))
    if dup:
        raise HTTPException(status.HTTP_409_CONFLICT, "A category with this name already exists")
    count = db.scalar(select(func.count(Category.id))) or 0
    cat = Category(
        name=data.name.strip(), description=data.description, icon=data.icon or "target",
        color=data.color or PALETTE[count % len(PALETTE)], is_default=is_admin, created_by=user.id,
    )
    db.add(cat)
    db.flush()
    if not is_admin:
        db.add(UserCategory(user_id=user.id, category_id=cat.id))
    audit(db, user.id, "category", cat.id, "CREATED", new=data.model_dump())
    db.commit()
    return _category_out(db, user, cat.id)


def _editable(db: Session, user: User, category_id: uuid.UUID) -> Category:
    cat = db.get(Category, category_id)
    if cat is None:
        raise not_found("Category")
    if cat.is_default and user.role != "ADMIN":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Default categories can only be changed by an administrator")
    if not cat.is_default and cat.created_by != user.id:
        raise not_found("Category")
    return cat


def update_category(db: Session, user: User, category_id: uuid.UUID, data: CategoryUpdate) -> dict:
    cat = _editable(db, user, category_id)
    changes = data.model_dump(exclude_unset=True)
    old = {k: getattr(cat, k) for k in changes}
    for k, v in changes.items():
        if v is not None:
            setattr(cat, k, v.strip() if isinstance(v, str) and k == "name" else v)
    audit(db, user.id, "category", cat.id, "UPDATED", old, changes)
    db.commit()
    return _category_out(db, user, cat.id)


def deactivate_category(db: Session, user: User, category_id: uuid.UUID) -> None:
    cat = _editable(db, user, category_id)
    cat.is_active = False
    audit(db, user.id, "category", cat.id, "DEACTIVATED")
    db.commit()


def set_selected(db: Session, user: User, category_id: uuid.UUID, selected: bool) -> None:
    accessible_category(db, user.id, category_id)
    link = db.scalar(select(UserCategory).where(
        and_(UserCategory.user_id == user.id, UserCategory.category_id == category_id)
    ))
    if link is None:
        if selected:
            db.add(UserCategory(user_id=user.id, category_id=category_id))
    else:
        link.is_active = selected
    audit(db, user.id, "category", category_id, "SELECTED" if selected else "UNSELECTED")
    db.commit()
