import uuid
from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import User

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = decode_access_token(creds.credentials)
        user_id = uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account is inactive or missing")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "ADMIN":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Administrator access required")
    return user


@dataclass
class ViewContext:
    """Who is asking and whose (read-only) data they are viewing."""

    viewer: User
    target: User

    @property
    def is_self(self) -> bool:
        return self.viewer.id == self.target.id


def get_view_context(
    user_id: uuid.UUID | None = Query(None, description="View another user's data (read-only)"),
    viewer: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ViewContext:
    if user_id is None or user_id == viewer.id:
        return ViewContext(viewer, viewer)
    target = db.get(User, user_id)
    if target is None or not target.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return ViewContext(viewer, target)
