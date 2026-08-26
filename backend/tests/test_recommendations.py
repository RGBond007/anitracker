"""
Titles handed directly between friends.

Most of what matters here is negative: who cannot see a recommendation, what
accepting must *not* do, and what happens to old ones when a friendship ends.
"""

A = {"email": "a@example.com", "username": "alice", "password": "supersecret1"}
B = {"email": "b@example.com", "username": "bob", "password": "supersecret2"}
C = {"email": "c@example.com", "username": "carol", "password": "supersecret3"}

S1, S2 = "900", "901"


async def login(client, who):
    resp = await client.post(
        "/api/auth/login", json={"identifier": who["username"], "password": who["password"]}
    )
    assert resp.status_code == 200, resp.text


async def setup_three(client):
    """Alice is the admin; Bob and Carol register. Alice and Bob become friends."""
    assert (await client.post("/api/setup", json=A)).status_code == 201
    for who in (B, C):
        assert (await client.post("/api/auth/register", json=who)).status_code == 201

    await login(client, A)
    me = (await client.get("/api/me")).json()
    ids = {A["username"]: me["id"]}

    created = await client.post("/api/friends/requests", json={"username": B["username"]})
    assert created.status_code == 201, created.text

    await login(client, B)
    ids[B["username"]] = (await client.get("/api/me")).json()["id"]
    accepted = await client.post(f"/api/friends/requests/{created.json()['id']}/accept")
    assert accepted.status_code == 200, accepted.text

    await login(client, C)
    ids[C["username"]] = (await client.get("/api/me")).json()["id"]
    await login(client, A)
    return ids


async def add(client, provider_id=S1, **fields) -> int:
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


async def send(client, recipient_ids, provider_id=S1, **extra):
    return await client.post(
        "/api/recommendations",
        json={
            "provider": "stub",
            "provider_id": provider_id,
            "media_type": "anime",
            "recipient_ids": recipient_ids,
            **extra,
        },
    )


async def test_send_and_receive(app_client):
    ids = await setup_three(app_client)
    resp = await send(app_client, [ids["bob"]], message="  No spoilers, just watch it.  ")
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert len(body["sent"]) == 1
    assert body["sent"][0]["sender"]["username"] == "alice"
    # Trimmed, not stored with its whitespace.
    assert body["sent"][0]["message"] == "No spoilers, just watch it."
    assert body["sent"][0]["state"] == "pending"

    await login(app_client, B)
    inbox = (await app_client.get("/api/recommendations/inbox")).json()
    assert [r["provider_id"] for r in inbox] == [S1]
    assert inbox[0]["sender"]["username"] == "alice"


async def test_message_is_optional_and_capped(app_client):
    ids = await setup_three(app_client)
    assert (await send(app_client, [ids["bob"]])).json()["sent"][0]["message"] is None
    too_long = await send(app_client, [ids["bob"]], provider_id=S2, message="x" * 281)
    assert too_long.status_code == 422


async def test_duplicate_pending_is_skipped_not_raised(app_client):
    ids = await setup_three(app_client)
    first = await send(app_client, [ids["bob"]])
    assert len(first.json()["sent"]) == 1

    again = await send(app_client, [ids["bob"]])
    assert again.status_code == 201
    assert again.json()["sent"] == []
    assert again.json()["already_pending"] == [ids["bob"]]

    await login(app_client, B)
    assert len((await app_client.get("/api/recommendations/inbox")).json()) == 1


async def test_cannot_recommend_to_a_stranger(app_client):
    ids = await setup_three(app_client)
    # Carol registered but never became Alice's friend.
    assert (await send(app_client, [ids["carol"]])).status_code == 403
    # And one stranger in the list poisons the whole call rather than half-sending.
    assert (await send(app_client, [ids["bob"], ids["carol"]])).status_code == 403
    await login(app_client, B)
    assert (await app_client.get("/api/recommendations/inbox")).json() == []


async def test_recommendations_are_private_to_the_pair(app_client):
    ids = await setup_three(app_client)
    sent = (await send(app_client, [ids["bob"]])).json()["sent"][0]

    await login(app_client, C)
    assert (await app_client.get("/api/recommendations/inbox")).json() == []
    assert (
        await app_client.patch(f"/api/recommendations/{sent['id']}", json={"state": "dismissed"})
    ).status_code == 404


