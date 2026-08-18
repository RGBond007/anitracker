"""
Profile picture uploads.

The interesting cases are all the same shape: something that is not a still image
arriving with an image's name. So most of this file is about what gets refused,
and what is left on disk afterwards.
"""

from io import BytesIO

from PIL import Image

from app.avatars import avatar_dir
from app.config import settings

ADMIN = {"email": "admin@example.com", "username": "admin", "password": "supersecret1"}
OTHER = {"email": "taro@example.com", "username": "taro", "password": "anotherpw12"}


async def setup_admin(client):
    assert (await client.post("/api/setup", json=ADMIN)).status_code == 201


async def login(client, identifier, password):
    resp = await client.post(
        "/api/auth/login", json={"identifier": identifier, "password": password}
    )
    assert resp.status_code == 200, resp.text


def image_bytes(fmt="PNG", size=(800, 600), mode="RGB") -> bytes:
    buffer = BytesIO()
    Image.new(mode, size, (120, 90, 200)).save(buffer, format=fmt)
    return buffer.getvalue()


def animated_webp() -> bytes:
    buffer = BytesIO()
    frames = [Image.new("RGB", (64, 64), (i * 60, 0, 0)) for i in range(3)]
    frames[0].save(buffer, format="WEBP", save_all=True, append_images=frames[1:], duration=100)
    return buffer.getvalue()


async def upload(client, data: bytes, filename="me.png", content_type="image/png"):
    return await client.put(
        "/api/me/avatar", files={"file": (filename, data, content_type)}
    )


def stored_files() -> list[str]:
    return sorted(p.name for p in avatar_dir().iterdir() if p.is_file())


# --- the happy path -------------------------------------------------------


async def test_upload_normalises_to_a_square_webp_and_serves_it(app_client):
    await setup_admin(app_client)

    resp = await upload(app_client, image_bytes())
    assert resp.status_code == 200, resp.text
    url = resp.json()["avatar_url"]
    assert url and url.startswith("/media/avatars/")

    served = await app_client.get(url)
    assert served.status_code == 200
    assert served.headers["content-type"] == "image/webp"
    # Nothing served out of the upload directory may be sniffed into another type.
    assert served.headers["x-content-type-options"] == "nosniff"

    # A 4:3 source comes back as the square every avatar slot expects.
    stored = Image.open(BytesIO(served.content))
    assert stored.format == "WEBP"
    assert stored.size == (settings.avatar_pixels, settings.avatar_pixels)


async def test_a_jpeg_keeps_its_exif_out_of_the_stored_copy(app_client):
    await setup_admin(app_client)

    source = BytesIO()
    exif = Image.Exif()
    exif[0x010E] = "taken at home"  # ImageDescription
    Image.new("RGB", (400, 400), (10, 10, 10)).save(source, format="JPEG", exif=exif)

    resp = await upload(app_client, source.getvalue(), "holiday.jpg", "image/jpeg")
    assert resp.status_code == 200

    served = await app_client.get(resp.json()["avatar_url"])
    assert dict(Image.open(BytesIO(served.content)).getexif()) == {}


async def test_replacing_an_avatar_leaves_only_the_new_file(app_client):
    await setup_admin(app_client)

    first = (await upload(app_client, image_bytes())).json()["avatar_url"]
    assert len(stored_files()) == 1

    second = (await upload(app_client, image_bytes(size=(300, 300)))).json()["avatar_url"]
    assert second != first
    assert len(stored_files()) == 1, "the replaced picture should not be left behind"
    # The old URL is gone rather than serving a stale picture -- which is what
    # makes a new avatar appear without a hard refresh.
    assert (await app_client.get(first)).status_code == 404


async def test_removing_an_avatar_clears_the_row_and_the_file(app_client):
    await setup_admin(app_client)
    url = (await upload(app_client, image_bytes())).json()["avatar_url"]

    resp = await app_client.delete("/api/me/avatar")
    assert resp.status_code == 200
    assert resp.json()["avatar_url"] is None
    assert stored_files() == []
    assert (await app_client.get(url)).status_code == 404

    # Removing again is not an error -- there is simply nothing to remove.
    assert (await app_client.delete("/api/me/avatar")).status_code == 200


