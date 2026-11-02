import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.v1.goals import ai_limiter
from app.core.permissions import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.planning import PlanningRequestIn, PlanningRequestOut, TimetableOut
from app.services import ai_planning_service as planner
from app.services.timetable_service import timetable_out

router = APIRouter(prefix="/planning", tags=["planning"])


@router.post("/requests", response_model=PlanningRequestOut, status_code=status.HTTP_201_CREATED)
def create_request(body: PlanningRequestIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return planner.request_out(db, planner.create_request(db, user, body.user_prompt, body.week_start))


@router.get("/requests/{request_id}", response_model=PlanningRequestOut)
def get_request(request_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return planner.request_out(db, planner.get_request(db, user.id, request_id))


@router.post("/requests/{request_id}/generate", response_model=TimetableOut)
def generate(request_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ai_limiter.check(str(user.id))
    req = planner.get_request(db, user.id, request_id)
    return timetable_out(planner.generate(db, user, req))
