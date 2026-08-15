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

ENDPOINT = "https://graphql.anilist.co"

_MEDIA_FIELDS = """
  id
  idMal
  type
  format
  status
  episodes
  chapters
  duration
  seasonYear
  averageScore
  genres
  synonyms
  description(asHtml: false)
  title { romaji english native }
  coverImage { extraLarge large medium color }
  bannerImage
"""

SEARCH_QUERY = (
    """
query ($search: String, $type: MediaType, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(search: $search, type: $type, sort: SEARCH_MATCH) {
      %s
    }
  }
}
"""
    % _MEDIA_FIELDS
)

BY_ID_QUERY = (
    """
query ($id: Int, $idMal: Int, $type: MediaType) {
  Media(id: $id, idMal: $idMal, type: $type) {
    %s
  }
}
"""
    % _MEDIA_FIELDS
)


# Airing data is volatile and tiny, so it is fetched on its own rather than being
# folded into `_MEDIA_FIELDS` — the cached media row would go stale every week.
AIRING_QUERY = """
query ($ids: [Int]) {
  Page(perPage: 50) {
    media(id_in: $ids, type: ANIME) {
      id
      nextAiringEpisode { airingAt episode }
    }
  }
}
"""


class AniListProvider(MediaProvider):
    """Primary source. One GraphQL round trip yields titles, covers, synonyms and synopsis."""

    name = "anilist"

    def __init__(self, client: httpx.AsyncClient | None = None):
        self._client = client or httpx.AsyncClient(timeout=15.0)
        # Documented ~90/min, in practice degraded to 30/min. Stay under the floor.
        self._bucket = TokenBucket(rate=0.5, capacity=5)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _post(self, query: str, variables: dict) -> dict:
        await self._bucket.acquire()
        try:
            resp = await self._client.post(ENDPOINT, json={"query": query, "variables": variables})
        except httpx.HTTPError as exc:
            raise ProviderError(f"anilist transport error: {exc}") from exc

        if resp.status_code == 429:
            retry = float(resp.headers.get("Retry-After", 60))
            self._bucket.penalise(retry)
            raise RateLimited(retry)
        if resp.status_code >= 500:
            raise ProviderError(f"anilist upstream {resp.status_code}")
        if resp.status_code == 404:
            raise NotFound("anilist 404")

        payload = resp.json()
        if payload.get("errors"):
            messages = [e.get("message", "") for e in payload["errors"]]
            if any("Not Found" in m for m in messages):
                raise NotFound("; ".join(messages))
            raise ProviderError("; ".join(messages))
        return payload.get("data") or {}

    def _to_record(self, node: dict) -> MediaRecord:
        media_type = (node.get("type") or "ANIME").lower()
        cover = node.get("coverImage") or {}
        title = node.get("title") or {}
        total = node.get("episodes") if media_type == "anime" else node.get("chapters")
        return MediaRecord(
            provider=self.name,
            provider_id=str(node["id"]),
            mal_id=node.get("idMal"),
            type=media_type,
            title_romaji=title.get("romaji"),
            title_english=title.get("english"),
            title_native=title.get("native"),
            synonyms=list(node.get("synonyms") or []),
            covers=Covers(
                large=cover.get("extraLarge") or cover.get("large"),
                medium=cover.get("medium"),
                banner=node.get("bannerImage"),
                color=cover.get("color"),
            ),
            synopsis=node.get("description"),
            total_units=total,
            format=node.get("format"),
            status=node.get("status"),
            season_year=node.get("seasonYear"),
            genres=list(node.get("genres") or []),
            average_score=node.get("averageScore"),
            duration=node.get("duration"),
        )

    async def search(
        self, query: str, type: str, page: int = 1, per_page: int = 20
    ) -> list[MediaRecord]:
        data = await self._post(
            SEARCH_QUERY,
            {"search": query, "type": type.upper(), "page": page, "perPage": per_page},
        )
        nodes = ((data.get("Page") or {}).get("media")) or []
        return [self._to_record(n) for n in nodes]

    async def get_by_id(self, provider_id: str, type: str) -> MediaRecord:
        data = await self._post(BY_ID_QUERY, {"id": int(provider_id), "type": type.upper()})
        node = data.get("Media")
        if not node:
            raise NotFound(f"anilist id {provider_id}")
        return self._to_record(node)

    async def get_by_mal_id(self, mal_id: int, type: str) -> MediaRecord:
        data = await self._post(BY_ID_QUERY, {"idMal": int(mal_id), "type": type.upper()})
        node = data.get("Media")
        if not node:
            raise NotFound(f"anilist idMal {mal_id}")
        return self._to_record(node)

    async def get_covers(self, provider_id: str, type: str) -> Covers:
        return (await self.get_by_id(provider_id, type)).covers


    async def airing(self, provider_ids: list[str]) -> dict[str, tuple[int, int]]:
        """
        `{provider_id: (episode, airing_at_unix)}` for whichever of these are still
        airing. Finished shows simply have no `nextAiringEpisode` and are omitted.

        One request for up to 50 titles: a call per show would exhaust the rate
        limit on a moderately sized watching list.
        """
        numeric = [int(pid) for pid in provider_ids if str(pid).isdigit()]
        if not numeric:
            return {}
        data = await self._post(AIRING_QUERY, {"ids": numeric[:50]})
        out: dict[str, tuple[int, int]] = {}
        for media in data.get("Page", {}).get("media", []) or []:
            nxt = media.get("nextAiringEpisode")
            if nxt and nxt.get("airingAt"):
                out[str(media["id"])] = (int(nxt.get("episode") or 0), int(nxt["airingAt"]))
        return out
