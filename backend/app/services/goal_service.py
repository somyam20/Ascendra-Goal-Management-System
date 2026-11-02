import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app.models import AuditLog, DailyProgress, Goal, GoalMilestone, User
from app.models.enums import IMPORTANCE_WEIGHT
from app.prompts.templates import DECOMPOSE_SYSTEM
from app.repositories.base import accessible_category, get_owned_goal
from app.schemas.goals import DecomposeIn, GoalIn, MilestoneIn, SuggestedMilestone
from app.schemas.planning import AIDecomposeOutput
from app.services import ai_client
from app.utils.common import audit, paginate, rate


def _snapshot(goal: Goal) -> dict:
    return {
        "title": goal.title, "description": goal.description, "category_id": goal.category_id,
        "start_date": goal.start_date, "end_date": goal.end_date, "importance": goal.importance,
        "status": goal.status, "approval_status": goal.approval_status, "notes": goal.notes,
        "milestones": [{"title": m.title, "due_date": m.due_date, "status": m.status} for m in goal.milestones],
    }


def progress_for(db: Session, goal_ids: list[uuid.UUID]) -> dict[uuid.UUID, dict]:
    if not goal_ids:
        return {}
    rows = db.execute(
        select(
            DailyProgress.goal_id,
            func.sum(case((DailyProgress.completion_status == 1, 1), else_=0)),
            func.sum(case((DailyProgress.completion_status == 0, 1), else_=0)),
            func.sum(case((DailyProgress.completion_status.is_(None), 1), else_=0)),
        ).where(DailyProgress.goal_id.in_(goal_ids)).group_by(DailyProgress.goal_id)
    ).all()
    out = {}
    for gid, done, missed, unmarked in rows:
        done, missed = int(done or 0), int(missed or 0)
        out[gid] = {"completed": done, "not_completed": missed, "unmarked": int(unmarked or 0),
                    "completion_rate": rate(done, missed)}
    return out


def to_out(goal: Goal, progress: dict | None, today: date | None = None) -> dict:
    today = today or date.today()
    open_status = goal.status in ("ACTIVE", "DRAFT", "PAUSED")
    return {
        "id": goal.id, "user_id": goal.user_id, "category_id": goal.category_id,
        "category_name": goal.category.name, "category_color": goal.category.color,
        "title": goal.title, "description": goal.description, "start_date": goal.start_date,
        "end_date": goal.end_date, "importance": goal.importance, "status": goal.status,
        "approval_status": goal.approval_status, "notes": goal.notes, "ai_generated": goal.ai_generated,
        "milestones": goal.milestones,
        "progress": progress or {"completed": 0, "not_completed": 0, "unmarked": 0, "completion_rate": None},
        "is_overdue": open_status and goal.end_date < today,
        "days_remaining": (goal.end_date - today).days,
        "created_at": goal.created_at, "updated_at": goal.updated_at,
    }


def one_out(db: Session, goal: Goal) -> dict:
    return to_out(goal, progress_for(db, [goal.id]).get(goal.id))


def list_goals(
    db: Session, owner_id: uuid.UUID, *, category_id=None, importance=None, status_=None,
    start_from: date | None = None, end_to: date | None = None, search: str | None = None,
    sort: str = "-created_at", page: int = 1, page_size: int = 20,
):
    stmt = select(Goal).where(Goal.user_id == owner_id, Goal.deleted_at.is_(None))
    if category_id:
        stmt = stmt.where(Goal.category_id == category_id)
    if importance:
        stmt = stmt.where(Goal.importance == importance)
    if status_:
        stmt = stmt.where(Goal.status == status_)
    if start_from:
        stmt = stmt.where(Goal.end_date >= start_from)
    if end_to:
        stmt = stmt.where(Goal.start_date <= end_to)
    if search:
        like = f"%{search.lower()}%"
        stmt = stmt.where(or_(func.lower(Goal.title).like(like), func.lower(Goal.description).like(like)))
    weight = case(*[(Goal.importance == k, v) for k, v in IMPORTANCE_WEIGHT.items()], else_=0)
    order = {
        "-created_at": Goal.created_at.desc(), "created_at": Goal.created_at, "end_date": Goal.end_date,
        "-end_date": Goal.end_date.desc(), "importance": weight.desc(), "title": Goal.title,
    }.get(sort, Goal.created_at.desc())
    items, total = paginate(db, stmt.order_by(order, Goal.id), page, page_size)
    prog = progress_for(db, [g.id for g in items])
    return [to_out(g, prog.get(g.id)) for g in items], total


