"""
A series as a whole: every season, the viewer's progress on each, and which one
they are currently on.

The season chain itself is resolved elsewhere (`season_chain`); this only reads it
and layers the per-user pieces on top.
"""

import re
from datetime import date

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app import media_service, season_chain
from app.deps import CurrentUser, DbSession, Registry
from app.models import EntryStatus, FranchiseSelection, ListEntry, MediaCache, MediaType
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


#: Sorts last. A season announced without a date belongs after everything dated,
#: which is where an unaired season actually goes.
_UNDATED = date(9999, 1, 1)


def release_key(row: MediaCache) -> tuple[date, int, int]:
    """
    Release order, which is the order a series reads in.

    A real start date wins; a year alone is placed at the start of that year, which
    keeps a 2019 season ahead of a 2020 movie without pretending to know the day.
    The season number and the row id break ties, so two titles sharing a date — a
    season and the special that shipped with it — never swap places between requests.
    """
    when = row.start_date or (date(row.season_year, 1, 1) if row.season_year else _UNDATED)
    return (when, row.season_number or 0, row.id)


async def _chain_rows(db: DbSession, provider: str, root_provider_id: str) -> list[MediaCache]:
    """
    Every cached member of one series, in release order.

    `root_provider_id` is only unique within a provider, so both halves of the
    identity are matched. Ordering happens in Python rather than SQL because the key
    falls back through three columns; the set is a handful of rows per series.
    """
    rows = (
        (
            await db.execute(
                select(MediaCache).where(
                    MediaCache.provider == provider,
                    MediaCache.root_provider_id == root_provider_id,
                )
            )
        )
        .scalars()
        .all()
    )
    return sorted(rows, key=release_key)


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

    members = [
        SeasonOut(
            media=MediaOut.model_validate(row),
            # Passed through as resolved. Both are null only on a title whose chain
            # has never been walked, which is a series of one: season 1.
            season_number=row.season_number if row.kind else 1,
            kind=row.kind or season_chain.KIND_SEASON,
            entry=EntryOut.model_validate(entries[row.id]) if row.id in entries else None,
            is_current=False,  # filled in below, once the current season is known
        )
        for row in rows
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

    # An explicit choice wins, but only while it still names a member of this series —
    # a stale row must not leave the series with no current season at all. Otherwise
    # infer: what is being watched, else the furthest the user has got.
    known = {m.media.provider_id for m in members}
    picked_id = picked.media.provider_id if picked is not None else None
    explicit = picked_id is not None and picked_id in known

    if explicit:
        current = picked_id
    else:
        watching = [m for m in members if m.entry and m.entry.status == "current"]
        tracked = [m for m in members if m.entry]
        # Seasons before extras when guessing: "where am I in this show" is answered
        # by a season, not by the OVA that happens to be the newest thing tracked.
        seasons_only = [m for m in members if m.kind == season_chain.KIND_SEASON]
        current = (watching or tracked or seasons_only or members)[-1].media.provider_id

    for member in members:
        member.is_current = member.media.provider_id == current

    # The show is named after season one, not after whatever aired first: a prequel
    # OVA sorts ahead of it in release order and is a terrible name for the series.
    spine_start = next((r for r in rows if r.season_number == 1), rows[0])

    return SeriesOut(
        root_provider_id=root,
        title=series_title(spine_start),
        seasons=members,
        current_provider_id=current,
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

    # A null `kind` on an already-grouped row means it was cached before movies and
    # OVAs were part of a series, so it gets one more walk to pick them up.
    if media.root_provider_id is None or media.kind is None:
        await season_chain.resolve(db, registry, media)
    await db.commit()

    return await _build_series(db, user.id, media)


async def _cached_member(
    db: DbSession, root_provider_id: str, provider_id: str
) -> MediaCache | None:
    return (
        (
            await db.execute(
                select(MediaCache).where(
                    MediaCache.provider_id == provider_id,
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


async def _member(
    db: DbSession, registry: Registry, root_provider_id: str, provider_id: str
) -> MediaCache | None:
    """
    A member of this series, fetching it if this instance has never seen it.

    "Start season 4" is offered from the library the moment season 3 is finished, and
    at that point season 4 is often nothing but an id on season 3's `sequel_id` — no
    row, no title, no cover. Refusing the action because the row is missing would make
    the offer a lie, so an uncached id is fetched and then checked for membership: the
    walk it triggers is what proves it belongs to this series rather than another.

    Which provider to ask is read off the series itself. The route names the series by
    a provider id without naming the provider, and it does not need to: a client can
    only know a root id because some member of that series is already cached here.
    """
    cached = await _cached_member(db, root_provider_id, provider_id)
    if cached is not None:
        return cached

    known = (
        (
            await db.execute(
                select(MediaCache).where(
                    (MediaCache.root_provider_id == root_provider_id)
                    | (MediaCache.provider_id == root_provider_id)
                )
            )
        )
        .scalars()
        .first()
    )
    if known is None:
        return None

    try:
        fetched = await media_service.get_or_fetch(
            db, registry, known.provider, provider_id, known.type.value
        )
    except Exception:  # noqa: BLE001 — an id the provider will not resolve is a 404
        return None

    await season_chain.resolve(db, registry, fetched)
    await db.commit()
    return await _cached_member(db, root_provider_id, provider_id)


async def _entry_for(db: DbSession, user_id: int, media_cache_id: int) -> ListEntry | None:
    return (
        await db.execute(
            select(ListEntry).where(
                ListEntry.user_id == user_id, ListEntry.media_cache_id == media_cache_id
            )
        )
    ).scalar_one_or_none()


@router.put("/series/{root_provider_id}/season", response_model=SeriesOut)
async def set_current_season(
    root_provider_id: str,
    payload: SeasonSelectIn,
    user: CurrentUser,
    db: DbSession,
    registry: Registry,
) -> SeriesOut:
    """
    Move the user to a season, deliberately.

    Nothing here happens as a side effect of browsing: the client calls this only
    when the user asked for it. `start` and `complete_provider_id` make "you finished
    season 3, start season 4?" a single transaction, so the two halves cannot end up
    disagreeing about where the user is.
    """
    target = await _member(db, registry, root_provider_id, payload.provider_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That season is not part of this series")

    if payload.complete_provider_id is not None:
        finished = await _member(db, registry, root_provider_id, payload.complete_provider_id)
        if finished is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "That season is not part of this series")
        entry = await _entry_for(db, user.id, finished.id)
        if entry is not None:
            entry.status = EntryStatus.completed
            # Finishing the season means finishing its episodes; a "completed" entry
            # sitting at 7/12 is the kind of thing the user then has to go and fix.
            if finished.total_units:
                entry.progress = max(entry.progress, finished.total_units)
            if entry.finish_date is None:
                entry.finish_date = date.today()

    if payload.start:
        entry = await _entry_for(db, user.id, target.id)
        if entry is None:
            entry = ListEntry(
                user_id=user.id,
                media_cache_id=target.id,
                status=EntryStatus.current,
                progress=0,
                start_date=date.today(),
            )
            db.add(entry)
        elif entry.status != EntryStatus.current:
            # Progress is left alone: resuming a dropped season should not rewind it.
            entry.status = EntryStatus.current
            entry.start_date = entry.start_date or date.today()

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
