from tests.conftest import login


def test_login_and_me(client, admin_h):
    r = client.get("/api/v1/auth/me", headers=admin_h)
    assert r.status_code == 200
    assert r.json()["role"] == "ADMIN"


def test_bad_login(client):
    r = client.post("/api/v1/auth/login", json={"email": "admin@goals.local", "password": "nope"})
    assert r.status_code == 401


def test_refresh_rotates(client):
    r = client.post("/api/v1/auth/login", json={"email": "admin@goals.local", "password": "Admin@12345"})
    rt = r.json()["refresh_token"]
    r2 = client.post("/api/v1/auth/refresh", json={"refresh_token": rt})
    assert r2.status_code == 200
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": rt}).status_code == 401


def test_admin_creates_user_who_can_login(client, admin_h, alice):
    user, h = alice
    assert client.get("/api/v1/auth/me", headers=h).json()["email"] == "alice@test.local"
    directory = client.get("/api/v1/users/directory", headers=h).json()
    assert [u["name"] for u in directory] == ["Alice"]


def test_duplicate_email_rejected(client, admin_h, alice):
    r = client.post("/api/v1/users", headers=admin_h,
                    json={"name": "A2", "email": "ALICE@test.local", "password": "Password@1"})
    assert r.status_code == 409


def test_user_cannot_access_admin_routes(client, alice):
    _, h = alice
    assert client.get("/api/v1/users", headers=h).status_code == 403
    assert client.post("/api/v1/users", headers=h, json={"name": "x", "email": "x@x.io", "password": "Password@1"}).status_code == 403


def test_deactivated_user_cannot_login(client, admin_h, alice):
    user, h = alice
    client.patch(f"/api/v1/users/{user['id']}/status", headers=admin_h, json={"is_active": False})
    assert client.get("/api/v1/auth/me", headers=h).status_code == 401
    r = client.post("/api/v1/auth/login", json={"email": "alice@test.local", "password": "Password@1"})
    assert r.status_code == 403


def test_password_reset_flow(client, admin_h, alice):
    user, _ = alice
    token = client.post(f"/api/v1/users/{user['id']}/reset-token", headers=admin_h).json()["reset_token"]
    assert client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "NewPass@99"}).status_code == 204
    login(client, "alice@test.local", "NewPass@99")
    assert client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "Again@999"}).status_code == 400
