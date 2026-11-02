"""AI planning workflow: context assembly -> Gemini decomposition -> validation -> deterministic scheduling
-> DRAFT timetable. Gemini output is never written to the database without validation."""
import json
import logging
import uuid
from datetime import date, timedelta

from fastapi import HTTPException, status
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import PlanningRequest, Timetable, TimetableTask, User
from app.prompts.templates import PLANNER_SYSTEM
from app.repositories.base import active_goals
from app.schemas.planning import AIPlanOutput
from app.services import ai_client, preference_service as pref_svc, scheduling_service as sched
from app.services.settings_service import get_app_settings
from app.utils.common import WEEKDAY_NAMES, audit, default_planning_week, fmt_time, jsonable, local_now, monday_of, not_found

log = logging.getLogger(__name__)
DEFAULT_SESSIONS = {"CRITICAL": 5, "HIGH": 4, "MEDIUM": 3, "LOW": 2}


def user_today(db: Session, user_id: uuid.UUID) -> date:
    return local_now(pref_svc.get_prefs(db, user_id).timezone).date()


def create_request(db: Session, user: User, prompt: str, week_start: date | None) -> PlanningRequest:
    today = user_today(db, user.id)
    week = monday_of(week_start) if week_start else default_planning_week(today)
    if week + timedelta(days=6) < today:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Cannot plan a week that has already ended")
    req = PlanningRequest(user_id=user.id, user_prompt=prompt.strip(), week_start=week, status="PENDING")
    db.add(req)
    db.flush()
    audit(db, user.id, "planning_request", req.id, "CREATED", new={"week_start": week, "prompt": prompt})
    db.commit()
    return req


def get_request(db: Session, user_id: uuid.UUID, request_id: uuid.UUID) -> PlanningRequest:
    req = db.get(PlanningRequest, request_id)
    if req is None or req.user_id != user_id:
        raise not_found("Planning request")
    return req


def request_out(db: Session, req: PlanningRequest) -> dict:
    tt_id = db.scalar(select(Timetable.id).where(Timetable.planning_request_id == req.id)
                      .order_by(Timetable.version.desc()).limit(1))
    return {"id": req.id, "user_prompt": req.user_prompt, "status": req.status, "week_start": req.week_start,
            "error": req.error, "timetable_id": tt_id, "created_at": req.created_at}


def _context(goals, prefs, activities, budgets_list, avail, week_start, prompt) -> str:
    ctx = {
        "planning_week": {"monday": week_start, "sunday": week_start + timedelta(days=6)},
        "user_request": prompt or "Create a balanced plan for my active goals.",
        "goals": [{
            "goal_id": str(g.id), "title": g.title, "description": g.description, "category": g.category.name,
            "category_id": str(g.category_id), "start_date": g.start_date, "end_date": g.end_date,
            "importance": g.importance,
            "pending_milestones": [m.title for m in g.milestones if m.status == "PENDING"][:6],
        } for g in goals],
        "category_weekly_budget_hours": {b["category_name"]: b["hours_per_week"] for b in budgets_list},
        "sleep": {"wake_time": fmt_time(prefs.wake_time), "sleep_time": fmt_time(prefs.sleep_time)},
        "preferred_working_hours": [fmt_time(prefs.preferred_working_start), fmt_time(prefs.preferred_working_end)],
        "max_productive_hours_per_day": prefs.max_productive_hours,
        "preferred_session_minutes": prefs.preferred_task_minutes,
        "break_minutes_between_tasks": prefs.break_minutes,
        "unavailable_days": [WEEKDAY_NAMES[d] for d in prefs.unavailable_days or []],
        "rest_days": [WEEKDAY_NAMES[d] for d in prefs.rest_days or []],
        "fixed_activities": [{
            "title": a.title, "start": fmt_time(a.start_time), "end": fmt_time(a.end_time),
            "recurrence": a.recurrence, "weekdays": [WEEKDAY_NAMES[d] for d in a.weekdays or []],
        } for a in activities],
        "free_focus_minutes_per_day": {WEEKDAY_NAMES[d["weekday"]]: d["free_minutes"] for d in avail},
    }
    return json.dumps(jsonable(ctx), indent=1)


def _fallback_plan(goals, prefs, budgets: dict) -> AIPlanOutput:
    """Rule-based decomposition used when Gemini is unavailable or AI is disabled."""
    duration = prefs.preferred_task_minutes or 60
    per_cat: dict = {}
    for g in goals:
        per_cat.setdefault(g.category_id, []).append(g)
    tasks = []
    for cat_id, cat_goals in per_cat.items():
        for g in cat_goals:
            if cat_id in budgets:
                share = budgets[cat_id] / len(cat_goals)
                sessions = sched.sessions_for_budget(share, duration)
            else:
                sessions = DEFAULT_SESSIONS.get(g.importance, 3)
            pending = next((m for m in g.milestones if m.status == "PENDING"), None)
            tasks.append({
                "goal_id": str(g.id),
                "title": f"{g.title}: {pending.title}" if pending else f"Focus session: {g.title}",
                "description": (pending.description if pending and pending.description else
                                g.description or f"Make concrete progress on '{g.title}'."),
                "duration_minutes": duration, "sessions_per_week": min(sessions, 14),
            })
    return AIPlanOutput(
        planning_summary="Rule-based plan: sessions are distributed by importance, deadlines and your category budgets.",
        warnings=["Gemini was unavailable, so a rule-based plan was generated. You can edit it before approving."],
        tasks=tasks,
    )


