"""The series view: every season of a show, and which one the user is on."""

ADMIN = {"email": "admin@example.com", "username": "admin", "password": "supersecret1"}

# The stub's three-season chain. Season 1 is the root the whole chain groups on.
S1, S2, S3 = "900", "901", "902"


async def setup_admin(client):
    assert (await client.post("/api/setup", json=ADMIN)).status_code == 201


async def get_series(client, provider_id: str):
    resp = await client.get(f"/api/media/stub/{provider_id}/series")
    assert resp.status_code == 200, resp.text
    return resp.json()


async def add(client, provider_id: str, **fields):
    resp = await client.post(
        "/api/entries",
        json={"provider": "stub", "provider_id": provider_id, "type": "anime", **fields},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_series_lists_every_season_with_its_own_poster_and_count(app_client):
    await setup_admin(app_client)

    # Asked about season 2, and answered with the whole chain in order — walking
    # back to season 1 and forward again through links the caller never sent.
    body = await get_series(app_client, S2)

    assert body["root_provider_id"] == S1
    assert body["title"] == "Frieren"  # the "Season N" suffix is not part of the name
    assert [s["season_number"] for s in body["seasons"]] == [1, 2, 3]
    assert [s["media"]["provider_id"] for s in body["seasons"]] == [S1, S2, S3]
    assert [s["media"]["cover_url"] for s in body["seasons"]] == [
        "https://img/frieren-s1.jpg",
        "https://img/frieren-s2.jpg",
        "https://img/frieren-s3.jpg",
    ]
    assert [s["media"]["total_units"] for s in body["seasons"]] == [28, 12, 13]
    # None of them are tracked yet, which does not stop them being listed.
    assert [s["entry"] for s in body["seasons"]] == [None, None, None]


async def test_untouched_series_selects_the_season_being_watched(app_client):
    await setup_admin(app_client)
    await add(app_client, S1, status="completed")
    await add(app_client, S2, status="current", progress=4)

    body = await get_series(app_client, S1)
    assert body["selected_provider_id"] == S2
    assert body["is_explicit"] is False

    # Progress and status are per season, and each season carries its own.
    by_id = {s["media"]["provider_id"]: s for s in body["seasons"]}
    assert by_id[S1]["entry"]["status"] == "completed"
    assert by_id[S2]["entry"]["progress"] == 4
    assert by_id[S3]["entry"] is None


async def test_picking_a_season_persists_and_outlives_a_status_change(app_client):
    await setup_admin(app_client)
    await add(app_client, S1, status="current", progress=3)
    await add(app_client, S2, status="planned")
    await get_series(app_client, S1)  # resolve the chain

    picked = await app_client.put(f"/api/series/{S1}/season", json={"provider_id": S2})
    assert picked.status_code == 200, picked.text
    assert picked.json()["selected_provider_id"] == S2
    assert picked.json()["is_explicit"] is True

    # The pick is the user's, so it holds even though season 1 is the one being
    # watched — which is what the inference would otherwise have chosen.
    assert (await get_series(app_client, S3))["selected_provider_id"] == S2

    # And it is visible to the library grids without a series call per card.
    assert (await app_client.get("/api/series/selections")).json() == [
        {"root_provider_id": S1, "provider_id": S2}
    ]


async def test_picking_again_replaces_the_previous_pick(app_client):
    await setup_admin(app_client)
    await get_series(app_client, S1)

    for target in (S2, S3, S1):
        resp = await app_client.put(f"/api/series/{S1}/season", json={"provider_id": target})
        assert resp.status_code == 200
        assert resp.json()["selected_provider_id"] == target

    assert len((await app_client.get("/api/series/selections")).json()) == 1


async def test_a_season_from_another_series_is_refused(app_client):
    await setup_admin(app_client)
    await get_series(app_client, S1)
    await add(app_client, "16498", status="current")

    resp = await app_client.put(f"/api/series/{S1}/season", json={"provider_id": "16498"})
    assert resp.status_code == 404


async def test_picks_are_private_to_their_owner(app_client):
    await setup_admin(app_client)
    await get_series(app_client, S1)
    await app_client.put(f"/api/series/{S1}/season", json={"provider_id": S3})

    await app_client.post(
        "/api/auth/register",
        json={"email": "e@example.com", "username": "erin", "password": "erinpassword"},
    )
    assert (await app_client.get("/api/series/selections")).json() == []
    # Erin sees the same three seasons, but nothing is picked for her.
    erin = await get_series(app_client, S1)
    assert len(erin["seasons"]) == 3
    assert erin["is_explicit"] is False


async def test_a_standalone_title_is_a_series_of_one(app_client):
    await setup_admin(app_client)
    body = await get_series(app_client, "1535")

    assert body["root_provider_id"] == "1535"
    assert len(body["seasons"]) == 1
    assert body["seasons"][0]["season_number"] == 1
    assert body["selected_provider_id"] == "1535"


async def test_series_requires_auth(app_client):
    await setup_admin(app_client)
    await app_client.post("/api/auth/logout")
    assert (await app_client.get(f"/api/media/stub/{S1}/series")).status_code == 401
    assert (await app_client.get("/api/series/selections")).status_code == 401
