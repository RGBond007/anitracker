import httpx

from app.providers.base import (
    Covers,
    MediaProvider,
    MediaRecord,
    NotFound,
    ProviderError,
    RateLimited,
)
from app.providers.ratelimit import TokenBucket

BASE = "https://kitsu.io/api/edge"
HEADERS = {"Accept": "application/vnd.api+json", "Content-Type": "application/vnd.api+json"}


class KitsuProvider(MediaProvider):
    """Third fallback. Its ``titles`` map is the best locale-keyed source of the three."""

    name = "kitsu"

    def __init__(self, client: httpx.AsyncClient | None = None):
        self._client = client or httpx.AsyncClient(timeout=15.0, base_url=BASE, headers=HEADERS)
        # Undocumented limits -- self-throttle conservatively.
        self._bucket = TokenBucket(rate=2.0, capacity=5)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _get(self, path: str, params: dict | None = None) -> dict:
        await self._bucket.acquire()
        try:
            resp = await self._client.get(path, params=params)
        except httpx.HTTPError as exc:
            raise ProviderError(f"kitsu transport error: {exc}") from exc

        if resp.status_code == 429:
            retry = float(resp.headers.get("Retry-After", 30))
            self._bucket.penalise(retry)
            raise RateLimited(retry)
        if resp.status_code == 404:
            raise NotFound(f"kitsu 404 {path}")
        if resp.status_code >= 500:
            raise ProviderError(f"kitsu upstream {resp.status_code}")
        return resp.json()

    def _to_record(self, node: dict, type: str) -> MediaRecord:
        attrs = node.get("attributes") or {}
        titles = attrs.get("titles") or {}
        poster = attrs.get("posterImage") or {}
        cover = attrs.get("coverImage") or {}
        total = attrs.get("episodeCount") if type == "anime" else attrs.get("chapterCount")
        rating = attrs.get("averageRating")
        started = attrs.get("startDate") or ""
        return MediaRecord(
            provider=self.name,
            provider_id=str(node["id"]),
            type=type,
            title_romaji=titles.get("en_jp") or attrs.get("canonicalTitle"),
            title_english=titles.get("en"),
            title_native=titles.get("ja_jp"),
            synonyms=list(attrs.get("abbreviatedTitles") or []),
            covers=Covers(
                large=poster.get("large") or poster.get("original"),
                medium=poster.get("medium") or poster.get("small"),
                banner=cover.get("large") or cover.get("original"),
            ),
            synopsis=attrs.get("synopsis"),
            total_units=total,
            format=attrs.get("subtype"),
            status=attrs.get("status"),
            season_year=int(started[:4]) if started[:4].isdigit() else None,
            average_score=int(float(rating)) if rating else None,
            duration=attrs.get("episodeLength"),
        )

    async def search(
        self,
        query: str,
        type: str,
        page: int = 1,
        per_page: int = 20,
        genres: list[str] | None = None,
    ) -> list[MediaRecord]:
        # Kitsu categorises rather than tagging genres, and its slugs do not line
        # up with AniList's names. Left to the caller's own filtering.
        data = await self._get(
            f"/{type}",
            {
                "filter[text]": query,
                "page[limit]": per_page,
                "page[offset]": (page - 1) * per_page,
            },
        )
        return [self._to_record(n, type) for n in data.get("data") or []]

    async def get_by_id(self, provider_id: str, type: str) -> MediaRecord:
        data = await self._get(f"/{type}/{provider_id}")
        node = data.get("data")
        if not node:
            raise NotFound(f"kitsu {type} {provider_id}")
        return self._to_record(node, type)

    async def get_covers(self, provider_id: str, type: str) -> Covers:
        return (await self.get_by_id(provider_id, type)).covers