async def test_only_the_recipient_moves_it(app_client):
    """Whether a friend looked at it is the friend's to say, not the sender's."""
    ids = await setup_three(app_client)
    sent = (await send(app_client, [ids["bob"]])).json()["sent"][0]

    # Alice is still logged in: she is the sender, and may not mark her own as viewed.
    assert (
        await app_client.patch(f"/api/recommendations/{sent['id']}", json={"state": "viewed"})
    ).status_code == 404

    await login(app_client, B)
    moved = await app_client.patch(f"/api/recommendations/{sent['id']}", json={"state": "viewed"})
    assert moved.status_code == 200
    assert moved.json()["state"] == "viewed"


async def test_dismissed_leaves_the_inbox(app_client):
    ids = await setup_three(app_client)
    sent = (await send(app_client, [ids["bob"]])).json()["sent"][0]
    await login(app_client, B)
    await app_client.patch(f"/api/recommendations/{sent['id']}", json={"state": "dismissed"})
    assert (await app_client.get("/api/recommendations/inbox")).json() == []


async def test_accepting_does_not_start_the_title(app_client):
    """
    The behaviour the brief is most explicit about: accepting is a decision to keep
    the title, never a decision to have begun it.
    """
    ids = await setup_three(app_client)
    sent = (await send(app_client, [ids["bob"]])).json()["sent"][0]

    await login(app_client, B)
    accepted = await app_client.patch(
        f"/api/recommendations/{sent['id']}", json={"state": "accepted"}
    )
    assert accepted.status_code == 200
    assert accepted.json()["state"] == "accepted"

    # Accepting alone writes nothing to the library.
    assert (await app_client.get("/api/entries")).json() == []

    # Adding it is a separate, ordinary call -- and lands unstarted.
    added = await app_client.post(
        "/api/entries",
        json={"provider": "stub", "provider_id": S1, "type": "anime", "status": "planned"},
    )
    assert added.status_code == 201
    assert added.json()["status"] == "planned"
    assert added.json()["progress"] == 0


async def test_unfriending_hides_old_recommendations_both_ways(app_client):
    ids = await setup_three(app_client)
    sent = (await send(app_client, [ids["bob"]])).json()["sent"][0]
    assert len((await app_client.get("/api/recommendations/sent")).json()) == 1

    # Alice removes Bob. The route takes the other user's id, not the pair's.
    assert (await app_client.delete(f"/api/friends/{ids['bob']}")).status_code == 204

    assert (await app_client.get("/api/recommendations/sent")).json() == []
    await login(app_client, B)
    assert (await app_client.get("/api/recommendations/inbox")).json() == []
    # Not merely hidden from the list -- unreachable by id, and indistinguishable
    # from never having existed.
    assert (
        await app_client.patch(f"/api/recommendations/{sent['id']}", json={"state": "viewed"})
    ).status_code == 404


async def test_who_recommended_this_title(app_client):
    ids = await setup_three(app_client)
    await send(app_client, [ids["bob"]], message="trust me")
    await login(app_client, B)
    who = (await app_client.get(f"/api/recommendations/for/stub/{S1}")).json()
    assert [u["username"] for u in who] == ["alice"]
    # A title nobody recommended says so plainly.
    assert (await app_client.get(f"/api/recommendations/for/stub/{S2}")).json() == []


async def test_sending_to_several_skips_only_the_duplicate(app_client):
    """One friend already having it must not stop the others from getting it."""
    ids = await setup_three(app_client)
    # Make Carol a friend too.
    created = await app_client.post("/api/friends/requests", json={"username": C["username"]})
    assert created.status_code == 201, created.text
    await login(app_client, C)
    assert (
        await app_client.post(f"/api/friends/requests/{created.json()['id']}/accept")
    ).status_code == 200
    await login(app_client, A)

    await send(app_client, [ids["bob"]])
    both = await send(app_client, [ids["bob"], ids["carol"]])
    assert [r["recipient"]["username"] for r in both.json()["sent"]] == ["carol"]
    assert both.json()["already_pending"] == [ids["bob"]]


async def test_cannot_recommend_to_yourself(app_client):
    """
    A 400 rather than the friend check's 403: you are not your own friend, so that
    check would refuse it anyway — but with a message about friendship, which is
    not what the sender got wrong.
    """
    ids = await setup_three(app_client)
    resp = await send(app_client, [ids["alice"]])
    assert resp.status_code == 400
    assert "yourself" in resp.json()["detail"]
    # Also when smuggled in beside a legitimate recipient.
    both = await send(app_client, [ids["bob"], ids["alice"]])
    assert both.status_code == 400
    await login(app_client, B)
    assert (await app_client.get("/api/recommendations/inbox")).json() == []


