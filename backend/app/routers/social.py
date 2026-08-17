"""
Friends, friend requests, and the read-only views of another user's list.

Two rules run through the whole module:

* A list is private unless the viewer has been let in — by an accepted friendship
  or by the owner flipping `profile_public`. `_visibility` is the single place
  that decides, so no endpoint can accidentally answer more than it should.
* Nothing here returns a `UserOut`. Cross-account responses use `PublicUser`,
  which has no email, role, or session state on it.
"""

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.deps import CurrentUser, DbSession
from app.models import (
    EntryStatus,
    Friendship,
    FriendshipState,
    ListEntry,
    MediaCache,
    MediaType,
    User,
)
from app.ratelimit import limit as rate_limit
from app.routers.dashboard import type_stats
from app.schemas import (
    ComparisonOut,
    ComparisonRow,
    DiscoverUser,
    FeedItem,
    FriendRequestIn,
    FriendshipOut,
    FriendsOut,
    FriendSummary,
    LeaderboardOut,
    LeaderboardRow,
    ProfileOut,
    PublicUser,
    StatusCount,
    TypeStats,
)

router = APIRouter(tags=["social"])

FEED_LIMIT = 40
PROFILE_ENTRY_LIMIT = 500

# Returned in place of real figures when a list is private, so the response shape
# never tells the caller whether a hidden list is large or empty.
_EMPTY_STATS = TypeStats(
    counts=[StatusCount(status=s, count=0) for s in EntryStatus],
    total=0,
    mean_score=None,
    scored_count=0,
)


async def _pair(db, a_id: int, b_id: int) -> Friendship | None:
    """The row joining two users, whichever of them sent the request."""
    return (
        await db.execute(
            select(Friendship).where(
                or_(
                    (Friendship.requester_id == a_id) & (Friendship.addressee_id == b_id),
                    (Friendship.requester_id == b_id) & (Friendship.addressee_id == a_id),
                )
            )
        )
    ).scalar_one_or_none()


async def _friend_ids(db, user_id: int) -> list[int]:
    rows = (
        await db.execute(
            select(Friendship.requester_id, Friendship.addressee_id).where(
                Friendship.state == FriendshipState.accepted,
                or_(Friendship.requester_id == user_id, Friendship.addressee_id == user_id),
            )
        )
    ).all()
    return [r if r != user_id else a for r, a in rows]


def _as_out(row: Friendship, viewer_id: int) -> FriendshipOut:
    other = row.addressee if row.requester_id == viewer_id else row.requester
    return FriendshipOut(
        id=row.id,
        user=PublicUser.model_validate(other),
        state=row.state,
        direction="outgoing" if row.requester_id == viewer_id else "incoming",
        created_at=row.created_at,
    )


async def _by_username(db, username: str) -> User:
    target = (
        await db.execute(select(User).where(func.lower(User.username) == username.lower()))
    ).scalar_one_or_none()
    if target is None or not target.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such user")
    return target


async def _visibility(db, viewer: User, target: User) -> tuple[str, bool]:
    """(relationship, may_see_list) — the only place privacy is decided."""
    if viewer.id == target.id:
        return "self", True
    row = await _pair(db, viewer.id, target.id)
    if row is not None and row.state == FriendshipState.accepted:
        return "friends", True
    if row is not None and row.state == FriendshipState.pending:
        return "pending", target.profile_public
    return "none", target.profile_public


