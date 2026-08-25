"""
Custom shelves: named, ordered collections that sit beside status rather than in it.

The property these tests exist to protect is independence. A shelf must not care
what status an entry has, and changing a status must not disturb a shelf -- that is
the entire reason shelves are a table and not another enum value.
"""

ADMIN = {"email": "admin@example.com", "username": "admin", "password": "supersecret1"}
OTHER = {"email": "other@example.com", "username": "other", "password": "supersecret2"}

S1, S2, S3 = "900", "901", "902"


async def setup_admin(client):
    assert (await client.post("/api/setup", json=ADMIN)).status_code == 201


async def add_entry(client, provider_id: str, **fields) -> int:
    resp = await client.post(
        "/api/entries",
        json={
            "provider": "stub",
            "provider_id": provider_id,
            "type": "anime",
            "status": "planned",
            **fields,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def make_shelf(client, name="Comfort shows", **fields) -> dict:
    resp = await client.post("/api/shelves", json={"name": name, **fields})
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_create_list_and_fetch(app_client):
    await setup_admin(app_client)
    shelf = await make_shelf(app_client, description="  Things I put on again  ")

    assert shelf["name"] == "Comfort shows"
    # Whitespace is trimmed rather than stored.
    assert shelf["description"] == "Things I put on again"
    assert shelf["item_count"] == 0

    index = await app_client.get("/api/shelves")
    assert index.status_code == 200
    assert [s["name"] for s in index.json()] == ["Comfort shows"]
    # The index must not drag every shelf's entries along with it.
    assert index.json()[0]["items"] is None


async def test_names_are_unique_per_user(app_client):
    await setup_admin(app_client)
    await make_shelf(app_client, "Favorites")
    clash = await app_client.post("/api/shelves", json={"name": "Favorites"})
    assert clash.status_code == 409


async def test_blank_name_is_refused(app_client):
    await setup_admin(app_client)
    assert (await app_client.post("/api/shelves", json={"name": "   "})).status_code == 422
    assert (await app_client.post("/api/shelves", json={"name": ""})).status_code == 422


async def test_add_remove_and_count(app_client):
    await setup_admin(app_client)
    shelf = await make_shelf(app_client)
    first = await add_entry(app_client, S1)
    second = await add_entry(app_client, S2)

    resp = await app_client.post(f"/api/shelves/{shelf['id']}/items", json={"entry_id": first})
    assert resp.status_code == 200
    resp = await app_client.post(f"/api/shelves/{shelf['id']}/items", json={"entry_id": second})
    assert resp.json()["item_count"] == 2
    assert [i["entry"]["id"] for i in resp.json()["items"]] == [first, second]

    gone = await app_client.delete(f"/api/shelves/{shelf['id']}/items/{first}")
    assert gone.status_code == 204
    after = await app_client.get(f"/api/shelves/{shelf['id']}")
    assert [i["entry"]["id"] for i in after.json()["items"]] == [second]


async def test_adding_twice_is_a_no_op(app_client):
    """The button that calls this is a toggle; a double tap must not raise."""
    await setup_admin(app_client)
    shelf = await make_shelf(app_client)
    entry = await add_entry(app_client, S1)

    await app_client.post(f"/api/shelves/{shelf['id']}/items", json={"entry_id": entry})
    again = await app_client.post(f"/api/shelves/{shelf['id']}/items", json={"entry_id": entry})
    assert again.status_code == 200
    assert again.json()["item_count"] == 1


async def test_shelf_is_independent_of_status(app_client):
    """The point of the feature: finishing something must not move it off a shelf."""
    await setup_admin(app_client)
    shelf = await make_shelf(app_client)
    entry = await add_entry(app_client, S1, status="current")
    await app_client.post(f"/api/shelves/{shelf['id']}/items", json={"entry_id": entry})

    patched = await app_client.patch(f"/api/entries/{entry}", json={"status": "completed"})
    assert patched.status_code == 200
    assert patched.json()["status"] == "completed"

    still = await app_client.get(f"/api/shelves/{shelf['id']}")
    assert [i["entry"]["id"] for i in still.json()["items"]] == [entry]
    assert still.json()["items"][0]["entry"]["status"] == "completed"


async def test_reorder_rewrites_the_running_order(app_client):
    await setup_admin(app_client)
    shelf = await make_shelf(app_client)
    a = await add_entry(app_client, S1)
    b = await add_entry(app_client, S2)
    c = await add_entry(app_client, S3)
    for entry in (a, b, c):
        await app_client.post(f"/api/shelves/{shelf['id']}/items", json={"entry_id": entry})

    resp = await app_client.put(f"/api/shelves/{shelf['id']}/order", json={"entry_ids": [c, a, b]})
    assert resp.status_code == 200
    assert [i["entry"]["id"] for i in resp.json()["items"]] == [c, a, b]
    assert [i["position"] for i in resp.json()["items"]] == [0, 1, 2]


async def test_reorder_drops_what_it_omits(app_client):
    """Omission is removal -- this is also the "remove several at once" call."""
    await setup_admin(app_client)
    shelf = await make_shelf(app_client)
    a = await add_entry(app_client, S1)
    b = await add_entry(app_client, S2)
    for entry in (a, b):
        await app_client.post(f"/api/shelves/{shelf['id']}/items", json={"entry_id": entry})

    resp = await app_client.put(f"/api/shelves/{shelf['id']}/order", json={"entry_ids": [b]})
    assert [i["entry"]["id"] for i in resp.json()["items"]] == [b]
    assert resp.json()["item_count"] == 1


async def test_reorder_ignores_ids_the_shelf_does_not_hold(app_client):
    await setup_admin(app_client)
    shelf = await make_shelf(app_client)
    a = await add_entry(app_client, S1)
    stranger = await add_entry(app_client, S2)
    await app_client.post(f"/api/shelves/{shelf['id']}/items", json={"entry_id": a})

    resp = await app_client.put(
        f"/api/shelves/{shelf['id']}/order", json={"entry_ids": [stranger, a]}
    )
    assert [i["entry"]["id"] for i in resp.json()["items"]] == [a]


async def test_deleting_an_entry_takes_it_off_every_shelf(app_client):
    await setup_admin(app_client)
    one = await make_shelf(app_client, "Favorites")
    two = await make_shelf(app_client, "Weekend watchlist")
    entry = await add_entry(app_client, S1)
    for shelf in (one, two):
        await app_client.post(f"/api/shelves/{shelf['id']}/items", json={"entry_id": entry})

    assert (await app_client.delete(f"/api/entries/{entry}")).status_code == 204

    for shelf in (one, two):
        resp = await app_client.get(f"/api/shelves/{shelf['id']}")
        assert resp.json()["items"] == []
        assert resp.json()["item_count"] == 0


async def test_rename_update_and_delete(app_client):
    await setup_admin(app_client)
    shelf = await make_shelf(app_client)

    renamed = await app_client.patch(
        f"/api/shelves/{shelf['id']}", json={"name": "Sunday rewatches", "description": None}
    )
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Sunday rewatches"
    assert renamed.json()["description"] is None

    assert (await app_client.delete(f"/api/shelves/{shelf['id']}")).status_code == 204
    assert (await app_client.get(f"/api/shelves/{shelf['id']}")).status_code == 404


async def test_rename_onto_an_existing_name_conflicts(app_client):
    await setup_admin(app_client)
    await make_shelf(app_client, "Favorites")
    other = await make_shelf(app_client, "Comfort shows")
    resp = await app_client.patch(f"/api/shelves/{other['id']}", json={"name": "Favorites"})
    assert resp.status_code == 409


async def test_new_shelves_go_to_the_end(app_client):
    await setup_admin(app_client)
    await make_shelf(app_client, "First")
    await make_shelf(app_client, "Second")
    await make_shelf(app_client, "Third")
    names = [s["name"] for s in (await app_client.get("/api/shelves")).json()]
    assert names == ["First", "Second", "Third"]


async def test_shelves_are_private_to_their_owner(app_client):
    await setup_admin(app_client)
    shelf = await make_shelf(app_client)
    entry = await add_entry(app_client, S1)
    await app_client.post(f"/api/shelves/{shelf['id']}/items", json={"entry_id": entry})

    assert (await app_client.post("/api/auth/register", json=OTHER)).status_code == 201
    login = await app_client.post(
        "/api/auth/login", json={"identifier": OTHER["username"], "password": OTHER["password"]}
    )
    assert login.status_code == 200, login.text

    assert (await app_client.get("/api/shelves")).json() == []
    assert (await app_client.get(f"/api/shelves/{shelf['id']}")).status_code == 404
    assert (await app_client.delete(f"/api/shelves/{shelf['id']}")).status_code == 404
    sneak = await app_client.post(f"/api/shelves/{shelf['id']}/items", json={"entry_id": entry})
    assert sneak.status_code == 404


async def test_cannot_shelve_an_entry_you_do_not_own(app_client):
    await setup_admin(app_client)
    victim_entry = await add_entry(app_client, S1)

    assert (await app_client.post("/api/auth/register", json=OTHER)).status_code == 201
    await app_client.post(
        "/api/auth/login", json={"identifier": OTHER["username"], "password": OTHER["password"]}
    )
    mine = await make_shelf(app_client, "Mine")
    resp = await app_client.post(
        f"/api/shelves/{mine['id']}/items", json={"entry_id": victim_entry}
    )
    assert resp.status_code == 404


async def test_index_carries_membership_without_the_artwork(app_client):
    """
    The toggle in the entry menu asks "is this title on this shelf" for every shelf
    at once. The index answers it with ids so the menu never has to fetch each
    shelf, and still withholds `items` so it does not ship every cover.
    """
    await setup_admin(app_client)
    shelf = await make_shelf(app_client, "Favorites")
    await make_shelf(app_client, "Weekend watchlist")
    a = await add_entry(app_client, S1)
    b = await add_entry(app_client, S2)
    for entry in (a, b):
        await app_client.post(f"/api/shelves/{shelf['id']}/items", json={"entry_id": entry})

    index = {s["name"]: s for s in (await app_client.get("/api/shelves")).json()}
    assert index["Favorites"]["entry_ids"] == [a, b]
    assert index["Favorites"]["item_count"] == 2
    assert index["Favorites"]["items"] is None
    assert index["Weekend watchlist"]["entry_ids"] == []


async def test_index_membership_follows_a_reorder(app_client):
    await setup_admin(app_client)
    shelf = await make_shelf(app_client)
    a = await add_entry(app_client, S1)
    b = await add_entry(app_client, S2)
    for entry in (a, b):
        await app_client.post(f"/api/shelves/{shelf['id']}/items", json={"entry_id": entry})

    await app_client.put(f"/api/shelves/{shelf['id']}/order", json={"entry_ids": [b, a]})
    index = (await app_client.get("/api/shelves")).json()
    assert index[0]["entry_ids"] == [b, a]
