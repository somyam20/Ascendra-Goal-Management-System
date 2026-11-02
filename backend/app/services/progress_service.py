import uuid
from collections import defaultdict
from datetime import date, timedelta

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Category, DailyProgress, Goal, Timetable, TimetableTask, User
from app.repositories.base import get_owned_goal
from app.schemas.misc import ProgressIn
from app.services.ai_planning_service import user_today
from app.utils.common import audit, monday_of, not_found, rate


def _summary(statuses: list[int | None]) -> dict:
    done = sum(1 for s in statuses if s == 1)
    missed = sum(1 for s in statuses if s == 0)
    return {"total": len(statuses), "completed": done, "not_completed": missed,
            "unmarked": len(statuses) - done - missed, "completion_rate": rate(done, missed)}


def daily_items(db: Session, owner_id: uuid.UUID, day: date, today: date | None = None) -> list[dict]:
    today = today or user_today(db, owner_id)
    records = db.scalars(select(DailyProgress).where(
        DailyProgress.user_id == owner_id, DailyProgress.activity_date == day)).all()
    by_task = {r.task_id: r for r in records if r.task_id}
    by_goal = {r.goal_id: r for r in records if r.task_id is None}

    tasks = list(db.scalars(
        select(TimetableTask).join(Timetable, Timetable.id == TimetableTask.timetable_id).where(
            Timetable.user_id == owner_id, TimetableTask.scheduled_date == day, Timetable.status == "APPROVED")
    ).unique().all())
    # Preserve history: tasks from superseded versions that were already tracked still appear.
    seen = {t.id for t in tasks}
    extra_ids = [tid for tid in by_task if tid not in seen]
    if extra_ids:
        tasks += list(db.scalars(select(TimetableTask).where(TimetableTask.id.in_(extra_ids))).unique().all())

    items = []
    for t in sorted(tasks, key=lambda x: x.start_time):
        g = t.goal
        rec = by_task.get(t.id)
        items.append({
            "key": f"task:{t.id}", "kind": "TASK", "goal_id": g.id, "goal_title": g.title,
            "category_id": g.category_id, "category_name": g.category.name, "category_color": g.category.color,
            "task_id": t.id, "title": t.title, "description": t.description,
            "start_time": t.start_time.strftime("%H:%M"), "end_time": t.end_time.strftime("%H:%M"),
            "importance": g.importance, "activity_date": day,
            "progress_id": rec.id if rec else None, "completion_status": rec.completion_status if rec else None,
            "is_past": day < today,
        })

    goals = list(db.scalars(select(Goal).where(
        Goal.user_id == owner_id, Goal.deleted_at.is_(None), Goal.status == "ACTIVE",
        Goal.approval_status == "APPROVED", Goal.start_date <= day, Goal.end_date >= day,
    )).unique().all())
    goal_ids = {g.id for g in goals}
    missing = [gid for gid in by_goal if gid not in goal_ids]
    if missing:
        goals += list(db.scalars(select(Goal).where(Goal.id.in_(missing))).unique().all())
    for g in sorted(goals, key=lambda x: (x.end_date, x.title)):
        rec = by_goal.get(g.id)
        items.append({
            "key": f"goal:{g.id}", "kind": "GOAL", "goal_id": g.id, "goal_title": g.title,
            "category_id": g.category_id, "category_name": g.category.name, "category_color": g.category.color,
            "task_id": None, "title": g.title, "description": g.description, "start_time": None, "end_time": None,
            "importance": g.importance, "activity_date": day,
            "progress_id": rec.id if rec else None, "completion_status": rec.completion_status if rec else None,
            "is_past": day < today,
        })
    return items


def daily(db: Session, owner_id: uuid.UUID, day: date | None) -> dict:
    today = user_today(db, owner_id)
    day = day or today
    items = daily_items(db, owner_id, day, today)
    return {"date": day, "items": items, "summary": _summary([i["completion_status"] for i in items])}


