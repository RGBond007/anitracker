from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.deps import CurrentUser, DbSession
from app.models import (
    Friendship,
    FriendshipState,
    ListEntry,
    MediaCache,
    MediaType,
    User,
    WatchGroup,
    WatchGroupMember,
    WatchGroupState,
)
from app.schemas import (
    MediaOut,
    PublicUser,
    SpoilerCheck,
    WatchGroupCreate,
    WatchGroupOut,
    WatchInviteIn,
    WatchMember,
    WatchTargetIn,
)

router = APIRouter(prefix="/watch-groups", tags=["watch-groups"])

MAX_GROUPS = 50


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


async def _load(db, group_id: int) -> WatchGroup | None:
    return (
        await db.execute(
            select(WatchGroup)
            .options(
                selectinload(WatchGroup.members).selectinload(WatchGroupMember.user),
                selectinload(WatchGroup.owner),
            )
            .where(WatchGroup.id == group_id)
        )
    ).scalar_one_or_none()


def _standing(group: WatchGroup, user_id: int) -> WatchGroupMember | None:
    return next((m for m in group.members if m.user_id == user_id), None)


async def _visible(db, group_id: int, user: User) -> tuple[WatchGroup, WatchGroupMember]:
    """
    A group and the viewer's place in it, or a 404.

    Membership is the only key. Someone who was invited and declined, or who left,
    is outside again -- and outside is indistinguishable from "no such group",
    because the roster of a private group is itself private.
    """
    group = await _load(db, group_id)
    if group is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
    standing = _standing(group, user.id)
    if standing is None or standing.state == WatchGroupState.left:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
    return group, standing


async def _progress_for(db, group: WatchGroup, user_ids: list[int]) -> dict[int, int]:
    """Each member's own count for this title, read from their list, not stored."""
    if not user_ids:
        return {}
    rows = (
        await db.execute(
            select(ListEntry.user_id, ListEntry.progress)
            .join(MediaCache, MediaCache.id == ListEntry.media_cache_id)
            .where(
                ListEntry.user_id.in_(user_ids),
                MediaCache.provider == group.provider,
                MediaCache.provider_id == group.provider_id,
            )
        )
    ).all()
    return {user_id: progress for user_id, progress in rows}


async def _media_for(db, group: WatchGroup) -> MediaCache | None:
    return (
        await db.execute(
            select(MediaCache).where(
                MediaCache.provider == group.provider,
                MediaCache.provider_id == group.provider_id,
            )
        )
    ).scalar_one_or_none()


async def _as_out(db, group: WatchGroup, viewer: User) -> WatchGroupOut:
    standing = _standing(group, viewer.id)
    joined = [m for m in group.members if m.state == WatchGroupState.joined]
    progress = await _progress_for(db, group, [m.user_id for m in joined])
    media = await _media_for(db, group)

    return WatchGroupOut(
        id=group.id,
        provider=group.provider,
        provider_id=group.provider_id,
        media_type=group.media_type,
        target_unit=group.target_unit,
        is_closed=group.closed_at is not None,
        my_state=standing.state if standing else WatchGroupState.left,
        i_own_it=group.owner_id == viewer.id,
        members=[
            WatchMember(
                user=PublicUser.model_validate(member.user),
                state=member.state,
                # Only for people actually in it. An invitation is not consent to
                # publish where you are with the show.
                progress=progress.get(member.user_id)
                if member.state == WatchGroupState.joined
                else None,
                is_owner=member.user_id == group.owner_id,
            )
            for member in sorted(group.members, key=lambda m: (m.user_id != group.owner_id, m.id))
            if member.state != WatchGroupState.left
        ],
        media=MediaOut.model_validate(media) if media is not None else None,
        created_at=group.created_at,
    )


