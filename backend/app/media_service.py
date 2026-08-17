"""The only thing in the app allowed to reach a provider.

Route handlers call this module; this module decides whether the answer comes from
the DB (``media_cache``), the in-process search cache, or the network.
"""

import asyncio
import logging
import re
import weakref
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache import TTLCache
from app.config import settings
from app.models import MediaCache, MediaType
from app.providers.base import MediaRecord
from app.providers.registry import ProviderRegistry

log = logging.getLogger("anitrack.media")

_search_cache = TTLCache(ttl=settings.search_cache_ttl_seconds, max_size=512)

#: One writer at a time into `media_cache`. See `upsert_record` for why.
#:
#: Kept per event loop rather than as one module-level lock: an `asyncio.Lock`
#: binds to the loop that first waits on it, and the test suite runs every case in
#: a fresh loop, so a shared one would fail the second time it is contended. The
#: map is weak, so a closed loop's lock is collected with it.
_write_locks: weakref.WeakKeyDictionary[asyncio.AbstractEventLoop, asyncio.Lock] = (
    weakref.WeakKeyDictionary()
)


def _write_lock() -> asyncio.Lock:
    loop = asyncio.get_running_loop()
    lock = _write_locks.get(loop)
    if lock is None:
        lock = _write_locks[loop] = asyncio.Lock()
    return lock


_HTML_TAG = re.compile(r"<[^>]+>")
_BR = re.compile(r"<br\s*/?>", re.I)


def clean_synopsis(text: str | None) -> str | None:
    if not text:
        return None
    return _HTML_TAG.sub("", _BR.sub("\n", text)).strip()


async def search(
    registry: ProviderRegistry, query: str, type: str, page: int = 1, per_page: int = 20
) -> list[MediaRecord]:
    """Search results are cached in-process only -- they are not written to media_cache.

    Per spec: don't persist full detail until a user actually adds or opens an entry.
    """
    key = f"{type}:{page}:{per_page}:{query.strip().lower()}"
    cached = await _search_cache.get(key)
    if cached is not None:
        return cached
    results = await registry.search(query, type, page, per_page)
    await _search_cache.set(key, results)
    return results


def _apply(row: MediaCache, record: MediaRecord) -> MediaCache:
    row.mal_id = record.mal_id or row.mal_id
    row.title_romaji = record.title_romaji
    row.title_english = record.title_english
    row.title_native = record.title_native
    row.synonyms = record.synonyms
    row.cover_url = record.covers.large or record.covers.medium
    row.cover_color = record.covers.color
    row.banner_url = record.covers.banner
    row.synopsis = clean_synopsis(record.synopsis)
    row.total_units = record.total_units
    row.format = record.format
    row.status = record.status
    row.season_year = record.season_year
    row.season = record.season
    row.start_date = record.start_date or row.start_date
    row.prequel_id = record.prequel_id
    row.sequel_id = record.sequel_id
    # Both derived from the same relation list rather than asked of each adapter: a
    # provider reports edges, and which of them mean "same series" is one policy,
    # declared on `Related`. An adapter that forgot to apply it would silently drop
    # its movies out of their series.
    row.parent_id = next((r.provider_id for r in record.related if r.is_series_parent), None)
    row.related_ids = [r.provider_id for r in record.related if r.is_series_extra]
    row.genres = record.genres
    row.average_score = record.average_score
    row.duration = record.duration
    row.last_synced_at = datetime.now(UTC)
    return row


async def _by_provider_id(db: AsyncSession, provider: str, provider_id: str) -> MediaCache | None:
    return (
        await db.execute(
            select(MediaCache).where(
                MediaCache.provider == provider, MediaCache.provider_id == provider_id
            )
        )
    ).scalar_one_or_none()


async def upsert_record(db: AsyncSession, record: MediaRecord) -> MediaCache:
    """
    Cache one provider record, tolerating a concurrent writer of the same title.

    Caching a title is a look-then-insert, and two of them genuinely do overlap:
    resolving a season chain caches a row per season in a background session while
    the request that triggered it is still caching titles of its own, so both reach
    the same `(provider, provider_id)` and the second INSERT violates the unique
    constraint. `_write_lock()` closes the window inside this process — the whole
    critical section is local statements, no provider call — and the IntegrityError
    branch covers what a lock cannot: a second worker process or replica.

    Losing the race is not an error; the winner stored the same metadata. The loser
    adopts that row and applies its own copy of the record over it.
    """
    async with _write_lock():
        row = await _by_provider_id(db, record.provider, record.provider_id)
        if row is not None:
            _apply(row, record)
            await db.flush()
            return row

        fresh = _apply(
            MediaCache(
                provider=record.provider,
                provider_id=record.provider_id,
                type=MediaType(record.type),
            ),
            record,
        )
        try:
            # A savepoint, so a lost race rolls back the failed INSERT alone and
            # leaves the caller's transaction — an entry being created, a chain
            # being numbered — intact.
            async with db.begin_nested():
                db.add(fresh)
                await db.flush()
            return fresh
        except IntegrityError:
            if fresh in db:
                db.expunge(fresh)
            winner = await _by_provider_id(db, record.provider, record.provider_id)
            if winner is None:
                raise  # not the conflict we know how to recover from
            log.debug("media cache: adopted a concurrent row for %s", record.provider_id)
            _apply(winner, record)
            await db.flush()
            return winner


def is_stale(row: MediaCache) -> bool:
    synced = row.last_synced_at
    if synced is None:
        return True
    if synced.tzinfo is None:
        synced = synced.replace(tzinfo=UTC)
    return datetime.now(UTC) - synced > timedelta(days=settings.media_cache_ttl_days)


async def get_or_fetch(
    db: AsyncSession,
    registry: ProviderRegistry,
    provider: str,
    provider_id: str,
    type: str,
    *,
    force: bool = False,
) -> MediaCache:
    """Return a cached row, refreshing from the provider if missing or older than the TTL."""
    row = (
        await db.execute(
            select(MediaCache).where(
                MediaCache.provider == provider, MediaCache.provider_id == provider_id
            )
        )
    ).scalar_one_or_none()

    if row is not None and not force and not is_stale(row):
        return row

    try:
        record = await registry.get_by_id(provider, provider_id, type)
    except Exception:
        if row is not None:
            return row  # serve stale rather than fail -- provider outages stay invisible
        raise
    return await upsert_record(db, record)


async def resolve_mal_id(
    db: AsyncSession, registry: ProviderRegistry, mal_id: int, type: str
) -> MediaCache:
    """Used by the MAL XML importer: MAL id -> cached row, via whichever provider answers."""
    row = (
        (
            await db.execute(
                select(MediaCache).where(
                    MediaCache.mal_id == mal_id, MediaCache.type == MediaType(type)
                )
            )
        )
        .scalars()
        .first()
    )
    if row is not None and not is_stale(row):
        return row
    record = await registry.get_by_mal_id(mal_id, type)
    return await upsert_record(db, record)
