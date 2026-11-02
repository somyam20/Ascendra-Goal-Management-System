import uuid
from typing import Literal

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.goals import ai_limiter
from app.core.permissions import ViewContext, get_current_user, get_view_context
from app.db.session import get_db
from app.models import User
from app.repositories.base import get_owned_timetable
from app.schemas.planning import (RegenerateIn, RescheduleIn, ReviewIn, TasksIn, TimetableOut, ValidationOut)
from app.services import timetable_service as svc

router = APIRouter(prefix="/timetables", tags=["timetables"])


@router.get("", response_model=list[TimetableOut])
def list_timetables(status: Literal["DRAFT", "APPROVED", "REJECTED", "ARCHIVED"] | None = None,
                    ctx: ViewContext = Depends(get_view_context), db: Session = Depends(get_db)):
    return [svc.timetable_out(t, with_tasks=False)
            for t in svc.list_timetables(db, ctx.target.id, is_self=ctx.is_self, status_=status)]


@router.get("/active", response_model=TimetableOut | None)
def active(ctx: ViewContext = Depends(get_view_context), db: Session = Depends(get_db)):
    tt = svc.active_timetable(db, ctx.target.id)
    return svc.timetable_out(tt) if tt else None


@router.get("/{timetable_id}", response_model=TimetableOut)
def get_timetable(timetable_id: uuid.UUID, ctx: ViewContext = Depends(get_view_context), db: Session = Depends(get_db)):
    return svc.timetable_out(svc.get_viewable(db, ctx.target.id, timetable_id, is_self=ctx.is_self))


@router.post("/{timetable_id}/validate", response_model=ValidationOut)
def validate(timetable_id: uuid.UUID, body: TasksIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tt = get_owned_timetable(db, user.id, timetable_id)
    conflicts, _ = svc.validate(db, user, tt, body.tasks)
    return {"valid": not conflicts, "conflicts": conflicts}


@router.put("/{timetable_id}/draft", response_model=TimetableOut)
def save_draft(timetable_id: uuid.UUID, body: TasksIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tt = get_owned_timetable(db, user.id, timetable_id)
    return svc.timetable_out(svc.save_draft(db, user, tt, body.tasks))


@router.post("/{timetable_id}/regenerate", response_model=TimetableOut)
def regenerate(timetable_id: uuid.UUID, body: RegenerateIn, user: User = Depends(get_current_user),
               db: Session = Depends(get_db)):
    ai_limiter.check(str(user.id))
    tt = get_owned_timetable(db, user.id, timetable_id)
    return svc.timetable_out(svc.regenerate(db, user, tt, body.user_prompt))


@router.post("/{timetable_id}/approve", response_model=TimetableOut)
def approve(timetable_id: uuid.UUID, body: ReviewIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tt = get_owned_timetable(db, user.id, timetable_id)
    return svc.timetable_out(svc.approve(db, user, tt, body.comments))


@router.post("/{timetable_id}/reject", response_model=TimetableOut)
def reject(timetable_id: uuid.UUID, body: ReviewIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tt = get_owned_timetable(db, user.id, timetable_id)
    return svc.timetable_out(svc.reject(db, user, tt, body.comments))


@router.post("/{timetable_id}/tasks/{task_id}/reschedule", response_model=TimetableOut)
def reschedule(timetable_id: uuid.UUID, task_id: uuid.UUID, body: RescheduleIn,
               user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tt = get_owned_timetable(db, user.id, timetable_id)
    return svc.timetable_out(svc.reschedule(db, user, tt, task_id, body))
