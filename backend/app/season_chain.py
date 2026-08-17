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

#: Extras are unbounded in the provider's data (Gintama has dozens of specials) and
#: each unseen one costs a call, so a series page takes the first of them and stops.
MAX_EXTRAS = 12

KIND_SEASON = "season"
KIND_OTHER = "other"

_KIND_BY_FORMAT = {
    "MOVIE": "movie",
    "OVA": "ova",
    "ONA": KIND_SEASON,
    "SPECIAL": "special",
    "TV": KIND_SEASON,
    "TV_SHORT": "special",
    "MUSIC": "special",
}


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
    considers them fresh, so they would never pick the links up. Two flags say a row
    predates what it needs, and both are set by the end of a resolve, so each costs
    at most one re-fetch per title:

    - `root_provider_id` is NULL until a chain has been resolved once, and is set
      afterwards even for a standalone title, which becomes a chain of one.
    - `kind` is NULL on a row grouped before extras existed, whose `related_ids` are
      therefore unknown rather than genuinely empty. Without this, a library that
      already had its seasons numbered would never discover their movies and OVAs.
    """
    if row.root_provider_id is not None and row.kind is not None:
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


async def resolve(
    db: AsyncSession,
    registry: ProviderRegistry,
    media: MediaCache,
    *,
    _climbing: bool = False,
) -> None:
    """
    Number the whole series `media` belongs to: `root_provider_id` and, along the
    spine, `season_number`, with its movies and OVAs attached unnumbered.

    Safe to call repeatedly; it is a no-op once the chain is already numbered and
    no new season has appeared. Never raises — a franchise that cannot be resolved
    simply stays ungrouped, which is how the app behaved before this existed.

    `_climbing` is set on the one recursive call this makes, into an extra's parent,
    and stops a pathological provider graph (a movie whose parent is a movie) from
    recursing further than one hop.
    """
    try:
        media = await _refresh_links(db, registry, media)

        # A movie or OVA is not the head of anything. Resolving it on its own would
        # number it as a series of one, and it would then be excluded from its real
        # series forever, so climb to the parent first and let that walk adopt it.
        if kind_for(media.format) != KIND_SEASON and media.parent_id and not _climbing:
            parent = await _load(db, registry, media.provider, media.parent_id, media.type.value)
            if parent is not None and parent.provider_id != media.provider_id:
                await resolve(db, registry, parent, _climbing=True)
                if parent.root_provider_id is not None:
                    return

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
            # From the format, not hardcoded: a standalone movie resolves as a chain
            # of one and must still read as a movie rather than as its own season 1.
            # A title the provider gave no format is still a season — it is on the
            # numbered spine, which is what being a season means here.
            row.kind = kind_for(row.format) if row.format else KIND_SEASON

        await _attach_extras(db, registry, chain, root=first.provider_id)
    except Exception as exc:  # noqa: BLE001
        log.warning("season chain resolution failed for %s: %s", media.provider_id, exc)


def kind_for(format_: str | None) -> str:
    """What a title is within its series, from the provider's format."""
    return _KIND_BY_FORMAT.get((format_ or "").upper(), KIND_OTHER)


async def _attach_extras(
    db: AsyncSession, registry: ProviderRegistry, chain: list[MediaCache], root: str
) -> None:
    """
    Pull the movies, OVAs and specials of every season into the same series.

    They are grouped but never numbered: a movie between seasons 2 and 3 is not
    season 2.5, and the series page orders it by release date instead. Each unseen
    one costs a provider call, so the total is capped — a long-running franchise can
    hang dozens of specials off itself, and a series page is not an archive.
    """
    owned = {row.provider_id for row in chain}
    wanted: list[tuple[MediaCache, str]] = []
    for row in chain:
        for provider_id in row.related_ids or []:
            if provider_id in owned:
                continue
            owned.add(provider_id)
            wanted.append((row, provider_id))

    if len(wanted) > MAX_EXTRAS:
        log.info("season chain %s: %d extras, keeping the first %d", root, len(wanted), MAX_EXTRAS)
        wanted = wanted[:MAX_EXTRAS]

    for parent, provider_id in wanted:
        extra = await _load(db, registry, parent.provider, provider_id, parent.type.value)
        if extra is None:
            continue
        # An extra already numbered into a chain of its own is left alone: a spin-off
        # with its own seasons is a series, not this one's bonus feature.
        if extra.root_provider_id is not None and extra.root_provider_id != root:
            continue
        extra.root_provider_id = root
        extra.season_number = None
        extra.kind = kind_for(extra.format)
