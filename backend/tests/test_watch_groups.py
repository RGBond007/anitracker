"""
Watch-together groups: coordination, not playback.

The property under guard is containment. A group's roster and everyone's episode
are visible to its members and to nobody else -- not to a friend outside it, not
to someone still deciding on the invitation, and not to someone who left.
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
    """Leaves the session logged in as `second`."""
    made = await client.post("/api/friends/requests", json={"username": second["username"]})
    assert made.status_code == 201, made.text
    await login(client, second)
    ok = await client.post(f"/api/friends/requests/{made.json()['id']}/accept")
    assert ok.status_code == 200, ok.text


async def setup(client):
    """
    Alice is friends with Bob and with Carol. Bob and Carol are not friends.

    Ids come from the admin listing rather than three separate logins: the login
    limiter allows ten in five minutes, and a fixture that spends most of them
    leaves none for the test.
    """
    assert (await client.post("/api/setup", json=A)).status_code == 201
    for who in (B, C):
        assert (await client.post("/api/auth/register", json=who)).status_code == 201

    await login(client, A)
    ids = {u["username"]: u["id"] for u in (await client.get("/api/admin/users")).json()}

    await befriend(client, A, B)  # ends as Bob
    await login(client, A)
    await befriend(client, A, C)  # ends as Carol
    await login(client, A)
    return ids


async def track(client, provider_id=S1, **fields):
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


async def make_group(client, invite_ids, provider_id=S1):
    return await client.post(
        "/api/watch-groups",
        json={
            "provider": "stub",
            "provider_id": provider_id,
            "media_type": "anime",
            "invite_ids": invite_ids,
        },
    )


# --- Creating, joining, leaving ------------------------------------------


async def test_creator_is_in_it_and_others_are_invited(app_client):
    ids = await setup(app_client)
    resp = await make_group(app_client, [ids["bob"]])
    assert resp.status_code == 201, resp.text
    body = resp.json()

    assert body["i_own_it"] is True
    assert body["my_state"] == "joined"
    states = {m["user"]["username"]: m["state"] for m in body["members"]}
    assert states == {"alice": "joined", "bob": "invited"}


async def test_an_invitation_is_accepted_before_it_counts(app_client):
    ids = await setup(app_client)
    group = (await make_group(app_client, [ids["bob"]])).json()

    await login(app_client, B)
    seen = (await app_client.get(f"/api/watch-groups/{group['id']}")).json()
    assert seen["my_state"] == "invited"

    joined = await app_client.post(f"/api/watch-groups/{group['id']}/join")
    assert joined.status_code == 200
    assert joined.json()["my_state"] == "joined"


async def test_leaving_removes_you_from_the_roster_and_the_group(app_client):
    ids = await setup(app_client)
    group = (await make_group(app_client, [ids["bob"]])).json()
    await login(app_client, B)
    await app_client.post(f"/api/watch-groups/{group['id']}/join")

    assert (await app_client.post(f"/api/watch-groups/{group['id']}/leave")).status_code == 204
    # Gone, and indistinguishable from never having been there.
    assert (await app_client.get(f"/api/watch-groups/{group['id']}")).status_code == 404
    assert (await app_client.get("/api/watch-groups")).json() == []

    await login(app_client, A)
    roster = (await app_client.get(f"/api/watch-groups/{group['id']}")).json()["members"]
    assert [m["user"]["username"] for m in roster] == ["alice"]


async def test_only_the_owner_closes_it(app_client):
    ids = await setup(app_client)
    group = (await make_group(app_client, [ids["bob"]])).json()
    await login(app_client, B)
    await app_client.post(f"/api/watch-groups/{group['id']}/join")
    assert (await app_client.delete(f"/api/watch-groups/{group['id']}")).status_code == 403

    await login(app_client, A)
    assert (await app_client.delete(f"/api/watch-groups/{group['id']}")).status_code == 204
    assert (await app_client.get(f"/api/watch-groups/{group['id']}")).json()["is_closed"] is True


async def test_the_owner_leaving_closes_it_rather_than_orphaning_it(app_client):
    ids = await setup(app_client)
    group = (await make_group(app_client, [ids["bob"]])).json()
    assert (await app_client.post(f"/api/watch-groups/{group['id']}/leave")).status_code == 204

    await login(app_client, B)
    assert (await app_client.get(f"/api/watch-groups/{group['id']}")).json()["is_closed"] is True


async def test_one_open_group_per_title(app_client):
    ids = await setup(app_client)
    assert (await make_group(app_client, [ids["bob"]])).status_code == 201
    assert (await make_group(app_client, [ids["bob"]])).status_code == 409
    # A different title is fine, and so is a new one after closing.
    assert (await make_group(app_client, [ids["bob"]], provider_id=S2)).status_code == 201


# --- Containment ----------------------------------------------------------


async def test_a_friend_outside_the_group_sees_nothing(app_client):
    """Carol is Alice's friend, but not in the group. That is the whole test."""
    ids = await setup(app_client)
    group = (await make_group(app_client, [ids["bob"]])).json()

    await login(app_client, C)
    assert (await app_client.get(f"/api/watch-groups/{group['id']}")).status_code == 404
    assert (await app_client.get("/api/watch-groups")).json() == []
    assert (
        await app_client.get(f"/api/watch-groups/{group['id']}/spoiler?unit=5")
    ).status_code == 404


