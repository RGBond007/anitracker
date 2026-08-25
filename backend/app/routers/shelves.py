from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import selectinload

from app.deps import CurrentUser, DbSession
from app.models import ListEntry, Shelf, ShelfItem
from app.schemas import (
    ShelfCreate,
    ShelfItemIn,
    ShelfItemOut,
    ShelfOut,
    ShelfReorder,
    ShelfUpdate,
)

router = APIRouter(prefix="/shelves", tags=["shelves"])


async def _load(db, user_id: int, shelf_id: int, *, with_items: bool = False) -> Shelf:
    stmt = select(Shelf).where(Shelf.id == shelf_id, Shelf.user_id == user_id)
    if with_items:
        # Three levels deep on purpose: a shelf is only useful rendered as artwork,
        # and the client would otherwise fetch every entry back one at a time.
        stmt = stmt.options(
            selectinload(Shelf.items).selectinload(ShelfItem.entry).selectinload(ListEntry.media)
        )
    shelf = (await db.execute(stmt)).scalar_one_or_none()
    if shelf is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Shelf not found")
    return shelf


async def _reload(db, user_id: int, shelf: Shelf) -> Shelf:
    """
    Re-read a shelf and its items after writing to it.

    The expire is the point. `expire_on_commit` is off, so after a commit the session
    still holds the `items` collection exactly as it was loaded -- a re-query returns
    the same identity-mapped object and the stale collection with it, which makes a
    removal look like it did not happen. Expiring first forces the relationship to be
    fetched again.
    """
    # The id is read *before* expiring: expiring blanks every attribute, so reading
    # `shelf.id` afterwards would itself be a lazy load on an async session.
    shelf_id = shelf.id
    db.expire(shelf)
    return await _load(db, user_id, shelf_id, with_items=True)


async def _membership(db, shelf_ids: list[int]) -> dict[int, list[int]]:
    """Entry ids per shelf, in shelf order. One query for the whole index."""
    if not shelf_ids:
        return {}
    rows = (
        await db.execute(
            select(ShelfItem.shelf_id, ShelfItem.list_entry_id)
            .where(ShelfItem.shelf_id.in_(shelf_ids))
            .order_by(ShelfItem.shelf_id, ShelfItem.position)
        )
    ).all()
    out: dict[int, list[int]] = {}
    for shelf_id, entry_id in rows:
        out.setdefault(shelf_id, []).append(entry_id)
    return out


async def _owned_entry(db, user_id: int, entry_id: int) -> ListEntry:
    """A shelf may only hold entries its owner tracks -- checked, never assumed."""
    entry = (
        await db.execute(
            select(ListEntry).where(ListEntry.id == entry_id, ListEntry.user_id == user_id)
        )
    ).scalar_one_or_none()
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Entry not found")
    return entry


def _at(item: "ShelfItem") -> int:
    return item.position


def _as_out(shelf: Shelf, entry_ids: list[int], *, with_items: bool) -> ShelfOut:
    """
    Built field by field rather than by `model_validate`, because validating the ORM
    object reads *every* mapped attribute -- including `items`, which the index
    deliberately does not load. On an async session that lazy load raises
    MissingGreenlet instead of quietly issuing a query, so the shape of the response
    has to be decided here and not by nulling a field after the fact.
    """
    return ShelfOut(
        id=shelf.id,
        name=shelf.name,
        description=shelf.description,
        position=shelf.position,
        is_shared=shelf.is_shared,
        # Sorted here rather than trusting the relationship's `order_by`: after a
        # reorder commits, the session still holds the collection it loaded before
        # the positions changed, and `expire_on_commit` is off. Sorting the values
        # we are about to serialise makes the response independent of that cache.
        items=(
            [ShelfItemOut.model_validate(item) for item in sorted(shelf.items, key=_at)]
            if with_items
            else None
        ),
        entry_ids=entry_ids,
        item_count=len(entry_ids),
        created_at=shelf.created_at,
        updated_at=shelf.updated_at,
    )


@router.get("", response_model=list[ShelfOut])
async def list_shelves(user: CurrentUser, db: DbSession) -> list[ShelfOut]:
    shelves = list(
        (
            await db.execute(
                select(Shelf)
                .where(Shelf.user_id == user.id)
                .order_by(Shelf.position, Shelf.created_at)
            )
        )
        .scalars()
        .all()
    )
    membership = await _membership(db, [s.id for s in shelves])
    return [_as_out(s, membership.get(s.id, []), with_items=False) for s in shelves]


@router.post("", response_model=ShelfOut, status_code=status.HTTP_201_CREATED)
async def create_shelf(payload: ShelfCreate, user: CurrentUser, db: DbSession) -> ShelfOut:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Name cannot be blank")

    clash = (
        await db.execute(select(Shelf.id).where(Shelf.user_id == user.id, Shelf.name == name))
    ).scalar_one_or_none()
    if clash is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "A shelf with that name already exists")

    # New shelves go to the end rather than the front: the order is the user's, and
    # nothing they arranged should move because they made something else.
    last = (
        await db.execute(select(func.max(Shelf.position)).where(Shelf.user_id == user.id))
    ).scalar_one()

    shelf = Shelf(
        user_id=user.id,
        name=name,
        description=(payload.description or "").strip() or None,
        position=(last or 0) + 1 if last is not None else 0,
    )
    db.add(shelf)
    await db.commit()
    await db.refresh(shelf)
    return _as_out(shelf, [], with_items=False)