def _apply_milestones(db: Session, goal: Goal, milestones: list[MilestoneIn]) -> None:
    existing = {m.id: m for m in goal.milestones}
    keep = []
    for m in milestones:
        if m.id and m.id in existing:
            row = existing[m.id]
            row.title, row.description, row.due_date = m.title, m.description, m.due_date
            if row.status != m.status:
                row.status = m.status
                row.completed_at = datetime.now(timezone.utc) if m.status == "COMPLETED" else None
        else:
            row = GoalMilestone(title=m.title, description=m.description, due_date=m.due_date, status=m.status)
        keep.append(row)
    goal.milestones[:] = keep


def create_goal(db: Session, user: User, data: GoalIn) -> dict:
    accessible_category(db, user.id, data.category_id)
    if data.ai_generated:
        status_, approval = "DRAFT", "PENDING_REVIEW"
    else:
        status_, approval = data.status or "ACTIVE", "APPROVED"
    goal = Goal(
        user_id=user.id, category_id=data.category_id, title=data.title.strip(), description=data.description,
        start_date=data.start_date, end_date=data.end_date, importance=data.importance, status=status_,
        approval_status=approval, notes=data.notes, ai_generated=data.ai_generated,
    )
    db.add(goal)
    _apply_milestones(db, goal, data.milestones or [])
    db.flush()
    audit(db, user.id, "goal", goal.id, "CREATED", new=_snapshot(goal))
    db.commit()
    db.refresh(goal)
    return one_out(db, goal)


def update_goal(db: Session, user: User, goal_id: uuid.UUID, data: GoalIn) -> dict:
    goal = get_owned_goal(db, user.id, goal_id)
    accessible_category(db, user.id, data.category_id) if data.category_id != goal.category_id else None
    old = _snapshot(goal)
    goal.title, goal.description = data.title.strip(), data.description
    goal.category_id, goal.start_date, goal.end_date = data.category_id, data.start_date, data.end_date
    goal.importance, goal.notes = data.importance, data.notes
    if data.status and data.status != goal.status:
        _set_status(goal, data.status)
    if data.milestones is not None:
        _apply_milestones(db, goal, data.milestones)
    db.flush()
    db.expire(goal, ["category"])
    audit(db, user.id, "goal", goal.id, "UPDATED", old, _snapshot(goal))
    db.commit()
    db.refresh(goal)
    return one_out(db, goal)


def _set_status(goal: Goal, new_status: str) -> None:
    if goal.approval_status != "APPROVED" and new_status not in ("DRAFT", "CANCELLED"):
        raise HTTPException(status.HTTP_409_CONFLICT, "Review and approve this AI-suggested goal first")
    goal.status = new_status
    goal.completed_at = datetime.now(timezone.utc) if new_status == "COMPLETED" else None


def change_status(db: Session, user: User, goal_id: uuid.UUID, new_status: str) -> dict:
    goal = get_owned_goal(db, user.id, goal_id)
    old = goal.status
    _set_status(goal, new_status)
    audit(db, user.id, "goal", goal.id, "STATUS_CHANGED", {"status": old}, {"status": new_status})
    db.commit()
    return one_out(db, goal)


def set_milestone_status(db: Session, user: User, goal_id: uuid.UUID, milestone_id: uuid.UUID, new_status: str) -> dict:
    goal = get_owned_goal(db, user.id, goal_id)
    ms = next((m for m in goal.milestones if m.id == milestone_id), None)
    if ms is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Milestone not found")
    old = ms.status
    ms.status = new_status
    ms.completed_at = datetime.now(timezone.utc) if new_status == "COMPLETED" else None
    audit(db, user.id, "goal", goal.id, "MILESTONE_STATUS", {"milestone": ms.title, "status": old},
          {"milestone": ms.title, "status": new_status})
    db.commit()
    return one_out(db, goal)


def delete_goal(db: Session, user: User, goal_id: uuid.UUID) -> None:
    """Soft delete: progress history and timetable tasks referencing the goal are preserved."""
    goal = get_owned_goal(db, user.id, goal_id)
    goal.deleted_at = datetime.now(timezone.utc)
    if goal.status in ("ACTIVE", "DRAFT", "PAUSED"):
        goal.status = "CANCELLED"
    audit(db, user.id, "goal", goal.id, "DELETED", _snapshot(goal))
    db.commit()


