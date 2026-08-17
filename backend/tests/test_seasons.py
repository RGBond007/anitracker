"""
The series view: every member of a show, and which one the user is on.

The distinction these tests exist to protect: *viewing* a season is a read, and
*being on* a season is a write that only happens when the user asks for it.
"""

ADMIN = {"email": "admin@example.com", "username": "admin", "password": "supersecret1"}

# The stub's three-season chain, plus the movie and OVA that hang off season 1.
S1, S2, S3 = "900", "901", "902"
MOVIE, OVA = "910", "911"
SPINOFF = "913"


async def setup_admin(client):
    assert (await client.post("/api/setup", json=ADMIN)).status_code == 201


async def get_series(client, provider_id: str):
    resp = await client.get(f"/api/media/stub/{provider_id}/series")
    assert resp.status_code == 200, resp.text
    return resp.json()


async def set_current(client, provider_id: str, **extra):
    return await client.put(f"/api/series/{S1}/season", json={"provider_id": provider_id, **extra})


async def add(client, provider_id: str, **fields):
    resp = await client.post(
        "/api/entries",
        json={"provider": "stub", "provider_id": provider_id, "type": "anime", **fields},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def by_id(body):
    return {s["media"]["provider_id"]: s for s in body["seasons"]}


# --- what a series contains -------------------------------------------------


async def test_series_groups_seasons_movies_and_ovas_in_release_order(app_client):
    await setup_admin(app_client)
    body = await get_series(app_client, S2)

    # The movie (2021) belongs between seasons 1 (2020) and 2 (2022); the OVA (2023)
    # between seasons 2 and 3. Release order is the order a series reads in.
    assert [s["media"]["provider_id"] for s in body["seasons"]] == [S1, MOVIE, S2, OVA, S3]
    assert [s["kind"] for s in body["seasons"]] == ["season", "movie", "season", "ova", "season"]
    # Only the spine is numbered: a movie between seasons 2 and 3 is not season 2.5.
    assert [s["season_number"] for s in body["seasons"]] == [1, None, 2, None, 3]
    # The show is named after season one, not after whatever aired first.
    assert body["title"] == "Frieren"


async def test_a_series_does_not_swallow_its_adaptation_or_a_spin_off(app_client):
    await setup_admin(app_client)
    members = by_id(await get_series(app_client, S1))

    # The manga is another medium; the spin-off is only an OTHER relation.
    assert "912" not in members
    assert SPINOFF not in members


async def test_every_member_carries_its_own_poster_count_and_progress(app_client):
    await setup_admin(app_client)
    await add(app_client, S1, status="completed", progress=28)
    await add(app_client, MOVIE, status="planned")

    members = by_id(await get_series(app_client, S1))

    assert members[S1]["media"]["cover_url"] == "https://img/frieren-s1.jpg"
    assert members[MOVIE]["media"]["cover_url"] == "https://img/frieren-movie.jpg"
    assert [members[k]["media"]["total_units"] for k in (S1, MOVIE, S2, S3)] == [28, 1, 12, 13]
    assert members[S1]["entry"]["status"] == "completed"
    assert members[MOVIE]["entry"]["status"] == "planned"
    # Nothing else is on the list, which is what the UI shows as "not started".
    assert members[S2]["entry"] is None
    assert members[OVA]["entry"] is None


# --- viewing is not choosing ------------------------------------------------


async def test_reading_a_season_never_moves_the_current_season(app_client):
    await setup_admin(app_client)
    await add(app_client, S2, status="current", progress=4)

    # Browsing every other member of the series, repeatedly.
    for provider_id in (S1, S3, MOVIE, OVA, S1, S3):
        body = await get_series(app_client, provider_id)
        assert body["current_provider_id"] == S2, f"reading {provider_id} moved the user"
        assert body["is_explicit"] is False

    assert (await app_client.get("/api/series/selections")).json() == []


async def test_exactly_one_member_is_flagged_current(app_client):
    await setup_admin(app_client)
    await add(app_client, S2, status="current", progress=4)

    body = await get_series(app_client, S1)
    flagged = [s["media"]["provider_id"] for s in body["seasons"] if s["is_current"]]
    assert flagged == [S2]


async def test_the_guess_prefers_a_season_over_an_extra(app_client):
    await setup_admin(app_client)
    # The OVA is the most recently tracked thing, but "where am I in this show" is
    # answered by a season.
    await add(app_client, S1, status="completed", progress=28)
    await add(app_client, OVA, status="completed", progress=2)

    assert (await get_series(app_client, S1))["current_provider_id"] == S1


# --- choosing, deliberately -------------------------------------------------


async def test_setting_the_current_season_persists_and_outlives_a_status_change(app_client):
    await setup_admin(app_client)
    await add(app_client, S1, status="current", progress=3)
    await add(app_client, S2, status="planned")
    await get_series(app_client, S1)  # resolve the chain

    resp = await set_current(app_client, S2)
    assert resp.status_code == 200, resp.text
    assert resp.json()["current_provider_id"] == S2
    assert resp.json()["is_explicit"] is True

    # The choice is the user's, so it holds even though season 1 is the one being
    # watched — which is what the guess would otherwise have returned.
    assert (await get_series(app_client, S3))["current_provider_id"] == S2
    assert (await app_client.get("/api/series/selections")).json() == [
        {"root_provider_id": S1, "provider_id": S2}
    ]


async def test_starting_a_season_tracks_it_and_makes_it_current(app_client):
    await setup_admin(app_client)
    await add(app_client, S1, status="current", progress=28)
    await get_series(app_client, S1)

    body = (await set_current(app_client, S2, start=True)).json()

    assert body["current_provider_id"] == S2
    started = by_id(body)[S2]
    assert started["entry"]["status"] == "current"
    assert started["entry"]["progress"] == 0
    assert started["entry"]["start_date"] is not None


async def test_starting_a_season_you_dropped_resumes_it_without_rewinding(app_client):
    await setup_admin(app_client)
    await add(app_client, S2, status="dropped", progress=5)
    await get_series(app_client, S1)

    body = (await set_current(app_client, S2, start=True)).json()

    resumed = by_id(body)[S2]["entry"]
    assert resumed["status"] == "current"
    assert resumed["progress"] == 5  # not reset to zero


async def test_finishing_a_season_and_continuing_is_one_atomic_change(app_client):
    await setup_admin(app_client)
    await add(app_client, S1, status="current", progress=27)  # one short of 28
    await get_series(app_client, S1)

    body = (await set_current(app_client, S2, start=True, complete_provider_id=S1)).json()

    members = by_id(body)
    # The season just left is completed and its progress squared off, so a completed
    # entry is never left sitting at 27/28.
    assert members[S1]["entry"]["status"] == "completed"
    assert members[S1]["entry"]["progress"] == 28
    assert members[S1]["entry"]["finish_date"] is not None
    # And the next one is now the current, tracked season.
    assert body["current_provider_id"] == S2
    assert members[S2]["entry"]["status"] == "current"


async def test_a_movie_can_be_the_current_entry(app_client):
    await setup_admin(app_client)
    await get_series(app_client, S1)

    body = (await set_current(app_client, MOVIE, start=True)).json()
    assert body["current_provider_id"] == MOVIE
    assert by_id(body)[MOVIE]["kind"] == "movie"


async def test_setting_current_again_replaces_the_previous_choice(app_client):
    await setup_admin(app_client)
    await get_series(app_client, S1)

    for target in (S2, S3, MOVIE, S1):
        resp = await set_current(app_client, target)
        assert resp.status_code == 200
        assert resp.json()["current_provider_id"] == target

    assert len((await app_client.get("/api/series/selections")).json()) == 1


async def test_a_title_from_another_series_is_refused(app_client):
    await setup_admin(app_client)
    await get_series(app_client, S1)
    await add(app_client, "16498", status="current")

    assert (await set_current(app_client, "16498")).status_code == 404
    assert (await set_current(app_client, S2, complete_provider_id="16498")).status_code == 404


async def test_an_id_the_provider_cannot_resolve_is_a_404_not_a_crash(app_client):
    await setup_admin(app_client)
    await get_series(app_client, S1)

    # An id nobody has heard of. The endpoint fetches uncached ids on purpose — the
    # library offers "start season 4" from a bare `sequel_id` — so the miss has to
    # land as a refusal rather than as a provider error escaping.
    assert (await set_current(app_client, "40404")).status_code == 404
    # An id that exists as another medium, which is not this series either.
    assert (await set_current(app_client, "11")).status_code == 404


async def test_choices_are_private_to_their_owner(app_client):
    await setup_admin(app_client)
    await get_series(app_client, S1)
    await set_current(app_client, S3)

    await app_client.post(
        "/api/auth/register",
        json={"email": "e@example.com", "username": "erin", "password": "erinpassword"},
    )
    assert (await app_client.get("/api/series/selections")).json() == []
    erin = await get_series(app_client, S1)
    assert len(erin["seasons"]) == 5  # she sees the same series
    assert erin["is_explicit"] is False  # but nothing is chosen for her


# --- degenerate shapes ------------------------------------------------------


async def test_a_standalone_title_is_a_series_of_one(app_client):
    await setup_admin(app_client)
    body = await get_series(app_client, "1535")

    assert body["root_provider_id"] == "1535"
    assert len(body["seasons"]) == 1
    assert body["seasons"][0]["season_number"] == 1
    assert body["seasons"][0]["kind"] == "season"
    assert body["current_provider_id"] == "1535"
    assert body["seasons"][0]["is_current"] is True


async def test_series_requires_auth(app_client):
    await setup_admin(app_client)
    await app_client.post("/api/auth/logout")
    assert (await app_client.get(f"/api/media/stub/{S1}/series")).status_code == 401
    assert (await app_client.get("/api/series/selections")).status_code == 401
    assert (await set_current(app_client, S2)).status_code == 401
