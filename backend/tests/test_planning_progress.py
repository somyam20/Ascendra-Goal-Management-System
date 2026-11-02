from datetime import date, time, timedelta

import pytest

from app.services import ai_client
from app.utils.common import monday_of
from tests.conftest import create_goal

THIS_MONDAY = monday_of(date.today())


def _setup(client, h):
    client.put("/api/v1/preferences", headers=h, json={
        "wake_time": "06:00", "sleep_time": "23:00", "preferred_working_start": "06:00",
        "preferred_working_end": "23:00", "max_productive_hours": 4, "break_minutes": 10,
        "preferred_task_minutes": 60})
    client.post("/api/v1/activities", headers=h, json={
        "title": "Office", "start_time": "09:00", "end_time": "18:00", "recurrence": "WEEKLY",
        "weekdays": [0, 1, 2, 3, 4]})
    return create_goal(client, h, start_date=(THIS_MONDAY - timedelta(days=7)).isoformat())


def _generate(client, h, prompt="Prioritise job switching"):
    req = client.post("/api/v1/planning/requests", headers=h,
                      json={"user_prompt": prompt, "week_start": THIS_MONDAY.isoformat()}).json()
    return client.post(f"/api/v1/planning/requests/{req['id']}/generate", headers=h)


def test_fallback_generation_creates_valid_draft(client, alice):
    _, h = alice
    _setup(client, h)
    r = _generate(client, h)
    assert r.status_code == 200, r.text
    tt = r.json()
    assert tt["status"] == "DRAFT" and tt["source"] == "fallback" and tt["version"] == 1
    assert tt["tasks"]
    for t in tt["tasks"]:
        d = date.fromisoformat(t["scheduled_date"])
        if d.weekday() < 5:  # never during office hours
            assert t["end_time"] <= "09:00" or t["start_time"] >= "18:00"
        assert "06:00" <= t["start_time"] and t["end_time"] <= "23:00"


def test_gemini_output_validated(client, alice, monkeypatch):
    _, h = alice
    goal = _setup(client, h)
    monkeypatch.setattr(ai_client, "is_configured", lambda: True)
    monkeypatch.setattr(ai_client, "generate_json", lambda *a, **k: {
        "planning_summary": "Focus on DSA", "warnings": [],
        "tasks": [
            {"goal_id": goal["id"], "title": "Solve arrays", "description": "2 problems",
             "duration_minutes": 90, "sessions_per_week": 3, "preferred_time_of_day": "evening"},
            {"goal_id": "00000000-0000-0000-0000-000000000000", "title": "Rogue task",
             "duration_minutes": 60, "sessions_per_week": 2},
        ]})
    tt = _generate(client, h).json()
    assert tt["source"] == "gemini"
    assert {t["title"] for t in tt["tasks"]} == {"Solve arrays"}
    assert any("unknown goal" in w for w in tt["warnings"])


def test_invalid_gemini_json_falls_back(client, alice, monkeypatch):
    _, h = alice
    _setup(client, h)
    monkeypatch.setattr(ai_client, "is_configured", lambda: True)
    monkeypatch.setattr(ai_client, "generate_json", lambda *a, **k: {"tasks": [{"duration_minutes": "lots"}]})
    tt = _generate(client, h).json()
    assert tt["source"] == "fallback" and tt["tasks"]


def test_infeasible_plan_returns_conflict(client, alice):
    _, h = alice
    client.put("/api/v1/preferences", headers=h, json={"unavailable_days": [0, 1, 2, 3, 4, 5, 6]})
    create_goal(client, h)
    r = _generate(client, h)
    assert r.status_code == 409
    assert r.json()["detail"]["conflicts"]


def test_no_goals_is_clear_error(client, alice):
    _, h = alice
    assert _generate(client, h).status_code == 400


def test_edit_validate_approve_and_versioning(client, alice):
    _, h = alice
    goal = _setup(client, h)
    tt = _generate(client, h).json()
    tasks = [{k: t[k] for k in ("id", "goal_id", "title", "description", "scheduled_date", "start_time", "end_time")}
             for t in tt["tasks"]]
    # conflicting edit: overlap office hours on Monday
    bad = tasks + [{"goal_id": goal["id"], "title": "At work", "scheduled_date": THIS_MONDAY.isoformat(),
                    "start_time": "10:00", "end_time": "11:00"}]
    v = client.post(f"/api/v1/timetables/{tt['id']}/validate", headers=h, json={"tasks": bad}).json()
    assert not v["valid"] and any("Office" in c for c in v["conflicts"])
    assert client.put(f"/api/v1/timetables/{tt['id']}/draft", headers=h, json={"tasks": bad}).status_code == 422

    tasks[0]["title"] = "Renamed task"
    saved = client.put(f"/api/v1/timetables/{tt['id']}/draft", headers=h, json={"tasks": tasks}).json()
    assert saved["id"] == tt["id"] and saved["tasks"][0]["title"] in {t["title"] for t in tasks}

    approved = client.post(f"/api/v1/timetables/{tt['id']}/approve", headers=h, json={}).json()
    assert approved["status"] == "APPROVED" and approved["approved_at"]

    # editing an approved timetable creates a new draft version and leaves the original untouched
    new = client.put(f"/api/v1/timetables/{tt['id']}/draft", headers=h, json={"tasks": tasks[1:]}).json()
    assert new["id"] != tt["id"] and new["version"] == 2 and new["status"] == "DRAFT"
    assert client.get(f"/api/v1/timetables/{tt['id']}", headers=h).json()["status"] == "APPROVED"

    # regenerate -> version 3; approving it archives v1 and rejects other drafts
    regen = client.post(f"/api/v1/timetables/{tt['id']}/regenerate", headers=h, json={}).json()
    assert regen["version"] == 3
    client.post(f"/api/v1/timetables/{regen['id']}/approve", headers=h, json={})
    statuses = {t["version"]: t["status"] for t in client.get("/api/v1/timetables", headers=h).json()}
    assert statuses == {1: "ARCHIVED", 2: "REJECTED", 3: "APPROVED"}
    assert client.post(f"/api/v1/timetables/{tt['id']}/approve", headers=h, json={}).status_code == 409


