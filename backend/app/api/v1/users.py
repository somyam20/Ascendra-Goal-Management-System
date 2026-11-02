import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.permissions import get_current_user, require_admin
from app.db.session import get_db
from app.models import User
from app.schemas.common import Page
from app.schemas.users import (DirectoryEntry, ResetTokenOut, UserCreate, UserOut, UserStatusUpdate,
                               UserUpdate)
from app.services import user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/directory", response_model=list[DirectoryEntry])
def directory(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return user_service.directory(db)


@router.get("", response_model=Page[UserOut])
def list_users(
    search: str | None = None, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    _: User = Depends(require_admin), db: Session = Depends(get_db),
):
    items, total = user_service.list_users(db, search, page, page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(body: UserCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return user_service.create_user(db, admin, body)


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: uuid.UUID, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    return user_service.get_user(db, user_id)


@router.put("/{user_id}", response_model=UserOut)
def update_user(user_id: uuid.UUID, body: UserUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return user_service.update_user(db, admin, user_id, body)


@router.patch("/{user_id}/status", response_model=UserOut)
def set_status(user_id: uuid.UUID, body: UserStatusUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return user_service.set_status(db, admin, user_id, body.is_active)


@router.post("/{user_id}/reset-token", response_model=ResetTokenOut)
def reset_token(user_id: uuid.UUID, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return user_service.create_reset_token(db, admin, user_id)
