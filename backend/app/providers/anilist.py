from datetime import date

import httpx

from app.providers.base import (
    Covers,
    MediaProvider,
    MediaRecord,
    NotFound,
    ProviderError,
    RateLimited,
    Related,
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
  season
  startDate { year month day }
  averageScore
  genres
  synonyms
  description(asHtml: false)
  title { romaji english native }
  coverImage { extraLarge large medium color }
  bannerImage
  relations { edges { relationType node { id type format } } }
"""

SEARCH_QUERY = (
    """
query (
  $search: String, $type: MediaType, $page: Int, $perPage: Int
  $genres: [String], $sort: [MediaSort]
) {
  Page(page: $page, perPage: $perPage) {
    media(search: $search, type: $type, sort: $sort, genre_in: $genres, isAdult: false) {
      %s
    }
  }
}
"""
    % _MEDIA_FIELDS
)

#: What people are actually watching this week, which is what "popular right now"
#: has to mean -- POPULARITY_DESC would return the same all-time list every day.
TRENDING_QUERY = (
    """
query ($type: MediaType, $perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(type: $type, sort: TRENDING_DESC, isAdult: false) {
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

    @staticmethod
    def _same_medium(node: dict, media_type: str) -> bool:
        return (node.get("type") or "").lower() == media_type.lower()

    @classmethod
    def _chain_links(cls, node: dict, media_type: str) -> tuple[str | None, str | None]:
        """
        The direct prequel and sequel, if they are the same medium and a real season
        rather than a special. AniList hangs OVAs, movies and recaps off the same
        `relations` edge, and treating a recap as "Staffel 2" would be worse than
        showing nothing — those arrive through `_related` instead, unnumbered.
        """
        seasonish = {"TV", "TV_SHORT", "ONA"}
        prequel = sequel = None
        for edge in (node.get("relations") or {}).get("edges") or []:
            child = edge.get("node") or {}
            if not cls._same_medium(child, media_type):
                continue
            if child.get("format") not in seasonish:
                continue
            if edge.get("relationType") == "PREQUEL" and prequel is None:
                prequel = str(child["id"])
            elif edge.get("relationType") == "SEQUEL" and sequel is None:
                sequel = str(child["id"])
        return prequel, sequel

    @classmethod
    def _related(cls, node: dict, media_type: str) -> list[Related]:
        """
        Every neighbour of the same medium, raw. The season spine is filtered here to
        TV formats; this is not, because the movie, the OVA and the recap special all
        belong on a series page even though none of them is a season of it.
        """
        out: list[Related] = []
        for edge in (node.get("relations") or {}).get("edges") or []:
            child = edge.get("node") or {}
            if not cls._same_medium(child, media_type) or child.get("id") is None:
                continue
            out.append(
                Related(
                    provider_id=str(child["id"]),
                    relation=edge.get("relationType") or "OTHER",
                    format=child.get("format"),
                )
            )
        return out

    @staticmethod
    def _start_date(node: dict) -> date | None:
        """
        AniList reports a partial date for anything not yet dated — a year with no
        month is normal for an announced season — so a date is only built when all
        three parts are there, and the year alone keeps working through `season_year`.
        """
        raw = node.get("startDate") or {}
        year, month, day = raw.get("year"), raw.get("month"), raw.get("day")
        if not (year and month and day):
            return None
        try:
            return date(year, month, day)
        except ValueError:  # the provider has published 2月30日 before now
            return None

    def _to_record(self, node: dict) -> MediaRecord:
        media_type = (node.get("type") or "ANIME").lower()
        cover = node.get("coverImage") or {}
        title = node.get("title") or {}
        total = node.get("episodes") if media_type == "anime" else node.get("chapters")
        prequel, sequel = self._chain_links(node, media_type)
        related = self._related(node, media_type)
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
            season=node.get("season"),
            start_date=self._start_date(node),
            prequel_id=prequel,
            sequel_id=sequel,
            related=related,
            genres=list(node.get("genres") or []),
            average_score=node.get("averageScore"),
            duration=node.get("duration"),
        )

    async def search(
        self,
        query: str,
        type: str,
        page: int = 1,
        per_page: int = 20,
        genres: list[str] | None = None,
    ) -> list[MediaRecord]:
        data = await self._post(
            SEARCH_QUERY,
            {
                # Null rather than "": with no search term AniList ranks the
                # whole genre by popularity, which is what browsing a genre with
                # an empty box should give you.
                "search": query.strip() or None,
                "type": type.upper(),
                "page": page,
                "perPage": per_page,
                # Null rather than an empty list: AniList reads `genre_in: []` as
                # "in none of these" and answers with nothing at all.
                "genres": genres or None,
                # SEARCH_MATCH only means anything when there is a term to match.
                "sort": ["SEARCH_MATCH"] if query.strip() else ["POPULARITY_DESC"],
            },
        )
        nodes = ((data.get("Page") or {}).get("media")) or []
        return [self._to_record(n) for n in nodes]

    async def trending(self, type: str, limit: int = 12) -> list[MediaRecord]:
        data = await self._post(TRENDING_QUERY, {"type": type.upper(), "perPage": limit})
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