async def test_an_account_without_an_upload_has_no_avatar_url(app_client):
    await setup_admin(app_client)
    assert (await app_client.get("/api/me")).json()["avatar_url"] is None


# --- what gets refused ----------------------------------------------------


async def test_a_script_wearing_a_png_name_is_refused(app_client):
    await setup_admin(app_client)
    resp = await upload(app_client, b"#!/bin/sh\nrm -rf /\n", "avatar.png", "image/png")
    assert resp.status_code == 400
    assert stored_files() == []


async def test_svg_is_refused(app_client):
    await setup_admin(app_client)
    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    assert (await upload(app_client, svg, "avatar.svg", "image/svg+xml")).status_code == 400
    assert stored_files() == []


async def test_a_truncated_image_is_refused(app_client):
    await setup_admin(app_client)
    half = image_bytes()[: len(image_bytes()) // 2]
    assert (await upload(app_client, half)).status_code == 400
    assert stored_files() == []


async def test_an_oversized_upload_is_refused(app_client):
    await setup_admin(app_client)
    # Valid JPEG signature, so it is the size check that rejects it rather than
    # the decoder -- which is the point: the server never decodes something this big.
    huge = b"\xff\xd8\xff" + b"0" * (settings.max_avatar_bytes + 1)
    assert (await upload(app_client, huge, "big.jpg", "image/jpeg")).status_code == 400
    assert stored_files() == []


async def test_an_animated_image_is_refused(app_client):
    await setup_admin(app_client)
    resp = await upload(app_client, animated_webp(), "loop.webp", "image/webp")
    assert resp.status_code == 400
    assert "Animated" in resp.json()["detail"]
    assert stored_files() == []


async def test_an_empty_file_is_refused(app_client):
    await setup_admin(app_client)
    assert (await upload(app_client, b"")).status_code == 400


# --- who may do it --------------------------------------------------------


async def test_uploading_requires_a_session(app_client):
    await setup_admin(app_client)
    await app_client.post("/api/auth/logout")
    assert (await upload(app_client, image_bytes())).status_code == 401
    assert (await app_client.delete("/api/me/avatar")).status_code == 401


async def test_an_upload_only_ever_changes_your_own_picture(app_client):
    """The route names no user, so the session is the only thing that decides."""
    await setup_admin(app_client)
    assert (await app_client.post("/api/auth/register", json=OTHER)).status_code == 201

    await login(app_client, ADMIN["username"], ADMIN["password"])
    mine = (await upload(app_client, image_bytes())).json()["avatar_url"]

    await login(app_client, OTHER["username"], OTHER["password"])
    assert (await app_client.get("/api/me")).json()["avatar_url"] is None

    # And the other account's picture is visible as theirs, not adopted as ours.
    await login(app_client, ADMIN["username"], ADMIN["password"])
    assert (await app_client.get("/api/me")).json()["avatar_url"] == mine


# --- serving --------------------------------------------------------------


async def test_only_generated_names_are_served(app_client):
    await setup_admin(app_client)
    await upload(app_client, image_bytes())

    # A name this server never generated, and a traversal attempt: both are misses,
    # and neither is answered with the SPA's index.html.
    for name in ("nope.webp", "../../etc/passwd", "avatar.png"):
        resp = await app_client.get(f"/media/avatars/{name}")
        assert resp.status_code == 404, name
        assert "text/html" not in resp.headers.get("content-type", "")


async def test_a_friend_sees_your_picture_on_your_profile(app_client):
    await setup_admin(app_client)
    await app_client.post("/api/auth/register", json=OTHER)

    await login(app_client, ADMIN["username"], ADMIN["password"])
    url = (await upload(app_client, image_bytes())).json()["avatar_url"]

    await login(app_client, OTHER["username"], OTHER["password"])
    profile = (await app_client.get("/api/users/admin")).json()
    assert profile["user"]["avatar_url"] == url
    # ...and still nothing it should not carry.
    assert "email" not in profile["user"]
