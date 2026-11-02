from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permissions import require_admin
from app.db.session import get_db
from app.models import AuditLog, User
from app.schemas.common import Page
from app.schemas.misc import AppSettingsModel, AuditOut
from app.services.settings_service import get_app_settings, update_app_settings
from app.utils.common import paginate

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/audit-logs", response_model=Page[AuditOut])
def audit_logs(entity_type: str | None = None, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=100),
               _: User = Depends(require_admin), db: Session = Depends(get_db)):
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    items, total = paginate(db, stmt, page, page_size)
    names = dict(db.execute(select(User.id, User.name)).all())
    return {
        "items": [{"id": a.id, "user_id": a.user_id, "user_name": names.get(a.user_id), "entity_type": a.entity_type,
                   "entity_id": a.entity_id, "action": a.action, "old_value": a.old_value, "new_value": a.new_value,
                   "created_at": a.created_at} for a in items],
        "total": total, "page": page, "page_size": page_size,
    }


@router.get("/settings", response_model=AppSettingsModel)
def get_settings(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return get_app_settings(db)


@router.put("/settings", response_model=AppSettingsModel)
def put_settings(body: AppSettingsModel, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return update_app_settings(db, admin, body.model_dump())
