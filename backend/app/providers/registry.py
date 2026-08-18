import logging

from app.config import settings
from app.providers.anilist import AniListProvider
from app.providers.base import MediaProvider, MediaRecord, NotFound, ProviderError
from app.providers.jikan import JikanProvider
from app.providers.kitsu import KitsuProvider

log = logging.getLogger(__name__)

_BUILDERS = {
    "anilist": AniListProvider,
    "jikan": JikanProvider,
    "kitsu": KitsuProvider,
}


class ProviderRegistry:
    """Tries providers in configured order, falling through on 429/5xx/transport errors.

    A clean ``NotFound`` from the primary still falls through -- a fallback provider
    may simply have the record the primary lacks.
    """

    def __init__(self, providers: list[MediaProvider] | None = None):
        if providers is None:
            providers = [_BUILDERS[name]() for name in settings.providers if name in _BUILDERS]
        if not providers:
            raise RuntimeError("No media providers configured (check PROVIDER_ORDER)")
        self.providers = providers

    @property
    def primary(self) -> MediaProvider:
        return self.providers[0]

    def get(self, name: str) -> MediaProvider | None:
        return next((p for p in self.providers if p.name == name), None)

    async def aclose(self) -> None:
        for p in self.providers:
            await p.aclose()

    async def _attempt(self, method: str, *args, **kwargs):
        errors: list[str] = []
        for provider in self.providers:
            try:
                return await getattr(provider, method)(*args, **kwargs)
            except NotFound as exc:
                errors.append(f"{provider.name}: not found ({exc})")
            except ProviderError as exc:
                log.warning("provider %s failed on %s: %s", provider.name, method, exc)
                errors.append(f"{provider.name}: {exc}")
        raise ProviderError(f"all providers failed for {method}: " + " | ".join(errors))

    async def search(
        self,
        query: str,
        type: str,
        page: int = 1,
        per_page: int = 20,
        genres: list[str] | None = None,
    ) -> list[MediaRecord]:
        return await self._attempt("search", query, type, page, per_page, genres)

    async def get_by_id(self, provider: str, provider_id: str, type: str) -> MediaRecord:
        """Detail lookups are pinned to the provider that produced the id."""
        target = self.get(provider)
        if target is None:
            raise ProviderError(f"unknown provider {provider!r}")
        return await target.get_by_id(provider_id, type)

    async def get_by_mal_id(self, mal_id: int, type: str) -> MediaRecord:
        return await self._attempt("get_by_mal_id", mal_id, type)

    async def trending(self, type: str, limit: int = 12) -> list[MediaRecord]:
        return await self._attempt("trending", type, limit)
