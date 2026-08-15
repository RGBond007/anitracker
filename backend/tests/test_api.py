import asyncio

import pytest

ADMIN = {"email": "admin@example.com", "username": "admin", "password": "supersecret1"}


async def setup_admin(client):
    resp = await client.post("/api/setup", json=ADMIN)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_instance_reports_setup_state(app_client):
    before = (await app_client.get("/api/instance")).json()
    assert before["setup_complete"] is False
    assert before["license_tier"] == "community"

    await setup_admin(app_client)
    after = (await app_client.get("/api/instance")).json()
    assert after["setup_complete"] is True


async def test_setup_creates_admin_and_cannot_run_twice(app_client):
    user = await setup_admin(app_client)
    assert user["role"] == "admin"

    again = await app_client.post(
        "/api/setup", json={**ADMIN, "email": "other@example.com", "username": "other"}
    )
    assert again.status_code == 409


async def test_second_user_registers_as_plain_user(app_client):
    await setup_admin(app_client)
    resp = await app_client.post(
        "/api/auth/register",
        json={"email": "b@example.com", "username": "bob", "password": "anotherpw12"},
    )
    assert resp.status_code == 201
    assert resp.json()["role"] == "user"


async def test_login_accepts_email_or_username_and_rejects_bad_password(app_client):
    await setup_admin(app_client)
    await app_client.post("/api/auth/logout")

    assert (
        await app_client.post(
            "/api/auth/login",
            json={"identifier": "ADMIN@example.com", "password": ADMIN["password"]},
        )
    ).status_code == 200
    assert (
        await app_client.post(
            "/api/auth/login", json={"identifier": "admin", "password": "wrong-password"}
        )
    ).status_code == 401


async def test_protected_routes_require_auth(app_client):
    await setup_admin(app_client)
    await app_client.post("/api/auth/logout")
    assert (await app_client.get("/api/dashboard")).status_code == 401


async def test_password_change_revokes_other_sessions(app_client):
    await setup_admin(app_client)
    stale_cookies = dict(app_client.cookies)

    resp = await app_client.post(
        "/api/me/password",
        json={"current_password": ADMIN["password"], "new_password": "brand-new-pw-9"},
    )
    assert resp.status_code == 204

    # The old token carries the pre-bump token_version and must be rejected.
    import httpx

    async with httpx.AsyncClient(
        transport=app_client._transport, base_url="http://test", cookies=stale_cookies
    ) as stale:
        assert (await stale.get("/api/me")).status_code == 401


