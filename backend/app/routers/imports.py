import asyncio
import logging

from fastapi import APIRouter, File, HTTPException, Request, UploadFile, status
from sqlalchemy import select

from app import db as db_module
from app import media_service
from app.deps import CurrentUser, DbSession
from app.ratelimit import limit as rate_limit
from app.importers import mal_xml
from app.models import ImportJob, ImportState, ListEntry
from app.providers.registry import ProviderRegistry
from app.schemas import ImportJobOut

log = logging.getLogger(__name__)
router = APIRouter(prefix="/import", tags=["import"])

MAX_UPLOAD_BYTES = 20 * 1024 * 1024


async def _run_import(
    job_id: int, entries: list[mal_xml.MalEntry], registry: ProviderRegistry
) -> None:
    """Background worker. Owns its own session -- the request's session is long gone."""
    async with db_module.SessionLocal() as db:
        job = await db.get(ImportJob, job_id)
        if job is None:
            return
        job.state = ImportState.running
        job.total = len(entries)
        await db.commit()

        for item in entries:
            try:
                media = await media_service.resolve_mal_id(db, registry, item.mal_id, item.type)
                existing = (
                    await db.execute(
                        select(ListEntry).where(
                            ListEntry.user_id == job.user_id,
                            ListEntry.media_cache_id == media.id,
                        )
                    )
                ).scalar_one_or_none()
                if existing is not None:
                    job.skipped += 1
                else:
                    db.add(
                        ListEntry(
                            user_id=job.user_id,
                            media_cache_id=media.id,
                            status=item.status,
                            score=item.score,
                            progress=item.progress,
                            rewatch_count=item.rewatch_count,
                            start_date=item.start_date,
                            finish_date=item.finish_date,
                            notes=item.notes,
                        )
                    )
                    job.imported += 1
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # one bad title must not sink the whole import
                log.warning("import: %s (%s) failed: %s", item.title, item.mal_id, exc)
                job.failed += 1
            finally:
                job.processed += 1

            if job.processed % 10 == 0:
                await db.commit()

        job.state = ImportState.done
        await db.commit()


@router.post(
    "/mal",
    response_model=ImportJobOut,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[rate_limit("import", 5, 3600, scope="user")],
)
async def import_mal(
    request: Request,
    user: CurrentUser,
    db: DbSession,
    file: UploadFile = File(...),
) -> ImportJob:
    """Accepts a MAL XML export (.xml or .xml.gz). Runs in the background, poll for progress."""
    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File larger than 20 MB")
    if not raw:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty file")

    try:
        entries = mal_xml.parse(raw)
    except Exception as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Not a valid MAL export: {exc}") from exc
    if not entries:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No importable entries found in that file")

    job = ImportJob(user_id=user.id, source="mal_xml", total=len(entries))
    db.add(job)
    await db.commit()
    await db.refresh(job)

    task = asyncio.create_task(_run_import(job.id, entries, request.app.state.registry))
    request.app.state.background_tasks.add(task)
    task.add_done_callback(request.app.state.background_tasks.discard)
    return job


@router.get("/jobs", response_model=list[ImportJobOut])
async def list_jobs(user: CurrentUser, db: DbSession) -> list[ImportJob]:
    return list(
        (
            await db.execute(
                select(ImportJob)
                .where(ImportJob.user_id == user.id)
                .order_by(ImportJob.created_at.desc())
                .limit(10)
            )
        )
        .scalars()
        .all()
    )


@router.get("/jobs/{job_id}", response_model=ImportJobOut)
async def job_status(job_id: int, user: CurrentUser, db: DbSession) -> ImportJob:
    job = await db.get(ImportJob, job_id)
    if job is None or job.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    return job
