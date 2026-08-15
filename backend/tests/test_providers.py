import httpx
import pytest
import respx

from app.providers.anilist import AniListProvider
from app.providers.base import NotFound, ProviderError, RateLimited
from app.providers.jikan import JikanProvider
from app.providers.kitsu import KitsuProvider
from app.providers.registry import ProviderRegistry


@respx.mock
async def test_anilist_search_maps_all_fields(fixture):
    respx.post("https://graphql.anilist.co").mock(
        return_value=httpx.Response(200, json=fixture("anilist_search.json"))
    )
    provider = AniListProvider()
    results = await provider.search("titan", "anime")

    assert len(results) == 2
    first = results[0]
    assert first.provider == "anilist"
    assert first.provider_id == "16498"
    assert first.mal_id == 16498
    assert first.title_english == "Attack on Titan"
    assert first.title_native == "進撃の巨人"
    assert first.synonyms == ["進撃の巨人", "AoT"]
    assert first.covers.large == "https://img/aot-xl.jpg"  # prefers extraLarge
    assert first.covers.color == "#e4a15d"
    assert first.total_units == 25
    assert first.duration == 24

    # Falls back to `large` when extraLarge is absent.
    assert results[1].covers.large == "https://img/aot2-l.jpg"
    assert results[1].display_title == "Shingeki no Kyojin 2"
    await provider.aclose()


@respx.mock
async def test_anilist_manga_uses_chapters_not_episodes(fixture):
    payload = fixture("anilist_media.json")
    payload["data"]["Media"].update({"type": "MANGA", "episodes": None, "chapters": 139})
    respx.post("https://graphql.anilist.co").mock(return_value=httpx.Response(200, json=payload))

    provider = AniListProvider()
    record = await provider.get_by_id("16498", "manga")
    assert record.type == "manga"
    assert record.total_units == 139
    await provider.aclose()


@respx.mock
async def test_anilist_429_raises_rate_limited_and_blocks_bucket():
    respx.post("https://graphql.anilist.co").mock(
        return_value=httpx.Response(429, headers={"Retry-After": "30"})
    )
    provider = AniListProvider()
    with pytest.raises(RateLimited):
        await provider.search("x", "anime")
    assert provider._bucket.blocked
    await provider.aclose()


@respx.mock
async def test_anilist_graphql_not_found_is_notfound(fixture):
    respx.post("https://graphql.anilist.co").mock(
        return_value=httpx.Response(200, json={"errors": [{"message": "Not Found."}]})
    )
    provider = AniListProvider()
    with pytest.raises(NotFound):
        await provider.get_by_id("1", "anime")
    await provider.aclose()


@respx.mock
async def test_jikan_search_maps_titles_and_score(fixture):
    respx.get("https://api.jikan.moe/v4/anime").mock(
        return_value=httpx.Response(200, json=fixture("jikan_search.json"))
    )
    provider = JikanProvider()
    record = (await provider.search("titan", "anime"))[0]

    assert record.provider == "jikan"
    assert record.mal_id == 16498
    assert record.title_english == "Attack on Titan"
    assert record.synonyms == ["AoT"]
    assert record.average_score == 85  # 8.54 * 10, rounded down to int
    assert record.duration == 24  # parsed out of "24 min per ep"
    await provider.aclose()


@respx.mock
async def test_kitsu_locale_title_map(fixture):
    respx.get("https://kitsu.io/api/edge/anime").mock(
        return_value=httpx.Response(200, json=fixture("kitsu_search.json"))
    )
    provider = KitsuProvider()
    record = (await provider.search("titan", "anime"))[0]

    assert record.title_romaji == "Shingeki no Kyojin"  # en_jp
    assert record.title_english == "Attack on Titan"
    assert record.title_native == "進撃の巨人"
    assert record.season_year == 2013
    await provider.aclose()


@respx.mock
async def test_registry_falls_back_when_primary_is_rate_limited(fixture):
    respx.post("https://graphql.anilist.co").mock(return_value=httpx.Response(429))
    respx.get("https://api.jikan.moe/v4/anime").mock(
        return_value=httpx.Response(200, json=fixture("jikan_search.json"))
    )
    registry = ProviderRegistry([AniListProvider(), JikanProvider()])
    results = await registry.search("titan", "anime")

    assert results and results[0].provider == "jikan"
    await registry.aclose()


@respx.mock
async def test_registry_raises_when_every_provider_fails():
    respx.post("https://graphql.anilist.co").mock(return_value=httpx.Response(500))
    respx.get("https://api.jikan.moe/v4/anime").mock(return_value=httpx.Response(503))
    registry = ProviderRegistry([AniListProvider(), JikanProvider()])

    with pytest.raises(ProviderError):
        await registry.search("titan", "anime")
    await registry.aclose()


async def test_registry_detail_lookup_is_pinned_to_owning_provider():
    """An AniList id must never be resolved against Jikan -- the ids are unrelated."""
    registry = ProviderRegistry([AniListProvider(), JikanProvider()])
    with pytest.raises(ProviderError, match="unknown provider"):
        await registry.get_by_id("nope", "1", "anime")
    await registry.aclose()
