# Changelog

All notable changes to AniTracker are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.5.0] — 2026-08-26

A journal: what you thought, episode by episode.

> **Upgrading from 2.4.0 runs one migration (`0015`).** One new table. Nothing
> existing is touched, and `list_entries.notes` in particular is left alone.

### Added
- **A note about one episode**, with an optional mood from a fixed set, a favourite
  marker and a spoiler flag. Everything but the episode number is optional — a mood
  on its own is a real entry, and so is a star with nothing written.
- **A timeline** at `/journal`, newest first and grouped by day, filterable to
  favourites. The notes are worth keeping because they are worth rereading, and one
  you can only find by opening the title it belongs to is not really findable.
- **A rewatch writes a new memory rather than editing the old one.** Rows are keyed
  by which pass you are on, so watching episode 7 again sits beside what you thought
  the first time. The pass comes from the entry's own rewatch count, not from the
  client, so a request cannot aim at an older pass and overwrite it.
- A note you flagged stays covered when you reread your own journal later.

### Security
- **Private, with no way to share it.** No visibility column, and no endpoint that
  returns a journal entry to anyone but its author — being someone's friend opens
  their list, not their diary. That is a decision rather than an omission: this is
  not a review platform, and the surest way to keep it from becoming one is to give
  the data nowhere else to go.

### Unchanged
- `list_entries.notes` is untouched. A scratchpad for a whole title and a series of
  dated moments answer different questions, and neither overwrites the other.

## [2.4.0] — 2026-08-26

Holds back what you have not reached yet, and decides what that is from your own
progress rather than from labels.

> **Upgrading from 2.3.0 runs two migrations (`0013`, `0014`).** Both add columns
> with defaults; nothing is backfilled. **Spoiler protection defaults to on**, which
> does change behaviour for existing accounts: seasons past the one you are on ask
> before opening, and a friend's message can arrive covered. It is one switch in
> Settings — protection nobody wanted costs a tap to undo, protection somebody
> wanted but did not get costs them the story.

### Added
- **A global spoiler-protection preference**, in Settings. Not visible to anyone
  else: it is a setting about the reader, not a fact about them.
- **Per-episode titles**, from AniList where a streaming site supplied them. They
  arrive partial and out of order, so each is indexed by the number inside its own
  title and anything unparseable is dropped — a title against the wrong episode is
  worse than none. Jikan and Kitsu return none, and empty is the ordinary answer.
- **An episode list** on a title's page, with everything past your progress covered.
- **A warning before opening a season you have not reached**, decided by whether the
  season before it is finished. Not owning an earlier season counts as unfinished.
- **Recommendation messages can be marked as giving something away** — and the label
  alone is never trusted. The server computes whether the sender is further into the
  title than the reader, so a sincere "no spoilers" from someone four episodes ahead
  still arrives covered.
- **Friend notes are visible again, covered when their author is ahead of you.**
  Accepted friends only — making a list public does not publish its notes.
- Revealing anything protected is always an explicit act, through one control.

### Security
- Notes reach accepted friends only, never a stranger browsing a public profile.
  Every social surface now goes through a single function that decides this, so
  there is one place to get it right rather than four.

## [2.3.0] — 2026-08-26

Watching one show with a few friends, at roughly the same pace.

> **Upgrading from 2.2.0 runs one migration (`0012`).** Two new tables, nothing
> existing touched, and no account behaves differently until somebody starts a group.

### Added
- **Watch-together groups.** Mark a title, invite friends, and see where everyone is
  with it. Coordination only — nothing streams, syncs or plays, and the app never
  learns whether a session happened.
- **Progress is not stored in the group.** Each member's position is read from their
  own list at request time, so the group cannot drift out of step with the library
  and leaving takes nothing with it.
- **A spoiler check beside the button that matters.** Logging the next episode shows
  who it would leave behind, by name: "Watching episode 19 puts you ahead of Mika."
  It reports and never blocks.
- An optional target episode for the next session, changeable by any joined member.
- Leaving, and closing. The owner leaving closes the group rather than orphaning it.

### Security
- A group's roster and everyone's episode are visible to its members and to nobody
  else. A friend outside the group, an invitee who has not accepted, and someone who
  left all get a 404 — the roster of a private group is itself private. An invitation
  is not consent to publish your position, so `progress` stays null until you join.

## [2.2.0] — 2026-08-26

Answers "what should I watch tonight?" from your own library.

### Added
- **A queue for one evening.** Say how long you have (25, 50 or 90 minutes), whether
  to carry on with something or start fresh, anime or manga, a mood, and whether you
  are watching alone — and get three titles back, each with the reason it was chosen.
  Fit is real arithmetic against episode duration, so a 110-minute film honestly does
  not fit a 90-minute evening and is left out. Manga carries no duration, so time maps
  to an approximate chapter count and says "about".