async def test_search_returns_stub_results(app_client):
    await setup_admin(app_client)
    resp = await app_client.get("/api/media/search", params={"q": "shingeki", "type": "anime"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["results"][0]["title_english"] == "Attack on Titan"
    assert body["has_more"] is False


async def test_add_entry_caches_media_once_across_users(app_client):
    await setup_admin(app_client)
    resp = await app_client.post(
        "/api/entries",
        json={"provider": "stub", "provider_id": "16498", "type": "anime", "status": "current"},
    )
    assert resp.status_code == 201
    entry = resp.json()
    assert entry["media"]["title_romaji"] == "Shingeki no Kyojin"
    assert entry["start_date"] is not None  # auto-set on "current"

    duplicate = await app_client.post(
        "/api/entries",
        json={"provider": "stub", "provider_id": "16498", "type": "anime", "status": "planned"},
    )
    assert duplicate.status_code == 409

    # Second user, same title -> same media_cache row.
    await app_client.post(
        "/api/auth/register",
        json={"email": "c@example.com", "username": "carol", "password": "carolpassword"},
    )
    other = await app_client.post(
        "/api/entries",
        json={"provider": "stub", "provider_id": "16498", "type": "anime", "status": "planned"},
    )
    assert other.status_code == 201
    assert other.json()["media"]["id"] == entry["media"]["id"]


async def test_progress_is_clamped_and_completes_the_entry(app_client):
    await setup_admin(app_client)
    entry = (
        await app_client.post(
            "/api/entries",
            json={"provider": "stub", "provider_id": "16498", "type": "anime", "status": "current"},
        )
    ).json()

    updated = (await app_client.patch(f"/api/entries/{entry['id']}", json={"progress": 999})).json()
    assert updated["progress"] == 25  # clamped to total_units
    assert updated["status"] == "completed"
    assert updated["finish_date"] is not None


async def test_increment_moves_planned_to_current(app_client):
    await setup_admin(app_client)
    entry = (
        await app_client.post(
            "/api/entries",
            json={"provider": "stub", "provider_id": "1535", "type": "anime", "status": "planned"},
        )
    ).json()

    bumped = (await app_client.post(f"/api/entries/{entry['id']}/increment")).json()
    assert bumped["progress"] == 1
    assert bumped["status"] == "current"


async def test_entries_are_scoped_per_user(app_client):
    await setup_admin(app_client)
    mine = (
        await app_client.post(
            "/api/entries",
            json={"provider": "stub", "provider_id": "16498", "type": "anime", "status": "current"},
        )
    ).json()

    await app_client.post(
        "/api/auth/register",
        json={"email": "d@example.com", "username": "dave", "password": "davepassword"},
    )
    assert (await app_client.get(f"/api/entries/{mine['id']}")).status_code == 404
    assert (await app_client.get("/api/entries")).json() == []


async def test_dashboard_aggregates_scores_and_watch_time(app_client):
    await setup_admin(app_client)
    for provider_id, status_value, score in (("16498", "completed", 9), ("1535", "current", 7)):
        created = (
            await app_client.post(
                "/api/entries",
                json={
                    "provider": "stub",
                    "provider_id": provider_id,
                    "type": "anime",
                    "status": status_value,
                    "score": score,
                },
            )
        ).json()
        if status_value == "current":
            await app_client.patch(f"/api/entries/{created['id']}", json={"progress": 10})

    data = (await app_client.get("/api/dashboard")).json()
    anime = data["anime"]
    assert anime["total"] == 2
    assert anime["mean_score"] == 8.0
    assert anime["scored_count"] == 2
    assert anime["episodes_watched"] == 35  # 25 completed + 10 in progress
    assert anime["days_watched"] == pytest.approx((25 * 24 + 10 * 23) / 1440, abs=0.01)
    assert len(data["in_progress"]) == 1


async def test_admin_cannot_delete_last_admin(app_client):
    admin = await setup_admin(app_client)
    resp = await app_client.delete(f"/api/admin/users/{admin['id']}")
    assert resp.status_code == 409


async def test_non_admin_is_refused_admin_routes(app_client):
    await setup_admin(app_client)
    await app_client.post(
        "/api/auth/register",
        json={"email": "e@example.com", "username": "erin", "password": "erinpassword"},
    )
    assert (await app_client.get("/api/admin/users")).status_code == 403


async def test_mal_import_creates_entries(app_client, fixture):
    await setup_admin(app_client)
    resp = await app_client.post(
        "/api/import/mal",
        files={"file": ("animelist.xml", fixture("mal_export.xml"), "text/xml")},
    )
    assert resp.status_code == 202
    job_id = resp.json()["id"]

    for _ in range(50):
        job = (await app_client.get(f"/api/import/jobs/{job_id}")).json()
        if job["state"] in ("done", "failed"):
            break
        await asyncio.sleep(0.05)

    assert job["state"] == "done"
    assert job["imported"] == 3  # the "Bogus" status row is dropped at parse time
    assert job["failed"] == 0

    entries = (await app_client.get("/api/entries")).json()
    titles = {e["media"]["title_romaji"] for e in entries}
    assert titles == {"Shingeki no Kyojin", "Death Note", "Berserk"}

    aot = next(e for e in entries if e["media"]["title_romaji"] == "Shingeki no Kyojin")
    assert aot["status"] == "completed"
    assert aot["score"] == 9
    assert aot["start_date"] == "2013-04-10"
    assert aot["notes"] == "Season 1 is peak."

    death_note = next(e for e in entries if e["media"]["title_romaji"] == "Death Note")
    assert death_note["score"] is None  # MAL score 0 means "unscored", not zero
    assert death_note["start_date"] is None  # 0000-00-00


async def test_mal_import_rejects_garbage(app_client):
    await setup_admin(app_client)
    resp = await app_client.post(
        "/api/import/mal", files={"file": ("x.xml", b"not xml at all", "text/xml")}
    )
    assert resp.status_code == 400


async def test_setup_wizard_can_brand_the_instance(app_client):
    await app_client.post(
        "/api/setup",
        json={**ADMIN, "instance_name": "Rafael's Anime", "accent_color": "#C9A227"},
    )
    info = (await app_client.get("/api/instance")).json()
    assert info["instance_name"] == "Rafael's Anime"
    assert info["accent_color"] == "#C9A227"


async def test_admin_can_edit_branding_and_close_signups(app_client):
    await setup_admin(app_client)

    resp = await app_client.patch(
        "/api/admin/instance",
        json={"instance_name": "Homelab Tracker", "allow_signup": False},
    )
    assert resp.status_code == 200
    assert resp.json()["instance_name"] == "Homelab Tracker"

    info = (await app_client.get("/api/instance")).json()
    assert info["allow_signup"] is False

    blocked = await app_client.post(
        "/api/auth/register",
        json={"email": "z@example.com", "username": "zoe", "password": "zoepassword1"},
    )
    assert blocked.status_code == 403


async def test_clearing_a_branding_override_falls_back_to_env(app_client):
    await setup_admin(app_client)
    await app_client.patch("/api/admin/instance", json={"instance_name": "Temporary"})
    await app_client.patch("/api/admin/instance", json={"instance_name": ""})

    info = (await app_client.get("/api/instance")).json()
    assert info["instance_name"] == "AniTrack"  # the .env default


async def test_non_admin_cannot_edit_the_instance(app_client):
    await setup_admin(app_client)
    await app_client.post(
        "/api/auth/register",
        json={"email": "f@example.com", "username": "finn", "password": "finnpassword"},
    )
    resp = await app_client.patch("/api/admin/instance", json={"instance_name": "Hijacked"})
    assert resp.status_code == 403
