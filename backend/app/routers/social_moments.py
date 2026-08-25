from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import selectinload

from app.deps import CurrentUser, DbSession
from app.models import (
    EntryReaction,
    EntryStatus,
    Friendship,
    FriendshipState,
    ListEntry,
    MediaCache,
    Reaction,
    Shelf,
    ShelfItem,
    User,
)
from app.schemas import (
    FriendOnTitle,
    PublicUser,
    ReactionIn,
    ReactionOut,
    ReactionSummary,
    ShelfOut,
    TitleFriends,
)

router = APIRouter(tags=["social-moments"])


async def _friend_ids(db, user_id: int) -> set[int]:
    rows = (
        await db.execute(
            select(Friendship.requester_id, Friendship.addressee_id).where(
                Friendship.state == FriendshipState.accepted,
                or_(Friendship.requester_id == user_id, Friendship.addressee_id == user_id),
            )
        )
    ).all()
    return {requester if requester != user_id else addressee for requester, addressee in rows}


@router.get("/media/{provider}/{provider_id}/friends", response_model=TitleFriends)
async def friends_on_title(
    provider: str, provider_id: str, user: CurrentUser, db: DbSession
) -> TitleFriends:
    """
    Which friends have this title, where they are with it, and what they gave it.

    The comparison the title page draws, answered in one request. It reports only
    status, progress and score -- never notes, which are private working text and
    the one field on an entry that can spoil something.

    A friend who does not track it simply is not in the list: "nobody you know has
    seen this" is a real answer and does not need a row saying so.
    """
    friends = await _friend_ids(db, user.id)

    mine = (
        await db.execute(
            select(ListEntry.score)
            .join(MediaCache)
            .where(
                ListEntry.user_id == user.id,
                MediaCache.provider == provider,
                MediaCache.provider_id == provider_id,
            )
        )
    ).scalar_one_or_none()

    if not friends:
        return TitleFriends(friends=[], my_score=mine)

    rows = (
        await db.execute(
            select(ListEntry, User)
            .join(User, User.id == ListEntry.user_id)
            .join(MediaCache, MediaCache.id == ListEntry.media_cache_id)
            .where(
                ListEntry.user_id.in_(friends),
                MediaCache.provider == provider,
                MediaCache.provider_id == provider_id,
            )
            .order_by(ListEntry.score.desc().nullslast(), User.username)
        )
    ).all()

    return TitleFriends(
        friends=[
            FriendOnTitle(
                user=PublicUser.model_validate(owner),
                status=entry.status,
                score=entry.score,
                progress=entry.progress,
            )
            for entry, owner in rows
        ],
        my_score=mine,
    )


async def _reactable_entry(db, user_id: int, entry_id: int) -> ListEntry:
    """
    An entry you may react to: a *current friend's*, and one they have finished.

    Reacting to something half-watched would be reacting to a progress number rather
    than to an event, and reacting to a stranger's entry is not a thing this app
    offers at all.
    """
    entry = (
        await db.execute(
            select(ListEntry).options(selectinload(ListEntry.media)).where(ListEntry.id == entry_id)
        )
    ).scalar_one_or_none()
    friends = await _friend_ids(db, user_id)
    if entry is None or entry.user_id not in friends:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Entry not found")
    if entry.status != EntryStatus.completed:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "You can only react to something a friend has finished"
        )
    return entry


async def _summary(db, entry_id: int, viewer_id: int) -> ReactionSummary:
    rows = list(
        (
            await db.execute(
                select(EntryReaction)
                .options(selectinload(EntryReaction.user))
                .where(EntryReaction.entry_id == entry_id)
                .order_by(EntryReaction.created_at)
            )
        )
        .scalars()
        .all()
    )
    return ReactionSummary(
        entry_id=entry_id,
        reactions=[
            ReactionOut(
                user=PublicUser.model_validate(row.user), kind=row.kind, created_at=row.created_at
            )
            for row in rows
        ],
        mine=next((row.kind for row in rows if row.user_id == viewer_id), None),
    )


