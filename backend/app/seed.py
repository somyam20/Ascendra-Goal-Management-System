"""Idempotent bootstrap: default categories and the initial administrator.

Run with `python -m app.seed`. Pass `--demo-users` to also create Bipasha, Pallavi and Somya
(regular data, not hardcoded in business logic; the password is printed once).
"""
import argparse
import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models import Category, User
from app.schemas.users import UserCreate
from app.services import user_service

log = logging.getLogger(__name__)

DEFAULT_CATEGORIES = [
    ("Exercise", "Workouts, running, yoga and physical fitness.", "dumbbell", "#22c55e"),
    ("Job Switch", "Interview preparation, applications and career moves.", "briefcase", "#6366f1"),
    ("Thesis", "Research, writing and thesis milestones.", "graduation-cap", "#f59e0b"),
    ("Studies", "Courses, classes and structured learning.", "book-open", "#0ea5e9"),
]


def ensure_defaults(db: Session) -> None:
    for name, desc, icon, color in DEFAULT_CATEGORIES:
        exists = db.scalar(select(Category.id).where(func.lower(Category.name) == name.lower(),
                                                     Category.is_default.is_(True)))
        if not exists:
            db.add(Category(name=name, description=desc, icon=icon, color=color, is_default=True))
    db.commit()
    if not db.scalar(select(User.id).where(User.role == "ADMIN")):
        user_service.create_user(db, None, UserCreate(
            name=settings.admin_name, email=settings.admin_email, password=settings.admin_password,
            role="ADMIN", avatar_color="#0f172a",
        ))
        log.info("Created initial administrator %s", settings.admin_email)


def create_demo_users(db: Session, password: str) -> None:
    for name, color in (("Bipasha", "#ec4899"), ("Pallavi", "#14b8a6"), ("Somya", "#8b5cf6")):
        email = f"{name.lower()}@goals.local"
        if not db.scalar(select(User.id).where(User.email == email)):
            user_service.create_user(db, None, UserCreate(name=name, email=email, password=password,
                                                          role="USER", avatar_color=color))
            print(f"Created {email}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--demo-users", action="store_true")
    parser.add_argument("--password", default="Welcome@123")
    args = parser.parse_args()
    with SessionLocal() as session:
        ensure_defaults(session)
        if args.demo_users:
            create_demo_users(session, args.password)
    print("Seed complete.")
