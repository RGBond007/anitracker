"""
The small social surfaces: who else is watching, comparing scores, reactions, and
shelves someone chose to show.

The recurring property is restraint. Everything here reports facts a friend already
has a right to see, nothing carries free text, and nothing is exposed that its owner
did not deliberately expose.
"""

A = {"email": "a@example.com", "username": "alice", "password": "supersecret1"}
B = {"email": "b@example.com", "username": "bob", "password": "supersecret2"}
C = {"email": "c@example.com", "username": "carol", "password": "supersecret3"}

S1, S2 = "900", "901"


async def login(client, who):
    r = await client.post(
        "/api/auth/login", json={"identifier": who["username"], "password": who["password"]}
    )
    assert r.status_code == 200, r.text


async def befriend(client, first, second):
    await login(client, first)
    created = await client.post("/api/friends/requests", json={"username": second["username"]})
    assert created.status_code == 201, created.text
    await login(client, second)
    accepted = await client.post(f"/api/friends/requests/{created.json()['id']}/accept")
    assert accepted.status_code == 200, accepted.text


async def setup(client):
    assert (await client.post("/api/setup", json=A)).status_code == 201
    for who in (B, C):
        assert (await client.post("/api/auth/register", json=who)).status_code == 201
    await befriend(client, A, B)
    await login(client, A)


