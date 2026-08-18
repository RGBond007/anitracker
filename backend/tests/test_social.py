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


# --- What friends are watching, and what to watch next --------------------


async def befriend(client, other_username: str, other_creds: dict) -> None:
    """Admin and `other` end up accepted friends, whoever is logged in after."""
    await login(client, ADMIN["username"], ADMIN["password"])
    created = await client.post("/api/friends/requests", json={"username": other_username})
    assert created.status_code == 201, created.text
    await login(client, other_creds["username"], other_creds["password"])
    accepted = await client.post(f"/api/friends/requests/{created.json()['id']}/accept")
    assert accepted.status_code == 200, accepted.text


async def track(client, provider_id: str, **fields) -> dict:
    resp = await client.post(
        "/api/entries",
        json={"provider": "stub", "provider_id": provider_id, "type": "anime", **fields},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_friends_watching_shows_one_title_per_friend_and_no_strangers(app_client):
    await setup_admin(app_client)
    await app_client.post("/api/auth/register", json=FRIEND)
    stranger = {"email": "e@example.com", "username": "erin", "password": "erinpassword12"}
    await app_client.post("/api/auth/register", json=stranger)

    # The stranger is watching something too, and must not appear.
    await login(app_client, stranger["username"], stranger["password"])
    await track(app_client, "1535", status="current", progress=3)

    await befriend(app_client, FRIEND["username"], FRIEND)
    await login(app_client, FRIEND["username"], FRIEND["password"])
    await track(app_client, "16498", status="current", progress=7)
    # A second current title from the same friend: the row is people, not events.
    await track(app_client, "900", status="current", progress=2)
    # ...and something finished, which is not "watching".
    await track(app_client, "902", status="completed", progress=13)

    await login(app_client, ADMIN["username"], ADMIN["password"])
    rows = (await app_client.get("/api/friends/watching")).json()

    assert [r["user"]["username"] for r in rows] == ["taro"]
    assert rows[0]["entry"]["status"] == "current"
    # The entry carries its own media row, which is what "S3 · 7/12" is read off.
    assert rows[0]["entry"]["media"]["provider_id"] in {"16498", "900"}


async def test_unfriending_removes_them_from_watching(app_client):
    await setup_admin(app_client)
    await app_client.post("/api/auth/register", json=FRIEND)
    await befriend(app_client, FRIEND["username"], FRIEND)

    await login(app_client, FRIEND["username"], FRIEND["password"])
    await track(app_client, "16498", status="current", progress=1)
    friend_id = (await app_client.get("/api/me")).json()["id"]

    await login(app_client, ADMIN["username"], ADMIN["password"])
    assert len((await app_client.get("/api/friends/watching")).json()) == 1

    assert (await app_client.delete(f"/api/friends/{friend_id}")).status_code == 204
    assert (await app_client.get("/api/friends/watching")).json() == []


async def test_recommendations_come_from_friends_scores_and_explain_themselves(app_client):
    await setup_admin(app_client)
    await app_client.post("/api/auth/register", json=FRIEND)
    await befriend(app_client, FRIEND["username"], FRIEND)

    # Taro loved two things the admin does not have.
    await login(app_client, FRIEND["username"], FRIEND["password"])
    await track(app_client, "1535", status="completed", score=10, progress=37)
    await track(app_client, "910", status="completed", score=9, progress=1)

    # The admin's own favourite is the basis for "because you liked ...".
    await login(app_client, ADMIN["username"], ADMIN["password"])
    await track(app_client, "16498", status="completed", score=10, progress=25)

    body = (await app_client.get("/api/recommendations")).json()

    # Most sure-of-it wins: both have one fan, so the higher score decides.
    assert body["featured"]["media"]["provider_id"] == "1535"
    assert [f["username"] for f in body["featured"]["fans"]] == ["taro"]
    assert body["featured"]["top_score"] == 10

    assert body["because"]["provider_id"] == "16498"
    # The reason is real: the movie shares "Drama" with Attack on Titan.
    personal = {r["media"]["provider_id"]: r for r in body["personal"]}
    assert "910" in personal
    assert "Drama" in personal["910"]["shared_genres"]
    # Nothing already on the admin's list is recommended back to them.
    assert "16498" not in personal


async def test_a_recommendation_disappears_once_it_is_on_your_list(app_client):
    await setup_admin(app_client)
    await app_client.post("/api/auth/register", json=FRIEND)
    await befriend(app_client, FRIEND["username"], FRIEND)

    await login(app_client, FRIEND["username"], FRIEND["password"])
    await track(app_client, "1535", status="completed", score=10, progress=37)

    await login(app_client, ADMIN["username"], ADMIN["password"])
    assert (await app_client.get("/api/recommendations")).json()["featured"] is not None

    # "Add to plan" is the ordinary entry endpoint, and adding it twice is refused.
    await track(app_client, "1535", status="planned")
    duplicate = await app_client.post(
        "/api/entries",
        json={"provider": "stub", "provider_id": "1535", "type": "anime", "status": "planned"},
    )
    assert duplicate.status_code == 409

    assert (await app_client.get("/api/recommendations")).json()["featured"] is None


async def test_recommendations_are_empty_without_friends(app_client):
    await setup_admin(app_client)
    await track(app_client, "16498", status="completed", score=10, progress=25)

    body = (await app_client.get("/api/recommendations")).json()
    assert body["featured"] is None
    assert body["personal"] == []


async def test_friends_data_requires_a_session(app_client):
    await setup_admin(app_client)
    await app_client.post("/api/auth/logout")
    assert (await app_client.get("/api/friends/watching")).status_code == 401
    assert (await app_client.get("/api/recommendations")).status_code == 401
