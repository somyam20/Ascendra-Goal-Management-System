import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.permissions import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.misc import GenerateIn, NotificationOut, NotificationPage
from app.services import notification_service as svc

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationPage)
def list_notifications(unread_only: bool = False, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                       user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.list_notifications(db, user.id, unread_only, page, page_size)


@router.get("/pending-goals")
def pending_goals(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.pending_goals(db, user.id)


@router.post("/generate", response_model=list[NotificationOut])
def generate(body: GenerateIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.generate(db, user, body.kind)


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def read_all(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    svc.mark_all_read(db, user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_read(notification_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.mark_read(db, user.id, notification_id)