def test_reschedule_on_approved_creates_draft(client, alice):
    _, h = alice
    _setup(client, h)
    tt = _generate(client, h).json()
    client.post(f"/api/v1/timetables/{tt['id']}/approve", headers=h, json={})
    task = tt["tasks"][0]
    sunday = (THIS_MONDAY + timedelta(days=6)).isoformat()
    r = client.post(f"/api/v1/timetables/{tt['id']}/tasks/{task['id']}/reschedule", headers=h,
                    json={"scheduled_date": sunday, "start_time": "06:00", "end_time": "06:30"})
    assert r.status_code == 200, r.text
    moved = [t for t in r.json()["tasks"] if t["status"] == "RESCHEDULED"]
    assert r.json()["status"] == "DRAFT" and moved and moved[0]["scheduled_date"] == sunday


def test_daily_tracking_without_timetable(client, alice):
    _, h = alice
    g = create_goal(client, h)
    today = date.today().isoformat()
    day = client.get("/api/v1/progress/daily", headers=h).json()
    item = next(i for i in day["items"] if i["goal_id"] == g["id"])
    assert item["kind"] == "GOAL" and item["completion_status"] is None
    assert day["summary"]["unmarked"] == 1 and day["summary"]["completion_rate"] is None

    rec = client.post("/api/v1/progress", headers=h, json={"goal_id": g["id"], "activity_date": today,
                                                         "completion_status": 1}).json()
    again = client.post("/api/v1/progress", headers=h, json={"goal_id": g["id"], "activity_date": today,
                                                           "completion_status": 0}).json()
    assert rec["id"] == again["id"] and again["completion_status"] == 0  # no duplicates
    client.put(f"/api/v1/progress/{rec['id']}", headers=h, json={"completion_status": 1})
    day = client.get("/api/v1/progress/daily", headers=h).json()
    assert day["summary"]["completed"] == 1 and day["summary"]["completion_rate"] == 100.0
    assert client.get("/api/v1/progress/streaks", headers=h).json()["current_streak"] == 1

    future = (date.today() + timedelta(days=1)).isoformat()
    assert client.post("/api/v1/progress", headers=h, json={"goal_id": g["id"], "activity_date": future,
                                                          "completion_status": 1}).status_code == 422


def test_deleted_goal_keeps_history(client, alice):
    _, h = alice
    g = create_goal(client, h)
    client.post("/api/v1/progress", headers=h, json={"goal_id": g["id"], "activity_date": date.today().isoformat(),
                                                   "completion_status": 1})
    client.delete(f"/api/v1/goals/{g['id']}", headers=h)
    day = client.get("/api/v1/progress/daily", headers=h).json()
    assert any(i["goal_id"] == g["id"] and i["completion_status"] == 1 for i in day["items"])


def test_task_tracking_with_approved_timetable(client, alice):
    _, h = alice
    _setup(client, h)
    tt = _generate(client, h).json()
    client.post(f"/api/v1/timetables/{tt['id']}/approve", headers=h, json={})
    today = date.today()
    todays = [t for t in tt["tasks"] if t["scheduled_date"] == today.isoformat()]
    day = client.get("/api/v1/progress/daily", headers=h).json()
    assert sum(1 for i in day["items"] if i["kind"] == "TASK") == len(todays)
    other_day = next(t for t in tt["tasks"] if t["scheduled_date"] != today.isoformat())
    r = client.post("/api/v1/progress", headers=h, json={"goal_id": other_day["goal_id"], "task_id": other_day["id"],
                                                       "activity_date": today.isoformat(), "completion_status": 1})
    assert r.status_code == 422  # task not scheduled on that date


@pytest.mark.parametrize("sleep,wake", [(time(23), time(6)), (time(1), time(8))])
def test_awake_windows_handle_midnight(sleep, wake):
    from app.models import UserPreferences
    from app.services.scheduling_service import awake_windows, sleep_hours
    p = UserPreferences(wake_time=wake, sleep_time=sleep)
    assert sleep_hours(p) == 7.0
    assert all(s < e for s, e in awake_windows(p))
