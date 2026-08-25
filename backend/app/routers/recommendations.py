from fastapi import APIRouter, HTTPException, status
from sqlalchemy import Select, or_, select
from sqlalchemy.orm import selectinload

from app import media_service
from app.deps import CurrentUser, DbSession, Registry
from app.models import (
    FriendRecommendation,
    Friendship,
    FriendshipState,
    MediaCache,
    RecommendationState,
    User,
)
from app.providers.base import ProviderError
from app.schemas import (
    FriendRecommendationCreate,
    FriendRecommendationOut,
    MediaOut,
    PublicUser,
    RecommendationStateIn,
    SendResult,
)

router = APIRouter(prefix="/recommendations", tags=["recommendations"])

INBOX_LIMIT = 100


async def _friend_ids(db, user_id: int) -> set[int]:
    """Current accepted friends. Read fresh on every request, deliberately."""
    rows = (
        await db.execute(
            select(Friendship.requester_id, Friendship.addressee_id).where(
                Friendship.state == FriendshipState.accepted,
                or_(Friendship.requester_id == user_id, Friendship.addressee_id == user_id),
            )
        )
    ).all()
    return {requester if requester != user_id else addressee for requester, addressee in rows}


def _with_people(stmt: Select) -> Select:
    return stmt.options(
        selectinload(FriendRecommendation.sender),
        selectinload(FriendRecommendation.recipient),
    )


async def _cached_media(db, rows: list[FriendRecommendation]) -> dict[tuple[str, str], MediaCache]:
    """
    Whatever the instance already knows about the recommended titles.

    One query for the whole inbox rather than one per row, and a miss is not an
    error: a friend can recommend something nobody here has looked up, and the
    client resolves it from the provider when the card is opened.
    """
    if not rows:
        return {}
    keys = {(row.provider, row.provider_id) for row in rows}
    found = (
        (
            await db.execute(
                select(MediaCache).where(
                    MediaCache.provider.in_({provider for provider, _ in keys}),
                    MediaCache.provider_id.in_({provider_id for _, provider_id in keys}),
                )
            )
        )
        .scalars()
        .all()
    )
    return {(m.provider, m.provider_id): m for m in found if (m.provider, m.provider_id) in keys}


def _as_out(row: FriendRecommendation, media: MediaCache | None) -> FriendRecommendationOut:
    return FriendRecommendationOut(
        id=row.id,
        sender=PublicUser.model_validate(row.sender),
        recipient=PublicUser.model_validate(row.recipient),
        provider=row.provider,
        provider_id=row.provider_id,
        media_type=row.media_type,
        message=row.message,
        state=row.state,
        created_at=row.created_at,
        media=MediaOut.model_validate(media) if media is not None else None,
    )


async def _render(db, rows: list[FriendRecommendation]) -> list[FriendRecommendationOut]:
    cache = await _cached_media(db, rows)
    return [_as_out(row, cache.get((row.provider, row.provider_id))) for row in rows]


@router.post("", response_model=SendResult, status_code=status.HTTP_201_CREATED)
async def send(
    payload: FriendRecommendationCreate,
    user: CurrentUser,
    db: DbSession,
    registry: Registry,
) -> SendResult:
    """
    Hand a title to one or more friends.

    Three things are checked before a row is written, in the order they can fail
    cheapest first: that you are not recommending to yourself, that every recipient
    is a *current* friend, and that the title actually exists.

    A recipient who already has an identical recommendation waiting is skipped and
    reported back rather than raised on: sending to five friends where one already
    has it should still reach the other four.
    """
    requested = list(dict.fromkeys(payload.recipient_ids))

    # Checked explicitly rather than left to the friend test below. You are not your
    # own friend, so that test would already refuse it -- but with a message about
    # friendship, which is not what went wrong.
    if user.id in requested:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot recommend a title to yourself")

    friends = await _friend_ids(db, user.id)
    if any(recipient_id not in friends for recipient_id in requested):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only recommend titles to friends")

    # The provider pair is resolved before anything is stored, so a made-up id is a
    # 404 here instead of a row that points at nothing and a recipient staring at a
    # card with no title. Caching it as a side effect is the point rather than a
    # cost: the recipient's inbox can then show the artwork straight away.
    try:
        media = await media_service.get_or_fetch(
            db, registry, payload.provider, payload.provider_id, payload.media_type.value
        )
    except ProviderError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No such title: {exc}") from exc
    if media is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such title")

    message = (payload.message or "").strip() or None

    pending = {
        row.recipient_id
        for row in (
            await db.execute(
                select(FriendRecommendation).where(
                    FriendRecommendation.sender_id == user.id,
                    FriendRecommendation.recipient_id.in_(requested),
                    FriendRecommendation.provider == payload.provider,
                    FriendRecommendation.provider_id == payload.provider_id,
                    FriendRecommendation.state == RecommendationState.pending,
                )
            )
        )
        .scalars()
        .all()
    }

    fresh = [
        FriendRecommendation(
            sender_id=user.id,
            recipient_id=recipient_id,
            provider=payload.provider,
            provider_id=payload.provider_id,
            media_type=payload.media_type,
            message=message,
        )
        for recipient_id in requested
        if recipient_id not in pending
    ]
    for row in fresh:
        db.add(row)
    await db.commit()

    if not fresh:
        return SendResult(sent=[], already_pending=sorted(pending))

    rows = list(
        (
            await db.execute(
                _with_people(
                    select(FriendRecommendation).where(
                        FriendRecommendation.id.in_([row.id for row in fresh])
                    )
                )
            )
        )
        .scalars()
        .all()
    )
    return SendResult(sent=await _render(db, rows), already_pending=sorted(pending))


