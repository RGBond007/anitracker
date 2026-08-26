"""
Which unmatched paths are the client's routes.

The bug this file exists for: the SPA fallback excluded the whole of `/media`,
meaning it for the avatar files at `/media/avatars/...`. But `/media/{provider}/{id}`
is the client's own route for a title, so from 2026-08-18 every detail page in the
app answered a reload with `{"detail":"Not Found"}` — and every link anyone shared
to a title opened on a page of JSON.

Nothing caught it because the fallback is registered inside `if STATIC_DIR.is_dir()`,
and `app/static` only exists inside the built image; from a source checkout the whole
block is skipped and there is nothing for a request to hit. So the decision is tested
here directly, where a checkout can reach it.
"""

from app.main import is_client_route

#: Every route the client router declares, in the shapes they arrive in.
CLIENT_ROUTES = [
    "/",
    "/search",
    "/media/anilist/21",
    "/media/jikan/1535?type=anime",
    "/media/kitsu/44081",
    "/list/current",
    "/shelf/3",
    "/journal",
    "/friends",
    "/u/taro",
    "/settings",
    "/import",
    "/setup",
    "/login",
]

#: Served by something else. A miss here has to read as a miss.
NOT_CLIENT_ROUTES = [
    "/api",
    "/api/entries",
    "/api/media/anilist/21",
    "/assets",
    "/assets/index-C_HjmDAW.js",
    "/assets/index-DDOO7tka.css",
    "/media/avatars",
    "/media/avatars/6f1c2a.webp",
]


def test_every_client_route_is_answered_with_the_app():
    for path in CLIENT_ROUTES:
        assert is_client_route(path), path


def test_a_title_page_is_a_client_route():
    """The regression itself, named on its own so a failure says what broke."""
    assert is_client_route("/media/anilist/21")


def test_the_api_and_the_bundle_are_never_answered_with_the_app():
    for path in NOT_CLIENT_ROUTES:
        assert not is_client_route(path), path


def test_an_avatar_that_does_not_exist_still_reads_as_missing():
    # Otherwise the <img> is handed a page of HTML, the browser draws it as a
    # broken image, and the client never falls back to drawing initials.
    assert not is_client_route("/media/avatars/never-generated.webp")


def test_the_prefixes_match_on_segments_rather_than_on_letters():
    # A provider whose name merely starts with one of the reserved words is still
    # a title, and `/apiary` is not the API.
    assert is_client_route("/media/avatarsomething/21")
    assert is_client_route("/apiary")
    assert is_client_route("/assetsomething")
