from datetime import date, timedelta

from tests.conftest import create_goal, make_user


def _mark(client, h, goal_id, statuses):
    for i, s in enumerate(statuses):
        d = (date.today() - timedelta(days=i)).isoformat()
        client.post("/api/v1/progress", headers=h, json={"goal_id": goal_id, "activity_date": d, "completion_status": s})


def test_leaderboard_is_fair(client, admin_h):
    (_, a), (_, b), (_, c) = (make_user(client, admin_h, n) for n in ("Ann", "Ben", "Cat"))
    ga, gb, gc = create_goal(client, a), create_goal(client, b), create_goal(client, c)
    today = date.today()
    n = min(today.weekday() + 1, 7)
    # Ann: many tasks, lower rate. Ben: fewer tasks, perfect rate. Cat: only one evaluated (ineligible).
    _mark(client, a, ga["id"], ([1, 0] * 7)[:n] if n > 1 else [1])
    _mark(client, b, gb["id"], [1] * n)
    _mark(client, c, gc["id"], [None] * (n - 1) + [1])
    client.put("/api/v1/admin/settings", headers=admin_h, json={"leaderboard_min_evaluated": 2})
    lb = client.get("/api/v1/dashboard/leaderboard", headers=a, params={"period": "weekly"}).json()
    names = [e["name"] for e in lb["entries"]]
    if n >= 2:
        assert names[0] == "Ben" and lb["entries"][0]["rank"] == 1
        cat = next(e for e in lb["entries"] if e["name"] == "Cat")
        assert cat["eligible"] is False and cat["rank"] is None and cat["evaluated"] == 1
        assert names[-1] == "Cat"


def test_dashboard_endpoints_reflect_activity(client, admin_h):
    _, h = make_user(client, admin_h, "Dee")
    g = create_goal(client, h, end_date=(date.today() + timedelta(days=5)).isoformat())
    _mark(client, h, g["id"], [1])
    s = client.get("/api/v1/dashboard/summary", headers=h).json()
    assert s["total_users"] == 1 and s["total_active_goals"] == 1 and s["total_completed_tasks"] == 1
    assert s["group_completion_rate"] == 100.0
    users = client.get("/api/v1/dashboard/users", headers=h).json()
    assert users[0]["name"] == "Dee" and users[0]["evaluated"] == 1
    trends = client.get("/api/v1/dashboard/trends", headers=h, params={"granularity": "daily"}).json()
    assert trends["series"][-1]["group_rate"] == 100.0
    assert client.get("/api/v1/dashboard/upcoming-deadlines", headers=h).json()[0]["title"] == g["title"]
    assert client.get("/api/v1/dashboard/categories", headers=h).json()
    client.patch(f"/api/v1/goals/{g['id']}/status", headers=h, json={"status": "COMPLETED"})
    assert client.get("/api/v1/dashboard/achievements", headers=h).json()[0]["kind"] == "GOAL_COMPLETED"
    r = client.get("/api/v1/dashboard/summary", headers=h, params={"period": "custom"})
    assert r.status_code == 422


def test_notifications_idempotent_and_styled(client, admin_h):
    _, h = make_user(client, admin_h, "Eve")
    create_goal(client, h, end_date=date.today().isoformat(), start_date=date.today().isoformat())
    client.put("/api/v1/preferences/feedback-style", headers=h, json={"feedback_style": "STRICT"})
    first = client.post("/api/v1/notifications/generate", headers=h, json={"kind": "DAILY"}).json()
    again = client.post("/api/v1/notifications/generate", headers=h, json={"kind": "DAILY"}).json()
    assert first and again == []
    daily = next(n for n in first if n["notification_type"] == "DAILY_REMINDER")
    assert "is due today" in daily["message"] and "get them done" in daily["message"]
    page = client.get("/api/v1/notifications", headers=h).json()
    assert page["unread_count"] == len(first)
    client.patch(f"/api/v1/notifications/{daily['id']}/read", headers=h)
    assert client.get("/api/v1/notifications", headers=h).json()["unread_count"] == len(first) - 1
    pending = client.get("/api/v1/notifications/pending-goals", headers=h).json()
    assert len(pending["due_today"]) == 1 and pending["pending_tasks_today"]
    client.post("/api/v1/notifications/read-all", headers=h)
    assert client.get("/api/v1/notifications", headers=h).json()["unread_count"] == 0
    for kind in ("EVENING", "WEEKLY"):
        assert client.post("/api/v1/notifications/generate", headers=h, json={"kind": kind}).status_code == 200


def test_scheduler_job_runs(client, admin_h):
    from app.workers.scheduler import run_due_notifications
    make_user(client, admin_h, "Fay")
    assert run_due_notifications() >= 0


def test_admin_audit_logs(client, admin_h):
    make_user(client, admin_h, "Gus")
    logs = client.get("/api/v1/admin/audit-logs", headers=admin_h, params={"entity_type": "user"}).json()
    assert logs["total"] >= 1 and logs["items"][0]["entity_type"] == "user"