@router.get("/inbox", response_model=list[FriendRecommendationOut])
async def inbox(user: CurrentUser, db: DbSession) -> list[FriendRecommendationOut]:
    """
    What friends have handed you, newest first, dismissed ones left out.

    Filtered by the *current* friend list rather than by recipient alone: unfriending
    someone has to take their recommendations with it, in both directions, without
    rewriting history. A row from a former friend simply stops being returned.
    """
    friends = await _friend_ids(db, user.id)
    if not friends:
        return []
    stmt = (
        _with_people(
            select(FriendRecommendation).where(
                FriendRecommendation.recipient_id == user.id,
                FriendRecommendation.sender_id.in_(friends),
                FriendRecommendation.state != RecommendationState.dismissed,
            )
        )
        .order_by(FriendRecommendation.created_at.desc())
        .limit(INBOX_LIMIT)
    )
    rows = list((await db.execute(stmt)).scalars().all())
    return await _render(db, rows)


@router.get("/sent", response_model=list[FriendRecommendationOut])
async def sent(user: CurrentUser, db: DbSession) -> list[FriendRecommendationOut]:
    """What you handed to friends, so "did I already send this" has an answer."""
    friends = await _friend_ids(db, user.id)
    if not friends:
        return []
    stmt = (
        _with_people(
            select(FriendRecommendation).where(
                FriendRecommendation.sender_id == user.id,
                FriendRecommendation.recipient_id.in_(friends),
            )
        )
        .order_by(FriendRecommendation.created_at.desc())
        .limit(INBOX_LIMIT)
    )
    rows = list((await db.execute(stmt)).scalars().all())
    return await _render(db, rows)


@router.patch("/{recommendation_id}", response_model=FriendRecommendationOut)
async def set_state(
    recommendation_id: int, payload: RecommendationStateIn, user: CurrentUser, db: DbSession
) -> FriendRecommendationOut:
    """
    Move a recommendation along. Only its recipient may.

    The sender deliberately cannot: whether their friend looked at it is the
    friend's to say. And accepting does **not** touch the library -- adding the
    title is a separate call the client makes through the ordinary add-entry path,
    which is what keeps "accepted" from silently meaning "started".
    """
    row = (
        await db.execute(
            _with_people(
                select(FriendRecommendation).where(FriendRecommendation.id == recommendation_id)
            )
        )
    ).scalar_one_or_none()

    friends = await _friend_ids(db, user.id)
    # A former friend's recommendation is not "forbidden", it is gone: the reader is
    # not entitled to learn that it ever existed.
    if row is None or row.recipient_id != user.id or row.sender_id not in friends:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Recommendation not found")

    row.state = RecommendationState(payload.state)
    await db.commit()

    refreshed = (
        await db.execute(
            _with_people(
                select(FriendRecommendation).where(FriendRecommendation.id == recommendation_id)
            )
        )
    ).scalar_one()
    cache = await _cached_media(db, [refreshed])
    return _as_out(refreshed, cache.get((refreshed.provider, refreshed.provider_id)))


@router.get("/for/{provider}/{provider_id}", response_model=list[PublicUser])
async def who_recommended(
    provider: str, provider_id: str, user: CurrentUser, db: DbSession
) -> list[User]:
    """
    Which friends handed you this title -- the "why am I seeing this" line on a
    title's own page, answered without loading the whole inbox.
    """
    friends = await _friend_ids(db, user.id)
    if not friends:
        return []
    rows = list(
        (
            await db.execute(
                _with_people(
                    select(FriendRecommendation).where(
                        FriendRecommendation.recipient_id == user.id,
                        FriendRecommendation.sender_id.in_(friends),
                        FriendRecommendation.provider == provider,
                        FriendRecommendation.provider_id == provider_id,
                        FriendRecommendation.state != RecommendationState.dismissed,
                    )
                )
            )
        )
        .scalars()
        .all()
    )
    return [row.sender for row in rows]
