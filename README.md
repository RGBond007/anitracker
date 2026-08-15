# AniTrack

A self-hosted anime and manga tracker. Search, add, score, track progress — for you and everyone
else in your household, on one instance you own.

Two containers, one command, no API keys, no telemetry.

```bash
cp .env.example .env
sed -i '' "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env   # Linux: drop the ''
docker compose up -d
```

Then open <http://localhost:8000> and the first-run wizard creates your admin account.

---

## Screenshots

_To be added — drop `dashboard.png`, `search.png` and `detail.png` into `docs/screenshots/` after
your first run and link them here._

---

## What it does

- **Search anime & manga** through AniList, with Jikan (MyAnimeList) and Kitsu as automatic
  fallbacks when a provider rate-limits you. No account or API key with any of them.
- **Five list statuses** — watching/reading, completed, on hold, dropped, plan to watch/read —
  with score (0–10), progress, start/finish dates, rewatch count and notes.
- **A dashboard** with what you're partway through, plus counts per status, mean score,
  episodes watched and a days-watched estimate.
- **Cover art, synopses and titles cached locally** for 7 days, so browsing your list never
  touches an external API.
- **Title language per user** — Romaji, English or Native — independent of the interface language.
- **Multi-user** with local email/password accounts and admin/user roles. One instance, one
  household. Registration can be locked after everyone has signed up.
- **MyAnimeList import** — drop in your MAL XML export and it resolves every title, keeping your
  scores, progress, dates and comments.
- **English and German UI**, dark theme by default, light mode available per user.
- **White-labelling from the Settings page** — instance name, logo and accent colour, no redeploy.

## What it deliberately does not do

No streaming, no torrents, no downloading — this is a tracker, not a media server. No social feed,
no followers, no comments. No mobile app; the web UI is responsive. And no telemetry: the only
outbound requests it ever makes are to the metadata providers listed in your `.env`.

---

## Requirements

Docker with Compose v2. That's it. ~350 MB of images, about 200 MB of RAM at rest.

## Configuration

Everything is environment variables, all documented in [`.env.example`](.env.example).
The only value you must set is `JWT_SECRET`.

The ones people change most:

| Variable | Default | What it does |
| --- | --- | --- |
| `JWT_SECRET` | _(none)_ | Signs sessions. Generate with `openssl rand -hex 32`. |
| `PORT` | `8000` | Host port for the web UI. |
| `COOKIE_SECURE` | `false` | Set `true` when serving over HTTPS. |
| `ALLOW_SIGNUP` | `true` | Set `false` to close registration. Admins can also toggle this in Settings. |
| `INSTANCE_NAME` | `AniTrack` | Name in the header, tab title and wizard. Also editable in Settings. |
| `ACCENT_COLOR` | `#C9A227` | Stamp accent: buttons, focus rings, progress halftone. Also editable in Settings. |
| `PROVIDER_ORDER` | `anilist,jikan,kitsu` | Which metadata APIs to try, in order. |
| `MEDIA_CACHE_TTL_DAYS` | `7` | How long cached metadata is trusted. |

## Importing from MyAnimeList

On MAL: **Profile → Export → Export Your List**, once for anime and once for manga. In AniTrack:
**Settings → Import from MyAnimeList**, then drop in the downloaded file (`.xml` or `.xml.gz`).

The importer resolves MAL ids to full metadata, keeps your score, progress, dates, rewatch count
and comments, and skips anything already on your list — so re-running it is safe. MAL's "score 0"
is imported as unscored rather than as a zero.

## Reverse proxy

AniTrack serves the UI and the API from a single origin on port 8000, so any proxy works with a
plain pass-through. Set `COOKIE_SECURE=true` once you're on HTTPS.

```caddy
anitrack.example.com {
    reverse_proxy localhost:8000
}
```

## Upgrading

```bash
docker compose pull && docker compose up -d
```

Migrations run automatically at startup. Your data lives in the named `anitrack-db` volume and
survives image replacement — see [INSTALL.md](INSTALL.md) for backups and rollbacks.

## Development

```bash
# Backend (needs a Postgres; see INSTALL.md for a one-liner)
cd backend && python3.12 -m venv .venv && .venv/bin/pip install -e ".[dev]"
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload

# Frontend, proxied to the backend on :8000
cd frontend && npm install && npm run dev
```

Tests never hit the live provider APIs — they run against recorded fixtures in
`backend/tests/fixtures/`:

```bash
cd backend && .venv/bin/pytest
```

API docs are generated at <http://localhost:8000/api/docs>.

## Architecture

```text
docker-compose.yml
├── app   FastAPI + the pre-built React bundle (one image, no Node at runtime)
└── db    Postgres 16
```

The frontend is React 18 + TypeScript + Vite + Tailwind, with TanStack Query owning all server
state and a single small Zustand store for UI-only state (theme, title language, toasts). Fonts
are self-hosted and bundled, so a running instance makes no external requests except to the
metadata providers.

Every external API call goes through `app/media_service.py` — never straight from a route handler —
so results land in the `media_cache` table and multiple users tracking the same show cost one
lookup, not one each. Each provider has its own token bucket, and a 429 or 5xx falls through to the
next provider in `PROVIDER_ORDER`.

## Licence

MIT — see [LICENSE](LICENSE).
