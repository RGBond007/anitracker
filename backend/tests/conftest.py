import asyncio
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret")

FIXTURES = Path(__file__).parent / "fixtures"


def load_fixture(name: str):
    path = FIXTURES / name
    if path.suffix == ".json":
        return json.loads(path.read_text())
    return path.read_bytes()


@pytest.fixture
def fixture():
    return load_fixture


@pytest.fixture(autouse=True)
def _fresh_rate_limits():
    """
    Rate-limit buckets are module-level, so without this they accumulate across
    tests and every auth call after the first handful comes back 429. Clearing
    between tests keeps the limiter *live* — a test that trips it on purpose still
    sees a 429 — while stopping one test's attempts from failing the next.
    """
    from app import ratelimit

    ratelimit.reset()
    yield
    ratelimit.reset()


@pytest.fixture
async def app_client():
    """Full app over an in-memory SQLite DB with a stubbed provider registry."""
    import httpx
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.pool import StaticPool

    from app import db as db_module
    from app.deps import get_db
    from app.main import app
    from app.models import Base
    from app.providers.registry import ProviderRegistry
    from tests.stub_provider import StubProvider

    # StaticPool keeps every session on the *same* in-memory database.
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", poolclass=StaticPool)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Sessions take turns.
    #
    # Every in-memory SQLite connection is a database of its own, so StaticPool --
    # one connection, shared -- is the only way the app and its background tasks can
    # see the same data. The catch is that the app is genuinely concurrent: adding an
    # entry resolves the season chain in a task whose session overlaps the request
    # that scheduled it. Two sessions interleaving on one connection collide over
    # savepoints ("cannot open savepoint - SQL statements in progress"), the chain
    # walk reads the error as a title it cannot reach, and the series comes back
    # missing a member -- in whichever test happened to look, perhaps one run in five.
    #
    # In production each session holds its own connection out of the Postgres pool,
    # which is what makes the overlap safe there. This lock is that guarantee,
    # restated for a harness that has only one connection to give: it removes an
    # interleaving that never existed outside the tests, and nothing here awaits a
    # background task while holding a session, so taking turns cannot deadlock.
    session_gate = asyncio.Lock()

    @asynccontextmanager
    async def session_in_turn():
        async with session_gate, session_factory() as session:
            yield session

    db_module.SessionLocal = session_in_turn  # background import tasks use this

    async def override_get_db():
        async with session_in_turn() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    app.state.registry = ProviderRegistry([StubProvider()])
    app.state.background_tasks = set()

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()

    # Adding an entry kicks off season-chain resolution in a task. Left running, it
    # outlives its test and touches the next one's database — so wait for the ones
    # in flight before the engine goes away.
    if app.state.background_tasks:
        await asyncio.gather(*list(app.state.background_tasks), return_exceptions=True)
    await engine.dispose()
