from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.deps import CurrentUser, DbSession
from app.models import JournalEntry, ListEntry, MediaCache
from app.schemas import JournalOut, JournalPatch, JournalWrite, MediaOut

router = APIRouter(tags=["journal"])

TIMELINE_LIMIT = 200


async def _own_entry(db, user_id: int, entry_id: int) -> ListEntry:
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


def _as_out(row: JournalEntry, media: MediaCache | None = None) -> JournalOut:
    out = JournalOut.model_validate(row)
    out.media = MediaOut.model_validate(media) if media is not None else None
    return out


@router.get("/entries/{entry_id}/journal", response_model=list[JournalOut])
async def for_entry(entry_id: int, user: CurrentUser, db: DbSession) -> list[JournalOut]:
    """
    Everything written about one title, oldest episode first.

    Ownership is checked on the entry, not on the journal rows: a journal belongs
    to the list entry it hangs off, and if that entry is not yours there is nothing
    here to see.
    """
    await _own_entry(db, user.id, entry_id)
    rows = list(
        (
            await db.execute(
                select(JournalEntry)
                .where(JournalEntry.list_entry_id == entry_id, JournalEntry.user_id == user.id)
                .order_by(JournalEntry.rewatch_index, JournalEntry.unit)
            )
        )
        .scalars()
        .all()
    )
    return [_as_out(row) for row in rows]


@router.put("/entries/{entry_id}/journal", response_model=JournalOut)
async def write(
    entry_id: int, payload: JournalWrite, user: CurrentUser, db: DbSession
) -> JournalOut:
    """
    Write, or rewrite, the note for one episode of the pass you are currently on.

    A PUT because there is one note per episode per pass: coming back to episode 7
    during the same watch edits what you wrote, while watching the whole thing
    again starts a fresh row beside it. The pass comes from the entry's own
    `rewatch_count` rather than from the client, so it cannot be spoofed into
    overwriting an older memory.
    """
    entry = await _own_entry(db, user.id, entry_id)
    pass_index = entry.rewatch_count or 0

    row = (
        await db.execute(
            select(JournalEntry).where(
                JournalEntry.list_entry_id == entry_id,
                JournalEntry.unit == payload.unit,
                JournalEntry.rewatch_index == pass_index,
            )
        )
    ).scalar_one_or_none()

    note = (payload.note or "").strip() or None
    if row is None:
        row = JournalEntry(
            user_id=user.id,
            list_entry_id=entry_id,
            unit=payload.unit,
            rewatch_index=pass_index,
            note=note,
            mood=payload.mood,
            is_favorite=payload.is_favorite,
            has_spoilers=payload.has_spoilers,
        )
        db.add(row)
    else:
        row.note = note
        row.mood = payload.mood
        row.is_favorite = payload.is_favorite
        row.has_spoilers = payload.has_spoilers

    await db.commit()
    await db.refresh(row)
    return _as_out(row)


@router.patch("/journal/{journal_id}", response_model=JournalOut)
async def amend(
    journal_id: int, payload: JournalPatch, user: CurrentUser, db: DbSession
) -> JournalOut:
    """Change one field of an existing entry — flipping a favourite, mostly."""
    row = (
        await db.execute(
            select(JournalEntry).where(
                JournalEntry.id == journal_id, JournalEntry.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Journal entry not found")

    data = payload.model_dump(exclude_unset=True)
    if "note" in data:
        row.note = (data["note"] or "").strip() or None
    if "mood" in data:
        row.mood = data["mood"]
    if "is_favorite" in data and data["is_favorite"] is not None:
        row.is_favorite = data["is_favorite"]
    if "has_spoilers" in data and data["has_spoilers"] is not None:
        row.has_spoilers = data["has_spoilers"]
    await db.commit()
    await db.refresh(row)
    return _as_out(row)


@router.delete("/journal/{journal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove(journal_id: int, user: CurrentUser, db: DbSession) -> None:
    row = (
        await db.execute(
            select(JournalEntry).where(
                JournalEntry.id == journal_id, JournalEntry.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Journal entry not found")
    await db.delete(row)
    await db.commit()


@router.get("/journal", response_model=list[JournalOut])
async def timeline(
    user: CurrentUser,
    db: DbSession,
    favorites_only: bool = Query(default=False),
    limit: int = Query(default=60, ge=1, le=TIMELINE_LIMIT),
) -> list[JournalOut]:
    """
    Your own journal, newest first — the thing this feature exists to be reread.

    Each row carries the title it belongs to so the timeline reads as sentences
    rather than as ids, resolved in one query rather than one per row.
    """
    stmt = (
        select(JournalEntry, MediaCache)
        .join(ListEntry, ListEntry.id == JournalEntry.list_entry_id)
        .join(MediaCache, MediaCache.id == ListEntry.media_cache_id)
        .where(JournalEntry.user_id == user.id)
        .order_by(JournalEntry.created_at.desc(), JournalEntry.id.desc())
        .limit(limit)
    )
    if favorites_only:
        stmt = stmt.where(JournalEntry.is_favorite.is_(True))
    rows = (await db.execute(stmt)).all()
    return [_as_out(row, media) for row, media in rows]