- Finishing something tonight outranks everything else, and "with friends" is a
  preference that floats titles up rather than a filter that hides the rest.
- The three picks are replaceable, dismissable and reorderable; replacing pulls the
  next-best candidate off the same ranking rather than reshuffling.

## [2.1.1] — 2026-08-25

Adds shelves, discovery and direct recommendations between friends, and closes a
privacy hole in the existing social surfaces.

> **2.1.0 was tagged from an incomplete commit and never released.** Its tag and
> the images built from it contain only the progress-ledger work and report their
> version as 2.0.1. Nothing was published under it; 2.1.1 is the first release of
> everything below. If you pulled `2.1.0` or `latest` on 2026-08-25, upgrade.

> **Upgrading from 2.0.1 runs three migrations (`0009`, `0010`, `0011`).** All three
> only add tables and one column; nothing existing is altered or backfilled, and no
> account changes behaviour until someone uses the new features. Shelf sharing
> defaults to off for every existing shelf.

### Security
- **Private notes no longer reach other people.** The friend feed, profiles, score
  comparisons and "friends watching" all sent the full entry, including its `notes` —
  the one field on an entry that is working text and can spoil a story. Every social
  surface now sends a `PublicEntryOut` that has no `notes` field at all, so a future
  surface cannot reintroduce the leak by forgetting. Covered by `tests/test_privacy.py`.

### Added
- **Shelves.** Named, ordered collections that sit alongside the status lists and are
  deliberately independent of them: a title finished two years ago can still live on
  "Comfort shows". A shelf is a name, an optional description and an ordered set of
  entries. No shelves are seeded — "Favorites" and the rest are names the client
  offers when you create one, never rows written into an account. `GET/POST /api/shelves`,
  `PATCH/DELETE /api/shelves/{id}`, `POST/DELETE /api/shelves/{id}/items`, and
  `PUT /api/shelves/{id}/order`, which takes the whole running order.
- **Discovery.** Six rows in the search idle state, each a rule over your own library
  and each carrying the reason it surfaced: something on hold, a title sharing genres
  with one you rated 9+, a complete story under thirteen episodes, a short show already
  on your list, a genre you rarely watch, and something untouched for months. Nothing
  is predicted or blended. Suggestions are dismissible and stay dismissed.
- **Recommendations between friends.** Hand a tracked or untracked title to one or
  more friends with an optional 280-character message. The recipient can view, dismiss,
  or add it — adding lands in "Plan to watch" after a confirmation and never marks
  anything as watched. Duplicate pending recommendations are skipped rather than
  refused, so sending to five friends still reaches the four who do not have it.
  Provider ids are resolved server-side before a row is written.
- **Small social moments.** Which friends have a title, with their status, score and
  the difference against yours; five fixed completion reactions with no free text, no
  counts and no ranking; and shelves an owner has explicitly chosen to show on their
  profile.
- **The progress ledger.** A season is drawn as one notch per episode rather than a
  percentage bar, so logging one episode fills a whole cell. Milestones — first
  episode, halfway, a cour done, finale next — are read off the count and stated in a
  line, never stored.
- **A frontend test runner.** `npm test` in `frontend/`, running in CI on both hosts.

### Fixed
- **The header logo disappeared on instances named "AniTrack".** The header and the
  login screen each carried their own copy of the built-in-brand rule and the header's
  compared the same string twice, so one screen showed the logo and the other a blank
  square. Both now call `usesBuiltInBrand` from `frontend/src/lib/brand.ts`, and a
  test fails if any component re-implements the comparison inline.
- **A custom logo that fails to load falls back to the bundled icon** instead of
  leaving an empty space in the header.
- **Gold text is legible in light mode.** `--stamp-text` was 1.7:1 against paper,
  which was survivable while every use was a hover state and is not once a label
  simply sits there.
- **The test harness enforces foreign keys.** SQLite ignores them unless asked, so
  every `ondelete=CASCADE` in the models silently did nothing under pytest while
  Postgres enforced them in production.

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

[Unreleased]: https://github.com/RGBond007/anitracker/compare/v2.5.0...HEAD
[2.5.0]: https://github.com/RGBond007/anitracker/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/RGBond007/anitracker/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/RGBond007/anitracker/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/RGBond007/anitracker/compare/v2.1.1...v2.2.0
[2.1.1]: https://github.com/RGBond007/anitracker/compare/v2.0.1...v2.1.1
[2.0.1]: https://github.com/RGBond007/anitracker/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/RGBond007/anitracker/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/RGBond007/anitracker/releases/tag/v1.0.0