@router.get("/{shelf_id}", response_model=ShelfOut)
async def get_shelf(shelf_id: int, user: CurrentUser, db: DbSession) -> ShelfOut:
    shelf = await _load(db, user.id, shelf_id, with_items=True)
    return _as_out(shelf, [i.list_entry_id for i in sorted(shelf.items, key=_at)], with_items=True)


@router.patch("/{shelf_id}", response_model=ShelfOut)
async def update_shelf(
    shelf_id: int, payload: ShelfUpdate, user: CurrentUser, db: DbSession
) -> ShelfOut:
    shelf = await _load(db, user.id, shelf_id)
    data = payload.model_dump(exclude_unset=True)

    if "name" in data:
        name = (data["name"] or "").strip()
        if not name:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Name cannot be blank")
        clash = (
            await db.execute(
                select(Shelf.id).where(
                    Shelf.user_id == user.id, Shelf.name == name, Shelf.id != shelf.id
                )
            )
        ).scalar_one_or_none()
        if clash is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "A shelf with that name already exists")
        shelf.name = name

    if "description" in data:
        shelf.description = (data["description"] or "").strip() or None
    if "position" in data and data["position"] is not None:
        shelf.position = data["position"]
    if "is_shared" in data and data["is_shared"] is not None:
        # The only way this flag ever changes: an explicit request from the owner.
        # Nothing infers it, and no other endpoint writes it.
        shelf.is_shared = bool(data["is_shared"])

    await db.commit()
    membership = await _membership(db, [shelf.id])
    await db.refresh(shelf)
    return _as_out(shelf, membership.get(shelf.id, []), with_items=False)


@router.delete("/{shelf_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shelf(shelf_id: int, user: CurrentUser, db: DbSession) -> None:
    shelf = await _load(db, user.id, shelf_id)
    await db.delete(shelf)
    await db.commit()


@router.post("/{shelf_id}/items", response_model=ShelfOut)
async def add_item(
    shelf_id: int, payload: ShelfItemIn, user: CurrentUser, db: DbSession
) -> ShelfOut:
    shelf = await _load(db, user.id, shelf_id)
    await _owned_entry(db, user.id, payload.entry_id)

    existing = (
        await db.execute(
            select(ShelfItem.id).where(
                ShelfItem.shelf_id == shelf.id, ShelfItem.list_entry_id == payload.entry_id
            )
        )
    ).scalar_one_or_none()
    # Adding something already on the shelf is a no-op, not an error: the button that
    # calls this is a toggle, and a double tap should not raise.
    if existing is None:
        last = (
            await db.execute(
                select(func.max(ShelfItem.position)).where(ShelfItem.shelf_id == shelf.id)
            )
        ).scalar_one()
        db.add(
            ShelfItem(
                shelf_id=shelf.id,
                list_entry_id=payload.entry_id,
                position=(last or 0) + 1 if last is not None else 0,
            )
        )
        await db.commit()

    shelf = await _reload(db, user.id, shelf)
    return _as_out(shelf, [i.list_entry_id for i in sorted(shelf.items, key=_at)], with_items=True)


@router.delete("/{shelf_id}/items/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_item(shelf_id: int, entry_id: int, user: CurrentUser, db: DbSession) -> None:
    shelf = await _load(db, user.id, shelf_id)
    await db.execute(
        delete(ShelfItem).where(ShelfItem.shelf_id == shelf.id, ShelfItem.list_entry_id == entry_id)
    )
    await db.commit()


@router.put("/{shelf_id}/order", response_model=ShelfOut)
async def reorder(
    shelf_id: int, payload: ShelfReorder, user: CurrentUser, db: DbSession
) -> ShelfOut:
    """
    Rewrite the shelf's running order from a full list of entry ids.

    The whole order is sent rather than a move instruction because a drag produces
    one, and because two clients reordering at once should end with one of the two
    orders rather than an interleaving of both. Ids the shelf does not hold are
    ignored; ids it holds that are missing from the payload are dropped, which is
    what makes this also the "remove several" call.
    """
    shelf = await _load(db, user.id, shelf_id, with_items=True)
    by_entry = {item.list_entry_id: item for item in shelf.items}

    wanted = [entry_id for entry_id in dict.fromkeys(payload.entry_ids) if entry_id in by_entry]
    for position, entry_id in enumerate(wanted):
        by_entry[entry_id].position = position

    for entry_id, item in by_entry.items():
        if entry_id not in set(wanted):
            await db.delete(item)

    await db.commit()
    shelf = await _reload(db, user.id, shelf)
    return _as_out(shelf, [i.list_entry_id for i in sorted(shelf.items, key=_at)], with_items=True)