def upsert(db: Session, user: User, data: ProgressIn) -> DailyProgress:
    today = user_today(db, user.id)
    if data.activity_date > today and data.completion_status is not None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "You cannot evaluate a future date")
    goal = get_owned_goal(db, user.id, data.goal_id, include_deleted=True)
    if data.task_id:
        task = db.get(TimetableTask, data.task_id)
        tt = db.get(Timetable, task.timetable_id) if task else None
        if task is None or tt is None or tt.user_id != user.id:
            raise not_found("Task")
        if task.goal_id != goal.id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Task does not belong to this goal")
        if task.scheduled_date != data.activity_date:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Task is not scheduled on this date")
    elif goal.deleted_at:
        raise not_found("Goal")

    cond = [DailyProgress.user_id == user.id, DailyProgress.goal_id == goal.id,
            DailyProgress.activity_date == data.activity_date]
    cond.append(DailyProgress.task_id == data.task_id if data.task_id else DailyProgress.task_id.is_(None))

    for attempt in range(2):
        rec = db.scalar(select(DailyProgress).where(and_(*cond)).with_for_update())
        old = rec.completion_status if rec else None
        if rec is None:
            rec = DailyProgress(user_id=user.id, goal_id=goal.id, task_id=data.task_id,
                                activity_date=data.activity_date, completion_status=data.completion_status)
            db.add(rec)
        else:
            rec.completion_status = data.completion_status
        try:
            db.flush()
        except IntegrityError:
            # A concurrent request inserted the same record first; retry as an update.
            db.rollback()
            if attempt:
                raise
            continue
        if old != data.completion_status or attempt == 0:
            audit(db, user.id, "progress", rec.id, "STATUS_CHANGED",
                  {"completion_status": old}, {"completion_status": data.completion_status,
                                                "date": data.activity_date, "goal_id": goal.id})
        db.commit()
        return rec
    raise HTTPException(status.HTTP_409_CONFLICT, "Could not save progress, please retry")


def update(db: Session, user: User, progress_id: uuid.UUID, completion_status: int | None) -> DailyProgress:
    rec = db.get(DailyProgress, progress_id)
    if rec is None or rec.user_id != user.id:
        raise not_found("Progress record")
    if rec.activity_date > user_today(db, user.id) and completion_status is not None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "You cannot evaluate a future date")
    old = rec.completion_status
    rec.completion_status = completion_status
    audit(db, user.id, "progress", rec.id, "STATUS_CHANGED", {"completion_status": old},
          {"completion_status": completion_status})
    db.commit()
    return rec


# ---------------- aggregates (pure SQL/Python, never the LLM) ----------------

def records(db: Session, user_ids: list[uuid.UUID], start: date, end: date):
    """Rows of (user_id, goal_id, category_id, category_name, color, activity_date, completion_status)."""
    if not user_ids:
        return []
    return db.execute(
        select(DailyProgress.user_id, DailyProgress.goal_id, Goal.category_id, Category.name, Category.color,
               DailyProgress.activity_date, DailyProgress.completion_status)
        .join(Goal, Goal.id == DailyProgress.goal_id).join(Category, Category.id == Goal.category_id)
        .where(DailyProgress.user_id.in_(user_ids), DailyProgress.activity_date >= start,
               DailyProgress.activity_date <= end)
    ).all()


def by_day(rows, start: date, end: date) -> list[dict]:
    buckets = defaultdict(list)
    for r in rows:
        buckets[r.activity_date].append(r.completion_status)
    out = []
    d = start
    while d <= end:
        out.append({"date": d, **_summary(buckets.get(d, []))})
        d += timedelta(days=1)
    return out


def by_category(rows) -> list[dict]:
    agg: dict = {}
    for r in rows:
        a = agg.setdefault(r.category_id, {"category_id": r.category_id, "name": r.name, "color": r.color,
                                           "completed": 0, "not_completed": 0})
        if r.completion_status == 1:
            a["completed"] += 1
        elif r.completion_status == 0:
            a["not_completed"] += 1
    out = list(agg.values())
    for a in out:
        a["completion_rate"] = rate(a["completed"], a["not_completed"])
    return sorted(out, key=lambda a: a["name"])


