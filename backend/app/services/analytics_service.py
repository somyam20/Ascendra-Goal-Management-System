"""Group-level analytics. Only aggregates are exposed; no private prompts or preferences."""
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models import Category, Goal, GoalMilestone, User
from app.services import progress_service as prog
from app.services.settings_service import get_app_settings
from app.utils.common import monday_of, rate


def period_range(period: str, start: date | None, end: date | None, today: date | None = None) -> tuple[date, date]:
    today = today or date.today()
    if period == "custom":
        if not start or not end or end < start:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Custom range needs a valid start and end")
        if (end - start).days > 366:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Date range cannot exceed one year")
        return start, end
    if period == "daily":
        return today, today
    if period == "monthly":
        return today.replace(day=1), today
    return monday_of(today), today  # weekly (default)


def _users(db: Session) -> list[User]:
    return list(db.scalars(select(User).where(User.is_active.is_(True), User.role == "USER").order_by(User.name)))


def _tally(rows) -> tuple[int, int]:
    done = sum(1 for r in rows if r.completion_status == 1)
    return done, sum(1 for r in rows if r.completion_status == 0)


def summary(db: Session, start: date, end: date) -> dict:
    users = _users(db)
    ids = [u.id for u in users]
    today = date.today()
    goal_counts = dict(db.execute(
        select(Goal.status, func.count(Goal.id)).where(Goal.user_id.in_(ids), Goal.deleted_at.is_(None))
        .group_by(Goal.status)
    ).all()) if ids else {}
    done, missed = _tally(prog.records(db, ids, start, end))
    w_done, w_missed = _tally(prog.records(db, ids, monday_of(today), today))
    m_done, m_missed = _tally(prog.records(db, ids, today.replace(day=1), today))
    return {
        "start": start, "end": end, "total_users": len(users),
        "total_active_goals": goal_counts.get("ACTIVE", 0), "total_completed_goals": goal_counts.get("COMPLETED", 0),
        "total_evaluated_tasks": done + missed, "total_completed_tasks": done,
        "group_completion_rate": rate(done, missed),
        "weekly_completion_rate": rate(w_done, w_missed), "monthly_completion_rate": rate(m_done, m_missed),
    }


def users_comparison(db: Session, start: date, end: date) -> list[dict]:
    users = _users(db)
    ids = [u.id for u in users]
    rows = prog.records(db, ids, start, end)
    per_user = defaultdict(list)
    for r in rows:
        per_user[r.user_id].append(r)
    goal_rows = db.execute(
        select(Goal.user_id,
               func.sum(case((Goal.status == "ACTIVE", 1), else_=0)),
               func.sum(case((Goal.status == "COMPLETED", 1), else_=0)))
        .where(Goal.user_id.in_(ids), Goal.deleted_at.is_(None)).group_by(Goal.user_id)
    ).all() if ids else []
    goals = {uid: (int(a or 0), int(c or 0)) for uid, a, c in goal_rows}
    cons = prog.consistency(db, ids, start, end)
    out = []
    for u in users:
        done, missed = _tally(per_user[u.id])
        cats = prog.by_category(per_user[u.id])
        out.append({
            "user_id": u.id, "name": u.name, "avatar_color": u.avatar_color, "completed": done,
            "not_completed": missed, "evaluated": done + missed, "completion_rate": rate(done, missed),
            "active_goals": goals.get(u.id, (0, 0))[0], "completed_goals": goals.get(u.id, (0, 0))[1],
            "consistency_rate": cons.get(u.id, 0.0),
            "categories": [{"name": c["name"], "color": c["color"], "completion_rate": c["completion_rate"],
                            "evaluated": c["completed"] + c["not_completed"]} for c in cats],
        })
    return out


def leaderboard(db: Session, period: str, today: date | None = None) -> dict:
    """Rank by completion % over a common period. Unmarked tasks are excluded from the denominator,
    and users below the minimum number of evaluated tasks are listed but not ranked."""
    start, end = period_range("monthly" if period == "monthly" else "weekly", None, None, today)
    min_eval = int(get_app_settings(db)["leaderboard_min_evaluated"])
    entries = []
    for u in users_comparison(db, start, end):
        entries.append({
            "user_id": u["user_id"], "name": u["name"], "avatar_color": u["avatar_color"],
            "completion_rate": u["completion_rate"], "evaluated": u["evaluated"], "completed": u["completed"],
            "eligible": u["evaluated"] >= max(min_eval, 1), "rank": None,
        })
    eligible = sorted([e for e in entries if e["eligible"]],
                      key=lambda e: (-(e["completion_rate"] or 0), -e["evaluated"], e["name"]))
    rank, prev = 0, None
    for i, e in enumerate(eligible, start=1):
        key = (e["completion_rate"], e["evaluated"])
        rank = rank if key == prev else i  # ties share a rank
        e["rank"], prev = rank, key
    rest = sorted([e for e in entries if not e["eligible"]], key=lambda e: (-e["evaluated"], e["name"]))
    return {"start": start, "end": end, "min_evaluated": min_eval, "entries": eligible + rest}


