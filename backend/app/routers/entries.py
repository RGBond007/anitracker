import asyncio
from datetime import date

from fastapi import APIRouter, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app import media_service
from app.deps import CurrentUser, DbSession, Registry
from app.models import EntryStatus, ListEntry, MediaCache, MediaType
from app.providers.base import ProviderError
from app.schemas import EntryCreate, EntryOut, EntryUpdate

router = APIRouter(prefix="/entries", tags=["entries"])


def _auto_dates(entry: ListEntry, previous: EntryStatus | None) -> None:
    """Fill start/finish dates the way a tracker user expects, without overwriting theirs."""
    if entry.status == EntryStatus.current and entry.start_date is None:
        entry.start_date = date.today()
    if entry.status == EntryStatus.completed:
        if entry.start_date is None:
            entry.start_date = date.today()
        if entry.finish_date is None and previous != EntryStatus.completed:
            entry.finish_date = date.today()
        if entry.media is not None and entry.media.total_units:
            entry.progress = max(entry.progress, entry.media.total_units)


async def _load(db, user_id: int, entry_id: int) -> ListEntry:
    entry = (
        await db.execute(
            select(ListEntry)
            .options(selectinload(ListEntry.media))
            .where(ListEntry.id == entry_id, ListEntry.user_id == user_id)
        )
    ).scalar_one_or_none()
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Entry not found")
    return entry


@router.get("", response_model=list[EntryOut])
async def list_entries(
    user: CurrentUser,
    db: DbSession,
    type: MediaType | None = None,
    status_filter: EntryStatus | None = Query(default=None, alias="status"),
    sort: str = Query("updated", pattern="^(updated|title|score|progress)$"),
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
) -> list[ListEntry]:
    stmt = (
        select(ListEntry)
        .options(selectinload(ListEntry.media))
        .join(MediaCache)
        .where(ListEntry.user_id == user.id)
    )
    if type is not None:
        stmt = stmt.where(MediaCache.type == type)
    if status_filter is not None:
        stmt = stmt.where(ListEntry.status == status_filter)

    order = {
        "updated": ListEntry.updated_at.desc(),
        "title": MediaCache.title_romaji.asc(),
        "score": ListEntry.score.desc().nullslast(),
        "progress": ListEntry.progress.desc(),
    }[sort]
    stmt = stmt.order_by(order).limit(limit).offset(offset)
    return list((await db.execute(stmt)).scalars().all())


@router.post("", response_model=EntryOut, status_code=status.HTTP_201_CREATED)
async def create_entry(
    payload: EntryCreate,
    request: Request,
    user: CurrentUser,
    db: DbSession,
    registry: Registry,
) -> ListEntry:
    try:
        media = await media_service.get_or_fetch(
            db, registry, payload.provider, payload.provider_id, payload.type.value
        )
    except ProviderError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Could not fetch media: {exc}") from exc

    existing = (
        await db.execute(
            select(ListEntry).where(
                ListEntry.user_id == user.id, ListEntry.media_cache_id == media.id
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Already on your list")

    entry = ListEntry(
        user_id=user.id,
        media_cache_id=media.id,
        **payload.model_dump(exclude={"provider", "provider_id", "type"}),
    )
    entry.media = media
    _auto_dates(entry, previous=None)
    db.add(entry)
    await db.commit()

    # Numbering the season chain can cost a provider call per unseen season, so it
    # runs after the response instead of making the user wait to add one title.
    _schedule_chain_resolution(request, media.provider, media.provider_id, media.type.value)

    return await _load(db, user.id, entry.id)


def _schedule_chain_resolution(request: Request, provider: str, provider_id: str, type_: str):
    async def run() -> None:
        from app import season_chain
        from app.db import SessionLocal

        async with SessionLocal() as session:
            row = await media_service.get_or_fetch(
                session, request.app.state.registry, provider, provider_id, type_
            )
            await season_chain.resolve(session, request.app.state.registry, row)
            await session.commit()

    task = asyncio.create_task(run())
    request.app.state.background_tasks.add(task)
    task.add_done_callback(request.app.state.background_tasks.discard)


@router.get("/by-media/{provider}/{provider_id}", response_model=EntryOut | None)
async def entry_for_media(
    provider: str, provider_id: str, user: CurrentUser, db: DbSession
) -> ListEntry | None:
    """Lets the detail page know whether this title is already tracked."""
    return (
        await db.execute(
            select(ListEntry)
            .options(selectinload(ListEntry.media))
            .join(MediaCache)
            .where(
                ListEntry.user_id == user.id,
                MediaCache.provider == provider,
                MediaCache.provider_id == provider_id,
            )
        )
    ).scalar_one_or_none()


@router.get("/{entry_id}", response_model=EntryOut)
async def get_entry(entry_id: int, user: CurrentUser, db: DbSession) -> ListEntry:
    return await _load(db, user.id, entry_id)


@router.patch("/{entry_id}", response_model=EntryOut)
async def update_entry(
    entry_id: int, payload: EntryUpdate, user: CurrentUser, db: DbSession
) -> ListEntry:
    entry = await _load(db, user.id, entry_id)
    previous = entry.status
    data = payload.model_dump(exclude_unset=True)

    if "progress" in data and entry.media.total_units:
        data["progress"] = min(data["progress"], entry.media.total_units)
    for key, value in data.items():
        setattr(entry, key, value)

    # Finishing the last episode completes the entry -- the single most-used shortcut.
    if (
        "progress" in data
        and entry.media.total_units
        and entry.progress >= entry.media.total_units
        and entry.status == EntryStatus.current
        and "status" not in data
    ):
        entry.status = EntryStatus.completed

    _auto_dates(entry, previous)
    await db.commit()
    return await _load(db, user.id, entry_id)


@router.post("/{entry_id}/increment", response_model=EntryOut)
async def increment_progress(entry_id: int, user: CurrentUser, db: DbSession) -> ListEntry:
    entry = await _load(db, user.id, entry_id)
    previous = entry.status
    total = entry.media.total_units
    entry.progress = min(entry.progress + 1, total) if total else entry.progress + 1
    if total and entry.progress >= total:
        entry.status = EntryStatus.completed
    elif entry.status in (EntryStatus.planned, EntryStatus.on_hold):
        entry.status = EntryStatus.current
    _auto_dates(entry, previous)
    await db.commit()
    return await _load(db, user.id, entry_id)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(entry_id: int, user: CurrentUser, db: DbSession) -> None:
    entry = await _load(db, user.id, entry_id)
    await db.delete(entry)
    await db.commit()
