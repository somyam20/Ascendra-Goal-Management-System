import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.permissions import ViewContext, get_current_user, get_view_context
from app.db.session import get_db
from app.models import User
from app.repositories.base import get_owned_goal
from app.schemas.common import Page
from app.schemas.goals import (DecomposeIn, DecomposeOut, GoalApproveIn, GoalHistoryEntry, GoalIn, GoalOut,
                               GoalStatusIn, Importance, MilestoneStatusIn)
from app.schemas.goals import GoalStatus as GoalStatusLit
from app.services import goal_service
from app.utils.common import RateLimiter

router = APIRouter(prefix="/goals", tags=["goals"])
ai_limiter = RateLimiter(settings.ai_rate_limit_per_hour)


@router.get("", response_model=Page[GoalOut])
def list_goals(
    category_id: uuid.UUID | None = None, importance: Importance | None = None,
    status_: GoalStatusLit | None = Query(None, alias="status"), start_from: date | None = None,
    end_to: date | None = None, search: str | None = None, sort: str = "-created_at",
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    ctx: ViewContext = Depends(get_view_context), db: Session = Depends(get_db),
):
    items, total = goal_service.list_goals(
        db, ctx.target.id, category_id=category_id, importance=importance, status_=status_,
        start_from=start_from, end_to=end_to, search=search, sort=sort, page=page, page_size=page_size,
    )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
def create_goal(body: GoalIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return goal_service.create_goal(db, user, body)


@router.post("/ai-decompose", response_model=DecomposeOut)
def ai_decompose(body: DecomposeIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ai_limiter.check(str(user.id))
    return goal_service.decompose(db, user, body)


@router.get("/{goal_id}", response_model=GoalOut)
def get_goal(goal_id: uuid.UUID, ctx: ViewContext = Depends(get_view_context), db: Session = Depends(get_db)):
    return goal_service.one_out(db, get_owned_goal(db, ctx.target.id, goal_id))


@router.put("/{goal_id}", response_model=GoalOut)
def update_goal(goal_id: uuid.UUID, body: GoalIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return goal_service.update_goal(db, user, goal_id, body)


@router.patch("/{goal_id}/status", response_model=GoalOut)
def change_status(goal_id: uuid.UUID, body: GoalStatusIn, user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    return goal_service.change_status(db, user, goal_id, body.status)


@router.patch("/{goal_id}/milestones/{milestone_id}", response_model=GoalOut)
def milestone_status(goal_id: uuid.UUID, milestone_id: uuid.UUID, body: MilestoneStatusIn,
                     user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return goal_service.set_milestone_status(db, user, goal_id, milestone_id, body.status)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(goal_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    goal_service.delete_goal(db, user, goal_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{goal_id}/history", response_model=list[GoalHistoryEntry])
def goal_history(goal_id: uuid.UUID, ctx: ViewContext = Depends(get_view_context), db: Session = Depends(get_db)):
    return goal_service.history(db, ctx.target.id, goal_id)


@router.post("/{goal_id}/approve", response_model=GoalOut)
def approve_goal(goal_id: uuid.UUID, body: GoalApproveIn, user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    return goal_service.approve(db, user, goal_id, body.approve, body.milestones)
