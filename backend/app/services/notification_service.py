"""Deterministic, database-driven notifications. Gemini may only reword the final message."""
import logging
import uuid
from datetime import date, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Goal, Notification, User
from app.prompts.templates import MOTIVATION_SYSTEM
from app.repositories.base import active_goals
from app.services import ai_client, preference_service as pref_svc, progress_service as prog
from app.services.goal_service import progress_for
from app.services.settings_service import get_app_settings
from app.utils.common import local_now, monday_of, not_found, paginate

log = logging.getLogger(__name__)


def list_notifications(db: Session, user_id: uuid.UUID, unread_only: bool, page: int, page_size: int) -> dict:
    stmt = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))
    items, total = paginate(db, stmt.order_by(Notification.created_at.desc()), page, page_size)
    unread = db.scalar(select(func.count(Notification.id)).where(
        Notification.user_id == user_id, Notification.is_read.is_(False))) or 0
    return {"items": items, "total": total, "page": page, "page_size": page_size, "unread_count": unread}


def mark_read(db: Session, user_id: uuid.UUID, notification_id: uuid.UUID) -> Notification:
    n = db.get(Notification, notification_id)
    if n is None or n.user_id != user_id:
        raise not_found("Notification")
    n.is_read = True
    db.commit()
    return n


def mark_all_read(db: Session, user_id: uuid.UUID) -> None:
    db.execute(update(Notification).where(Notification.user_id == user_id, Notification.is_read.is_(False))
               .values(is_read=True))
    db.commit()


def _brief(g: Goal, today: date, rate_: float | None) -> dict:
    return {"id": g.id, "title": g.title, "end_date": g.end_date, "category_name": g.category.name,
            "category_color": g.category.color, "importance": g.importance,
            "days_remaining": (g.end_date - today).days, "completion_rate": rate_}


def pending_goals(db: Session, user_id: uuid.UUID) -> dict:
    today = local_now(pref_svc.get_prefs(db, user_id).timezone).date()
    goals = active_goals(db, user_id)
    rates = progress_for(db, [g.id for g in goals])
    out = {"due_today": [], "overdue": [], "approaching": [], "at_risk": []}
    for g in goals:
        r = rates.get(g.id, {}).get("completion_rate")
        b = _brief(g, today, r)
        if g.end_date == today:
            out["due_today"].append(b)
        elif g.end_date < today:
            out["overdue"].append(b)
        elif g.end_date <= today + timedelta(days=7):
            out["approaching"].append(b)
        # At risk: past half of its timeline with a weak completion record, or near deadline with none.
        total_days = max((g.end_date - g.start_date).days, 1)
        elapsed = (today - g.start_date).days / total_days
        if g.end_date >= today and ((elapsed > 0.5 and r is not None and r < 50) or
                                    (g.end_date <= today + timedelta(days=3) and r is None)):
            out["at_risk"].append(b)
    items = prog.daily_items(db, user_id, today, today)
    out["pending_tasks_today"] = [i for i in items if i["completion_status"] is None]
    return out


TEMPLATES = {
    "POSITIVE": {
        "daily": "Good morning! You have {tasks} activities planned today across {goals} active goals. {deadline}You've got this!",
        "evening": "Nice work today: {done} completed. {unmarked} item(s) are still unmarked - log them when you can.",
        "weekly": "You completed {rate} of your evaluated activities this week ({done}/{evaluated}). {focus}Keep the momentum going!",
    },
    "STRICT": {
        "daily": "Today you have {tasks} planned activities and {goals} active goals. {deadline}Block the time and get them done.",
        "evening": "{done} completed, {missed} not done, {unmarked} not reported. Report every activity and address what slipped.",
        "weekly": "Weekly completion: {rate} ({done}/{evaluated}). {focus}Review your priorities and make time for the remaining work.",
    },
    "BALANCED": {
        "daily": "Today: {tasks} planned activities across {goals} active goals. {deadline}Pace yourself and take breaks.",
        "evening": "Today so far: {done} done, {missed} not done, {unmarked} still to mark. Steady progress counts.",
        "weekly": "You reached {rate} completion this week ({done}/{evaluated} evaluated). {focus}A small adjustment next week will help.",
    },
}


