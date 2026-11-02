import time as _time
import uuid
from collections import defaultdict, deque
from datetime import date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import AuditLog

WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


def default_planning_week(today: date) -> date:
    """This week's Monday if today is Monday, otherwise next Monday."""
    return today if today.weekday() == 0 else monday_of(today) + timedelta(days=7)


def to_minutes(t: time) -> int:
    return t.hour * 60 + t.minute


def from_minutes(m: int) -> time:
    m = max(0, min(m, 24 * 60 - 1))
    return time(m // 60, m % 60)


def fmt_time(t: time | None) -> str | None:
    return t.strftime("%H:%M") if t else None


def safe_zone(tz: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(tz or "UTC")
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def local_now(tz: str | None) -> datetime:
    return datetime.now(safe_zone(tz))


def rate(completed: int, not_completed: int) -> float | None:
    """Completion %, excluding unmarked records from the denominator."""
    evaluated = completed + not_completed
    return round(100.0 * completed / evaluated, 1) if evaluated else None


def jsonable(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [jsonable(v) for v in value]
    if isinstance(value, (date, datetime, time)):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    return value


def audit(
    db: Session, actor_id: uuid.UUID | None, entity_type: str, entity_id: uuid.UUID | None,
    action: str, old: dict | None = None, new: dict | None = None,
) -> None:
    db.add(AuditLog(
        user_id=actor_id, entity_type=entity_type, entity_id=entity_id, action=action,
        old_value=jsonable(old) if old is not None else None,
        new_value=jsonable(new) if new is not None else None,
    ))


def paginate(db: Session, stmt, page: int, page_size: int) -> tuple[list, int]:
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    items = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).unique().all()
    return list(items), total


def not_found(what: str = "Resource") -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, f"{what} not found")


class RateLimiter:
    """In-memory sliding-window limiter (per process) for expensive AI endpoints."""

    def __init__(self, limit: int, window_seconds: int = 3600):
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = _time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] > self.window:
            hits.popleft()
        if len(hits) >= self.limit:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS, "AI request limit reached. Please try again later."
            )
        hits.append(now)
