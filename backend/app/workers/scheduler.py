"""APScheduler jobs for a single-process deployment.

Every 15 minutes each active user is checked against *their own* timezone; morning/evening/weekly
notifications are generated when their local hour matches the admin settings. Notification dedupe keys
make every job idempotent, so overlapping runs or restarts never create duplicates. Unreported tasks are
never auto-marked as failed. For multiple backend replicas, run this in one dedicated worker process
(`python -m app.workers.scheduler`) and set ENABLE_SCHEDULER=false on the API replicas.
"""
import logging
import time

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import User
from app.services import notification_service, preference_service
from app.services.settings_service import get_app_settings
from app.utils.common import local_now

log = logging.getLogger(__name__)


def run_due_notifications() -> int:
    created = 0
    with SessionLocal() as db:
        cfg = get_app_settings(db)
        users = db.scalars(select(User).where(User.is_active.is_(True), User.role == "USER")).all()
        for user in users:
            try:
                now = local_now(preference_service.get_prefs(db, user.id).timezone)
                kinds = []
                if now.hour == cfg["morning_hour"]:
                    kinds.append("DAILY")
                if now.hour == cfg["evening_hour"]:
                    kinds.append("EVENING")
                    if now.weekday() == cfg["weekly_review_day"]:
                        kinds.append("WEEKLY")
                for kind in kinds:
                    created += len(notification_service.generate(db, user, kind))
            except Exception:  # one user's failure must not stop the others
                db.rollback()
                log.exception("Notification job failed for user %s", user.id)
    return created


def start_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(run_due_notifications, "cron", minute="*/15", id="notifications",
                      max_instances=1, coalesce=True, replace_existing=True)
    scheduler.start()
    log.info("Notification scheduler started")
    return scheduler


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    sched = start_scheduler()
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        sched.shutdown()
