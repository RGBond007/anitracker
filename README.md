<div align="center">

<img src=".github/assets/AniTracker-GitHub-banner.svg" alt="AniTracker" width="100%">

[![CI](https://github.com/RGBond007/anitrack/actions/workflows/ci.yml/badge.svg)](https://github.com/RGBond007/anitrack/actions/workflows/ci.yml)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
![Deploy: Docker Compose](https://img.shields.io/badge/deploy-docker%20compose-2496ED?logo=docker&logoColor=white)
![Backend: FastAPI + Postgres](https://img.shields.io/badge/backend-FastAPI%20%2B%20Postgres-009688?logo=fastapi&logoColor=white)
![Frontend: React 18 + TypeScript](https://img.shields.io/badge/frontend-React%2018%20%2B%20TS-61DAFB?logo=react&logoColor=black)
![Telemetry: none](https://img.shields.io/badge/telemetry-none-2ea44f)

**A private, self-hosted anime and manga tracker for households and small communities.**

[Features](#features) · [Quick start](#quick-start) · [Screenshots](#screenshots) · [Configuration](#configuration) · [Development](#development) · [License](#license)

<img src="frontend/screenshots/dashboard.png" alt="AniTrack dashboard: a Vinland Saga hero with continue-watching progress, tracking figures and a rail of titles in progress" width="100%">

</div>

---

## Quick start

Run AniTrack with two containers. No third-party account or API key is required.

```bash
git clone https://github.com/RGBond007/anitrack.git
cd anitrack
cp .env.example .env
sed -i '' "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env   # Linux: drop the ''
docker compose up -d --build
```

Then open <http://localhost:8000> and the first-run wizard creates your admin account.

> [!TIP]
> For production deployment, HTTPS setup, backups, restores, and upgrades, see the
> [installation guide](INSTALL.md).

---

## Screenshots

### Seasons

A show is one entry in your library, not one per season — and browsing a season is not the same
thing as watching it. Every season, movie, OVA and special is grouped under the series in release
order, each with its own poster, episode count, progress and status. Tapping one shows it. Only an
explicit action moves the season you are **currently watching**, so you can read season 1's synopsis
without losing your place in season 6.

<table>
<tr>
<td width="50%"><img src="frontend/screenshots/seasons.png" alt="Attack on Titan on season 3: the season 3 poster, 7 of 12 episodes watched, and a carousel of seasons, movies and OVAs in release order with season 3 marked Watching now"></td>
<td width="50%"><img src="frontend/screenshots/seasons-viewing.png" alt="The same series showing season 1's poster and synopsis, with a Set as current season button and a note reading You're on Season 3"></td>
</tr>
<tr>
<td align="center"><em>On season 3 — the current season, marked <strong>Watching now</strong></em></td>
<td align="center"><em>Looking at season 1: its poster and progress, and you are still on season 3</em></td>
</tr>
</table>

When you finish a season, AniTrack offers to close it out and continue — it never moves you on its
own. In search, a show collapses to one card, and you choose which season or related entry to add.

<table>
<tr>
<td width="50%"><img src="frontend/screenshots/seasons-continue.png" alt="A panel reading You finished Season 1, Mark it completed and continue with Season 2, with Start Season 2 and Not now buttons"></td>
<td width="50%"><img src="frontend/screenshots/search-chooser.png" alt="A dialog listing Attack on Titan's seasons with format, year and episode count, each with an Add button or an On your list label"></td>
</tr>
<tr>
<td align="center"><em>Offered, not applied</em></td>
<td align="center"><em>One card per show; pick what you actually want</em></td>
</tr>
</table>

### Library, search, light mode

<table>
<tr>
<td width="50%"><img src="frontend/screenshots/library.png" alt="Library grid filtered to Watching, one card per show, the Attack on Titan card badged Season 3"></td>
<td width="50%"><img src="frontend/screenshots/search.png" alt="Search results for frieren showing six matching titles with covers, format and year"></td>
</tr>
<tr>
<td align="center"><em>One card per show, following the season you're on</em></td>
<td align="center"><em>Search across AniList, Jikan and Kitsu</em></td>
</tr>
</table>

<table>
<tr>
<td width="60%"><img src="frontend/screenshots/seasons-light.png" alt="The same series page in light mode: paper ground, ink text, the viewed season outlined in ink and the current season labelled Watching now in gold"></td>
<td width="20%"><img src="frontend/screenshots/mobile-seasons.png" alt="A phone showing the poster, progress, title and a compact scrolling row of season chips, all on the first screen"></td>
<td width="20%"><img src="frontend/screenshots/mobile-library.png" alt="Library grid on a phone with a bottom navigation bar"></td>
</tr>
<tr>
<td align="center"><em>Light mode — the same six palette tokens, re-roled</em></td>
<td colspan="2" align="center"><em>Compact season chips on a phone, no scrolling past the synopsis</em></td>
</tr>
</table>

---

## Features

- **Search anime & manga** through AniList, with Jikan (MyAnimeList) and Kitsu as automatic
  fallbacks when a provider rate-limits you. No account or API key with any of them.
- **Seasons, grouped and deliberate.** AniTrack walks the provider's relation graph and folds a
  show's seasons, sequel parts, movies, OVAs and specials into one library card, ordered by release
  date. Each of them keeps its own poster, episode count, progress and status — including *Not
  started* for what you have never opened. Browsing a season shows it; only an explicit
  **Set as current season** moves the season you are watching, and the card in your library follows
  that one. Finish a season and AniTrack offers to close it out and continue, rather than moving you
  on by itself.
- **Five list statuses** — watching/reading, completed, on hold, dropped, plan to watch/read —
  with score (0–10), progress, start/finish dates, rewatch count and notes.
- **A dashboard** with what you're partway through, plus counts per status, mean score,
  episodes watched and a days-watched estimate.
- **An airing schedule** for the week, flagging the shows you've fallen behind on.
- **Friends, if you want them** — friend requests, a feed of what they've been watching, a
  side-by-side score comparison and a household leaderboard. Lists are private to accepted friends
  until you opt into a public profile.
- **Cover art, synopses and titles cached locally** for 7 days, so browsing your list never
  touches an external API.
- **Title language per user** — Romaji, English or Native — independent of the interface language.
- **Multi-user** with local email/password accounts and admin/user roles. Admins can invite people
  with a one-time password, and registration can be closed once everyone has signed up.
- **MyAnimeList import** — drop in your MAL XML export and it resolves every title, keeping your
  scores, progress, dates and comments.
- **English and German UI**, dark theme by default, light mode per user.
- **Installable** — a web manifest and icons, so it can live on a phone home screen.
- **White-labelling from the Settings page** — instance name, logo and accent colour, no redeploy.

## Project scope

AniTrack is a tracker, not a media server: it does not stream, torrent, or download media. Social
features are limited to accepted friends, with no public timeline, followers, or comment threads.
There is no native mobile app; the responsive web app is installable as a PWA. AniTrack includes no
telemetry, and its only outbound requests are to the metadata providers configured in `.env`.

---

## Requirements

- Docker Engine with Compose v2
- Approximately 700 MB of image storage (300 MB application, 400 MB PostgreSQL)
- Approximately 110 MB of memory at idle

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
| `POSTGRES_PASSWORD` | `anitrack` | Change it before this leaves your LAN. |
| `RATE_LIMIT_ENABLED` | `true` | Caps repeated hits on login, registration, search and friend requests. |
| `TRUST_PROXY` | `false` | Only `true` behind a proxy you control — it makes rate limits trust `X-Forwarded-For`. |
| `INSTANCE_NAME` | `AniTrack` | Name in the header, tab title and wizard. Also editable in Settings. |
| `ACCENT_COLOR` | `#C9A227` | Stamp accent: buttons, focus rings, progress. Also editable in Settings. |
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

`docker-compose.yml` builds from this checkout rather than pulling a published image, so an upgrade
is a pull and a rebuild:

```bash
git pull && docker compose up -d --build
```

Migrations run automatically at startup. Your data lives in the named `anitrack-db` volume and
survives image replacement — see [INSTALL.md](INSTALL.md) for backups and rollbacks.

---

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
`backend/tests/fixtures/` and an in-memory SQLite database, so `pytest` needs no services:

```bash
cd backend && .venv/bin/pytest          # suite
cd backend && .venv/bin/ruff check .    # lint, as CI runs it
cd frontend && npm run lint             # tsc --noEmit
```

`.github/workflows/ci.yml` runs those three plus a Docker image build on every push and pull
request. API docs are generated at <http://localhost:8000/api/docs>.

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

Seasons are derived, not typed in. A provider only reports a title's immediate neighbours, so
`app/season_chain.py` walks back to season one and forward again to number the spine, then pulls in
the movies, OVAs and specials hanging off it — grouped under the same `root_provider_id` but left
without a `season_number`, because a movie between seasons 2 and 3 is not season 2.5. The series page
orders the result by `start_date`. That walk costs a provider call per title not yet cached, so it
runs in the background after a title is added rather than making you wait, and it is capped.

Two pieces of state are deliberately kept apart. The **viewed** season is the URL: opening a season
is a read, and nothing is written. The **current** season is a row of your own in
`franchise_selections`, keyed by the series rather than by a title, so it survives a status change
and is only ever written by `PUT /api/series/{root}/season` — which the client calls when the user
presses a button and at no other time. That endpoint also carries the optional `start` and
`complete_provider_id` flags, so "you finished season 3, start season 4?" applies as one transaction
instead of an add and a select that could half-succeed.

## Contributing

Issues and pull requests are welcome. Keep `ruff check`, `pytest` and `npm run lint` green, add a
test for behaviour you change, and put user-visible changes in [CHANGELOG.md](CHANGELOG.md).

## License

AniTrack is licensed under the [GNU Affero General Public License v3.0 only](LICENSE)
(`AGPL-3.0-only`). If you modify AniTrack and make it available to users over a network, the
license requires you to offer those users the corresponding source code for your modified version.