async def add(client, provider_id=S1, **fields):
    resp = await client.post(
        "/api/entries",
        json={
            "provider": "stub",
            "provider_id": provider_id,
            "type": "anime",
            "status": "current",
            **fields,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


# --- Friends on a title, and score comparison -----------------------------


async def test_friends_on_a_title_and_my_score(app_client):
    await setup(app_client)
    await login(app_client, B)
    bob_entry = await add(app_client, status="completed")
    await app_client.patch(f"/api/entries/{bob_entry}", json={"score": 8, "notes": "SECRET"})

    await login(app_client, A)
    mine = await add(app_client)
    await app_client.patch(f"/api/entries/{mine}", json={"score": 10})

    body = (await app_client.get(f"/api/media/stub/{S1}/friends")).json()
    assert body["my_score"] == 10
    assert [f["user"]["username"] for f in body["friends"]] == ["bob"]
    assert body["friends"][0]["score"] == 8
    assert body["friends"][0]["status"] == "completed"
    # Never the note.
    assert "SECRET" not in str(body)


async def test_a_stranger_is_not_on_the_title(app_client):
    await setup(app_client)
    await login(app_client, C)
    await add(app_client)  # Carol tracks it but is nobody's friend.

    await login(app_client, A)
    body = (await app_client.get(f"/api/media/stub/{S1}/friends")).json()
    assert body["friends"] == []


async def test_no_friends_is_an_empty_list_not_an_error(app_client):
    await setup(app_client)
    await login(app_client, C)
    body = (await app_client.get(f"/api/media/stub/{S1}/friends")).json()
    assert body == {"friends": [], "my_score": None}


# --- Completion reactions -------------------------------------------------


async def test_react_to_a_friends_completion(app_client):
    await setup(app_client)
    await login(app_client, B)
    entry = await add(app_client, status="completed")

    await login(app_client, A)
    resp = await app_client.put(f"/api/entries/{entry}/reactions", json={"kind": "clapped"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["mine"] == "clapped"
    assert [r["user"]["username"] for r in resp.json()["reactions"]] == ["alice"]


async def test_one_reaction_each_replaces_rather_than_stacks(app_client):
    await setup(app_client)
    await login(app_client, B)
    entry = await add(app_client, status="completed")

    await login(app_client, A)
    await app_client.put(f"/api/entries/{entry}/reactions", json={"kind": "clapped"})
    second = await app_client.put(f"/api/entries/{entry}/reactions", json={"kind": "crying"})
    assert len(second.json()["reactions"]) == 1
    assert second.json()["mine"] == "crying"


async def test_reactions_can_be_taken_back(app_client):
    await setup(app_client)
    await login(app_client, B)
    entry = await add(app_client, status="completed")
    await login(app_client, A)
    await app_client.put(f"/api/entries/{entry}/reactions", json={"kind": "same"})
    gone = await app_client.delete(f"/api/entries/{entry}/reactions")
    assert gone.json()["reactions"] == []
    assert gone.json()["mine"] is None


async def test_cannot_react_to_something_unfinished(app_client):
    await setup(app_client)
    await login(app_client, B)
    entry = await add(app_client, status="current")
    await login(app_client, A)
    resp = await app_client.put(f"/api/entries/{entry}/reactions", json={"kind": "clapped"})
    assert resp.status_code == 409


async def test_cannot_react_to_a_strangers_entry(app_client):
    await setup(app_client)
    await login(app_client, C)
    entry = await add(app_client, status="completed")
    await login(app_client, A)
    resp = await app_client.put(f"/api/entries/{entry}/reactions", json={"kind": "clapped"})
    assert resp.status_code == 404


async def test_reactions_are_a_closed_set(app_client):
    """No free text anywhere: an unknown kind is refused by the schema."""
    await setup(app_client)
    await login(app_client, B)
    entry = await add(app_client, status="completed")
    await login(app_client, A)
    resp = await app_client.put(
        f"/api/entries/{entry}/reactions", json={"kind": "you are wrong about this show"}
    )
    assert resp.status_code == 422


async def test_unfriending_hides_reactions(app_client):
    await setup(app_client)
    await login(app_client, B)
    entry = await add(app_client, status="completed")
    await login(app_client, A)
    await app_client.put(f"/api/entries/{entry}/reactions", json={"kind": "clapped"})

    me = (await app_client.get("/api/me")).json()["id"]
    await login(app_client, B)
    bob_sees = await app_client.get(f"/api/entries/{entry}/reactions")
    assert len(bob_sees.json()["reactions"]) == 1

    # Bob removes Alice.
    assert (await app_client.delete(f"/api/friends/{me}")).status_code == 204
    await login(app_client, A)
    assert (await app_client.get(f"/api/entries/{entry}/reactions")).status_code == 404


# --- Shared shelves -------------------------------------------------------


async def test_shelves_are_private_until_shared(app_client):
    await setup(app_client)
    made = await app_client.post("/api/shelves", json={"name": "Comfort shows"})
    assert made.status_code == 201
    # The default is the whole point.
    assert made.json()["is_shared"] is False

    await login(app_client, B)
    assert (await app_client.get("/api/users/alice/shelves")).json() == []


async def test_sharing_is_explicit_and_reversible(app_client):
    await setup(app_client)
    shelf = (await app_client.post("/api/shelves", json={"name": "Comfort shows"})).json()
    entry = await add(app_client)
    await app_client.post(f"/api/shelves/{shelf['id']}/items", json={"entry_id": entry})

    shared = await app_client.patch(f"/api/shelves/{shelf['id']}", json={"is_shared": True})
    assert shared.json()["is_shared"] is True

    await login(app_client, B)
    seen = (await app_client.get("/api/users/alice/shelves")).json()
    assert [s["name"] for s in seen] == ["Comfort shows"]
    assert seen[0]["item_count"] == 1

    await login(app_client, A)
    await app_client.patch(f"/api/shelves/{shelf['id']}", json={"is_shared": False})
    await login(app_client, B)
    assert (await app_client.get("/api/users/alice/shelves")).json() == []


async def test_a_stranger_cannot_see_shared_shelves_of_a_private_profile(app_client):
    await setup(app_client)
    shelf = (await app_client.post("/api/shelves", json={"name": "Favorites"})).json()
    await app_client.patch(f"/api/shelves/{shelf['id']}", json={"is_shared": True})

    # Carol is not a friend and Alice's profile is not public.
    await login(app_client, C)
    assert (await app_client.get("/api/users/alice/shelves")).status_code == 404


async def test_only_shared_shelves_are_listed(app_client):
    await setup(app_client)
    public = (await app_client.post("/api/shelves", json={"name": "Favorites"})).json()
    await app_client.post("/api/shelves", json={"name": "Private thoughts"})
    await app_client.patch(f"/api/shelves/{public['id']}", json={"is_shared": True})

    await login(app_client, B)
    seen = (await app_client.get("/api/users/alice/shelves")).json()
    assert [s["name"] for s in seen] == ["Favorites"]
