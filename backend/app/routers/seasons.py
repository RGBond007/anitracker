"""
A series as a whole: every season, the viewer's progress on each, and which one
they are currently on.

The season chain itself is resolved elsewhere (`season_chain`); this only reads it
and layers the per-user pieces on top.
"""

import re

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app import media_service, season_chain
from app.deps import CurrentUser, DbSession, Registry
from app.models import FranchiseSelection, ListEntry, MediaCache, MediaType
from app.providers.base import ProviderError
from app.schemas import (
    EntryOut,
    MediaOut,
    SeasonOut,
    SeasonSelectIn,
    SeasonSelectionOut,
    SeriesOut,
)

router = APIRouter(tags=["seasons"])

#: "Frieren: Beyond Journey's End Season 2" -> "Frieren: Beyond Journey's End".
_SEASON_SUFFIX = re.compile(
    r"\s*(?::|-)?\s*(?:season\s*\d+|\d+(?:st|nd|rd|th)\s*season|part\s*\d+)\s*$",
    re.IGNORECASE,
)


def series_title(row: MediaCache) -> str:
    raw = row.title_english or row.title_romaji or row.title_native or "Untitled"
    trimmed = raw
    # A title can carry both, e.g. "... Season 2 Part 2".
    for _ in range(2):
        trimmed = _SEASON_SUFFIX.sub("", trimmed).strip(" -:·")
    return trimmed or raw


async def _chain_rows(db: DbSession, provider: str, root_provider_id: str) -> list[MediaCache]:
    """
    Every cached season of one chain, in order.

    `root_provider_id` is only unique within a provider, so both halves of the
    identity are matched. Ordering is by season number with the row's own id as the
    tie-break, so a chain whose numbering is somehow incomplete still comes back in
    a stable order rather than a different one per request.
    """
    rows = (
        (
            await db.execute(
                select(MediaCache)
                .where(
                    MediaCache.provider == provider,
                    MediaCache.root_provider_id == root_provider_id,
                )
                .order_by(MediaCache.season_number, MediaCache.id)
            )
        )
        .scalars()
        .all()
    )
    return list(rows)


async def _build_series(db: DbSession, user_id: int, media: MediaCache) -> SeriesOut:
    """Assemble the response for the chain `media` belongs to."""
    root = media.root_provider_id or media.provider_id
    rows = await _chain_rows(db, media.provider, root) or [media]

    entries = {
        e.media_cache_id: e
        for e in (
            await db.execute(
                select(ListEntry)
                .options(selectinload(ListEntry.media))
                .where(
                    ListEntry.user_id == user_id,
                    ListEntry.media_cache_id.in_([r.id for r in rows]),
                )
            )
        )
        .scalars()
        .all()
    }

    seasons = [
        SeasonOut(
            media=MediaOut.model_validate(row),
            # A resolved chain always numbers from 1; the fallback only fires for a
            # title whose chain has never been walked, which is a series of one.
            season_number=row.season_number or index,
            entry=EntryOut.model_validate(entries[row.id]) if row.id in entries else None,
        )
        for index, row in enumerate(rows, start=1)
    ]

    picked = (
        await db.execute(
            select(FranchiseSelection)
            .options(selectinload(FranchiseSelection.media))
            .where(
                FranchiseSelection.user_id == user_id,
                FranchiseSelection.root_provider_id == root,
            )
        )
    ).scalar_one_or_none()

    # An explicit pick wins, but only while it still names a season of this chain —
    # a stale pick must not select nothing at all. Otherwise fall back to what the
    # user is watching, and failing that the season they have got furthest through.
    known = {s.media.provider_id for s in seasons}
    picked_id = picked.media.provider_id if picked is not None else None
    explicit = picked_id is not None and picked_id in known

    if explicit:
        selected = picked_id
    else:
        watching = [s for s in seasons if s.entry and s.entry.status == "current"]
        tracked = [s for s in seasons if s.entry]
        selected = (watching or tracked or seasons)[-1].media.provider_id

    return SeriesOut(
        root_provider_id=root,
        title=series_title(rows[0]),
        seasons=seasons,
        selected_provider_id=selected,
        is_explicit=explicit,
    )


@router.get("/series/selections", response_model=list[SeasonSelectionOut])
async def selections(user: CurrentUser, db: DbSession) -> list[SeasonSelectionOut]:
    """
    Every season the user has explicitly picked, as a flat map.

    The library grids need this to draw the right cover per show, and one small
    request for the whole page beats a series call per card.
    """
    rows = (
        (
            await db.execute(
                select(FranchiseSelection)
                .options(selectinload(FranchiseSelection.media))
                .where(FranchiseSelection.user_id == user.id)
            )
        )
        .scalars()
        .all()
    )
    return [
        SeasonSelectionOut(root_provider_id=row.root_provider_id, provider_id=row.media.provider_id)
        for row in rows
    ]


@router.get("/media/{provider}/{provider_id}/series", response_model=SeriesOut)
async def series(
    provider: str,
    provider_id: str,
    user: CurrentUser,
    db: DbSession,
    registry: Registry,
    type: MediaType = MediaType.anime,
) -> SeriesOut:
    """
    Every season of the series this title belongs to.

    Resolves the chain on demand when it has never been walked, so opening a title
    added before this feature existed still produces a full season list rather than
    a series of one.
    """
    try:
        media = await media_service.get_or_fetch(db, registry, provider, provider_id, type.value)
    except ProviderError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, f"Metadata providers unavailable: {exc}"
        ) from exc

    if media.root_provider_id is None:
        await season_chain.resolve(db, registry, media)
    await db.commit()

    return await _build_series(db, user.id, media)


@router.put("/series/{root_provider_id}/season", response_model=SeriesOut)
async def select_season(
    root_provider_id: str,
    payload: SeasonSelectIn,
    user: CurrentUser,
    db: DbSession,
) -> SeriesOut:
    """Remember the season the user says they are on."""
    target = (
        (
            await db.execute(
                select(MediaCache).where(
                    MediaCache.provider_id == payload.provider_id,
                    # A chain of one has no root stamped on it until it is walked, so a
                    # title may legitimately name itself as its own root.
                    (MediaCache.root_provider_id == root_provider_id)
                    | (MediaCache.provider_id == root_provider_id),
                )
            )
        )
        .scalars()
        .first()
    )
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That season is not part of this series")

    existing = (
        await db.execute(
            select(FranchiseSelection).where(
                FranchiseSelection.user_id == user.id,
                FranchiseSelection.root_provider_id == root_provider_id,
            )
        )
    ).scalar_one_or_none()
    if existing is None:
        db.add(
            FranchiseSelection(
                user_id=user.id, root_provider_id=root_provider_id, media_cache_id=target.id
            )
        )
    else:
        existing.media_cache_id = target.id
    await db.commit()

    return await _build_series(db, user.id, target)
