# Changelog

All notable changes to AniTracker are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.1] — 2026-08-24

Adds profile pictures, friend recommendations and genre-aware search, and ships
prebuilt container images so installing no longer means compiling on the target
machine.

> **Upgrading from 2.0.0 runs one migration (`0008`).** It adds a single nullable
> column, `users.avatar_filename`. No backfill, no account changes behaviour, and
> the downgrade drops the column while deliberately leaving uploaded files on disk.

### Added
- **Profile pictures.** `PUT /api/me/avatar` and `DELETE /api/me/avatar`. Uploads
  are decoded to check what a file *is* rather than what it is named, re-encoded to
  one 512×512 square with metadata stripped, and served off disk. Accounts without
  one keep the initials fallback. Tunable with `MEDIA_ROOT`, `MAX_AVATAR_BYTES` and
  `AVATAR_PIXELS`; the compose file backs the directory with a named volume so
  uploads survive `up -d --build`.
- **Recommendations and friend activity.** `GET /api/recommendations` and
  `GET /api/friends/watching`, surfaced on a discovery page — what friends are
  watching now, and titles they rate that are not yet in your library.
- **Genre-aware search.** Genres are repeatable (`?genre=Action&genre=Drama` means
  both) and a genre alone is a valid search, so picking one with an empty box
  browses it instead of being a dead end. Providers that can filter at the source
  do; results are filtered again locally, so a provider that ignores the hint costs
  precision, never correctness.
- **Settings split** into About, Appearance, Instance, Profile, Security and Users,
  replacing the single page.
- **Container images**, published to GHCR and GitLab's registry on each version tag
  as `{version}`, `{major}.{minor}` and `latest`, built for **linux/amd64 and
  linux/arm64** so ARM boards and ARM NAS units are covered:
  ```
  docker pull ghcr.io/rgbond007/anitracker:2.0.1
  ```
- A link to the browser-local demo from the README.

### Changed
- **`GET /api/instance` reports `license` instead of `license_tier`.** The field
  carries the licence itself (`AGPL-3.0-only`) rather than a tier name. The bundled
  frontend is the only consumer and ships in the same image, so an upgrade needs no
  action — but a script reading `license_tier` must be updated.
- Documentation, issue-template contact links and the in-app About links point at
  `github.com/RGBond007/anitracker`; the repository was renamed and the old URLs had
  been resolving only through GitHub's rename redirect.

### Removed
- The licence-key stub: `LICENSE_KEY`, the `app/license.py` validator, and the
  feature list naming `multi_user`, `import` and `share_links` as gateable. Nothing
  gated anything, and AniTracker is AGPL-3.0-only with no paid tier — the machinery
  only implied otherwise. `LICENSE_KEY` in an existing `.env` is now ignored and can
  be deleted.

### Notes
- Versioned as a patch. The functionality above is backward-compatible and would
  ordinarily warrant a minor release; the number understates it.

## [2.0.0] — 2026-08-17

### Added
- Contributor documentation, issue forms, pull-request guidance, a security policy, project
  governance, and a documented release process.
- **Seasons** — a title's page lists every season of its show, each with its own poster, episode
  count, progress and status, and moving between them changes the artwork and the numbers without a
  reload. The season you are on drives the poster and progress shown in the library and on the
  dashboard.
- **Viewing a season is separate from watching it.** Opening a season shows its details and nothing
  more; the season you are on changes only through **Set as current season** or **Start season N**.
  So you can read season 1's synopsis, or look at a movie, without losing your place.
- **Finishing a season offers to continue.** Watch the last episode and a panel offers to mark the
  season completed and start the next one, as a single change. It never moves you on by itself, and
  "Not now" is remembered.
- **Movies, OVAs, specials and sequel parts** are grouped under their series and ordered by release
  date, so a movie sits between the seasons it shipped between. Only seasons are numbered.
- **Six per-season states** — watching, completed, on hold, dropped, plan to watch, and *Not
  started* for a season you have never opened.
- **A compact season selector beside the title on phones**, so choosing a season no longer means
  scrolling past the whole synopsis. The poster carousel stays below for browsing.
- **Search groups a show into one card** and lets you choose which season or related entry to add,
  instead of returning six rows of the same series.

### Changed
- The public product name is now consistently **AniTracker**. Compatibility-sensitive internal
  identifiers such as database names, storage keys, and cookies remain unchanged.
- The project is now licensed under the GNU Affero General Public License v3.0 only
  (`AGPL-3.0-only`). Version 1.0.0 remains available under its original MIT license.
- The current season is marked with a "Watching now" label and a filled dot, and the season being
  viewed with an outline — two signals that do not depend on the accent colour alone.
- Changing the displayed season fades the poster and details in over 180ms instead of swapping them,
  and no longer raises a toast over the season carousel.
- The detail page's cover is capped on phones, so the title, progress and season selector fit on the
  first screen.

### Fixed
- Caching a title no longer fails when two writers reach the same show at once — resolving a
  season chain in the background overlaps with the request that started it, and the second
  insert used to hit the unique constraint.
- A movie or OVA added before the rest of its series no longer resolves into a series of one and stay
  stuck there; it now finds its parent series and joins it.
- The detail page no longer overflows horizontally on a phone, which made mobile browsers zoom the
  whole page out to fit.
- The English locale carried German strings for the season labels.

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

[Unreleased]: https://github.com/RGBond007/anitracker/compare/v2.0.1...HEAD
[2.0.1]: https://github.com/RGBond007/anitracker/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/RGBond007/anitracker/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/RGBond007/anitracker/releases/tag/v1.0.0
