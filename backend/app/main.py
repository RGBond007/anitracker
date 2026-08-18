import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import avatars
from app.config import settings
from app.license import validate as validate_license
from app.providers.registry import ProviderRegistry
from app.routers import (
    admin,
    auth,
    dashboard,
    entries,
    imports,
    media,
    schedule,
    seasons,
    social,
)
from app.version import VERSION

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("anitrack")

STATIC_DIR = Path(__file__).resolve().parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.registry = ProviderRegistry()
    app.state.background_tasks = set()
    app.state.license = validate_license()
    log.info(
        "AniTracker %s starting -- providers: %s, license tier: %s",
        VERSION,
        ", ".join(p.name for p in app.state.registry.providers),
        app.state.license.tier,
    )
    yield
    for task in list(app.state.background_tasks):
        task.cancel()
    await app.state.registry.aclose()


app = FastAPI(
    title="AniTracker API",
    version=VERSION,
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

api = APIRouter(prefix="/api")
api.include_router(auth.router)
api.include_router(media.router)
api.include_router(entries.router)
api.include_router(dashboard.router)
api.include_router(social.router)
api.include_router(schedule.router)
api.include_router(seasons.router)
api.include_router(imports.router)
api.include_router(admin.router)


@api.get("/health", tags=["meta"])
async def health() -> dict:
    return {"status": "ok", "version": VERSION}


app.include_router(api)


# --- Uploaded media --------------------------------------------------------
# Outside the API prefix because these are plain files an <img> asks for, and
# outside the static block because they exist whether or not a bundle was built.

AVATAR_HEADERS = {
    # Every upload is written under a new random name, so a stored file never
    # changes and a replacement arrives as a different URL. That makes it safe to
    # cache forever, and is what makes a new picture appear without a hard refresh.
    "Cache-Control": "public, max-age=31536000, immutable",
    # Defence in depth for a directory holding user-supplied content: nothing here
    # may be sniffed into another type, and nothing it references may load. Only
    # re-encoded WebP is ever written, so neither should matter -- which is exactly
    # why they cost nothing to state.
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
}


@app.get("/media/avatars/{filename}", include_in_schema=False)
async def avatar_file(filename: str) -> FileResponse:
    # `path_for` returns None for anything this server did not generate, so a
    # traversal attempt is a 404 rather than a read.
    path = avatars.path_for(filename)
    if path is None:
        raise StarletteHTTPException(status_code=404)
    # Stated rather than guessed from the suffix: `mimetypes` has no entry for
    # `.webp` on a slim base image, so the guess is `application/octet-stream` --
    # which, with the `nosniff` above, is a picture no browser will draw.
    return FileResponse(path, media_type="image/webp", headers=AVATAR_HEADERS)


# --- Static frontend -------------------------------------------------------
# The React bundle is copied into app/static at image build time. Serving it from
# the backend removes an entire nginx container from the compose file.

if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    # `index.html` names the hashed bundles, so a cached copy outlives a deploy and
    # asks for files that no longer exist. Revalidating it every load is what keeps
    # a redeploy from stranding an open tab on a dead asset.
    INDEX_HEADERS = {"Cache-Control": "no-cache"}

    @app.exception_handler(StarletteHTTPException)
    async def spa_fallback(request, exc: StarletteHTTPException):
        """Unknown non-API GET paths return index.html so client-side routing works."""
        from fastapi.responses import JSONResponse

        if (
            exc.status_code == 404
            and request.method == "GET"
            and not request.url.path.startswith("/api")
            # A miss under /assets is a stale bundle reference, not a client route.
            # Answering it with index.html hands the browser HTML where it expects
            # JavaScript, and the module fails to parse — a blank page instead of a
            # 404 the client could recover from.
            and not request.url.path.startswith("/assets")
            # Same reasoning for uploads: a missing avatar must read as missing, so
            # the browser draws its broken-image state and the client falls back to
            # initials, rather than being handed a page of HTML for an <img>.
            and not request.url.path.startswith("/media")
        ):
            return FileResponse(STATIC_DIR / "index.html", headers=INDEX_HEADERS)
        # `exc.headers` carries things the client needs to act on — `Retry-After` on
        # a 429, `WWW-Authenticate` on a 401. Rebuilding the response without them
        # silently strips every one.
        return JSONResponse(
            {"detail": exc.detail}, status_code=exc.status_code, headers=exc.headers
        )

    @app.get("/", include_in_schema=False)
    async def index() -> FileResponse:
        return FileResponse(STATIC_DIR / "index.html", headers=INDEX_HEADERS)

    # Files the build drops at the root of the bundle rather than under /assets —
    # the web manifest, the icons, favicon. They are not client routes, so without
    # this the SPA fallback answers them with index.html and the browser gets HTML
    # where it asked for PNG or JSON: a home-screen icon that never appears.
    ROOT_FILES = frozenset(
        p.name for p in STATIC_DIR.iterdir() if p.is_file() and p.name != "index.html"
    )

    @app.get("/{filename}", include_in_schema=False)
    async def root_file(filename: str) -> FileResponse:
        if filename not in ROOT_FILES:
            # Not a bundled file — let the SPA fallback treat it as a client route.
            raise StarletteHTTPException(status_code=404)
        return FileResponse(STATIC_DIR / filename)
else:

    @app.get("/", include_in_schema=False)
    async def dev_index() -> dict:
        return {
            "app": settings.instance_name,
            "version": VERSION,
            "note": "Frontend bundle not present -- run the Vite dev server, or build the image.",
        }
