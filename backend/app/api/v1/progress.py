import uuid
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.permissions import ViewContext, get_current_user, get_view_context
from app.db.session import get_db
from app.models import User
from app.schemas.misc import ProgressIn, ProgressOut, ProgressUpdate
from app.services import progress_service as svc

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("/daily")
def daily(date: date | None = None, ctx: ViewContext = Depends(get_view_context), db: Session = Depends(get_db)):
    return svc.daily(db, ctx.target.id, date)


@router.post("", response_model=ProgressOut)
def upsert(body: ProgressIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.upsert(db, user, body)


@router.put("/{progress_id}", response_model=ProgressOut)
def update(progress_id: uuid.UUID, body: ProgressUpdate, user: User = Depends(get_current_user),
           db: Session = Depends(get_db)):
    return svc.update(db, user, progress_id, body.completion_status)


@router.get("/weekly")
def weekly(week_start: date | None = None, ctx: ViewContext = Depends(get_view_context), db: Session = Depends(get_db)):
    return svc.weekly(db, ctx.target.id, week_start)


@router.get("/history")
def history(start: date | None = None, end: date | None = None, ctx: ViewContext = Depends(get_view_context),
            db: Session = Depends(get_db)):
    return svc.history(db, ctx.target.id, start, end)


@router.get("/streaks")
def streaks(ctx: ViewContext = Depends(get_view_context), db: Session = Depends(get_db)):
    return svc.streaks(db, ctx.target.id)


@router.get("/analytics")
def analytics(start: date | None = None, end: date | None = None, ctx: ViewContext = Depends(get_view_context),
              db: Session = Depends(get_db)):
    return svc.analytics(db, ctx.target.id, start, end)
