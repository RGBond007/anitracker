from fastapi import APIRouter, HTTPException, Query, status

from app import media_service
from app.deps import CurrentUser, DbSession, Registry
from app.models import MediaType
from app.providers.base import Covers, MediaRecord, ProviderError
from app.ratelimit import limit as rate_limit
from app.schemas import MediaOut, SearchResults

router = APIRouter(prefix="/media", tags=["media"])


def _record_to_out(record: MediaRecord) -> MediaOut:
    return MediaOut(
        provider=record.provider,
        provider_id=record.provider_id,
        type=MediaType(record.type),
        mal_id=record.mal_id,
        title_romaji=record.title_romaji,
        title_english=record.title_english,
        title_native=record.title_native,
        synonyms=record.synonyms,
        cover_url=record.covers.large or record.covers.medium,
        cover_color=record.covers.color,
        banner_url=record.covers.banner,
        synopsis=media_service.clean_synopsis(record.synopsis),
        total_units=record.total_units,
        format=record.format,
        status=record.status,
        season_year=record.season_year,
        genres=record.genres,
        average_score=record.average_score,
        duration=record.duration,
    )


# Each miss is an outbound call to AniList/Jikan/Kitsu — this protects their
# rate limits as much as ours.
@router.get(
    "/search",
    response_model=SearchResults,
    dependencies=[rate_limit("media_search", 30, 60, scope="user")],
)
async def search_media(
    user: CurrentUser,
    registry: Registry,
    q: str = Query(min_length=1, max_length=200),
    type: MediaType = MediaType.anime,
    page: int = Query(1, ge=1, le=50),
    per_page: int = Query(20, ge=1, le=50),
) -> SearchResults:
    try:
        records = await media_service.search(registry, q, type.value, page, per_page)
    except ProviderError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, f"Metadata providers unavailable: {exc}"
        ) from exc
    return SearchResults(
        results=[_record_to_out(r) for r in records],
        page=page,
        has_more=len(records) >= per_page,
    )


@router.get("/{provider}/{provider_id}", response_model=MediaOut)
async def media_detail(
    provider: str,
    provider_id: str,
    user: CurrentUser,
    db: DbSession,
    registry: Registry,
    type: MediaType = MediaType.anime,
    refresh: bool = False,
) -> MediaOut:
    try:
        row = await media_service.get_or_fetch(
            db, registry, provider, provider_id, type.value, force=refresh
        )
    except ProviderError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, f"Metadata providers unavailable: {exc}"
        ) from exc
    await db.commit()
    return MediaOut.model_validate(row)


@router.get("/{provider}/{provider_id}/covers", response_model=Covers)
async def media_covers(
    provider: str,
    provider_id: str,
    user: CurrentUser,
    db: DbSession,
    registry: Registry,
    type: MediaType = MediaType.anime,
) -> Covers:
    row = await media_service.get_or_fetch(db, registry, provider, provider_id, type.value)
    await db.commit()
    return Covers(large=row.cover_url, banner=row.banner_url, color=row.cover_color)
