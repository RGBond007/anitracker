"""The only thing in the app allowed to reach a provider.

Route handlers call this module; this module decides whether the answer comes from
the DB (``media_cache``), the in-process search cache, or the network.
"""

import re
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache import TTLCache
from app.config import settings
from app.models import MediaCache, MediaType
from app.providers.base import MediaRecord
from app.providers.registry import ProviderRegistry

_search_cache = TTLCache(ttl=settings.search_cache_ttl_seconds, max_size=512)

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
    row.genres = record.genres
    row.average_score = record.average_score
    row.duration = record.duration
    row.last_synced_at = datetime.now(UTC)
    return row


async def upsert_record(db: AsyncSession, record: MediaRecord) -> MediaCache:
    row = (
        await db.execute(
            select(MediaCache).where(
                MediaCache.provider == record.provider,
                MediaCache.provider_id == record.provider_id,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        row = MediaCache(
            provider=record.provider,
            provider_id=record.provider_id,
            type=MediaType(record.type),
        )
        db.add(row)
    _apply(row, record)
    await db.flush()
    return row


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
