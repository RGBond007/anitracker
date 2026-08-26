"""
The viewing journal: dated notes about single episodes.

Two properties matter. It is *private* -- there is no endpoint that hands one of
these to anyone but its author -- and a rewatch writes a new memory rather than
editing the old one.
"""

A = {"email": "a@example.com", "username": "alice", "password": "supersecret1"}
B = {"email": "b@example.com", "username": "bob", "password": "supersecret2"}

S1, S2 = "900", "901"


async def login(client, who):
    r = await client.post(
        "/api/auth/login", json={"identifier": who["username"], "password": who["password"]}
    )
    assert r.status_code == 200, r.text


async def setup(client):
    assert (await client.post("/api/setup", json=A)).status_code == 201
    assert (await client.post("/api/auth/register", json=B)).status_code == 201
    await login(client, A)


async def track(client, provider_id=S1, **fields) -> int:
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


async def write(client, entry_id, unit, **fields):
    return await client.put(f"/api/entries/{entry_id}/journal", json={"unit": unit, **fields})


# --- Writing ---------------------------------------------------------------


async def test_a_note_about_one_episode(app_client):
    await setup(app_client)
    entry = await track(app_client)
    resp = await write(app_client, entry, 7, note="  Great character episode.  ", mood="moved")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["unit"] == 7
    assert body["note"] == "Great character episode."  # trimmed
    assert body["mood"] == "moved"
    assert body["rewatch_index"] == 0


async def test_everything_but_the_episode_is_optional(app_client):
    """A mood alone is a real entry; so is a favourite with nothing written."""
    await setup(app_client)
    entry = await track(app_client)
    assert (await write(app_client, entry, 3, mood="funny")).status_code == 200
    only_star = await write(app_client, entry, 4, is_favorite=True)
    assert only_star.status_code == 200
    assert only_star.json()["note"] is None
    assert only_star.json()["is_favorite"] is True


async def test_writing_the_same_episode_again_edits_it(app_client):
    await setup(app_client)
    entry = await track(app_client)
    await write(app_client, entry, 7, note="first thought")
    second = await write(app_client, entry, 7, note="on reflection")
    assert second.json()["note"] == "on reflection"
    assert len((await app_client.get(f"/api/entries/{entry}/journal")).json()) == 1


async def test_episode_zero_is_refused(app_client):
    await setup(app_client)
    entry = await track(app_client)
    assert (await write(app_client, entry, 0, note="nope")).status_code == 422


# --- Rewatches -------------------------------------------------------------


async def test_a_rewatch_writes_a_new_memory_beside_the_old_one(app_client):
    """
    The point of `rewatch_index`. Watching episode 7 again should not overwrite
    what you thought the first time — that is the memory worth keeping.
    """
    await setup(app_client)
    entry = await track(app_client)
    await write(app_client, entry, 7, note="first time through")

    # Start a second pass.
    await app_client.patch(f"/api/entries/{entry}", json={"rewatch_count": 1})
    await write(app_client, entry, 7, note="noticed the foreshadowing")

    rows = (await app_client.get(f"/api/entries/{entry}/journal")).json()
    assert [(r["rewatch_index"], r["note"]) for r in rows] == [
        (0, "first time through"),
        (1, "noticed the foreshadowing"),
    ]


async def test_the_pass_comes_from_the_entry_not_the_client(app_client):
    """A client cannot aim a write at an older pass and overwrite it."""
    await setup(app_client)
    entry = await track(app_client)
    await write(app_client, entry, 5, note="original")
    await app_client.patch(f"/api/entries/{entry}", json={"rewatch_count": 2})

    # Even if a client sends one, `rewatch_index` is not an accepted field.
    resp = await write(app_client, entry, 5, note="second pass", rewatch_index=0)
    assert resp.json()["rewatch_index"] == 2
    rows = (await app_client.get(f"/api/entries/{entry}/journal")).json()
    assert {r["note"] for r in rows} == {"original", "second pass"}


