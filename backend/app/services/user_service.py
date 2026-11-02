import random
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (create_access_token, hash_password, hash_token, new_opaque_token,
                               verify_password)
from app.models import Category, PasswordResetToken, RefreshToken, User, UserCategory, UserPreferences
from app.schemas.users import UserCreate, UserUpdate
from app.utils.common import audit, not_found, paginate

AVATAR_COLORS = ["#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444", "#0ea5e9", "#22c55e"]


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _issue_tokens(db: Session, user: User) -> dict:
    raw = new_opaque_token()
    db.add(RefreshToken(
        user_id=user.id, token_hash=hash_token(raw),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_days),
    ))
    db.commit()
    return {"access_token": create_access_token(str(user.id), user.role), "refresh_token": raw,
            "token_type": "bearer", "user": user}


def login(db: Session, email: str, password: str) -> dict:
    user = db.scalar(select(User).where(func.lower(User.email) == email.lower()))
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated")
    return _issue_tokens(db, user)


def refresh(db: Session, raw_token: str) -> dict:
    token = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw_token)))
    now = datetime.now(timezone.utc)
    if token is None or token.revoked_at or _aware(token.expires_at) < now:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token is invalid or expired")
    user = db.get(User, token.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account is inactive")
    token.revoked_at = now  # rotation
    return _issue_tokens(db, user)


def logout(db: Session, raw_token: str) -> None:
    token = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw_token)))
    if token and not token.revoked_at:
        token.revoked_at = datetime.now(timezone.utc)
        db.commit()


def change_password(db: Session, user: User, current: str, new: str) -> None:
    if not verify_password(current, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    user.password_hash = hash_password(new)
    audit(db, user.id, "user", user.id, "PASSWORD_CHANGED")
    db.commit()


def create_reset_token(db: Session, admin: User, user_id) -> dict:
    user = db.get(User, user_id) or None
    if user is None:
        raise not_found("User")
    raw = new_opaque_token()
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.reset_token_minutes)
    db.add(PasswordResetToken(user_id=user.id, created_by=admin.id, token_hash=hash_token(raw), expires_at=expires))
    audit(db, admin.id, "user", user.id, "PASSWORD_RESET_ISSUED")
    db.commit()
    return {"reset_token": raw, "expires_at": expires}


def reset_password(db: Session, raw: str, new_password: str) -> None:
    token = db.scalar(select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_token(raw)))
    now = datetime.now(timezone.utc)
    if token is None or token.used_at or _aware(token.expires_at) < now:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Reset token is invalid or expired")
    user = db.get(User, token.user_id)
    user.password_hash = hash_password(new_password)
    token.used_at = now
    for rt in db.scalars(select(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))):
        rt.revoked_at = now
    audit(db, user.id, "user", user.id, "PASSWORD_RESET")
    db.commit()


def directory(db: Session) -> list[User]:
    return list(db.scalars(
        select(User).where(User.is_active.is_(True), User.role == "USER").order_by(User.created_at, User.name)
    ))


def list_users(db: Session, search: str | None, page: int, page_size: int):
    stmt = select(User).order_by(User.created_at)
    if search:
        like = f"%{search.lower()}%"
        stmt = stmt.where(or_(func.lower(User.name).like(like), func.lower(User.email).like(like)))
    return paginate(db, stmt, page, page_size)


def get_user(db: Session, user_id) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise not_found("User")
    return user


def _ensure_email_free(db: Session, email: str, exclude_id=None) -> None:
    stmt = select(User.id).where(func.lower(User.email) == email.lower())
    existing = db.scalar(stmt)
    if existing and existing != exclude_id:
        raise HTTPException(status.HTTP_409_CONFLICT, "A user with this email already exists")


def create_user(db: Session, actor: User | None, data: UserCreate) -> User:
    _ensure_email_free(db, data.email)
    user = User(
        name=data.name.strip(), email=data.email.lower(), password_hash=hash_password(data.password),
        role=data.role, avatar_color=data.avatar_color or random.choice(AVATAR_COLORS),
    )
    db.add(user)
    db.flush()
    db.add(UserPreferences(user_id=user.id))
    # New users start with every default category selected; they can change this freely.
    for cat in db.scalars(select(Category).where(Category.is_default.is_(True), Category.is_active.is_(True))):
        db.add(UserCategory(user_id=user.id, category_id=cat.id))
    audit(db, actor.id if actor else None, "user", user.id, "CREATED",
          new={"name": user.name, "email": user.email, "role": user.role})
    db.commit()
    return user


def update_user(db: Session, actor: User, user_id, data: UserUpdate) -> User:
    user = get_user(db, user_id)
    changes = data.model_dump(exclude_unset=True, exclude_none=True)
    if "email" in changes:
        _ensure_email_free(db, changes["email"], exclude_id=user.id)
        changes["email"] = changes["email"].lower()
    if user.id == actor.id and changes.get("role") == "USER":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot remove your own admin role")
    old = {k: getattr(user, k) for k in changes}
    for k, v in changes.items():
        setattr(user, k, v)
    audit(db, actor.id, "user", user.id, "UPDATED", old, changes)
    db.commit()
    return user


def set_status(db: Session, actor: User, user_id, is_active: bool) -> User:
    user = get_user(db, user_id)
    if user.id == actor.id and not is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot deactivate your own account")
    old = user.is_active
    user.is_active = is_active
    if not is_active:
        now = datetime.now(timezone.utc)
        for rt in db.scalars(select(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))):
            rt.revoked_at = now
    audit(db, actor.id, "user", user.id, "STATUS_CHANGED", {"is_active": old}, {"is_active": is_active})
    db.commit()
    return user