def by_goal(db: Session, rows) -> list[dict]:
    agg: dict = {}
    for r in rows:
        a = agg.setdefault(r.goal_id, [0, 0])
        if r.completion_status == 1:
            a[0] += 1
        elif r.completion_status == 0:
            a[1] += 1
    titles = dict(db.execute(select(Goal.id, Goal.title).where(Goal.id.in_(list(agg)))).all()) if agg else {}
    return [{"goal_id": gid, "title": titles.get(gid, "Goal"), "completed": c, "not_completed": n,
             "completion_rate": rate(c, n)} for gid, (c, n) in agg.items()]


def weekly(db: Session, owner_id: uuid.UUID, week_start: date | None) -> dict:
    today = user_today(db, owner_id)
    ws = monday_of(week_start or today)
    we = ws + timedelta(days=6)
    days, all_status = [], []
    for i in range(7):
        d = ws + timedelta(days=i)
        statuses = [it["completion_status"] for it in daily_items(db, owner_id, d, today)]
        all_status += statuses
        days.append({"date": d, **_summary(statuses)})
    rows = records(db, [owner_id], ws, we)
    return {"week_start": ws, "week_end": we, "days": days, "summary": _summary(all_status),
            "categories": by_category(rows), "goals": by_goal(db, rows)}


def history(db: Session, owner_id: uuid.UUID, start: date | None, end: date | None) -> dict:
    end = end or user_today(db, owner_id)
    start = start or end - timedelta(days=29)
    if (end - start).days > 366:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Date range cannot exceed one year")
    return {"days": by_day(records(db, [owner_id], start, end), start, end)}


def streaks(db: Session, owner_id: uuid.UUID) -> dict:
    today = user_today(db, owner_id)
    active = set(db.scalars(select(DailyProgress.activity_date).where(
        DailyProgress.user_id == owner_id, DailyProgress.completion_status == 1).distinct()))
    current = 0
    d = today if today in active else today - timedelta(days=1)
    while d in active:
        current += 1
        d -= timedelta(days=1)
    longest = run = 0
    prev = None
    for day in sorted(active):
        run = run + 1 if prev and (day - prev).days == 1 else 1
        longest = max(longest, run)
        prev = day
    last30 = sum(1 for i in range(30) if today - timedelta(days=i) in active)
    return {"current_streak": current, "longest_streak": longest,
            "consistency_rate": round(100 * last30 / 30, 1), "active_days_30": last30}


def consistency(db: Session, user_ids: list[uuid.UUID], start: date, end: date) -> dict[uuid.UUID, float]:
    days = (end - start).days + 1
    out = {uid: 0.0 for uid in user_ids}
    if not user_ids:
        return out
    rows = db.execute(select(DailyProgress.user_id, DailyProgress.activity_date).where(
        DailyProgress.user_id.in_(user_ids), DailyProgress.completion_status == 1,
        DailyProgress.activity_date >= start, DailyProgress.activity_date <= end).distinct()).all()
    counts = defaultdict(int)
    for uid, _ in rows:
        counts[uid] += 1
    for uid in user_ids:
        out[uid] = round(100 * counts[uid] / days, 1)
    return out


def analytics(db: Session, owner_id: uuid.UUID, start: date | None, end: date | None) -> dict:
    end = end or user_today(db, owner_id)
    start = start or end - timedelta(days=29)
    rows = records(db, [owner_id], start, end)
    daily_rows = by_day(rows, start, end)
    weeks: dict = {}
    for d in daily_rows:
        w = weeks.setdefault(monday_of(d["date"]), [0, 0])
        w[0] += d["completed"]
        w[1] += d["not_completed"]
    status_counts = defaultdict(int)
    for s in db.scalars(select(Goal.status).where(Goal.user_id == owner_id, Goal.deleted_at.is_(None))):
        status_counts[s] += 1
    return {
        "summary": _summary([r.completion_status for r in rows]),
        "categories": by_category(rows),
        "daily": daily_rows,
        "weekly": [{"week_start": k, "completed": c, "not_completed": n, "completion_rate": rate(c, n)}
                   for k, (c, n) in sorted(weeks.items())],
        "goal_status_counts": dict(status_counts),
        "goals": by_goal(db, rows),
    }
