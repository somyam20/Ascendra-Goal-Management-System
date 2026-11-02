"""Deterministic scheduling engine.

The LLM decides *what* to work on and *how much*; this module decides *when*, and is the single source of
truth for constraint validation (sleep, fixed activities, unavailable/rest days, goal date ranges, overlaps,
daily workload and category budgets).
"""
import math
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, time, timedelta

from app.models import FixedActivity, Goal, UserPreferences
from app.models.enums import IMPORTANCE_WEIGHT
from app.utils.common import WEEKDAY_NAMES, fmt_time, from_minutes, to_minutes

DAY_END = 24 * 60
Interval = tuple[int, int]


# ---------------- interval helpers ----------------

def _subtract(intervals: list[Interval], block: Interval) -> list[Interval]:
    out = []
    bs, be = block
    for s, e in intervals:
        if be <= s or bs >= e:
            out.append((s, e))
            continue
        if bs > s:
            out.append((s, bs))
        if be < e:
            out.append((be, e))
    return out


def _intersect(a: list[Interval], b: list[Interval]) -> list[Interval]:
    out = []
    for s1, e1 in a:
        for s2, e2 in b:
            s, e = max(s1, s2), min(e1, e2)
            if s < e:
                out.append((s, e))
    return sorted(out)


def _span(start: time, end: time) -> list[Interval]:
    """Interval(s) covered by start..end on one day; wraps past midnight if end <= start."""
    s, e = to_minutes(start), to_minutes(end)
    if e > s:
        return [(s, e)]
    return [(s, DAY_END), (0, e)] if e > 0 else [(s, DAY_END)]


def awake_windows(prefs: UserPreferences) -> list[Interval]:
    wake, sleep = to_minutes(prefs.wake_time), to_minutes(prefs.sleep_time)
    if sleep > wake:
        return [(wake, sleep)]
    return [(0, sleep), (wake, DAY_END)] if sleep > 0 else [(wake, DAY_END)]


def sleep_hours(prefs: UserPreferences) -> float:
    awake = sum(e - s for s, e in awake_windows(prefs))
    return round((DAY_END - awake) / 60, 2)


def activity_applies(act: FixedActivity, d: date) -> bool:
    if act.start_date and d < act.start_date and act.recurrence != "ONCE":
        return False
    if act.end_date and d > act.end_date:
        return False
    if act.recurrence == "ONCE":
        return act.start_date == d
    if act.recurrence == "DAILY":
        return True
    return d.weekday() in (act.weekdays or [])


def blocked_day(prefs: UserPreferences, d: date) -> bool:
    return d.weekday() in (prefs.unavailable_days or []) or d.weekday() in (prefs.rest_days or [])


def free_windows(prefs: UserPreferences, activities: list[FixedActivity], d: date, *, working_only=True) -> list[Interval]:
    if blocked_day(prefs, d):
        return []
    windows = awake_windows(prefs)
    if working_only:
        windows = _intersect(windows, _span(prefs.preferred_working_start, prefs.preferred_working_end))
    for act in activities:
        if activity_applies(act, d):
            for block in _span(act.start_time, act.end_time):
                windows = _subtract(windows, block)
    return [(s, e) for s, e in windows if e - s >= 15]


def availability(prefs: UserPreferences, activities: list[FixedActivity], week_start: date) -> list[dict]:
    days = []
    max_day = int(prefs.max_productive_hours * 60)
    for i in range(7):
        d = week_start + timedelta(days=i)
        free = sum(e - s for s, e in free_windows(prefs, activities, d))
        days.append({"date": d, "weekday": i, "free_minutes": min(free, max_day), "blocked": blocked_day(prefs, d)})
    return days


# ---------------- planning ----------------

@dataclass
class SessionRequest:
    goal: Goal
    title: str
    description: str
    duration: int
    sessions: int
    preferred_days: list[int] = field(default_factory=list)
    time_of_day: str = "any"


@dataclass
class PlacedTask:
    goal_id: uuid.UUID
    title: str
    description: str
    scheduled_date: date
    start_time: time
    end_time: time


