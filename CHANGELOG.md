# Changelog

All notable changes to AniTrack are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-08-10

First release.

### Added
- **Admin-editable instance settings** — instance name, logo, accent colour and the
  registration toggle are now changeable from Settings as well as `.env`. A cleared field
  falls back to the environment value, so operators and admins do not fight over it.
- **Tracking** — anime and manga lists with five statuses (watching/reading, completed, on hold,
  dropped, plan to watch/read), 0–10 score, progress, start/finish dates, rewatch count and notes.
  Progress is clamped to the episode/chapter total, and finishing the last one completes the entry.
- **Metadata providers** — AniList (primary), with Jikan and Kitsu as fallbacks behind a common
  `MediaProvider` interface. Per-provider token buckets, and automatic fall-through on 429/5xx.
- **Caching** — metadata is stored in `media_cache` for 7 days (`MEDIA_CACHE_TTL_DAYS`) and shared
  across users, so one show costs one lookup no matter how many people track it. Search results are
  cached in-process for 10 minutes. Provider outages serve stale data rather than failing.
- **Dashboard** — in-progress titles, counts per status, mean score, episodes watched and a
  days-watched estimate.
- **Multi-user auth** — local email/password with Argon2 hashing, JWT access and refresh tokens in
  httpOnly cookies, admin/user roles, and `ALLOW_SIGNUP` to close registration. Changing a password
  revokes every other session.
- **First-run setup wizard** — creates the admin account and picks the default title language.
- **MyAnimeList import** — accepts `.xml` and `.xml.gz` exports, resolves MAL ids to full metadata,
  and runs in the background with live progress. Already-tracked titles are skipped, so re-running
  an import is safe.
- **UI** — a panel-grid interface built on the manga vocabulary of panels, gutters and
  screentone: visible gutter borders instead of shadows, an uneven hero row that breaks the
  grid the way a manga page varies panel size, and a halftone dot overlay that doubles as the
  progress indicator on card hover. Dark by default; light mode re-roles the same six palette
  tokens into paper-and-ink. Flat skeleton blocks, no shimmer. English and German translations.
- **Per-user title language** — Romaji, English or Native, independent of interface language.
- **White-labelling** — instance name, logo and accent colour via environment variables.
- **Packaging** — two-service `docker-compose.yml`, multi-stage build with the React bundle served
  by the backend (no Node at runtime), migrations applied automatically on container start.

### Notes
- No telemetry. The only outbound requests are to the metadata providers in `PROVIDER_ORDER`.
- `LICENSE_KEY` is accepted and validated by a no-op stub; it gates nothing in this release.
- Title languages are limited to Romaji/English/Native — the free public APIs do not expose
  German, French or Italian titles. The `title_overrides` table ships now so per-locale overrides
  can be added without a schema migration.
