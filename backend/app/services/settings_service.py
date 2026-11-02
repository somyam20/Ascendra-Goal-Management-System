import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AppSetting, User
from app.models.misc import DEFAULT_APP_SETTINGS
from app.utils.common import audit


def get_app_settings(db: Session) -> dict:
    values = dict(DEFAULT_APP_SETTINGS)
    for row in db.scalars(select(AppSetting)):
        if row.key in values:
            values[row.key] = json.loads(row.value)
    return values


def update_app_settings(db: Session, actor: User, data: dict) -> dict:
    old = get_app_settings(db)
    for key, value in data.items():
        if key not in DEFAULT_APP_SETTINGS:
            continue
        row = db.get(AppSetting, key)
        if row is None:
            db.add(AppSetting(key=key, value=json.dumps(value)))
        else:
            row.value = json.dumps(value)
    audit(db, actor.id, "app_settings", None, "UPDATED", old, data)
    db.commit()
    return get_app_settings(db)
