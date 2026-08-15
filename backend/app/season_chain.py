"""
Turning a pile of unrelated media rows into ordered season chains.

The provider only ever tells us a title's *immediate* prequel and sequel. That is
enough to walk: from any season, follow `prequel_id` until a title has none — that
is season 1 — then walk `sequel_id` forward numbering as we go. Every row in the
chain is stamped with the same `root_provider_id`, which is what the library groups
on, plus its `season_number`.

Walking costs one provider call per season we have never seen, so the result is
persisted and only recomputed when a link points somewhere we have not cached.
"""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import media_service
from app.models import MediaCache
from app.providers.base import ProviderError
from app.providers.registry import ProviderRegistry

log = logging.getLogger("anitrack.season_chain")

#: A guard against a cycle in the provider's own data — a chain longer than this
#: is a data bug, not a franchise, and must not become an infinite walk.
MAX_SEASONS = 20


async def _cached(db: AsyncSession, provider: str, provider_id: str) -> MediaCache | None:
    return (
        await db.execute(
            select(MediaCache).where(
                MediaCache.provider == provider, MediaCache.provider_id == provider_id
            )
        )
    ).scalar_one_or_none()


async def _refresh_links(
    db: AsyncSession, registry: ProviderRegistry, row: MediaCache
) -> MediaCache:
    """
    Re-fetch a row whose chain links were never recorded.

    Rows cached before this feature existed have NULL links, and the normal TTL
    considers them fresh, so they would never pick the links up. `root_provider_id`
    is the flag: it is NULL only until a chain has been resolved once, and after a
    resolve it is always set — even for a standalone title, which becomes a chain of
    one. So this refetches at most once per title.
    """
    if row.root_provider_id is not None:
        return row
    try:
        record = await registry.get_by_id(row.provider, row.provider_id, row.type.value)
        return await media_service.upsert_record(db, record)
    except Exception as exc:  # noqa: BLE001 — a refresh failure just leaves it ungrouped
        log.info("season chain: link refresh failed for %s: %s", row.provider_id, exc)
        return row


async def _load(
    db: AsyncSession, registry: ProviderRegistry, provider: str, provider_id: str, type_: str
) -> MediaCache | None:
    """Cached row, or fetch it once so the walk can continue through it."""
    row = await _cached(db, provider, provider_id)
    if row is not None:
        return row
    try:
        return await media_service.get_or_fetch(db, registry, provider, provider_id, type_)
    except (ProviderError, Exception) as exc:  # noqa: BLE001 — a gap must not break the walk
        log.info("season chain: could not load %s/%s: %s", provider, provider_id, exc)
        return None


async def resolve(db: AsyncSession, registry: ProviderRegistry, media: MediaCache) -> None:
    """
    Number the whole chain `media` belongs to, writing `root_provider_id` and
    `season_number` onto every member.

    Safe to call repeatedly; it is a no-op once the chain is already numbered and
    no new season has appeared. Never raises — a franchise that cannot be resolved
    simply stays ungrouped, which is how the app behaved before this existed.
    """
    try:
        media = await _refresh_links(db, registry, media)

        # --- walk back to season one ---
        first = media
        seen = {first.provider_id}
        for _ in range(MAX_SEASONS):
            if not first.prequel_id or first.prequel_id in seen:
                break
            previous = await _load(db, registry, first.provider, first.prequel_id, first.type.value)
            if previous is None:
                break
            previous = await _refresh_links(db, registry, previous)
            seen.add(previous.provider_id)
            first = previous

        # --- walk forward, numbering ---
        chain: list[MediaCache] = [first]
        cursor = first
        for _ in range(MAX_SEASONS):
            if not cursor.sequel_id or cursor.sequel_id in {m.provider_id for m in chain[1:]}:
                break
            nxt = await _load(db, registry, cursor.provider, cursor.sequel_id, cursor.type.value)
            if nxt is None:
                break
            nxt = await _refresh_links(db, registry, nxt)
            chain.append(nxt)
            cursor = nxt

        for index, row in enumerate(chain, start=1):
            row.root_provider_id = first.provider_id
            row.season_number = index
    except Exception as exc:  # noqa: BLE001
        log.warning("season chain resolution failed for %s: %s", media.provider_id, exc)