def trends(db: Session, granularity: str, start: date | None, end: date | None) -> dict:
    today = date.today()
    defaults = {"daily": 13, "weekly": 7 * 11, "monthly": 365}
    end = end or today
    start = start or end - timedelta(days=defaults.get(granularity, 13))
    if (end - start).days > 731:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Date range too large")
    users = _users(db)
    rows = prog.records(db, [u.id for u in users], start, end)

    def bucket(d: date) -> date:
        if granularity == "weekly":
            return monday_of(d)
        if granularity == "monthly":
            return d.replace(day=1)
        return d

    keys = []
    d = bucket(start)
    while d <= end:
        keys.append(d)
        if granularity == "weekly":
            d += timedelta(days=7)
        elif granularity == "monthly":
            d = (d.replace(day=28) + timedelta(days=4)).replace(day=1)
        else:
            d += timedelta(days=1)
    agg = defaultdict(lambda: [0, 0])
    for r in rows:
        k = bucket(r.activity_date)
        for key in ((k, None), (k, r.user_id)):
            if r.completion_status == 1:
                agg[key][0] += 1
            elif r.completion_status == 0:
                agg[key][1] += 1
    fmt = {"daily": "%d %b", "weekly": "W/c %d %b", "monthly": "%b %Y"}[granularity if granularity in ("weekly", "monthly") else "daily"]
    series = [{
        "bucket": k, "label": k.strftime(fmt), "group_rate": rate(*agg[(k, None)]),
        "users": {str(u.id): rate(*agg[(k, u.id)]) for u in users},
    } for k in keys]
    return {"granularity": granularity, "users": [{"user_id": u.id, "name": u.name, "avatar_color": u.avatar_color}
                                                   for u in users], "series": series}


def categories(db: Session, start: date, end: date) -> list[dict]:
    users = _users(db)
    ids = [u.id for u in users]
    rows = prog.records(db, ids, start, end)
    agg: dict = {}
    for r in rows:
        a = agg.setdefault(r.name, {"category_name": r.name, "color": r.color, "completed": 0, "not_completed": 0,
                                    "active_goals": 0})
        if r.completion_status == 1:
            a["completed"] += 1
        elif r.completion_status == 0:
            a["not_completed"] += 1
    if ids:
        for name, color, n in db.execute(
            select(Category.name, Category.color, func.count(Goal.id)).join(Goal, Goal.category_id == Category.id)
            .where(Goal.user_id.in_(ids), Goal.status == "ACTIVE", Goal.deleted_at.is_(None))
            .group_by(Category.name, Category.color)
        ):
            a = agg.setdefault(name, {"category_name": name, "color": color, "completed": 0, "not_completed": 0,
                                      "active_goals": 0})
            a["active_goals"] += n
    out = list(agg.values())
    for a in out:
        a["completion_rate"] = rate(a["completed"], a["not_completed"])
    return sorted(out, key=lambda a: a["category_name"])


def upcoming_deadlines(db: Session, days: int) -> list[dict]:
    today = date.today()
    users = {u.id: u for u in _users(db)}
    if not users:
        return []
    goals = db.scalars(select(Goal).where(
        Goal.user_id.in_(list(users)), Goal.deleted_at.is_(None), Goal.status == "ACTIVE",
        Goal.end_date >= today, Goal.end_date <= today + timedelta(days=days),
    ).order_by(Goal.end_date)).unique().all()
    return [{
        "goal_id": g.id, "title": g.title, "user_id": g.user_id, "user_name": users[g.user_id].name,
        "avatar_color": users[g.user_id].avatar_color, "category_name": g.category.name,
        "category_color": g.category.color, "end_date": g.end_date, "days_remaining": (g.end_date - today).days,
        "importance": g.importance,
    } for g in goals]


def achievements(db: Session, limit: int = 12) -> list[dict]:
    users = {u.id: u for u in _users(db)}
    if not users:
        return []
    since = datetime.now(timezone.utc) - timedelta(days=60)
    out = []
    for g in db.scalars(select(Goal).where(Goal.user_id.in_(list(users)), Goal.status == "COMPLETED",
                                           Goal.deleted_at.is_(None), Goal.completed_at >= since)).unique():
        u = users[g.user_id]
        out.append({"user_name": u.name, "avatar_color": u.avatar_color, "title": g.title,
                    "kind": "GOAL_COMPLETED", "completed_at": g.completed_at})
    for m, uid in db.execute(select(GoalMilestone, Goal.user_id).join(Goal, Goal.id == GoalMilestone.goal_id).where(
            Goal.user_id.in_(list(users)), GoalMilestone.status == "COMPLETED", Goal.deleted_at.is_(None),
            GoalMilestone.completed_at >= since)):
        u = users[uid]
        out.append({"user_name": u.name, "avatar_color": u.avatar_color, "title": m.title,
                    "kind": "MILESTONE_COMPLETED", "completed_at": m.completed_at})

    def _key(a):
        ts = a["completed_at"]
        return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
    return sorted(out, key=_key, reverse=True)[:limit]
