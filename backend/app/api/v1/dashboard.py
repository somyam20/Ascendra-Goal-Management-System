from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.permissions import get_current_user
from app.db.session import get_db
from app.models import User
from app.services import analytics_service as svc

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
Period = Literal["daily", "weekly", "monthly", "custom"]


@router.get("/summary")
def summary(period: Period = "weekly", start: date | None = None, end: date | None = None,
            _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.summary(db, *svc.period_range(period, start, end))


@router.get("/users")
def users(period: Period = "weekly", start: date | None = None, end: date | None = None,
          _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.users_comparison(db, *svc.period_range(period, start, end))


@router.get("/leaderboard")
def leaderboard(period: Literal["weekly", "monthly"] = "weekly", _: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    return svc.leaderboard(db, period)


@router.get("/trends")
def trends(granularity: Literal["daily", "weekly", "monthly"] = "daily", start: date | None = None,
           end: date | None = None, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.trends(db, granularity, start, end)


@router.get("/categories")
def categories(period: Period = "monthly", start: date | None = None, end: date | None = None,
               _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.categories(db, *svc.period_range(period, start, end))


@router.get("/upcoming-deadlines")
def upcoming(days: int = Query(14, ge=1, le=90), _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.upcoming_deadlines(db, days)


@router.get("/achievements")
def achievements(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.achievements(db)
