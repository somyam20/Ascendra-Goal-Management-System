from datetime import date, timedelta

from tests.conftest import create_goal, first_category


def test_default_categories_selected(client, alice):
    _, h = alice
    cats = client.get("/api/v1/categories", headers=h).json()
    assert {c["name"] for c in cats} >= {"Exercise", "Job Switch", "Thesis", "Studies"}
    assert all(c["is_selected"] for c in cats)


def test_custom_category_select_unselect(client, alice, bob):
    _, h = alice
    r = client.post("/api/v1/categories", headers=h, json={"name": "Reading", "icon": "book"})
    assert r.status_code == 201
    cid = r.json()["id"]
    assert client.delete(f"/api/v1/categories/{cid}/select", headers=h).status_code == 204
    cat = next(c for c in client.get("/api/v1/categories", headers=h).json() if c["id"] == cid)
    assert cat["is_selected"] is False
    # Bob can neither see in his own list nor edit Alice's custom category
    _, bh = bob
    assert all(c["id"] != cid for c in client.get("/api/v1/categories", headers=bh).json())
    assert client.put(f"/api/v1/categories/{cid}", headers=bh, json={"name": "Hacked"}).status_code == 404


def test_users_cannot_edit_default_categories(client, alice):
    _, h = alice
    cid = first_category(client, h)
    assert client.put(f"/api/v1/categories/{cid}", headers=h, json={"name": "X"}).status_code == 403


def test_goal_crud_and_history(client, alice):
    _, h = alice
    g = create_goal(client, h, milestones=[{"title": "Arrays"}])
    assert g["status"] == "ACTIVE" and g["approval_status"] == "APPROVED"
    body = {k: g[k] for k in ("title", "description", "category_id", "start_date", "end_date", "importance")}
    body["title"] = "Practice DSA daily"
    body["milestones"] = [{"id": g["milestones"][0]["id"], "title": "Arrays", "status": "COMPLETED"}, {"title": "Graphs"}]
    r = client.put(f"/api/v1/goals/{g['id']}", headers=h, json=body)
    assert r.status_code == 200
    assert [m["title"] for m in r.json()["milestones"]] == ["Arrays", "Graphs"]
    assert client.patch(f"/api/v1/goals/{g['id']}/status", headers=h, json={"status": "PAUSED"}).json()["status"] == "PAUSED"
    hist = client.get(f"/api/v1/goals/{g['id']}/history", headers=h).json()
    assert {e["action"] for e in hist} >= {"CREATED", "UPDATED", "STATUS_CHANGED"}
    assert client.delete(f"/api/v1/goals/{g['id']}", headers=h).status_code == 204
    assert client.get(f"/api/v1/goals/{g['id']}", headers=h).status_code == 404


def test_goal_date_validation(client, alice):
    _, h = alice
    today = date.today()
    r = client.post("/api/v1/goals", headers=h, json={
        "title": "Bad", "category_id": first_category(client, h), "start_date": today.isoformat(),
        "end_date": (today - timedelta(days=1)).isoformat(), "importance": "LOW"})
    assert r.status_code == 422
    r = client.post("/api/v1/goals", headers=h, json={
        "title": "", "category_id": first_category(client, h), "start_date": today.isoformat(),
        "end_date": today.isoformat()})
    assert r.status_code == 422


def test_goal_filters(client, alice):
    _, h = alice
    create_goal(client, h, title="A", importance="LOW")
    create_goal(client, h, title="B", importance="CRITICAL")
    r = client.get("/api/v1/goals", headers=h, params={"importance": "CRITICAL"}).json()
    assert r["total"] == 1 and r["items"][0]["title"] == "B"
    r = client.get("/api/v1/goals", headers=h, params={"sort": "importance"}).json()
    assert r["items"][0]["title"] == "B"


def test_ai_goal_requires_approval(client, alice):
    _, h = alice
    start, end = date.today().isoformat(), (date.today() + timedelta(days=90)).isoformat()
    sugg = client.post("/api/v1/goals/ai-decompose", headers=h, json={
        "title": "Switch jobs in three months", "start_date": start, "end_date": end}).json()
    assert sugg["source"] == "fallback" and len(sugg["milestones"]) >= 3
    g = create_goal(client, h, title=sugg["suggested_title"], ai_generated=True, start_date=start, end_date=end,
                    milestones=[m for m in sugg["milestones"]])
    assert g["approval_status"] == "PENDING_REVIEW" and g["status"] == "DRAFT"
    assert client.patch(f"/api/v1/goals/{g['id']}/status", headers=h, json={"status": "ACTIVE"}).status_code == 409
    r = client.post(f"/api/v1/goals/{g['id']}/approve", headers=h, json={"approve": True})
    assert r.json()["approval_status"] == "APPROVED" and r.json()["status"] == "ACTIVE"
    assert client.post(f"/api/v1/goals/{g['id']}/approve", headers=h, json={"approve": True}).status_code == 409


def test_data_isolation_and_read_only_viewing(client, alice, bob):
    alice_user, ah = alice
    _, bh = bob
    g = create_goal(client, ah)
    # Bob may view Alice's goals read-only...
    r = client.get("/api/v1/goals", headers=bh, params={"user_id": alice_user["id"]})
    assert r.json()["total"] == 1
    assert client.get(f"/api/v1/goals/{g['id']}", headers=bh, params={"user_id": alice_user["id"]}).status_code == 200
    # ...but cannot read it as his own nor modify it
    assert client.get(f"/api/v1/goals/{g['id']}", headers=bh).status_code == 404
    body = {k: g[k] for k in ("title", "category_id", "start_date", "end_date", "importance")}
    assert client.put(f"/api/v1/goals/{g['id']}?user_id={alice_user['id']}", headers=bh, json=body).status_code == 404
    assert client.delete(f"/api/v1/goals/{g['id']}", headers=bh).status_code == 404
    assert client.post("/api/v1/progress", headers=bh, json={
        "goal_id": g["id"], "activity_date": date.today().isoformat(), "completion_status": 1}).status_code == 404
    # Private data is not viewable
    assert client.get("/api/v1/preferences", headers=bh, params={"user_id": alice_user["id"]}).json()["timezone"]
