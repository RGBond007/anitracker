"""
What other people are allowed to see.

Notes are the one field on an entry that is working text rather than a fact: they
are where someone writes down what happens. Every social surface therefore sends
`PublicEntryOut`, which has no `notes` field at all, and this file is the check
that it is never quietly swapped back for the private one.
"""

A = {"email": "a@example.com", "username": "alice", "password": "supersecret1"}
B = {"email": "b@example.com", "username": "bob", "password": "supersecret2"}
SPOILER = "The twist is that the mentor dies in episode 19."


async def login(client, who):
    r = await client.post(
        "/api/auth/login", json={"identifier": who["username"], "password": who["password"]}
    )
    assert r.status_code == 200, r.text


async def test_private_notes_do_not_reach_friends(app_client):
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
        f"/api/entries/{added.json()['id']}", json={"notes": SPOILER, "score": 9}
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
    leaked = [name for name, body in surfaces.items() if SPOILER in body]
    assert not leaked, f"Bob's private note leaked through: {leaked}"