async def test_provider_ids_are_validated(app_client):
    """A made-up id is refused before anything is stored."""
    ids = await setup_three(app_client)
    bogus = await send(app_client, [ids["bob"]], provider_id="definitely-not-a-title")
    assert bogus.status_code == 404

    await login(app_client, B)
    assert (await app_client.get("/api/recommendations/inbox")).json() == []


async def test_an_untracked_title_can_be_recommended(app_client):
    """
    Neither party needs the title on a list. Recommending is how someone hears about
    something for the first time, so requiring the sender to track it first would
    rule out the main case.
    """
    ids = await setup_three(app_client)
    assert (await app_client.get("/api/entries")).json() == []

    resp = await send(app_client, [ids["bob"]])
    assert resp.status_code == 201
    # Resolving it also cached it, so the recipient sees a real title, not a blank.
    assert resp.json()["sent"][0]["media"] is not None
    assert resp.json()["sent"][0]["media"]["provider_id"] == S1


async def test_only_pending_counts_as_waiting(app_client):
    """
    What a badge is allowed to count. Viewing something must clear the count even
    though the card stays in the inbox, or the number never goes down.
    """
    ids = await setup_three(app_client)
    first = (await send(app_client, [ids["bob"]])).json()["sent"][0]
    await send(app_client, [ids["bob"]], provider_id=S2)

    await login(app_client, B)
    inbox = (await app_client.get("/api/recommendations/inbox")).json()
    assert len([r for r in inbox if r["state"] == "pending"]) == 2

    await app_client.patch(f"/api/recommendations/{first['id']}", json={"state": "viewed"})
    inbox = (await app_client.get("/api/recommendations/inbox")).json()
    # Still two cards, but only one of them is still waiting on the reader.
    assert len(inbox) == 2
    assert len([r for r in inbox if r["state"] == "pending"]) == 1


async def test_the_sender_can_declare_a_spoiler(app_client):
    ids = await setup_three(app_client)
    plain = await send(app_client, [ids["bob"]], message="just watch it")
    assert plain.json()["sent"][0]["has_spoilers"] is False

    flagged = await send(
        app_client, [ids["bob"]], provider_id=S2, message="the ending!", has_spoilers=True
    )
    assert flagged.json()["sent"][0]["has_spoilers"] is True


async def test_a_sender_further_in_is_flagged_without_declaring_anything(app_client):
    """
    The heart of it: someone ahead of you is risky whether or not they said so.
    People are sincere and still wrong about what gives things away.
    """
    ids = await setup_three(app_client)
    mine = await add(app_client, S1)
    await app_client.patch(f"/api/entries/{mine}", json={"progress": 9})
    await send(app_client, [ids["bob"]], message="no spoilers, promise")

    await login(app_client, B)
    theirs = await add(app_client, S1)
    await app_client.patch(f"/api/entries/{theirs}", json={"progress": 2})

    inbox = (await app_client.get("/api/recommendations/inbox")).json()
    assert inbox[0]["has_spoilers"] is False  # they declared it safe...
    assert inbox[0]["sender_ahead"] is True  # ...and the progress says otherwise


async def test_a_sender_level_or_behind_is_not_flagged(app_client):
    ids = await setup_three(app_client)
    mine = await add(app_client, S1)
    await app_client.patch(f"/api/entries/{mine}", json={"progress": 3})
    await send(app_client, [ids["bob"]])

    await login(app_client, B)
    theirs = await add(app_client, S1)
    await app_client.patch(f"/api/entries/{theirs}", json={"progress": 3})
    assert (await app_client.get("/api/recommendations/inbox")).json()[0]["sender_ahead"] is False


async def test_a_recipient_who_does_not_track_it_counts_as_at_zero(app_client):
    ids = await setup_three(app_client)
    mine = await add(app_client, S1)
    await app_client.patch(f"/api/entries/{mine}", json={"progress": 4})
    await send(app_client, [ids["bob"]])

    await login(app_client, B)
    # Bob has never opened it, so anyone with progress is ahead of him.
    assert (await app_client.get("/api/recommendations/inbox")).json()[0]["sender_ahead"] is True