# --- Privacy ---------------------------------------------------------------


async def test_a_journal_belongs_to_one_person(app_client):
    await setup(app_client)
    entry = await track(app_client)
    written = await write(app_client, entry, 7, note="mine alone")

    await login(app_client, B)
    # Not theirs to read, amend, or delete — and the entry is not theirs either.
    assert (await app_client.get(f"/api/entries/{entry}/journal")).status_code == 404
    assert (
        await app_client.patch(f"/api/journal/{written.json()['id']}", json={"note": "hi"})
    ).status_code == 404
    assert (await app_client.delete(f"/api/journal/{written.json()['id']}")).status_code == 404
    assert (await app_client.get("/api/journal")).json() == []


async def test_being_friends_does_not_open_a_journal(app_client):
    """
    Friendship opens a list, not a diary. Nothing about this feature is social,
    and there is no endpoint that would make it so.
    """
    await setup(app_client)
    entry = await track(app_client)
    await write(app_client, entry, 7, note="still mine")

    made = await app_client.post("/api/friends/requests", json={"username": "bob"})
    await login(app_client, B)
    await app_client.post(f"/api/friends/requests/{made.json()['id']}/accept")

    assert (await app_client.get(f"/api/entries/{entry}/journal")).status_code == 404
    assert (await app_client.get("/api/journal")).json() == []
    # And nothing leaks through the social surfaces either.
    for path in ("/api/feed", "/api/users/alice", "/api/users/alice/compare"):
        assert "still mine" not in (await app_client.get(path)).text


# --- The timeline ----------------------------------------------------------


async def test_the_timeline_reads_newest_first_and_names_the_title(app_client):
    await setup(app_client)
    first = await track(app_client, S1)
    second = await track(app_client, S2)
    await write(app_client, first, 1, note="one")
    await write(app_client, second, 2, note="two")

    rows = (await app_client.get("/api/journal")).json()
    assert [r["note"] for r in rows] == ["two", "one"]
    # Each row carries its title, so the timeline reads as sentences.
    assert all(r["media"] is not None for r in rows)
    assert {r["media"]["provider_id"] for r in rows} == {S1, S2}


async def test_the_timeline_can_be_narrowed_to_favourites(app_client):
    await setup(app_client)
    entry = await track(app_client)
    await write(app_client, entry, 1, note="ordinary")
    await write(app_client, entry, 2, note="the one", is_favorite=True)

    rows = (await app_client.get("/api/journal?favorites_only=true")).json()
    assert [r["note"] for r in rows] == ["the one"]


async def test_deleting_a_title_takes_its_journal_with_it(app_client):
    await setup(app_client)
    entry = await track(app_client)
    await write(app_client, entry, 7, note="goes with it")
    assert (await app_client.delete(f"/api/entries/{entry}")).status_code == 204
    assert (await app_client.get("/api/journal")).json() == []


async def test_the_spoiler_flag_is_carried_but_never_enforced_server_side(app_client):
    """The server records the flag; covering it is the reader's own client's job."""
    await setup(app_client)
    entry = await track(app_client)
    resp = await write(app_client, entry, 9, note="the twist", has_spoilers=True)
    assert resp.json()["has_spoilers"] is True
    assert resp.json()["note"] == "the twist"


async def test_the_general_note_is_untouched_by_the_journal(app_client):
    """They answer different questions and must not overwrite one another."""
    await setup(app_client)
    entry = await track(app_client)
    await app_client.patch(f"/api/entries/{entry}", json={"notes": "watching with Kaito"})
    await write(app_client, entry, 7, note="great character episode")

    assert (await app_client.get(f"/api/entries/{entry}")).json()["notes"] == "watching with Kaito"
    assert (await app_client.get(f"/api/entries/{entry}/journal")).json()[0][
        "note"
    ] == "great character episode"
