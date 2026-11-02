import os
import tempfile
from datetime import date, timedelta

_db_file = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_db_file}"
os.environ["ENABLE_SCHEDULER"] = "false"
os.environ["GEMINI_API_KEY"] = ""
os.environ["JWT_SECRET"] = "test-secret"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import app.models  # noqa: E402,F401
from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.main import app  # noqa: E402

ADMIN = {"email": "admin@goals.local", "password": "Admin@12345"}


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app) as c:
        yield c


def login(client, email, password):
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture()
def admin_h(client):
    return login(client, **ADMIN)


def make_user(client, admin_h, name):
    email = f"{name.lower()}@test.local"
    r = client.post("/api/v1/users", headers=admin_h,
                    json={"name": name, "email": email, "password": "Password@1", "role": "USER"})
    assert r.status_code == 201, r.text
    return r.json(), login(client, email, "Password@1")


@pytest.fixture()
def alice(client, admin_h):
    return make_user(client, admin_h, "Alice")


@pytest.fixture()
def bob(client, admin_h):
    return make_user(client, admin_h, "Bob")


def first_category(client, h):
    return client.get("/api/v1/categories", headers=h).json()[0]["id"]


def create_goal(client, h, **over):
    today = date.today()
    body = {"title": "Practice DSA", "description": "Arrays and graphs", "category_id": first_category(client, h),
            "start_date": (today - timedelta(days=7)).isoformat(),
            "end_date": (today + timedelta(days=60)).isoformat(), "importance": "HIGH"}
    body.update(over)
    r = client.post("/api/v1/goals", headers=h, json=body)
    assert r.status_code == 201, r.text
    return r.json()
