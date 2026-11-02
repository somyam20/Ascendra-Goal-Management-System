import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.api.v1 import (admin, auth, categories, dashboard, goals, notifications, planning, preferences, progress,
                        timetables, users)
from app.core.config import settings
from app.db.session import SessionLocal

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("app")


@asynccontextmanager
async def lifespan(_: FastAPI):
    from app.seed import ensure_defaults

    with SessionLocal() as db:
        ensure_defaults(db)
    scheduler = None
    if settings.enable_scheduler:
        from app.workers.scheduler import start_scheduler
        scheduler = start_scheduler()
    yield
    if scheduler:
        scheduler.shutdown(wait=False)


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan,
              docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(
    CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"], allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(IntegrityError)
async def integrity_handler(_: Request, exc: IntegrityError):
    log.warning("Integrity error: %s", exc.orig.__class__.__name__)
    return JSONResponse(status_code=409, content={"detail": "The request conflicts with existing data."})


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    log.exception("Unhandled error")
    return JSONResponse(status_code=500, content={"detail": "An unexpected error occurred. Please try again."})


for r in (auth, users, categories, goals, preferences, planning, timetables, progress, dashboard, notifications, admin):
    app.include_router(r.router, prefix="/api/v1")


@app.get("/api/health", tags=["health"])
def health():
    return {"status": "ok"}
