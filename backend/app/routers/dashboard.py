from fastapi import APIRouter
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.deps import CurrentUser, DbSession
from app.models import EntryStatus, ListEntry, MediaCache, MediaType
from app.schemas import DashboardOut, StatusCount, TypeStats

router = APIRouter(tags=["dashboard"])

DEFAULT_EPISODE_MINUTES = 24


async def type_stats(db, user_id: int, media_type: MediaType) -> TypeStats:
    """Per-type figures for one user. Shared with the social profile endpoint."""
    rows = (
        await db.execute(
            select(ListEntry.status, func.count(ListEntry.id))
            .join(MediaCache)
            .where(ListEntry.user_id == user_id, MediaCache.type == media_type)
            .group_by(ListEntry.status)
        )
    ).all()
    counts = {status: count for status, count in rows}

    mean, scored = (
        await db.execute(
            select(func.avg(ListEntry.score), func.count(ListEntry.score))
            .join(MediaCache)
            .where(
                ListEntry.user_id == user_id,
                MediaCache.type == media_type,
                ListEntry.score.is_not(None),
                ListEntry.score > 0,
            )
        )
    ).one()

    units, minutes = (
        await db.execute(
            select(
                func.coalesce(func.sum(ListEntry.progress), 0),
                func.coalesce(
                    func.sum(
                        ListEntry.progress
                        * func.coalesce(MediaCache.duration, DEFAULT_EPISODE_MINUTES)
                    ),
                    0,
                ),
            )
            .join(MediaCache)
            .where(ListEntry.user_id == user_id, MediaCache.type == media_type)
        )
    ).one()

    return TypeStats(
        counts=[StatusCount(status=s, count=counts.get(s, 0)) for s in EntryStatus],
        total=sum(counts.values()),
        mean_score=round(float(mean), 2) if mean is not None else None,
        scored_count=scored or 0,
        episodes_watched=int(units) if media_type == MediaType.anime else 0,
        chapters_read=int(units) if media_type == MediaType.manga else 0,
        days_watched=round(float(minutes) / 1440, 2) if media_type == MediaType.anime else 0.0,
    )


@router.get("/dashboard", response_model=DashboardOut)
async def dashboard(user: CurrentUser, db: DbSession) -> DashboardOut:
    in_progress = list(
        (
            await db.execute(
                select(ListEntry)
                .options(selectinload(ListEntry.media))
                .where(ListEntry.user_id == user.id, ListEntry.status == EntryStatus.current)
                .order_by(ListEntry.updated_at.desc())
                .limit(24)
            )
        )
        .scalars()
        .all()
    )
    recent = list(
        (
            await db.execute(
                select(ListEntry)
                .options(selectinload(ListEntry.media))
                .where(ListEntry.user_id == user.id)
                .order_by(ListEntry.updated_at.desc())
                .limit(12)
            )
        )
        .scalars()
        .all()
    )
    return DashboardOut(
        anime=await type_stats(db, user.id, MediaType.anime),
        manga=await type_stats(db, user.id, MediaType.manga),
        in_progress=in_progress,
        recently_updated=recent,
    )
