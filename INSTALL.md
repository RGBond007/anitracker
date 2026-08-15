# Installing AniTrack

## 1. Requirements

- Docker Engine 24+ with Compose v2 (`docker compose version`)
- ~350 MB disk for images, plus your database
- A free port (8000 by default)

## 2. Install

```bash
mkdir -p /opt/anitrack && cd /opt/anitrack
curl -O https://raw.githubusercontent.com/anitrack/anitrack/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/anitrack/anitrack/main/.env.example
cp .env.example .env
```

Set the one required value:

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
```

If this instance will be reachable from outside your LAN, also change `POSTGRES_PASSWORD` in
`.env` **before** the first start — it is only read when the database volume is created.

Start it:

```bash
docker compose up -d
docker compose logs -f app     # watch migrations run
```

Open `http://<host>:8000`. The first-run wizard creates your admin account and picks your default
title language. The first account created is always the admin.

## 3. After setup

Once everyone in your household has an account, close registration:

```bash
sed -i 's/^ALLOW_SIGNUP=.*/ALLOW_SIGNUP=false/' .env
docker compose up -d
```

Existing users keep working; the sign-up link disappears from the login screen.

## 4. Building from source instead of pulling

```bash
git clone https://github.com/anitrack/anitrack.git && cd anitrack
cp .env.example .env && echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
```

In `docker-compose.yml`, comment out `image:` under the `app` service and uncomment `build: .`, then:

```bash
docker compose up -d --build
```

## 5. HTTPS

AniTrack serves the UI and API from one origin, so any reverse proxy needs only a pass-through.
Set `COOKIE_SECURE=true` in `.env` and restart — session cookies are then marked `Secure`, which
browsers require for cross-site-safe cookies over TLS.

**Caddy**

```caddy
anitrack.example.com {
    reverse_proxy localhost:8000
}
```

**nginx**

```nginx
server {
    server_name anitrack.example.com;
    client_max_body_size 25M;   # MAL exports can be a few MB

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

If you proxy from another machine, drop the `ports:` mapping from the `app` service and put both
containers on a shared Docker network instead.

## 6. Upgrading

```bash
cd /opt/anitrack
docker compose pull
docker compose up -d
```

Migrations run automatically on start; the container waits for Postgres first. Your data is in the
named volume `anitrack-db`, which is untouched by image replacement — that is why the compose file
uses a named volume rather than a bind mount into the install directory.

**Take a backup before a major-version upgrade** (step 7). To roll back, pin the previous tag:

```yaml
image: ghcr.io/anitrack/anitrack:1.0.0
```

then `docker compose up -d`. Note that migrations are forward-only: restore the matching database
backup if the newer version already migrated your schema.

## 7. Backup and restore

Backup (both the database and your `.env` — without `JWT_SECRET` everyone gets logged out):

```bash
docker compose exec -T db pg_dump -U anitrack anitrack | gzip > anitrack-$(date +%F).sql.gz
cp .env anitrack-env-$(date +%F).bak
```

Restore into a fresh instance:

```bash
docker compose up -d db
gunzip -c anitrack-2026-08-10.sql.gz | docker compose exec -T db psql -U anitrack anitrack
docker compose up -d
```

## 8. Troubleshooting

**`JWT_SECRET` error on startup.** Compose refuses to start without it. Add it to `.env` in the same
directory as `docker-compose.yml`.

**Login succeeds then immediately bounces back.** `COOKIE_SECURE=true` while serving over plain
HTTP — the browser discards the session cookie. Set it to `false`, or finish the TLS setup.

**"Metadata providers unavailable" on search.** All three APIs failed or rate-limited you. They are
public and free, so limits are real: AniList throttles around 30 requests/minute. Wait a minute;
AniTrack backs off and retries automatically. Check `docker compose logs app` for which provider
failed. Anything already on your list keeps working — it is served from the local cache.

**Import finished with failures.** Titles MAL has but AniList and Kitsu do not (usually delisted or
doujin entries) are counted as failed and skipped. Everything else is imported. Re-running the
import is safe; existing entries are skipped, not duplicated.

**Reset the admin password.** There is no email flow. Delete the user row and re-run setup, or set a
new hash directly:

```bash
docker compose exec app python -c "from app.security import hash_password; print(hash_password('new-password'))"
docker compose exec db psql -U anitrack -c "UPDATE users SET password_hash='<paste>', token_version=token_version+1 WHERE username='you';"
```

## 9. Development without Docker

```bash
docker run -d --name anitrack-dev-db -p 5432:5432 \
  -e POSTGRES_USER=anitrack -e POSTGRES_PASSWORD=anitrack -e POSTGRES_DB=anitrack \
  postgres:16-alpine

cd backend
python3.12 -m venv .venv && .venv/bin/pip install -e ".[dev]"
export DATABASE_URL=postgresql+asyncpg://anitrack:anitrack@localhost:5432/anitrack
export JWT_SECRET=dev-secret-change-me
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload

# second terminal
cd frontend && npm install && npm run dev   # http://localhost:5173, proxies /api to :8000
```
