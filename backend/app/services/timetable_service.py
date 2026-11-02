import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import Approval, Goal, Timetable, TimetableTask, User
from app.repositories.base import get_owned_timetable
from app.schemas.planning import TaskInput
from app.services import ai_planning_service as planner, preference_service as pref_svc, scheduling_service as sched
from app.utils.common import audit, not_found

PUBLIC_STATUSES = ("APPROVED", "ARCHIVED")


def task_out(t: TimetableTask) -> dict:
    g = t.goal
    return {
        "id": t.id, "timetable_id": t.timetable_id, "goal_id": t.goal_id, "goal_title": g.title,
        "category_id": g.category_id, "category_name": g.category.name, "category_color": g.category.color,
        "task_type": t.task_type, "title": t.title, "description": t.description,
        "scheduled_date": t.scheduled_date, "start_time": t.start_time, "end_time": t.end_time,
        "importance": g.importance, "status": t.status,
    }


def timetable_out(tt: Timetable, with_tasks: bool = True) -> dict:
    return {
        "id": tt.id, "user_id": tt.user_id, "planning_request_id": tt.planning_request_id,
        "week_start": tt.week_start, "week_end": tt.week_end, "version": tt.version, "status": tt.status,
        "approved_at": tt.approved_at, "created_at": tt.created_at, "planning_summary": tt.planning_summary,
        "warnings": tt.warnings or [], "source": tt.source, "task_count": len(tt.tasks),
        "tasks": [task_out(t) for t in tt.tasks] if with_tasks else [],
    }


def list_timetables(db: Session, owner_id: uuid.UUID, *, is_self: bool, status_: str | None) -> list[Timetable]:
    stmt = select(Timetable).where(Timetable.user_id == owner_id)
    if not is_self:
        stmt = stmt.where(Timetable.status.in_(PUBLIC_STATUSES))
    if status_:
        stmt = stmt.where(Timetable.status == status_)
    return list(db.scalars(stmt.order_by(Timetable.week_start.desc(), Timetable.version.desc())))


def get_viewable(db: Session, owner_id: uuid.UUID, timetable_id: uuid.UUID, *, is_self: bool) -> Timetable:
    tt = get_owned_timetable(db, owner_id, timetable_id)
    if not is_self and tt.status not in PUBLIC_STATUSES:
        raise not_found("Timetable")
    return tt


def active_timetable(db: Session, owner_id: uuid.UUID) -> Timetable | None:
    today = planner.user_today(db, owner_id)
    current = db.scalar(select(Timetable).where(
        Timetable.user_id == owner_id, Timetable.status == "APPROVED",
        Timetable.week_start <= today, Timetable.week_end >= today,
    ).order_by(Timetable.version.desc()).limit(1))
    if current:
        return current
    return db.scalar(select(Timetable).where(Timetable.user_id == owner_id, Timetable.status == "APPROVED")
                     .order_by(Timetable.week_start.desc(), Timetable.version.desc()).limit(1))


def _goals_for(db: Session, user_id: uuid.UUID, goal_ids: set[uuid.UUID]) -> dict[uuid.UUID, Goal]:
    if not goal_ids:
        return {}
    rows = db.scalars(select(Goal).where(Goal.id.in_(goal_ids), Goal.user_id == user_id,
                                         Goal.deleted_at.is_(None))).unique().all()
    return {g.id: g for g in rows}


def validate(db: Session, user: User, tt: Timetable, tasks: list[TaskInput]) -> tuple[list[str], list[str]]:
    goals = _goals_for(db, user.id, {t.goal_id for t in tasks})
    for t in tasks:
        g = goals.get(t.goal_id)
        if g is not None and (g.status not in ("ACTIVE", "PAUSED") or g.approval_status != "APPROVED"):
            goals.pop(t.goal_id)
    prefs = pref_svc.get_prefs(db, user.id)
    specs = [sched.TaskSpec(t.goal_id, t.title, t.scheduled_date, t.start_time, t.end_time) for t in tasks]
    conflicts, warnings = sched.validate_tasks(
        specs, prefs, pref_svc.list_activities(db, user.id), goals, tt.week_start, tt.week_end)
    used: dict = {}
    names = {}
    for t in tasks:
        g = goals.get(t.goal_id)
        if g:
            used[g.category_id] = used.get(g.category_id, 0) + (
                t.end_time.hour * 60 + t.end_time.minute - t.start_time.hour * 60 - t.start_time.minute)
            names[g.category_id] = g.category.name
    warnings += sched.check_budgets(used, pref_svc.budget_map(db, user.id), names)
    return conflicts, warnings


def _raise_conflicts(conflicts: list[str]) -> None:
    raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                        {"message": "The timetable has scheduling conflicts.", "conflicts": conflicts})


def _next_version(db: Session, user_id, week_start) -> int:
    return (db.scalar(select(func.max(Timetable.version)).where(
        Timetable.user_id == user_id, Timetable.week_start == week_start)) or 0) + 1


