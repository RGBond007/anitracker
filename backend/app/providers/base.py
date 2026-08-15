from abc import ABC, abstractmethod
from dataclasses import dataclass, field


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
    # Direct neighbours in the season chain, as provider ids. Only the immediate
    # links are stored; the full chain is walked from these.
    prequel_id: str | None = None
    sequel_id: str | None = None
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
