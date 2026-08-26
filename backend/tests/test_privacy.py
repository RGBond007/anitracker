"""
What other people are allowed to see.

Notes are the delicate field: they are where someone writes down what happens, so
they are both the most interesting thing a friend can read and the most dangerous.
Two rules, both enforced on the server, and both checked here:

* accepted friends only -- never a stranger browsing a public profile;
* flagged when the author is ahead, so the client can cover them.
"""

A = {"email": "a@example.com", "username": "alice", "password": "supersecret1"}
B = {"email": "b@example.com", "username": "bob", "password": "supersecret2"}
SPOILER = "The twist is that the mentor dies in episode 19."


async def login(client, who):
    r = await client.post(
        "/api/auth/login", json={"identifier": who["username"], "password": who["password"]}
    )
    assert r.status_code == 200, r.text


async def test_notes_reach_friends_and_carry_the_ahead_flag(app_client):
    assert (await app_client.post("/api/setup", json=A)).status_code == 201
    assert (await app_client.post("/api/auth/register", json=B)).status_code == 201

    # Alice and Bob become friends.
    await login(app_client, A)
    created = await app_client.post("/api/friends/requests", json={"username": "bob"})
    await login(app_client, B)
    await app_client.post(f"/api/friends/requests/{created.json()['id']}/accept")

    # Bob tracks something and writes a private note on it.
    added = await app_client.post(
        "/api/entries",
        json={"provider": "stub", "provider_id": "900", "type": "anime", "status": "current"},
    )
    assert added.status_code == 201, added.text
    await app_client.patch(
        f"/api/entries/{added.json()['id']}",
        # Progress matters: `author_ahead` is about how far in he is, not who he is.
        json={"notes": SPOILER, "score": 9, "progress": 19},
    )

    # Alice looks at every social surface.
    await login(app_client, A)
    await app_client.post(
        "/api/entries",
        json={"provider": "stub", "provider_id": "900", "type": "anime", "status": "current"},
    )
    surfaces = {
        "feed": (await app_client.get("/api/feed")).text,
        "profile": (await app_client.get("/api/users/bob")).text,
        "compare": (await app_client.get("/api/users/bob/compare")).text,
        "watching": (await app_client.get("/api/friends/watching")).text,
    }
    # A friend may read them; that is the point of reopening them.
    carried = [name for name, body in surfaces.items() if SPOILER in body]
    assert set(carried) == {"feed", "profile", "compare", "watching"}, carried

    # And every one is flagged, because Bob is further into the title than Alice.
    feed = (await app_client.get("/api/feed")).json()
    assert feed[0]["entry"]["notes"] == SPOILER
    assert feed[0]["entry"]["author_ahead"] is True


async def test_spoiler_protection_defaults_on_for_a_new_account(app_client):
    """
    The default that matters. Protection nobody wanted costs one tap in Settings;
    protection somebody wanted but did not get costs them the story.
    """
    assert (await app_client.post("/api/setup", json=A)).status_code == 201
    assert (await app_client.get("/api/me")).json()["spoiler_protection"] is True


async def test_spoiler_protection_is_a_preference_the_owner_controls(app_client):
    assert (await app_client.post("/api/setup", json=A)).status_code == 201
    off = await app_client.patch("/api/me", json={"spoiler_protection": False})
    assert off.status_code == 200
    assert off.json()["spoiler_protection"] is False
    assert (await app_client.get("/api/me")).json()["spoiler_protection"] is False


async def test_the_preference_is_not_visible_to_other_people(app_client):
    """It is a setting about the reader, not a fact about them worth publishing."""
    assert (await app_client.post("/api/setup", json=A)).status_code == 201
    assert (await app_client.post("/api/auth/register", json=B)).status_code == 201
    await login(app_client, A)
    body = (await app_client.get("/api/users/bob")).text
    assert "spoiler_protection" not in body


async def test_a_public_profile_does_not_publish_notes_to_strangers(app_client):
    """
    The rule that survived reopening notes. Making a list public widens who may
    browse it; it does not hand the whole instance the owner's working notes.
    """
    assert (await app_client.post("/api/setup", json=A)).status_code == 201
    assert (await app_client.post("/api/auth/register", json=B)).status_code == 201

    # Bob makes his list public and writes a note on something.
    await login(app_client, B)
    await app_client.patch("/api/me", json={"profile_public": True})
    added = await app_client.post(
        "/api/entries",
        json={"provider": "stub", "provider_id": "900", "type": "anime", "status": "current"},
    )
    await app_client.patch(f"/api/entries/{added.json()['id']}", json={"notes": SPOILER})

    # Alice is not his friend. She can see the list and must not see the note.
    await login(app_client, A)
    profile = (await app_client.get("/api/users/bob")).json()
    assert profile["visible"] is True
    assert profile["entries"], "the list itself is public"
    assert all(e["notes"] is None for e in profile["entries"])
    assert SPOILER not in (await app_client.get("/api/users/bob")).text


async def test_a_note_from_someone_level_or_behind_is_not_flagged(app_client):
    """`author_ahead` is about progress, not about who wrote it."""
    assert (await app_client.post("/api/setup", json=A)).status_code == 201
    assert (await app_client.post("/api/auth/register", json=B)).status_code == 201

    await login(app_client, A)
    made = await app_client.post("/api/friends/requests", json={"username": "bob"})
    await login(app_client, B)
    await app_client.post(f"/api/friends/requests/{made.json()['id']}/accept")

    theirs = await app_client.post(
        "/api/entries",
        json={"provider": "stub", "provider_id": "900", "type": "anime", "status": "current"},
    )
    await app_client.patch(
        f"/api/entries/{theirs.json()['id']}", json={"progress": 3, "notes": "fine so far"}
    )

    await login(app_client, A)
    mine = await app_client.post(
        "/api/entries",
        json={"provider": "stub", "provider_id": "900", "type": "anime", "status": "current"},
    )
    await app_client.patch(f"/api/entries/{mine.json()['id']}", json={"progress": 5})

    feed = (await app_client.get("/api/feed")).json()
    theirs_row = next(r for r in feed if r["user"]["username"] == "bob")
    assert theirs_row["entry"]["notes"] == "fine so far"
    # Alice is further in than Bob, so his note cannot spoil anything for her.
    assert theirs_row["entry"]["author_ahead"] is False