def generate(db: Session, user: User, req: PlanningRequest, *, parent: Timetable | None = None) -> Timetable:
    week_start, week_end = req.week_start, req.week_start + timedelta(days=6)
    goals = [g for g in active_goals(db, user.id) if g.start_date <= week_end and g.end_date >= week_start]
    if not goals:
        req.status, req.error = "FAILED", "No active, approved goals overlap this week."
        db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "You have no active goals during this week. Create or activate a goal first.")

    prefs = pref_svc.get_prefs(db, user.id)
    activities = pref_svc.list_activities(db, user.id)
    budgets_list = pref_svc.budgets(db, user.id)
    budgets = pref_svc.budget_map(db, user.id)
    avail = sched.availability(prefs, activities, week_start)
    req.preferences_snapshot = jsonable({**pref_svc.prefs_out(prefs), "budgets": budgets_list,
                                         "activities": [a.title for a in activities]})

    source, extra_warnings = "gemini", []
    if not prefs.is_configured:
        extra_warnings.append("Sleep schedule and working hours are not configured; default values were used.")
    plan: AIPlanOutput | None = None
    if get_app_settings(db)["ai_enabled"]:
        try:
            raw = ai_client.generate_json(
                PLANNER_SYSTEM, _context(goals, prefs, activities, budgets_list, avail, week_start, req.user_prompt)
            )
            req.ai_response = raw
            plan = AIPlanOutput.model_validate(raw)
        except ai_client.AIUnavailable as exc:
            log.info("Planner falling back: %s", exc)
        except ValidationError:
            log.warning("Gemini plan failed schema validation")
            extra_warnings.append("The AI response did not match the expected format; a rule-based plan was used.")
    if plan is None:
        source = "fallback"
        plan = _fallback_plan(goals, prefs, budgets)

    goal_by_id = {str(g.id): g for g in goals}
    requests: list[sched.SessionRequest] = []
    for t in plan.tasks:
        goal = goal_by_id.get(t.goal_id)
        if goal is None:
            extra_warnings.append(f"Ignored AI task '{t.title}' because it referenced an unknown goal.")
            continue
        requests.append(sched.SessionRequest(
            goal=goal, title=t.title.strip(), description=t.description.strip(), duration=t.duration_minutes,
            sessions=t.sessions_per_week,
            preferred_days=[WEEKDAY_NAMES.index(d.capitalize()) for d in t.preferred_days if d.capitalize() in WEEKDAY_NAMES],
            time_of_day=t.preferred_time_of_day,
        ))

    if not requests:
        req.status = "NEEDS_CLARIFICATION" if plan.clarifications_needed else "FAILED"
        req.error = "; ".join(plan.clarifications_needed or ["The planner produced no usable tasks."])
        db.commit()
        raise HTTPException(status.HTTP_409_CONFLICT, {
            "message": "The planner needs more information before it can build a timetable.",
            "conflicts": plan.clarifications_needed or ["No usable tasks were produced. Try a more specific prompt."],
        })

    result = sched.build_schedule(requests, prefs, activities, week_start, budgets)
    if not result.tasks:
        req.status, req.error = "FAILED", "; ".join(result.unscheduled)
        db.commit()
        raise HTTPException(status.HTTP_409_CONFLICT, {
            "message": "No feasible timetable: there is not enough free time for your goals this week. "
                       "Revise your availability, fixed activities or priorities.",
            "conflicts": result.unscheduled + result.warnings,
        })

    version = (db.scalar(select(func.max(Timetable.version)).where(
        Timetable.user_id == user.id, Timetable.week_start == week_start)) or 0) + 1
    tt = Timetable(
        user_id=user.id, planning_request_id=req.id, parent_id=parent.id if parent else None,
        week_start=week_start, week_end=week_end, version=version, status="DRAFT", source=source,
        planning_summary=plan.planning_summary or None,
        warnings=[*plan.warnings, *extra_warnings, *result.warnings, *result.unscheduled,
                  *[f"Gemini asks: {q}" for q in plan.clarifications_needed]],
    )
    tt.tasks = [TimetableTask(goal_id=p.goal_id, task_type="AI", title=p.title, description=p.description,
                              scheduled_date=p.scheduled_date, start_time=p.start_time, end_time=p.end_time)
                for p in result.tasks]
    db.add(tt)
    req.status, req.error = "GENERATED", None
    db.flush()
    audit(db, user.id, "timetable", tt.id, "GENERATED", new={"version": version, "tasks": len(tt.tasks), "source": source})
    db.commit()
    return tt