async def test_progress_is_withheld_until_someone_joins(app_client):
    ids = await setup(app_client)
    await track(app_client)
    await login(app_client, B)
    bob_entry = await track(app_client)
    await app_client.patch(f"/api/entries/{bob_entry}", json={"progress": 7})

    await login(app_client, A)
    group = (await make_group(app_client, [ids["bob"]])).json()
    by_name = {m["user"]["username"]: m for m in group["members"]}
    # Invited, not joined: an invitation is not consent to publish your position.
    assert by_name["bob"]["state"] == "invited"
    assert by_name["bob"]["progress"] is None

    await login(app_client, B)
    await app_client.post(f"/api/watch-groups/{group['id']}/join")
    await login(app_client, A)
    seen = (await app_client.get(f"/api/watch-groups/{group['id']}")).json()
    assert {m["user"]["username"]: m["progress"] for m in seen["members"]}["bob"] == 7


async def test_progress_comes_from_the_library_not_a_copy(app_client):
    ids = await setup(app_client)
    await track(app_client)
    group = (await make_group(app_client, [ids["bob"]])).json()
    await login(app_client, B)
    entry = await track(app_client)
    await app_client.post(f"/api/watch-groups/{group['id']}/join")

    await app_client.post(f"/api/entries/{entry}/increment")
    await login(app_client, A)
    seen = (await app_client.get(f"/api/watch-groups/{group['id']}")).json()
    assert {m["user"]["username"]: m["progress"] for m in seen["members"]}["bob"] == 1


async def test_you_can_only_invite_your_own_friends(app_client):
    ids = await setup(app_client)
    # Bob and Carol are not friends, so Bob cannot pull Carol in.
    group = (await make_group(app_client, [ids["bob"]])).json()
    await login(app_client, B)
    await app_client.post(f"/api/watch-groups/{group['id']}/join")
    resp = await app_client.post(
        f"/api/watch-groups/{group['id']}/invite", json={"user_ids": [ids["carol"]]}
    )
    assert resp.status_code == 403

    # Alice can, because Carol is her friend.
    await login(app_client, A)
    ok = await app_client.post(
        f"/api/watch-groups/{group['id']}/invite", json={"user_ids": [ids["carol"]]}
    )
    assert ok.status_code == 200
    assert "carol" in {m["user"]["username"] for m in ok.json()["members"]}


async def test_an_invitee_cannot_invite_or_set_a_target(app_client):
    ids = await setup(app_client)
    group = (await make_group(app_client, [ids["bob"], ids["carol"]])).json()
    await login(app_client, B)
    assert (
        await app_client.patch(f"/api/watch-groups/{group['id']}", json={"target_unit": 5})
    ).status_code == 403
    assert (
        await app_client.post(
            f"/api/watch-groups/{group['id']}/invite", json={"user_ids": [ids["alice"]]}
        )
    ).status_code == 403