@router.post("", response_model=WatchGroupOut, status_code=status.HTTP_201_CREATED)
async def create(payload: WatchGroupCreate, user: CurrentUser, db: DbSession) -> WatchGroupOut:
    """
    Mark a title as watch-together and invite whoever you want along.

    The creator joins immediately -- proposing a thing and then having to accept
    your own invitation is a step nobody would thank us for. Everyone else is
    invited and stays invited until they say yes.
    """
    friends = await _friend_ids(db, user.id)
    invites = [uid for uid in dict.fromkeys(payload.invite_ids) if uid != user.id]
    if any(uid not in friends for uid in invites):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only invite friends")

    existing = (
        await db.execute(
            select(WatchGroup).where(
                WatchGroup.owner_id == user.id,
                WatchGroup.provider == payload.provider,
                WatchGroup.provider_id == payload.provider_id,
                WatchGroup.closed_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "You already have an open group for this title"
        )

    mine = (
        await db.execute(
            select(WatchGroup.id).where(
                WatchGroup.owner_id == user.id, WatchGroup.closed_at.is_(None)
            )
        )
    ).all()
    if len(mine) >= MAX_GROUPS:
        raise HTTPException(status.HTTP_409_CONFLICT, "Too many open groups")

    group = WatchGroup(
        owner_id=user.id,
        provider=payload.provider,
        provider_id=payload.provider_id,
        media_type=MediaType(payload.media_type),
    )
    group.members.append(WatchGroupMember(user_id=user.id, state=WatchGroupState.joined))
    for uid in invites:
        group.members.append(WatchGroupMember(user_id=uid, state=WatchGroupState.invited))
    db.add(group)
    await db.commit()

    fresh = await _load(db, group.id)
    return await _as_out(db, fresh, user)


@router.get("", response_model=list[WatchGroupOut])
async def mine(user: CurrentUser, db: DbSession) -> list[WatchGroupOut]:
    """Groups you are in or have been invited to. Never anyone else's."""
    rows = list(
        (
            await db.execute(
                select(WatchGroupMember.group_id).where(
                    WatchGroupMember.user_id == user.id,
                    WatchGroupMember.state != WatchGroupState.left,
                )
            )
        )
        .scalars()
        .all()
    )
    if not rows:
        return []
    groups = list(
        (
            await db.execute(
                select(WatchGroup)
                .options(
                    selectinload(WatchGroup.members).selectinload(WatchGroupMember.user),
                    selectinload(WatchGroup.owner),
                )
                .where(WatchGroup.id.in_(rows))
                .order_by(WatchGroup.closed_at.is_not(None), WatchGroup.updated_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return [await _as_out(db, group, user) for group in groups]


@router.get("/for/{provider}/{provider_id}", response_model=WatchGroupOut | None)
async def for_title(
    provider: str, provider_id: str, user: CurrentUser, db: DbSession
) -> WatchGroupOut | None:
    """
    The open group you are in for this title, if any -- what the title page asks.

    Null rather than 404: "no group for this" is the ordinary answer, not a
    failure, and the page renders nothing for it.
    """
    group_ids = list(
        (
            await db.execute(
                select(WatchGroupMember.group_id).where(
                    WatchGroupMember.user_id == user.id,
                    WatchGroupMember.state != WatchGroupState.left,
                )
            )
        )
        .scalars()
        .all()
    )
    if not group_ids:
        return None
    group = (
        await db.execute(
            select(WatchGroup)
            .options(
                selectinload(WatchGroup.members).selectinload(WatchGroupMember.user),
                selectinload(WatchGroup.owner),
            )
            .where(
                WatchGroup.id.in_(group_ids),
                WatchGroup.provider == provider,
                WatchGroup.provider_id == provider_id,
                WatchGroup.closed_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    return await _as_out(db, group, user) if group else None


@router.get("/{group_id}", response_model=WatchGroupOut)
async def detail(group_id: int, user: CurrentUser, db: DbSession) -> WatchGroupOut:
    group, _ = await _visible(db, group_id, user)
    return await _as_out(db, group, user)


@router.post("/{group_id}/join", response_model=WatchGroupOut)
async def join(group_id: int, user: CurrentUser, db: DbSession) -> WatchGroupOut:
    group, standing = await _visible(db, group_id, user)
    if group.closed_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "That group is closed")
    standing.state = WatchGroupState.joined
    await db.commit()
    return await _as_out(db, await _load(db, group_id), user)


@router.post("/{group_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave(group_id: int, user: CurrentUser, db: DbSession) -> None:
    """
    Leave, or decline an invitation -- the same door either way.

    The owner leaving closes the group rather than orphaning it: a group whose
    owner is gone has nobody who can close it, and quietly handing ownership to
    whoever happens to be next is a decision nobody made.
    """
    group, standing = await _visible(db, group_id, user)
    standing.state = WatchGroupState.left
    if group.owner_id == user.id and group.closed_at is None:
        group.closed_at = datetime.now(UTC)
    await db.commit()


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def close(group_id: int, user: CurrentUser, db: DbSession) -> None:
    """Close the group. Only its owner, and closing is not deleting."""
    group, _ = await _visible(db, group_id, user)
    if group.owner_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner can close a group")
    if group.closed_at is None:
        group.closed_at = datetime.now(UTC)
        await db.commit()


@router.post("/{group_id}/invite", response_model=WatchGroupOut)
async def invite(
    group_id: int, payload: WatchInviteIn, user: CurrentUser, db: DbSession
) -> WatchGroupOut:
    """
    Add more people. Any *joined* member may, and only their own friends.

    Not owner-only on purpose: a watch-along is a social arrangement rather than a
    possession, and the person who knows the third friend is often not the one who
    started it. Whose friend they are is still checked -- you cannot pull a
    stranger into a group by id.
    """
    group, standing = await _visible(db, group_id, user)
    if standing.state != WatchGroupState.joined:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Join the group before inviting others")
    if group.closed_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "That group is closed")

    friends = await _friend_ids(db, user.id)
    wanted = [uid for uid in dict.fromkeys(payload.user_ids) if uid != user.id]
    if any(uid not in friends for uid in wanted):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only invite friends")

    existing = {m.user_id: m for m in group.members}
    for uid in wanted:
        member = existing.get(uid)
        if member is None:
            group.members.append(WatchGroupMember(user_id=uid, state=WatchGroupState.invited))
        elif member.state == WatchGroupState.left:
            # Someone who left can be asked again; someone already in is untouched.
            member.state = WatchGroupState.invited
    await db.commit()
    return await _as_out(db, await _load(db, group_id), user)


@router.patch("/{group_id}", response_model=WatchGroupOut)
async def set_target(
    group_id: int, payload: WatchTargetIn, user: CurrentUser, db: DbSession
) -> WatchGroupOut:
    """
    Set where the group is aiming next. Any joined member may propose it.

    Deliberately not a vote and not owner-only: it is a note on the fridge, and the
    cost of getting it wrong is that somebody changes it again.
    """
    group, standing = await _visible(db, group_id, user)
    if standing.state != WatchGroupState.joined:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Join the group before setting a target")
    if group.closed_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "That group is closed")
    group.target_unit = payload.target_unit
    await db.commit()
    return await _as_out(db, await _load(db, group_id), user)


@router.get("/{group_id}/spoiler", response_model=SpoilerCheck)
async def spoiler(group_id: int, unit: int, user: CurrentUser, db: DbSession) -> SpoilerCheck:
    """
    Who would be left behind if you watched up to `unit`.

    The whole feature, in one question. It names people rather than counting them,
    because "this would put you ahead of Mika" is a thing you can act on and
    "1 person" is not. It reports; it never blocks.
    """
    group, standing = await _visible(db, group_id, user)
    joined = [
        m for m in group.members if m.state == WatchGroupState.joined and m.user_id != user.id
    ]
    progress = await _progress_for(db, group, [m.user_id for m in joined])

    behind = [
        PublicUser.model_validate(member.user)
        for member in joined
        # Someone who does not track the title yet counts as behind: they have
        # certainly not seen it.
        if progress.get(member.user_id, 0) < unit
    ]
    return SpoilerCheck(
        unit=unit,
        behind=behind,
        past_target=group.target_unit is not None and unit > group.target_unit,
        target_unit=group.target_unit,
    )