def save_draft(db: Session, user: User, tt: Timetable, tasks: list[TaskInput], *, rescheduled: set | None = None) -> Timetable:
    conflicts, warnings = validate(db, user, tt, tasks)
    if conflicts:
        _raise_conflicts(conflicts)
    rescheduled = rescheduled or set()
    if tt.status == "DRAFT":
        target = tt
        existing = {t.id: t for t in tt.tasks}
        old_count = len(existing)
    else:
        # Approved/rejected/archived versions are immutable: edits always create a new draft version.
        target = Timetable(
            user_id=user.id, planning_request_id=tt.planning_request_id, parent_id=tt.id,
            week_start=tt.week_start, week_end=tt.week_end, version=_next_version(db, user.id, tt.week_start),
            status="DRAFT", planning_summary=tt.planning_summary, source=tt.source,
        )
        db.add(target)
        existing, old_count = {}, len(tt.tasks)
    new_tasks = []
    for t in tasks:
        row = existing.get(t.id) if t.id else None
        if row is None:
            original = next((o for o in tt.tasks if o.id == t.id), None) if t.id else None
            row = TimetableTask(task_type=original.task_type if original else "MANUAL")
        row.goal_id, row.title, row.description = t.goal_id, t.title.strip(), t.description
        row.scheduled_date, row.start_time, row.end_time = t.scheduled_date, t.start_time, t.end_time
        row.status = "RESCHEDULED" if t.id in rescheduled else (row.status or "PLANNED")
        new_tasks.append(row)
    target.tasks[:] = new_tasks
    target.warnings = warnings
    db.flush()
    audit(db, user.id, "timetable", target.id, "DRAFT_SAVED" if target is tt else "NEW_VERSION",
          {"version": tt.version, "tasks": old_count}, {"version": target.version, "tasks": len(new_tasks)})
    db.commit()
    db.refresh(target)
    return target


def reschedule(db: Session, user: User, tt: Timetable, task_id: uuid.UUID, data) -> Timetable:
    if not any(t.id == task_id for t in tt.tasks):
        raise not_found("Task")
    tasks = []
    for t in tt.tasks:
        moved = t.id == task_id
        tasks.append(TaskInput(
            id=t.id, goal_id=t.goal_id, title=t.title, description=t.description,
            scheduled_date=data.scheduled_date if moved else t.scheduled_date,
            start_time=data.start_time if moved else t.start_time,
            end_time=data.end_time if moved else t.end_time,
        ))
    return save_draft(db, user, tt, tasks, rescheduled={task_id})


def regenerate(db: Session, user: User, tt: Timetable, prompt: str | None) -> Timetable:
    base_prompt = prompt
    if base_prompt is None and tt.planning_request_id:
        prev = db.get(planner.PlanningRequest, tt.planning_request_id)
        base_prompt = prev.user_prompt if prev else ""
    req = planner.create_request(db, user, base_prompt or "", tt.week_start)
    return planner.generate(db, user, req, parent=tt)


def _review(db: Session, user: User, tt: Timetable, new_status: str, comments: str | None) -> None:
    db.add(Approval(timetable_id=tt.id, user_id=user.id, status=new_status, comments=comments,
                    reviewed_at=datetime.now(timezone.utc)))


def approve(db: Session, user: User, tt: Timetable, comments: str | None) -> Timetable:
    if tt.status != "DRAFT":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Only drafts can be approved (this version is {tt.status}).")
    if not tt.tasks:
        raise HTTPException(status.HTTP_409_CONFLICT, "Add at least one task before approving.")
    inputs = [TaskInput(id=t.id, goal_id=t.goal_id, title=t.title, description=t.description,
                        scheduled_date=t.scheduled_date, start_time=t.start_time, end_time=t.end_time) for t in tt.tasks]
    conflicts, _ = validate(db, user, tt, inputs)
    if conflicts:
        _raise_conflicts(conflicts)
    for other in db.scalars(select(Timetable).where(
        Timetable.user_id == user.id, Timetable.week_start == tt.week_start, Timetable.id != tt.id,
        or_(Timetable.status == "APPROVED", Timetable.status == "DRAFT"),
    )):
        old = other.status
        other.status = "ARCHIVED" if old == "APPROVED" else "REJECTED"
        audit(db, user.id, "timetable", other.id, "SUPERSEDED", {"status": old}, {"status": other.status})
    tt.status, tt.approved_at = "APPROVED", datetime.now(timezone.utc)
    _review(db, user, tt, "APPROVED", comments)
    audit(db, user.id, "timetable", tt.id, "APPROVED", {"status": "DRAFT"}, {"status": "APPROVED"})
    db.commit()
    return tt


def reject(db: Session, user: User, tt: Timetable, comments: str | None) -> Timetable:
    if tt.status != "DRAFT":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only drafts can be rejected.")
    tt.status = "REJECTED"
    _review(db, user, tt, "REJECTED", comments)
    audit(db, user.id, "timetable", tt.id, "REJECTED", {"status": "DRAFT"}, {"status": "REJECTED", "comments": comments})
    db.commit()
    return tt