async def _entries_of(db, user_id: int, limit: int = PROFILE_ENTRY_LIMIT) -> list[ListEntry]:
    return list(
        (
            await db.execute(
                select(ListEntry)
                .options(selectinload(ListEntry.media))
                .where(ListEntry.user_id == user_id)
                .order_by(ListEntry.updated_at.desc())
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )


async def _summaries(db, viewer_id: int, friend_ids: list[int]) -> dict[int, FriendSummary]:
    """
    Tracked count, mean score and titles-in-common for several friends at once.

    Three grouped queries rather than three per friend: the friends list would
    otherwise issue 3N round-trips to render one page.
    """
    if not friend_ids:
        return {}

    totals = dict(
        (
            await db.execute(
                select(ListEntry.user_id, func.count(ListEntry.id))
                .where(ListEntry.user_id.in_(friend_ids))
                .group_by(ListEntry.user_id)
            )
        ).all()
    )
    means = dict(
        (
            await db.execute(
                select(ListEntry.user_id, func.avg(ListEntry.score))
                .where(
                    ListEntry.user_id.in_(friend_ids),
                    ListEntry.score.is_not(None),
                    ListEntry.score > 0,
                )
                .group_by(ListEntry.user_id)
            )
        ).all()
    )
    mine = select(ListEntry.media_cache_id).where(ListEntry.user_id == viewer_id).scalar_subquery()
    common = dict(
        (
            await db.execute(
                select(ListEntry.user_id, func.count(ListEntry.id))
                .where(ListEntry.user_id.in_(friend_ids), ListEntry.media_cache_id.in_(mine))
                .group_by(ListEntry.user_id)
            )
        ).all()
    )

    return {
        fid: FriendSummary(
            tracked=totals.get(fid, 0),
            mean_score=round(float(means[fid]), 2) if means.get(fid) is not None else None,
            in_common=common.get(fid, 0),
        )
        for fid in friend_ids
    }


# --- Friends and requests ------------------------------------------------


@router.get("/friends", response_model=FriendsOut)
async def list_friends(user: CurrentUser, db: DbSession) -> FriendsOut:
    rows = list(
        (
            await db.execute(
                select(Friendship)
                .options(selectinload(Friendship.requester), selectinload(Friendship.addressee))
                .where(
                    Friendship.state != FriendshipState.blocked,
                    or_(
                        Friendship.requester_id == user.id,
                        Friendship.addressee_id == user.id,
                    ),
                )
                .order_by(Friendship.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    out = [_as_out(r, user.id) for r in rows]

    # Only accepted friends carry figures; a pending request reveals nothing.
    accepted = [o for o in out if o.state == FriendshipState.accepted]
    summaries = await _summaries(db, user.id, [o.user.id for o in accepted])
    for o in accepted:
        o.stats = summaries.get(o.user.id)

    return FriendsOut(
        friends=[o for o in out if o.state == FriendshipState.accepted],
        incoming=[
            o for o in out if o.state == FriendshipState.pending and o.direction == "incoming"
        ],
        outgoing=[
            o for o in out if o.state == FriendshipState.pending and o.direction == "outgoing"
        ],
    )


@router.post(
    "/friends/requests",
    response_model=FriendshipOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[rate_limit("friend_request", 20, 3600, scope="user")],
)
async def send_request(payload: FriendRequestIn, user: CurrentUser, db: DbSession) -> FriendshipOut:
    target = await _by_username(db, payload.username)
    if target.id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot friend yourself")

    existing = await _pair(db, user.id, target.id)
    if existing is not None:
        if existing.state == FriendshipState.blocked:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No such user")
        if existing.state == FriendshipState.accepted:
            raise HTTPException(status.HTTP_409_CONFLICT, "Already friends")
        if existing.requester_id == user.id:
            raise HTTPException(status.HTTP_409_CONFLICT, "Request already sent")
        # They asked first and we are asking back: treat that as accepting, which
        # also keeps the pair down to the single row the unique constraint allows.
        existing.state = FriendshipState.accepted
        await db.commit()
        await db.refresh(existing, ["requester", "addressee"])
        return _as_out(existing, user.id)

    row = Friendship(requester_id=user.id, addressee_id=target.id, state=FriendshipState.pending)
    db.add(row)
    await db.commit()
    await db.refresh(row, ["requester", "addressee"])
    return _as_out(row, user.id)


async def _load_addressed(db, request_id: int, user_id: int) -> Friendship:
    row = (
        await db.execute(
            select(Friendship)
            .options(selectinload(Friendship.requester), selectinload(Friendship.addressee))
            .where(Friendship.id == request_id)
        )
    ).scalar_one_or_none()
    if row is None or row.state != FriendshipState.pending or row.addressee_id != user_id:
        # Includes "you are the requester" — you may cancel it, but not accept it.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such request")
    return row


@router.post("/friends/requests/{request_id}/accept", response_model=FriendshipOut)
async def accept_request(request_id: int, user: CurrentUser, db: DbSession) -> FriendshipOut:
    row = await _load_addressed(db, request_id, user.id)
    row.state = FriendshipState.accepted
    await db.commit()
    await db.refresh(row, ["requester", "addressee"])
    return _as_out(row, user.id)


@router.post("/friends/requests/{request_id}/decline", status_code=status.HTTP_204_NO_CONTENT)
async def decline_request(request_id: int, user: CurrentUser, db: DbSession) -> None:
    row = await _load_addressed(db, request_id, user.id)
    await db.delete(row)
    await db.commit()


@router.delete("/friends/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_friend(user_id: int, user: CurrentUser, db: DbSession) -> None:
    """Unfriend, or withdraw a request you sent — the same row either way."""
    row = await _pair(db, user.id, user_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not connected to that user")
    await db.delete(row)
    await db.commit()


# --- Discovery and profiles ----------------------------------------------


# Username lookup is the one endpoint that reveals who exists on the instance.
@router.get(
    "/users/search",
    response_model=list[PublicUser],
    dependencies=[rate_limit("user_search", 30, 60, scope="user")],
)
async def search_users(
    user: CurrentUser,
    db: DbSession,
    q: str = Query(min_length=1, max_length=64),
    limit: int = Query(10, ge=1, le=50),
) -> list[User]:
    """Username prefix match. Emails are never searchable — that would leak them."""
    # `%` and `_` are LIKE metacharacters: unescaped, a search for "%" matches every
    # row and turns this endpoint into a dump of the instance's user list.
    pattern = q.lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    rows = (
        await db.execute(
            select(User)
            .where(
                User.id != user.id,
                User.is_active.is_(True),
                func.lower(User.username).like(f"{pattern}%", escape="\\"),
            )
            .order_by(User.username)
            .limit(limit)
        )
    ).scalars()
    return list(rows)


@router.get("/users/{username}", response_model=ProfileOut)
async def user_profile(username: str, user: CurrentUser, db: DbSession) -> ProfileOut:
    target = await _by_username(db, username)
    relationship, visible = await _visibility(db, user, target)

    return ProfileOut(
        user=PublicUser.model_validate(target),
        relationship=relationship,
        visible=visible,
        anime=await type_stats(db, target.id, MediaType.anime) if visible else _EMPTY_STATS,
        manga=await type_stats(db, target.id, MediaType.manga) if visible else _EMPTY_STATS,
        entries=await _entries_of(db, target.id) if visible else [],
    )


@router.get("/users/{username}/compare", response_model=ComparisonOut)
async def compare_lists(username: str, user: CurrentUser, db: DbSession) -> ComparisonOut:
    target = await _by_username(db, username)
    if target.id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nothing to compare against yourself")
    _, visible = await _visibility(db, user, target)
    if not visible:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "That list is private")

    mine = {e.media_cache_id: e for e in await _entries_of(db, user.id)}
    theirs = {e.media_cache_id: e for e in await _entries_of(db, target.id)}

    shared: list[ComparisonRow] = []
    diffs: list[int] = []
    for media_id, their_entry in theirs.items():
        my_entry = mine.get(media_id)
        if my_entry is None:
            continue
        shared.append(ComparisonRow(media=their_entry.media, mine=my_entry, theirs=their_entry))
        if my_entry.score and their_entry.score:
            diffs.append(my_entry.score - their_entry.score)

    only_theirs = [
        ComparisonRow(media=e.media, mine=None, theirs=e)
        for media_id, e in theirs.items()
        if media_id not in mine
    ]

    return ComparisonOut(
        user=PublicUser.model_validate(target),
        shared=shared,
        only_theirs=only_theirs,
        both_scored=len(diffs),
        mean_difference=round(sum(diffs) / len(diffs), 2) if diffs else None,
    )


# --- Feed ----------------------------------------------------------------


@router.get("/feed", response_model=list[FeedItem])
async def friend_feed(user: CurrentUser, db: DbSession) -> list[FeedItem]:
    """
    What your friends have been up to, newest first. Friendship alone grants this —
    `profile_public` widens who may browse a list, it does not gate the feed.
    """
    friend_ids = await _friend_ids(db, user.id)
    if not friend_ids:
        return []

    rows = list(
        (
            await db.execute(
                select(ListEntry, User)
                .join(User, User.id == ListEntry.user_id)
                .options(selectinload(ListEntry.media))
                .where(ListEntry.user_id.in_(friend_ids))
                .order_by(ListEntry.updated_at.desc())
                .limit(FEED_LIMIT)
            )
        ).all()
    )
    return [FeedItem(user=PublicUser.model_validate(owner), entry=entry) for entry, owner in rows]


# --- Discovery and leaderboard -------------------------------------------


# Top-level, not `/users/discover`: it is declared after `/users/{username}`, so
# that path would capture "discover" as a username before this ever matched.
@router.get(
    "/discover",
    response_model=list[DiscoverUser],
    dependencies=[rate_limit("discover", 30, 60, scope="user")],
)
async def discover_users(
    user: CurrentUser, db: DbSession, limit_n: int = Query(12, ge=1, le=50, alias="limit")
) -> list[DiscoverUser]:
    """
    Accounts you have no link with — so adding someone does not require knowing
    their exact username in advance.

    The tracked count is withheld unless they made their profile public: how big a
    private list is stays as private as what is in it.
    """
    linked = (
        select(Friendship.requester_id)
        .where(Friendship.addressee_id == user.id)
        .union(select(Friendship.addressee_id).where(Friendship.requester_id == user.id))
    )
    rows = list(
        (
            await db.execute(
                select(User)
                .where(
                    User.id != user.id,
                    User.is_active.is_(True),
                    User.id.not_in(linked),
                )
                .order_by(User.created_at.desc())
                .limit(limit_n)
            )
        )
        .scalars()
        .all()
    )
    if not rows:
        return []

    public_ids = [u.id for u in rows if u.profile_public]
    totals: dict[int, int] = {}
    if public_ids:
        totals = dict(
            (
                await db.execute(
                    select(ListEntry.user_id, func.count(ListEntry.id))
                    .where(ListEntry.user_id.in_(public_ids))
                    .group_by(ListEntry.user_id)
                )
            ).all()
        )

    return [
        DiscoverUser(
            user=PublicUser.model_validate(u),
            tracked=totals.get(u.id, 0) if u.profile_public else None,
        )
        for u in rows
    ]


@router.get("/leaderboard", response_model=LeaderboardOut)
async def leaderboard(user: CurrentUser, db: DbSession) -> LeaderboardOut:
    """
    You and your accepted friends, with the totals each of you has accumulated.

    Restricted to people you are actually friends with — this is a comparison
    among consenting parties, not an instance-wide scoreboard.
    """
    ids = [user.id, *await _friend_ids(db, user.id)]

    people = {
        u.id: u for u in (await db.execute(select(User).where(User.id.in_(ids)))).scalars().all()
    }

    # Progress only counts toward episodes for anime and chapters for manga, so the
    # sum is split by media type rather than lumped together.
    units = {
        (uid, mtype): int(total)
        for uid, mtype, total in (
            await db.execute(
                select(
                    ListEntry.user_id,
                    MediaCache.type,
                    func.coalesce(func.sum(ListEntry.progress), 0),
                )
                .join(MediaCache, MediaCache.id == ListEntry.media_cache_id)
                .where(ListEntry.user_id.in_(ids))
                .group_by(ListEntry.user_id, MediaCache.type)
            )
        ).all()
    }
    completed = dict(
        (
            await db.execute(
                select(ListEntry.user_id, func.count(ListEntry.id))
                .where(ListEntry.user_id.in_(ids), ListEntry.status == EntryStatus.completed)
                .group_by(ListEntry.user_id)
            )
        ).all()
    )
    means = dict(
        (
            await db.execute(
                select(ListEntry.user_id, func.avg(ListEntry.score))
                .where(
                    ListEntry.user_id.in_(ids),
                    ListEntry.score.is_not(None),
                    ListEntry.score > 0,
                )
                .group_by(ListEntry.user_id)
            )
        ).all()
    )

    rows = [
        LeaderboardRow(
            user=PublicUser.model_validate(people[uid]),
            is_self=uid == user.id,
            episodes_watched=units.get((uid, MediaType.anime), 0),
            chapters_read=units.get((uid, MediaType.manga), 0),
            completed=completed.get(uid, 0),
            mean_score=round(float(means[uid]), 2) if means.get(uid) is not None else None,
        )
        for uid in ids
        if uid in people
    ]
    # Default order; the client re-sorts when you switch metric.
    rows.sort(key=lambda r: r.episodes_watched, reverse=True)
    return LeaderboardOut(rows=rows)
