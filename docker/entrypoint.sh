#!/bin/sh
# Migrations run on every start: `docker compose up -d` must work with zero manual DB setup,
# and `docker compose pull && up -d` must upgrade an existing volume in place.
set -e

echo "AniTrack: waiting for the database…"
python - <<'PY'
import asyncio, os, sys, time
from sqlalchemy.ext.asyncio import create_async_engine

url = os.environ.get("DATABASE_URL", "postgresql+asyncpg://anitrack:anitrack@db:5432/anitrack")
deadline = time.time() + 60

async def ping():
    engine = create_async_engine(url)
    try:
        async with engine.connect():
            return True
    finally:
        await engine.dispose()

while True:
    try:
        asyncio.run(ping())
        break
    except Exception as exc:
        if time.time() > deadline:
            print(f"AniTrack: database unreachable after 60s: {exc}", file=sys.stderr)
            sys.exit(1)
        time.sleep(1)
PY

echo "AniTrack: applying migrations…"
alembic upgrade head

echo "AniTrack: starting."
exec "$@"
