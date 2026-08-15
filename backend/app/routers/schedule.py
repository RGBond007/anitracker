"""
What is airing next from the titles you are currently watching.

Only AniList carries airing data, and only for anime, so this is a best-effort
surface: if the provider is unreachable or a title has no schedule, the endpoint
returns what it can rather than failing the dashboard.
"""

import logging
from datetime import UTC, datetime

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.cache import TTLCache
from app.deps import CurrentUser, DbSession, Registry
from app.models import EntryStatus, ListEntry, MediaCache, MediaType
from app.providers.base import ProviderError
from app.schemas import MediaOut

log = logging.getLogger("anitrack.schedule")

router = APIRouter(tags=["schedule"])

#: Broadcast times move rarely; half an hour keeps the dashboard cheap without
#: going stale in a way anyone would notice.
_cache = TTLCache(ttl=1800, max_size=64)

#: A week is what the strip can show; anything further out is not a "schedule".
HORIZON_DAYS = 7


class AiringEpisode(BaseModel):
    media: MediaOut
    episode: int
    airing_at: datetime
    #: Where the user is now, so the strip can flag a gap ("ep 5 airs, you're on 2").
    progress: int


@router.get("/schedule", response_model=list[AiringEpisode])
async def schedule(user: CurrentUser, db: DbSession, registry: Registry) -> list[AiringEpisode]:
    entries = list(
        (
            await db.execute(
                select(ListEntry)
                .options(selectinload(ListEntry.media))
                .join(MediaCache)
                .where(
                    ListEntry.user_id == user.id,
                    ListEntry.status == EntryStatus.current,
                    MediaCache.type == MediaType.anime,
                    MediaCache.provider == "anilist",
                )
            )
        )
        .scalars()
        .all()
    )
    if not entries:
        return []

    by_provider_id = {e.media.provider_id: e for e in entries}
    key = ",".join(sorted(by_provider_id))

    airing = await _cache.get(key)
    if airing is None:
        provider = next((p for p in registry.providers if p.name == "anilist"), None)
        if provider is None or not hasattr(provider, "airing"):
            return []
        try:
            airing = await provider.airing(list(by_provider_id))
        except ProviderError as exc:
            # The dashboard renders without this strip; a provider outage should
            # not take the whole page down with it.
            log.warning("airing lookup failed: %s", exc)
            return []
        await _cache.set(key, airing)

    now = datetime.now(UTC)
    out: list[AiringEpisode] = []
    for provider_id, (episode, airing_at) in airing.items():
        entry = by_provider_id.get(provider_id)
        if entry is None:
            continue
        when = datetime.fromtimestamp(airing_at, UTC)
        if (when - now).days >= HORIZON_DAYS:
            continue
        out.append(
            AiringEpisode(
                media=MediaOut.model_validate(entry.media),
                episode=episode,
                airing_at=when,
                progress=entry.progress,
            )
        )

    out.sort(key=lambda a: a.airing_at)
    return out
