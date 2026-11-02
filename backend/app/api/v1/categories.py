import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.permissions import ViewContext, get_current_user, get_view_context
from app.db.session import get_db
from app.models import User
from app.schemas.categories import CategoryIn, CategoryOut, CategoryUpdate
from app.services import category_service

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(include_inactive: bool = False, ctx: ViewContext = Depends(get_view_context),
                    db: Session = Depends(get_db)):
    return category_service.list_categories(db, ctx.target, is_self=ctx.is_self,
                                            include_inactive=include_inactive and ctx.is_self)


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(body: CategoryIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return category_service.create_category(db, user, body)


@router.put("/{category_id}", response_model=CategoryOut)
def update_category(category_id: uuid.UUID, body: CategoryUpdate, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    return category_service.update_category(db, user, category_id, body)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    category_service.deactivate_category(db, user, category_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{category_id}/select", status_code=status.HTTP_204_NO_CONTENT)
def select_category(category_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    category_service.set_selected(db, user, category_id, True)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{category_id}/select", status_code=status.HTTP_204_NO_CONTENT)
def unselect_category(category_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    category_service.set_selected(db, user, category_id, False)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
