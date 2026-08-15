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

BASE = "https://api.jikan.moe/v4"


class JikanProvider(MediaProvider):
    """Unofficial MAL API. Fallback source, and the natural home for MAL id lookups."""

    name = "jikan"

    def __init__(self, client: httpx.AsyncClient | None = None):
        self._client = client or httpx.AsyncClient(timeout=15.0, base_url=BASE)
        # Documented 3 req/sec and 60 req/min -- the per-minute cap is the binding one.
        self._bucket = TokenBucket(rate=1.0, capacity=3)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _get(self, path: str, params: dict | None = None) -> dict:
        await self._bucket.acquire()
        try:
            resp = await self._client.get(path, params=params)
        except httpx.HTTPError as exc:
            raise ProviderError(f"jikan transport error: {exc}") from exc

        if resp.status_code == 429:
            retry = float(resp.headers.get("Retry-After", 60))
            self._bucket.penalise(retry)
            raise RateLimited(retry)
        if resp.status_code == 404:
            raise NotFound(f"jikan 404 {path}")
        if resp.status_code >= 500:
            raise ProviderError(f"jikan upstream {resp.status_code}")
        return resp.json()

    def _to_record(self, node: dict, type: str) -> MediaRecord:
        images = (node.get("images") or {}).get("jpg") or {}
        titles = node.get("titles") or []
        by_type = {t.get("type"): t.get("title") for t in titles}
        synonyms = [t["title"] for t in titles if t.get("type") == "Synonym" and t.get("title")]
        total = node.get("episodes") if type == "anime" else node.get("chapters")
        duration = None
        if type == "anime" and isinstance(node.get("duration"), str):
            digits = "".join(c for c in node["duration"] if c.isdigit())
            duration = int(digits) if digits else None
        return MediaRecord(
            provider=self.name,
            provider_id=str(node["mal_id"]),
            mal_id=node.get("mal_id"),
            type=type,
            title_romaji=by_type.get("Default") or node.get("title"),
            title_english=by_type.get("English") or node.get("title_english"),
            title_native=by_type.get("Japanese") or node.get("title_japanese"),
            synonyms=synonyms or list(node.get("title_synonyms") or []),
            covers=Covers(
                large=images.get("large_image_url") or images.get("image_url"),
                medium=images.get("image_url") or images.get("small_image_url"),
            ),
            synopsis=node.get("synopsis"),
            total_units=total,
            format=node.get("type"),
            status=node.get("status"),
            season_year=node.get("year"),
            genres=[g["name"] for g in (node.get("genres") or []) if g.get("name")],
            average_score=int(node["score"] * 10) if node.get("score") else None,
            duration=duration,
        )

    async def search(
        self, query: str, type: str, page: int = 1, per_page: int = 20
    ) -> list[MediaRecord]:
        data = await self._get(f"/{type}", {"q": query, "page": page, "limit": per_page})
        return [self._to_record(n, type) for n in data.get("data") or []]

    async def get_by_id(self, provider_id: str, type: str) -> MediaRecord:
        data = await self._get(f"/{type}/{provider_id}")
        node = data.get("data")
        if not node:
            raise NotFound(f"jikan {type} {provider_id}")
        return self._to_record(node, type)

    async def get_by_mal_id(self, mal_id: int, type: str) -> MediaRecord:
        # Jikan ids *are* MAL ids.
        return await self.get_by_id(str(mal_id), type)

    async def get_covers(self, provider_id: str, type: str) -> Covers:
        return (await self.get_by_id(provider_id, type)).covers
