import uuid
from datetime import date

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.permissions import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.preferences import (ActivityIn, ActivityOut, BudgetOut, BudgetsIn, FeedbackStyleIn,
                                     PreferencesIn, PreferencesOut)
from app.services import preference_service as svc

router = APIRouter(tags=["preferences"])


@router.get("/preferences", response_model=PreferencesOut)
def get_preferences(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.prefs_out(svc.get_prefs(db, user.id))


@router.put("/preferences", response_model=PreferencesOut)
def update_preferences(body: PreferencesIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.update_prefs(db, user, body)


@router.put("/preferences/feedback-style", response_model=PreferencesOut)
def feedback_style(body: FeedbackStyleIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.update_prefs(db, user, PreferencesIn(feedback_style=body.feedback_style))


@router.get("/activities", response_model=list[ActivityOut])
def list_activities(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.list_activities(db, user.id)


@router.post("/activities", response_model=ActivityOut, status_code=status.HTTP_201_CREATED)
def create_activity(body: ActivityIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.create_activity(db, user, body)


@router.put("/activities/{activity_id}", response_model=ActivityOut)
def update_activity(activity_id: uuid.UUID, body: ActivityIn, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    return svc.update_activity(db, user, activity_id, body)


@router.delete("/activities/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity(activity_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    svc.delete_activity(db, user, activity_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/category-budgets", response_model=list[BudgetOut])
def get_budgets(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.budgets(db, user.id)


@router.put("/category-budgets", response_model=list[BudgetOut])
def put_budgets(body: BudgetsIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.set_budgets(db, user, body.budgets)


@router.get("/planning/availability")
def availability(week_start: date | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.availability(db, user, week_start)