def history(db: Session, owner_id: uuid.UUID, goal_id: uuid.UUID) -> list[AuditLog]:
    get_owned_goal(db, owner_id, goal_id, include_deleted=True)
    return list(db.scalars(
        select(AuditLog).where(AuditLog.entity_type == "goal", AuditLog.entity_id == goal_id)
        .order_by(AuditLog.created_at.desc())
    ))


def approve(db: Session, user: User, goal_id: uuid.UUID, approve_: bool, milestones: list[MilestoneIn] | None) -> dict:
    goal = get_owned_goal(db, user.id, goal_id)
    if goal.approval_status == "APPROVED":
        raise HTTPException(status.HTTP_409_CONFLICT, "This goal is already approved; edit it instead")
    old = _snapshot(goal)
    if approve_:
        if milestones is not None:
            for m in milestones:
                if m.due_date and not (goal.start_date <= m.due_date <= goal.end_date):
                    raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                                        f"Milestone '{m.title}' due date must fall within the goal dates")
            _apply_milestones(db, goal, milestones)
        goal.approval_status, goal.status = "APPROVED", "ACTIVE"
    else:
        goal.approval_status, goal.status = "REJECTED", "CANCELLED"
    audit(db, user.id, "goal", goal.id, "APPROVED" if approve_ else "REJECTED", old, _snapshot(goal))
    db.commit()
    db.refresh(goal)
    return one_out(db, goal)


# ---------------- AI decomposition ----------------

def _fallback_decompose(data: DecomposeIn) -> dict:
    """Deterministic milestone split used when Gemini is unavailable, so the HITL flow still works."""
    start = data.start_date or date.today()
    end = data.end_date or start + timedelta(days=56)
    span = max((end - start).days, 1)
    phases = [
        ("Define success and plan", "Clarify the outcome, gather resources and list the key sub-tasks."),
        ("Build foundations", "Work through the fundamentals needed for this goal."),
        ("Deep practice", "Dedicate focused, regular sessions to the hardest parts."),
        ("Apply and test", "Put the work into practice and measure results against the plan."),
        ("Review and finish", "Close remaining gaps, reflect and mark the goal complete."),
    ]
    ms = []
    for i, (title, desc) in enumerate(phases, start=1):
        due = start + timedelta(days=round(span * i / len(phases)))
        ms.append(SuggestedMilestone(title=title, description=desc, due_date=min(due, end)))
    return {
        "summary": "Gemini is unavailable, so a standard five-phase breakdown was generated. Edit it freely.",
        "suggested_title": data.title, "suggested_description": data.description or "",
        "milestones": ms, "warnings": ["AI service unavailable - showing a template breakdown."],
        "source": "fallback",
    }


def decompose(db: Session, user: User, data: DecomposeIn) -> dict:
    category = accessible_category(db, user.id, data.category_id).name if data.category_id else None
    today = date.today()
    prompt = (
        f"Today is {today.isoformat()}.\nGoal title: {data.title}\nDescription: {data.description or '-'}\n"
        f"Category: {category or '-'}\nStart date: {data.start_date or 'not set'}\n"
        f"End date: {data.end_date or 'not set'}\nExtra instructions: {data.prompt or '-'}"
    )
    try:
        raw = AIDecomposeOutput.model_validate(ai_client.generate_json(DECOMPOSE_SYSTEM, prompt))
    except (ai_client.AIUnavailable, ValueError):
        return _fallback_decompose(data)

    warnings = list(raw.warnings)
    milestones: list[SuggestedMilestone] = []
    for m in raw.milestones[:12]:
        try:
            sm = SuggestedMilestone.model_validate(m)
        except ValueError:
            continue
        if sm.due_date and data.start_date and data.end_date and not (data.start_date <= sm.due_date <= data.end_date):
            sm.due_date = min(max(sm.due_date, data.start_date), data.end_date)
        milestones.append(sm)
    if data.end_date and data.end_date < today:
        warnings.append("The goal's end date has already passed.")
    if not milestones:
        return _fallback_decompose(data)
    return {
        "summary": raw.summary or "Suggested breakdown", "suggested_title": raw.suggested_title or data.title,
        "suggested_description": raw.suggested_description or (data.description or ""),
        "milestones": milestones, "warnings": warnings, "source": "gemini",
    }