@dataclass
class ScheduleResult:
    tasks: list[PlacedTask]
    warnings: list[str]
    unscheduled: list[str]


TOD_RANGES = {"morning": (0, 12 * 60), "afternoon": (12 * 60, 17 * 60), "evening": (17 * 60, DAY_END)}


def _priority(req: SessionRequest, week_start: date) -> tuple:
    days_left = (req.goal.end_date - week_start).days
    return (-IMPORTANCE_WEIGHT.get(req.goal.importance, 1), days_left)


def build_schedule(
    requests: list[SessionRequest],
    prefs: UserPreferences,
    activities: list[FixedActivity],
    week_start: date,
    budgets: dict[uuid.UUID, float],
) -> ScheduleResult:
    warnings: list[str] = []
    unscheduled: list[str] = []
    break_min = prefs.break_minutes or 0
    max_day = int(prefs.max_productive_hours * 60)
    days = [week_start + timedelta(days=i) for i in range(7)]
    windows = {d: free_windows(prefs, activities, d) for d in days}
    load = defaultdict(int)
    placed: list[PlacedTask] = []
    goal_days: dict[uuid.UUID, set[date]] = defaultdict(set)

    # Respect category budgets: trim sessions beyond the budget and say so explicitly.
    by_cat: dict[uuid.UUID, int] = defaultdict(int)
    requests = sorted(requests, key=lambda r: _priority(r, week_start))
    for req in requests:
        cat = req.goal.category_id
        budget_min = budgets.get(cat)
        if budget_min is None:
            by_cat[cat] += req.duration * req.sessions
            continue
        allowed = max(0, int(budget_min * 60) - by_cat[cat])
        fits = min(req.sessions, allowed // req.duration) if req.duration else 0
        if fits < req.sessions:
            warnings.append(
                f"'{req.title}' trimmed from {req.sessions} to {fits} session(s): the "
                f"{req.goal.category.name} budget is {budget_min:g} h/week."
            )
            req.sessions = fits
        by_cat[cat] += req.duration * req.sessions

    total_free = sum(min(sum(e - s for s, e in w), max_day) for w in windows.values())
    total_req = sum(r.duration * r.sessions for r in requests)
    if total_req > total_free:
        warnings.append(
            f"Requested work ({total_req / 60:.1f} h) exceeds your available focus time this week "
            f"({total_free / 60:.1f} h). Lower-priority sessions may not fit."
        )

    for req in requests:
        active_days = [d for d in days if req.goal.start_date <= d <= req.goal.end_date]
        if not active_days:
            unscheduled.append(f"'{req.title}': goal '{req.goal.title}' is not active during this week.")
            continue
        missing = 0
        for _ in range(req.sessions):
            spot = _find_slot(req, active_days, windows, load, goal_days, max_day, break_min)
            if spot is None:
                missing += 1
                continue
            d, start = spot
            end = start + req.duration
            windows[d] = _subtract(windows[d], (start - break_min, end + break_min))
            load[d] += req.duration
            goal_days[req.goal.id].add(d)
            placed.append(PlacedTask(req.goal.id, req.title, req.description, d, from_minutes(start), from_minutes(end)))
        if missing:
            unscheduled.append(
                f"Could not fit {missing} of {req.sessions} '{req.title}' session(s) "
                f"({req.duration} min) without breaking your sleep, commitments or daily limit."
            )

    placed.sort(key=lambda t: (t.scheduled_date, t.start_time))
    return ScheduleResult(placed, warnings, unscheduled)


def _find_slot(req, active_days, windows, load, goal_days, max_day, break_min):
    pref = set(req.preferred_days)

    def day_rank(d: date):
        return (
            0 if d.weekday() in pref else 1,
            1 if d in goal_days[req.goal.id] else 0,   # spread sessions of the same goal
            load[d],
            d,
        )

    tod = TOD_RANGES.get(req.time_of_day)
    for d in sorted(active_days, key=day_rank):
        if load[d] + req.duration > max_day:
            continue
        candidates = windows[d]
        ordered = _intersect(candidates, [tod]) + candidates if tod else candidates
        for s, e in ordered:
            if e - s >= req.duration:
                return d, s
    return None


# ---------------- validation ----------------

@dataclass
class TaskSpec:
    goal_id: uuid.UUID
    title: str
    scheduled_date: date
    start_time: time
    end_time: time


def validate_tasks(
    tasks: list[TaskSpec],
    prefs: UserPreferences,
    activities: list[FixedActivity],
    goals: dict[uuid.UUID, Goal],
    week_start: date,
    week_end: date,
) -> tuple[list[str], list[str]]:
    """Return (conflicts, warnings). Conflicts block saving/approval; warnings are informational."""
    conflicts: list[str] = []
    warnings: list[str] = []
    per_day: dict[date, list[TaskSpec]] = defaultdict(list)
    max_day = int(prefs.max_productive_hours * 60)
    budgets_used: dict[uuid.UUID, int] = defaultdict(int)

    for t in tasks:
        label = f"'{t.title}' on {WEEKDAY_NAMES[t.scheduled_date.weekday()]} {t.scheduled_date.isoformat()}"
        s, e = to_minutes(t.start_time), to_minutes(t.end_time)
        if e <= s:
            conflicts.append(f"{label}: end time must be after start time.")
            continue
        goal = goals.get(t.goal_id)
        if goal is None:
            conflicts.append(f"{label}: linked goal is not one of your active goals.")
            continue
        if not (week_start <= t.scheduled_date <= week_end):
            conflicts.append(f"{label}: date is outside the timetable week.")
        if not (goal.start_date <= t.scheduled_date <= goal.end_date):
            conflicts.append(f"{label}: outside the goal's active dates ({goal.start_date} to {goal.end_date}).")
        if t.scheduled_date.weekday() in (prefs.unavailable_days or []):
            conflicts.append(f"{label}: you marked this weekday as unavailable.")
        awake = awake_windows(prefs)
        if not any(ws <= s and e <= we for ws, we in awake):
            conflicts.append(f"{label}: overlaps your sleeping hours.")
        for act in activities:
            if activity_applies(act, t.scheduled_date):
                for bs, be in _span(act.start_time, act.end_time):
                    if s < be and bs < e:
                        conflicts.append(f"{label}: overlaps fixed activity '{act.title}'.")
        per_day[t.scheduled_date].append(t)
        budgets_used[goal.category_id] += e - s

    for d, day_tasks in per_day.items():
        day_tasks.sort(key=lambda x: x.start_time)
        for a, b in zip(day_tasks, day_tasks[1:]):
            if to_minutes(b.start_time) < to_minutes(a.end_time):
                conflicts.append(
                    f"'{a.title}' ({fmt_time(a.start_time)}-{fmt_time(a.end_time)}) overlaps '{b.title}' "
                    f"({fmt_time(b.start_time)}-{fmt_time(b.end_time)}) on {d.isoformat()}."
                )
        total = sum(to_minutes(t.end_time) - to_minutes(t.start_time) for t in day_tasks)
        if total > max_day:
            conflicts.append(
                f"{WEEKDAY_NAMES[d.weekday()]} has {total / 60:.1f} h of tasks, above your "
                f"{prefs.max_productive_hours:g} h daily maximum."
            )
        if d.weekday() in (prefs.rest_days or []):
            warnings.append(f"{WEEKDAY_NAMES[d.weekday()]} is one of your rest days.")
    return conflicts, warnings


def check_budgets(used_minutes: dict[uuid.UUID, int], budgets: dict[uuid.UUID, float], names: dict) -> list[str]:
    out = []
    for cat, minutes in used_minutes.items():
        if cat in budgets and minutes > budgets[cat] * 60 + 1e-6:
            out.append(
                f"{names.get(cat, 'Category')}: {minutes / 60:.1f} h planned exceeds the "
                f"{budgets[cat]:g} h/week you allocated."
            )
    return out


def sessions_for_budget(hours: float, duration: int) -> int:
    return max(1, math.floor(hours * 60 / duration)) if duration else 1
