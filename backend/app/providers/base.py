from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date


class ProviderError(Exception):
    """Provider failed in a way that should trigger fallback to the next provider."""


class RateLimited(ProviderError):
    def __init__(self, retry_after: float | None = None):
        super().__init__("rate limited")
        self.retry_after = retry_after


class NotFound(ProviderError):
    """Provider answered successfully but has no such record. Not a fallback trigger."""


@dataclass(slots=True)
class Covers:
    large: str | None = None
    medium: str | None = None
    banner: str | None = None
    color: str | None = None


@dataclass(slots=True, frozen=True)
class Related:
    """
    One neighbour of a title, as the provider describes it.

    Kept as the provider's own vocabulary rather than resolved here: deciding that a
    MOVIE hanging off season 1 belongs in the same series is `season_chain`'s call,
    and it needs the raw relation type and format to make it.
    """

    provider_id: str
    #: PREQUEL | SEQUEL | SIDE_STORY | SPECIAL | ALTERNATIVE | PARENT | ...
    relation: str
    #: TV | TV_SHORT | ONA | OVA | MOVIE | SPECIAL | ...
    format: str | None = None

    #: Relations that put a title on the same series page. `ADAPTATION` is the source
    #: manga, `CHARACTER` and `OTHER` are a shared cast or a coincidence — none of
    #: them is this series. `PREQUEL`/`SEQUEL` are absent on purpose: a sequel is
    #: either a numbered season, which the spine already has, or it is not a season
    #: at all, in which case its own format decides.
    SERIES_RELATIONS = frozenset({"SIDE_STORY", "SPECIAL", "ALTERNATIVE", "PARENT", "SUMMARY"})
    #: Formats that are an extra rather than a season. TV and ONA are the spine.
    EXTRA_FORMATS = frozenset({"MOVIE", "OVA", "SPECIAL", "TV_SHORT", "MUSIC"})
    #: Formats that can carry a season number, and so can head a series.
    SPINE_FORMATS = frozenset({"TV", "TV_SHORT", "ONA"})

    @property
    def is_series_extra(self) -> bool:
        """A movie, OVA or special that belongs to this series without numbering it."""
        return self.relation in self.SERIES_RELATIONS and self.format in self.EXTRA_FORMATS

    @property
    def is_series_parent(self) -> bool:
        """
        A series this title hangs off — the other direction of `is_series_extra`.

        Needed because a movie can be added to a list before anything else in its
        series has been cached. Without a link upward it would resolve into a series
        of one and stay there, since the parent it belongs to has never been seen.
        """
        return self.relation in self.SERIES_RELATIONS and self.format in self.SPINE_FORMATS


@dataclass(slots=True)
class MediaRecord:
    """Provider-neutral media metadata. One shape for every adapter."""

    provider: str
    provider_id: str
    type: str  # "anime" | "manga"
    title_romaji: str | None = None
    title_english: str | None = None
    title_native: str | None = None
    synonyms: list[str] = field(default_factory=list)
    mal_id: int | None = None
    covers: Covers = field(default_factory=Covers)
    synopsis: str | None = None
    total_units: int | None = None
    format: str | None = None
    status: str | None = None
    season_year: int | None = None
    season: str | None = None  # WINTER | SPRING | SUMMER | FALL
    # First air/publication date, when the provider knows it. `season_year` is too
    # coarse to order a series by: a season and the movie that follows it six months
    # later share a year, and release order is how a series reads.
    start_date: date | None = None
    # Direct neighbours in the season chain, as provider ids. Only the immediate
    # links are stored; the full chain is walked from these.
    prequel_id: str | None = None
    sequel_id: str | None = None
    # Every other neighbour: the movies, OVAs and specials that belong to the same
    # series without being a numbered season of it.
    related: list[Related] = field(default_factory=list)
    genres: list[str] = field(default_factory=list)
    average_score: int | None = None
    duration: int | None = None

    @property
    def display_title(self) -> str:
        return self.title_romaji or self.title_english or self.title_native or "Untitled"


class MediaProvider(ABC):
    """Every external metadata source implements this and nothing else talks to the network."""

    name: str

    @abstractmethod
    async def search(
        self, query: str, type: str, page: int = 1, per_page: int = 20
    ) -> list[MediaRecord]: ...

    @abstractmethod
    async def get_by_id(self, provider_id: str, type: str) -> MediaRecord: ...

    @abstractmethod
    async def get_covers(self, provider_id: str, type: str) -> Covers: ...

    async def get_by_mal_id(self, mal_id: int, type: str) -> MediaRecord:
        """Used by the MAL XML importer. Providers that cannot map MAL ids raise NotFound."""
        raise NotFound(f"{self.name} cannot resolve MAL ids")

    async def aclose(self) -> None: ...
