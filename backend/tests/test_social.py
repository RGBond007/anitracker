"""
Covers the parts added after v1 whose failure mode is a leak rather than a 500:
list privacy, the one-time-password gate, and the rate limiter.
"""

ADMIN = {"email": "admin@example.com", "username": "admin", "password": "supersecret1"}
FRIEND = {"email": "taro@example.com", "username": "taro", "password": "anotherpw12"}


async def setup_admin(client):
    assert (await client.post("/api/setup", json=ADMIN)).status_code == 201


async def login(client, identifier, password):
    resp = await client.post(
        "/api/auth/login", json={"identifier": identifier, "password": password}
    )
    assert resp.status_code == 200, resp.text
    return dict(resp.cookies)


async def test_a_strangers_list_is_private_until_you_are_friends(app_client):
    await setup_admin(app_client)
    assert (await app_client.post("/api/auth/register", json=FRIEND)).status_code == 201

    # As taro, add a title so there is something worth hiding.
    await login(app_client, FRIEND["username"], FRIEND["password"])
    assert (
        await app_client.post(
            "/api/entries",
            json={"provider": "stub", "provider_id": "16498", "type": "anime", "status": "current"},
        )
    ).status_code == 201

    await login(app_client, ADMIN["username"], ADMIN["password"])
    profile = (await app_client.get("/api/users/taro")).json()
    assert profile["relationship"] == "none"
    assert profile["visible"] is False
    assert profile["entries"] == []
    # The counts must not leak the size of a hidden list either.
    assert profile["anime"]["total"] == 0
    assert (await app_client.get("/api/users/taro/compare")).status_code == 403


async def test_accepting_a_request_opens_the_list_and_removing_closes_it(app_client):
    await setup_admin(app_client)
    await app_client.post("/api/auth/register", json=FRIEND)

    await login(app_client, ADMIN["username"], ADMIN["password"])
    created = await app_client.post("/api/friends/requests", json={"username": "taro"})
    assert created.status_code == 201
    request_id = created.json()["id"]
    # The requester may not accept their own invitation.
    assert (await app_client.post(f"/api/friends/requests/{request_id}/accept")).status_code == 404

    await login(app_client, FRIEND["username"], FRIEND["password"])
    assert (await app_client.post(f"/api/friends/requests/{request_id}/accept")).status_code == 200

    await login(app_client, ADMIN["username"], ADMIN["password"])
    assert (await app_client.get("/api/users/taro")).json()["visible"] is True

    taro_id = (await app_client.get("/api/friends")).json()["friends"][0]["user"]["id"]
    assert (await app_client.delete(f"/api/friends/{taro_id}")).status_code == 204
    assert (await app_client.get("/api/users/taro")).json()["visible"] is False


async def test_mutual_requests_collapse_into_one_accepted_friendship(app_client):
    await setup_admin(app_client)
    await app_client.post("/api/auth/register", json=FRIEND)

    await login(app_client, FRIEND["username"], FRIEND["password"])
    assert (
        await app_client.post("/api/friends/requests", json={"username": "admin"})
    ).status_code == 201

    # Asking back is an accept, not a second row — the unique pair constraint
    # would reject the insert.
    await login(app_client, ADMIN["username"], ADMIN["password"])
    back = await app_client.post("/api/friends/requests", json={"username": "taro"})
    assert back.status_code == 201
    assert back.json()["state"] == "accepted"
    assert len((await app_client.get("/api/friends")).json()["friends"]) == 1


async def test_user_search_cannot_be_wildcarded_into_a_user_dump(app_client):
    await setup_admin(app_client)
    await app_client.post("/api/auth/register", json=FRIEND)
    await login(app_client, ADMIN["username"], ADMIN["password"])

    assert [u["username"] for u in (await app_client.get("/api/users/search?q=ta")).json()] == [
        "taro"
    ]
    # `%` and `_` are LIKE metacharacters; unescaped they match every row.
    assert (await app_client.get("/api/users/search?q=%")).json() == []
    assert (await app_client.get("/api/users/search?q=_")).json() == []


async def test_one_time_password_blocks_everything_until_it_is_changed(app_client):
    await setup_admin(app_client)
    await login(app_client, ADMIN["username"], ADMIN["password"])

    created = await app_client.post(
        "/api/admin/users", json={"email": "new@example.com", "username": "newbie"}
    )
    assert created.status_code == 201
    temporary = created.json()["temporary_password"]
    assert created.json()["user"]["must_change_password"] is True

    await login(app_client, "newbie", temporary)
    # Readable, so the UI can explain why it is blocked.
    assert (await app_client.get("/api/me")).status_code == 200
    for path in ("/api/dashboard", "/api/entries", "/api/friends", "/api/feed"):
        assert (await app_client.get(path)).status_code == 403, path

    changed = await app_client.post(
        "/api/me/password",
        json={"current_password": temporary, "new_password": "chosen-password1"},
    )
    assert changed.status_code == 204
    assert (await app_client.get("/api/me")).json()["must_change_password"] is False
    assert (await app_client.get("/api/dashboard")).status_code == 200
    # The temporary secret is spent.
    spent = await app_client.post(
        "/api/auth/login", json={"identifier": "newbie", "password": temporary}
    )
    assert spent.status_code == 401


async def test_repeated_bad_logins_are_rate_limited(app_client):
    await setup_admin(app_client)

    codes = []
    for _ in range(8):
        resp = await app_client.post(
            "/api/auth/login", json={"identifier": "admin", "password": "wrong-one"}
        )
        codes.append(resp.status_code)

    assert 429 in codes, codes
    # A failure costs double, so the budget of 10 is gone after 5 attempts.
    assert codes.index(429) == 5, codes
    assert (
        "Retry-After"
        in (
            await app_client.post(
                "/api/auth/login", json={"identifier": "admin", "password": "wrong-one"}
            )
        ).headers
    )