@router.get("/entries/{entry_id}/reactions", response_model=ReactionSummary)
async def read_reactions(entry_id: int, user: CurrentUser, db: DbSession) -> ReactionSummary:
    """Reactions on a friend's completion, or on your own entry."""
    entry = (
        await db.execute(select(ListEntry).where(ListEntry.id == entry_id))
    ).scalar_one_or_none()
    friends = await _friend_ids(db, user.id)
    if entry is None or (entry.user_id != user.id and entry.user_id not in friends):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Entry not found")
    return await _summary(db, entry_id, user.id)


@router.put("/entries/{entry_id}/reactions", response_model=ReactionSummary)
async def react(
    entry_id: int, payload: ReactionIn, user: CurrentUser, db: DbSession
) -> ReactionSummary:
    """
    Leave, or change, your one reaction.

    A PUT rather than a POST because a person has at most one reaction per entry:
    picking a second replaces the first instead of stacking, which is what keeps
    this an acknowledgement rather than a score.
    """
    await _reactable_entry(db, user.id, entry_id)

    existing = (
        await db.execute(
            select(EntryReaction).where(
                EntryReaction.entry_id == entry_id, EntryReaction.user_id == user.id
            )
        )
    ).scalar_one_or_none()

    if existing is None:
        db.add(EntryReaction(entry_id=entry_id, user_id=user.id, kind=Reaction(payload.kind)))
    else:
        existing.kind = Reaction(payload.kind)
    await db.commit()
    return await _summary(db, entry_id, user.id)


@router.delete("/entries/{entry_id}/reactions", response_model=ReactionSummary)
async def unreact(entry_id: int, user: CurrentUser, db: DbSession) -> ReactionSummary:
    await _reactable_entry(db, user.id, entry_id)
    await db.execute(
        delete(EntryReaction).where(
            EntryReaction.entry_id == entry_id, EntryReaction.user_id == user.id
        )
    )
    await db.commit()
    return await _summary(db, entry_id, user.id)


@router.get("/users/{username}/shelves", response_model=list[ShelfOut])
async def public_shelves(username: str, user: CurrentUser, db: DbSession) -> list[ShelfOut]:
    """
    The shelves someone has chosen to show, and only those.

    Two gates, both required: the shelf must be flagged shared *and* the viewer must
    be allowed to see that person's list at all. Sharing a shelf is not a way to
    publish it wider than the profile it sits on.
    """
    owner = (await db.execute(select(User).where(User.username == username))).scalar_one_or_none()
    if owner is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such user")

    if owner.id != user.id:
        friends = await _friend_ids(db, user.id)
        if owner.id not in friends and not owner.profile_public:
            # Same shape as a missing user: whether a private profile exists is not
            # something a stranger gets to learn from this endpoint.
            raise HTTPException(status.HTTP_404_NOT_FOUND, "No such user")

    shelves = list(
        (
            await db.execute(
                select(Shelf)
                .where(Shelf.user_id == owner.id, Shelf.is_shared.is_(True))
                .order_by(Shelf.position, Shelf.created_at)
            )
        )
        .scalars()
        .all()
    )
    if not shelves:
        return []

    counts = (
        await db.execute(
            select(ShelfItem.shelf_id, ShelfItem.list_entry_id).where(
                ShelfItem.shelf_id.in_([s.id for s in shelves])
            )
        )
    ).all()
    per_shelf: dict[int, list[int]] = {}
    for shelf_id, entry_id in counts:
        per_shelf.setdefault(shelf_id, []).append(entry_id)

    return [
        ShelfOut(
            id=shelf.id,
            name=shelf.name,
            description=shelf.description,
            position=shelf.position,
            is_shared=shelf.is_shared,
            items=None,
            entry_ids=per_shelf.get(shelf.id, []),
            item_count=len(per_shelf.get(shelf.id, [])),
            created_at=shelf.created_at,
            updated_at=shelf.updated_at,
        )
        for shelf in shelves
    ]