def _reword(db: Session, style: str, message: str) -> str:
    if not get_app_settings(db)["ai_enabled"] or not ai_client.is_configured():
        return message
    try:
        out = ai_client.generate_json(MOTIVATION_SYSTEM, f"Style: {style}\nMessage: {message}", temperature=0.7)
        text = str(out.get("message", "")).strip()
        return text if 10 < len(text) < 400 else message
    except ai_client.AIUnavailable:
        return message


def _create(db: Session, user_id, ntype: str, title: str, message: str, dedupe: str | None) -> Notification | None:
    if dedupe and db.scalar(select(Notification.id).where(Notification.user_id == user_id,
                                                           Notification.dedupe_key == dedupe)):
        return None
    n = Notification(user_id=user_id, notification_type=ntype, title=title, message=message, dedupe_key=dedupe)
    db.add(n)
    try:
        db.commit()
    except IntegrityError:  # another worker created it concurrently
        db.rollback()
        return None
    return n


def generate(db: Session, user: User, kind: str, *, reword: bool = True) -> list[Notification]:
    prefs = pref_svc.get_prefs(db, user.id)
    style = prefs.feedback_style
    today = local_now(prefs.timezone).date()
    created: list[Notification | None] = []
    pending = pending_goals(db, user.id)
    tpl = TEMPLATES.get(style, TEMPLATES["BALANCED"])

    def say(text: str) -> str:
        return _reword(db, style, text) if reword else text

    if kind == "DAILY":
        items = prog.daily_items(db, user.id, today, today)
        deadline = ""
        if pending["due_today"]:
            deadline = f"'{pending['due_today'][0]['title']}' is due today. "
        elif pending["approaching"]:
            g = pending["approaching"][0]
            deadline = f"'{g['title']}' is due in {g['days_remaining']} day(s). "
        msg = tpl["daily"].format(tasks=sum(1 for i in items if i["kind"] == "TASK"),
                                  goals=len(active_goals(db, user.id)), deadline=deadline)
        created.append(_create(db, user.id, "DAILY_REMINDER", "Your plan for today", say(msg), f"daily:{today}"))
        for g in pending["overdue"][:3]:
            created.append(_create(db, user.id, "OVERDUE", "Goal overdue",
                                   f"'{g['title']}' passed its end date ({g['end_date']}). Update its dates or status.",
                                   f"overdue:{g['id']}:{today}"))
        for g in pending["at_risk"][:3]:
            created.append(_create(db, user.id, "AT_RISK", "Goal needs attention",
                                   f"'{g['title']}' is at risk: {g['days_remaining']} day(s) left.",
                                   f"risk:{g['id']}:{monday_of(today)}"))
    elif kind == "EVENING":
        s = prog.daily(db, user.id, today)["summary"]
        msg = tpl["evening"].format(done=s["completed"], missed=s["not_completed"], unmarked=s["unmarked"])
        created.append(_create(db, user.id, "DAILY_SUMMARY", "Today's progress", say(msg), f"evening:{today}"))
    elif kind == "WEEKLY":
        ws = monday_of(today)
        w = prog.weekly(db, user.id, ws)
        s = w["summary"]
        evaluated = s["completed"] + s["not_completed"]
        weak = [c for c in w["categories"] if c["completion_rate"] is not None and c["completion_rate"] < 60]
        focus = f"Focus area: {weak[0]['name']} ({weak[0]['completion_rate']:.0f}%). " if weak else ""
        rate_txt = f"{s['completion_rate']:.0f}%" if s["completion_rate"] is not None else "no evaluated"
        msg = tpl["weekly"].format(rate=rate_txt, done=s["completed"], evaluated=evaluated, focus=focus)
        created.append(_create(db, user.id, "WEEKLY_REVIEW", "Your weekly review", say(msg), f"weekly:{ws}"))
        attention = pending["at_risk"] + pending["approaching"]
        if attention:
            names = ", ".join(g["title"] for g in attention[:3])
            created.append(_create(db, user.id, "WEEKLY_SUGGESTION", "Plan for next week",
                                   f"Next week, prioritise: {names}. Consider generating a fresh timetable.",
                                   f"suggest:{ws}"))
    else:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown notification kind")
    return [n for n in created if n is not None]