# --- The target and the spoiler check -------------------------------------


async def test_any_joined_member_may_set_the_target(app_client):
    ids = await setup(app_client)
    group = (await make_group(app_client, [ids["bob"]])).json()
    await login(app_client, B)
    await app_client.post(f"/api/watch-groups/{group['id']}/join")
    set_it = await app_client.patch(f"/api/watch-groups/{group['id']}", json={"target_unit": 6})
    assert set_it.status_code == 200
    assert set_it.json()["target_unit"] == 6

    cleared = await app_client.patch(f"/api/watch-groups/{group['id']}", json={"target_unit": None})
    assert cleared.json()["target_unit"] is None


async def test_the_spoiler_check_names_who_would_be_left_behind(app_client):
    ids = await setup(app_client)
    alice_entry = await track(app_client)
    await app_client.patch(f"/api/entries/{alice_entry}", json={"progress": 7})
    group = (await make_group(app_client, [ids["bob"], ids["carol"]])).json()

    for who in (B, C):
        await login(app_client, who)
        entry = await track(app_client)
        await app_client.patch(f"/api/entries/{entry}", json={"progress": 7 if who is B else 3})
        await app_client.post(f"/api/watch-groups/{group['id']}/join")

    await login(app_client, A)
    # At unit 8 both Bob (7) and Carol (3) are below it.
    check = (await app_client.get(f"/api/watch-groups/{group['id']}/spoiler?unit=8")).json()
    assert {u["username"] for u in check["behind"]} == {"bob", "carol"}

    # At unit 4 only Carol is behind.
    at_four = (await app_client.get(f"/api/watch-groups/{group['id']}/spoiler?unit=4")).json()
    assert [u["username"] for u in at_four["behind"]] == ["carol"]

    # And at unit 3 nobody is.
    at_three = (await app_client.get(f"/api/watch-groups/{group['id']}/spoiler?unit=3")).json()
    assert at_three["behind"] == []


async def test_the_spoiler_check_reports_passing_the_target(app_client):
    ids = await setup(app_client)
    await track(app_client)
    group = (await make_group(app_client, [ids["bob"]])).json()
    await app_client.patch(f"/api/watch-groups/{group['id']}", json={"target_unit": 6})

    under = (await app_client.get(f"/api/watch-groups/{group['id']}/spoiler?unit=6")).json()
    assert under["past_target"] is False
    over = (await app_client.get(f"/api/watch-groups/{group['id']}/spoiler?unit=7")).json()
    assert over["past_target"] is True
    assert over["target_unit"] == 6


async def test_someone_who_does_not_track_it_counts_as_behind(app_client):
    """They have certainly not seen it, and that is what the warning is about."""
    ids = await setup(app_client)
    await track(app_client)
    group = (await make_group(app_client, [ids["bob"]])).json()
    await login(app_client, B)
    await app_client.post(f"/api/watch-groups/{group['id']}/join")

    await login(app_client, A)
    check = (await app_client.get(f"/api/watch-groups/{group['id']}/spoiler?unit=1")).json()
    assert [u["username"] for u in check["behind"]] == ["bob"]


# --- The title page -------------------------------------------------------


async def test_the_title_page_asks_and_gets_null_when_there_is_none(app_client):
    await setup(app_client)
    assert (await app_client.get(f"/api/watch-groups/for/stub/{S1}")).json() is None


async def test_the_title_page_finds_the_open_group(app_client):
    ids = await setup(app_client)
    group = (await make_group(app_client, [ids["bob"]])).json()
    found = (await app_client.get(f"/api/watch-groups/for/stub/{S1}")).json()
    assert found["id"] == group["id"]

    await app_client.delete(f"/api/watch-groups/{group['id']}")
    # A closed group is not what the page is asking about.
    assert (await app_client.get(f"/api/watch-groups/for/stub/{S1}")).json() is None
