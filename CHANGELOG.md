# Changelog

All notable changes to AniTracker are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.5.10] — 2026-08-31

### Fixed
- **A failed request no longer answers in English, or in Java.** Every form printed
  `String(error)`, and `ApiError` sets its `name`, so a failed save put
  *"ApiError: Not Found"* in a red line under the field — a class name, followed by
  the server's `detail`, which is written in English in the Python source and stays
  English however the interface is set. The status now chooses a sentence and the
  sentence comes from the locale, in twelve places that each had their own copy of
  the mistake. A request that cannot reach the host at all says so, because on a
  self-hosted instance that usually means the container is down and the fix is
  somewhere else entirely.
- **Both dialog close buttons are localised.** `aria-label="Close"` on the modal and
  the sheet was read out in English to a German screen-reader user, on every dialog
  in the app.
- **Eight mutation toasts are localised.** "Entry added", "Profile saved",
  "Instance updated" and the rest were string literals inside the hooks that fired
  them, so the one message confirming an action was the one message still in
  English.
- **`{{count}} months ago` and `{{count}} titles you both track` had no singular.**
  Both are reachable with one — the first the moment something is thirty days old —
  and rendered "1 months ago" and, in German, the worse "vor 1 Monaten".
- **The leaderboard's metric chips no longer push the page sideways in German.**
  "Episoden · Durchschnitt · Abgeschlossen" is wider than its English equivalent
  and ran 7px past a 390px phone, taking the whole page into a horizontal scroll.
  The row scrolls on its own now, which is what the library and settings tabs
  already do with a chip row that may not fit.

### Notes
- Two files are English on purpose and say so. The demo banner is scaffolding
  around the product that Vite drops from a real instance's bundle, and
  `diagnostics.ts` builds the crash screen's technical block, which is pasted into
  a bug report — translating a stack trace's framing makes it harder to act on.
- `search.resultCount` and `shelf.count` look unpluralised in German and are not:
  *Treffer* and *Titel* are invariant, and forcing a difference would be wrong.
- `season.kind_other` is a season *kind* named "other", not a plural form. The
  collision with i18next's suffix is real and currently harmless — the key is only
  ever looked up exactly, never with a count — and is called out where it would
  otherwise look like an oversight.
- Guarded by `locales.test.ts` (key parity, no empty strings, matching
  interpolations, both plural forms, a message for every status the error mapping
  can produce) and `hardcoded.test.ts`, which fails if an accessible name, a toast
  or a raw error object is written into a component again.
- German was walked end to end at 320px, 390px and 1280px across eight routes: no
  page overflow, no clipped label, no English left in the interface.

## [2.5.9] — 2026-08-31

### Fixed
- **Text on the accent is no longer assumed to be dark.** Six components wrote
  `text-ink-950` onto an accent fill by hand — the primary button, the two
  notification badges, the filter count, the cropper's save button and a card's
  hover state. That is correct for the default gold and paints near-black text on
  a near-black button for anything else: an instance running `ACCENT_COLOR=#1a1a2e`
  had a badge count at **1.14:1**, and `#0d0c10` had one at **1:1**. The foreground
  is now derived from the accent — ink or paper, whichever can actually be read on
  it — and measures 5.34:1 on that same navy.
- **A progress bar in the light theme is visible again.** `--stamp` stayed the raw
  gold there, so a bar sat at **1.78:1** against the page and **1.47:1** against
  its own track: a graphical object conveying progress, drawn in a colour you
  cannot see. The stylesheet already knew this for *text* and darkened it; fills
  never got the same treatment. The light theme's fill is now the nearest gold
  that clears 1.4.11's 3:1.

### Added
- **The accent is validated against both themes before it is saved.** An operator
  picks a colour in whichever theme they happen to be using, and half their users
  are in the other one. The instance settings now judge it against both and warn
  when it cannot be made to work — with what is wrong, in the language they are
  reading, rather than a red border.
- **A live preview of the surfaces the accent actually lands on**, drawn twice, one
  panel per theme: a filled button, a count badge, a selected chip, a progress bar,
  an accent-coloured link and a focus ring, with the measured ratios under each.
  The field used to show a single swatch, which is the one thing about a colour
  that was never in doubt.
- **The closest safe shade, offered by name.** Lightness only and searched outward
  from where the operator put it, so the suggestion is recognisably the colour they
  asked for. When no shade of that hue passes, it says so plainly rather than
  answering with a colour nobody chose.
- **The submitted colour is kept for decoration.** `--stamp-raw` carries it
  untouched for tints, rims and borders; only the fill and its foreground are
  moved, and only as far as they have to be. When a colour is adjusted the form
  says so — that is a note, not a warning, because the colour works.

### Notes
- The focus ring is deliberately absent from all of this: it stopped being drawn
  from the accent in 2.5.7, and the preview shows it precisely so that its
  independence is visible.
- Warnings never block a save. It is the operator's instance, and a rule they
  cannot overrule is one they will work around by setting the colour in `.env`,
  where nothing checks it at all.
- The colour maths is its own module with no DOM, covered by 30 tests including a
  check that the assumed page grounds still match `tokens.css` — the verdicts are
  only honest while those are the colours actually behind the accent.

## [2.5.8] — 2026-08-31

### Accessibility
- **The pending count is announced, and it says what it counts.** The phone
  navigation's badge was `aria-hidden` with nothing else carrying the number, so a
  screen-reader user heard "Friends" whether three people were waiting on them or
  nobody was. The desktop badge was not hidden, which was wrong in its own way: it
  read out as "Friends 3" — a digit with nothing to say what it counted. The count
  now lives in the link's own accessible name: *Friends, 2 friend requests and 1
  recommendation*.
- **The two kinds are kept apart rather than summed.** A friend waiting on an
  answer is a different errand from a title someone sent you, and "3 pending items"
  hides which is which. It costs one clause to say.
- **Nothing is announced when nothing is waiting.** The name stays exactly
  "Friends" — an accessible name that grows a clause to report that nothing
  happened is worse than the plain one, and that is the state on almost every
  navigation.
- **The visual badge is now hidden from screen readers on both bars**, so the
  number is not read twice: once as a bare digit inside the link, and again in the
  name that explains it.
- **Both navigations read one source.** Each bar had its own copy of the
  `incoming + recommendations` sum. They agreed, which was luck rather than design —
  they lead to the same screen, so a disagreement would have meant one of them was
  lying about it.

### Notes
- No live region, deliberately. Changing an `aria-label` on a link nobody is
  focused on announces nothing at all, so the count can update as often as the
  queries refetch without interrupting anyone. Wrapping the badge in `aria-live`
  would have made every poll speak.
- The destination page already separates incoming requests, outgoing requests and
  the recommendation inbox into their own sections, so the count breaks down into
  the same shape the page is in.
- Verified through Chrome's accessibility tree — the string a screen reader is
  actually handed — at both 1280px and 390px, in English and German, with nothing
  pending, one kind pending, and both.

## [2.5.7] — 2026-08-31

### Accessibility
- **The focus ring no longer depends on the instance accent.** It was
  `2px solid var(--stamp)` — the colour the operator sets in `.env`. An instance
  running `ACCENT_COLOR=#1a1a2e` had a focus ring at 1.14:1 against its own page,
  and `#0d0c10` had one at exactly 1:1: invisible. The app looked perfect and was
  unusable by keyboard, and no screenshot of the default gold would have shown it.
  The indicator now has its own two tones, fixed per theme, and measures 16.55:1
  against the page in both. The accent goes back to meaning "progress".
- **Two tones, because one is never enough over artwork.** A poster is any colour
  at all, and a single ring disappears against the half of them that happen to
  match it. The ring is now paired with a halo in the opposite tone, filling the
  gap the offset leaves: where the ring sinks into the background the halo stands
  out, and the other way round. The pair is 16.55:1 against each other, so on any
  cover at all one of the two is legible.
- **Inputs answer a keyboard with more than a tinted border.** The shared input
  base carried `outline-none` alongside `focus:border-stamp`, which left a
  one-pixel colour change as the entire focus state for every text field, number
  field, select and textarea in the app — hard to see on a poor display, and
  nothing at all for anyone who cannot separate the two colours. The ring applies
  to them now, and the border tint stays as a second cue rather than the only one.
- **Rings are no longer clipped by scrolling rows.** A ring sits 4px outside its
  element, and a horizontal rail clips whatever leaves it: every poster in every
  rail had its top edge cut off flat. Rails now hold that much room inside
  themselves and are pulled back out by the same amount, so nothing on the page
  moved. `.rail` owns that spacing outright — a `pb-1.5` left in a component is a
  utility, and it beats the rule and quietly takes the room away again.
- **The segmented control shows focus at all.** Its real `<input type="radio">` is
  invisible by design and stretched across its label, so the ring was drawn around
  something with no pixels and then clipped away by the label's own truncation.
  Tabbing into the anime/manga switch produced no indicator whatsoever. The ring
  now sits on the label.

### Notes
- Everything is `:focus-visible`, so a clicked button does not wear a ring the
  person who clicked it never needed. Text fields are the exception, and that is
  the browser's own rule rather than this app's: an element expecting typed input
  always matches `:focus-visible`, however it was reached.
- `<main>` and the settings tab panel keep no ring. Both are `tabindex="-1"`
  regions that exist as a scroll destination, they are not in the tab sequence
  that WCAG 2.4.7 is about, and a ring around a full-width region reads as a
  border rather than as focus.
- Guarded by `src/styles/focus.test.ts`, which fails if the ring is pointed back
  at the accent, if a component opts out of it again, or if a padding utility
  reappears on a rail. The last of those found a sixth rail I had missed.

## [2.5.6] — 2026-08-28

### Accessibility
- **A skip link, first in the tab order on every route behind a session.** The
  header was a toll gate: five nav links, a badge, search, logout and the avatar
  menu standing in front of the page anyone actually asked for, paid again on
  every navigation by whoever cannot skip it by looking. The first Tab now reveals
  "Skip to main content", and activating it puts focus on `<main>`.
- **Focus follows a navigation.** A skip link only helps on the tab pass that
  starts at the top of the document. Follow a nav link and focus stays on the link
  that was pressed, with the rest of the header still ahead of the content and the
  skip link now *behind* focus — measured at eight tab stops between the "Journal"
  link and the first control on the journal page. The shell now hands focus to the
  new page itself. Two cases are deliberately left alone: the first render, or a
  fresh load would land past the skip link before anyone could reach it, and a
  `REPLACE` navigation, which is a page rewriting its own address rather than
  going somewhere new — switching season on a title does exactly that, and moving
  focus would take the keyboard out of the switcher still under the user's hand.
- The link is invisible until focused and drawn against both themes: surface on
  ground in dark, white on paper in light, with the instance accent as its ring.

### Notes
- `/search` is the one route where the first Tab does not reveal the link, because
  the page autofocuses its search field — which is *inside* the main content, so
  the header is bypassed there anyway and by a shorter road. The link is still in
  the DOM and still reachable backwards. Deleting the autofocus to make the rule
  uniform would have made that page worse for the same people.
- The focus target is `<main>`, and its own focus ring is suppressed: the region
  runs the full width of the viewport, so the ring draws as two gold rules across
  the page with its side edges off-screen, reading as decoration rather than as
  focus. WCAG 2.4.7 covers what a Tab can stop on, and `tabindex="-1"` is the
  opposite of that. Everything in the tab sequence keeps its ring.

## [2.5.5] — 2026-08-26

### Fixed
- **A title page survives a reload again.** Opening `/media/anilist/21` directly —
  a refresh, a bookmark, a link someone sent you — answered with
  `{"detail":"Not Found"}` instead of the app. The SPA fallback excluded the whole
  of `/media`, which was written for the avatar files served at `/media/avatars/…`
  but also happens to be the client's own route for a title. The exclusion now
  names the avatar directory it always meant, and matches on path segments rather
  than on letters, so a provider whose name merely starts with `avatars` is still
  a title. Broken since 2026-08-18 and shipped in every release from 2.0.1 on.
- **The decision is now reachable from a test.** The fallback is registered inside
  `if STATIC_DIR.is_dir()`, and `app/static` exists only inside the built image —
  so from a source checkout the whole block is skipped and nothing a test could
  send would ever hit it. That is why this went out eight days ago untested. The
  routing rule is its own function now, with `tests/test_spa_routing.py` covering
  every client route and every path that must keep reading as a miss: the API, the
  hashed bundle, and an avatar that does not exist.

## [2.5.4] — 2026-08-26

### Changed
- **Deleting something now says what it is deleting.** Every destructive action goes
  through one dialog, and that dialog has to name the object: "Remove Frieren:
  Beyond Journey's End from your library?", not "Remove this title from your list?".
  Under it sits a short list of what actually goes — your progress, score and notes,
  every journal entry you wrote about that title, and its place on any shelf — because
  the thing being deleted is usually something someone spent months on, and the old
  wording did not mention the journal at all.
- **`window.confirm` is gone from the app.** It could not be made to do this job: the
  browser's dialog cannot name the title, cannot list what goes with it, cannot be
  styled to match anything around it, and puts "OK" — a word that describes nothing —
  under the pointer. A source-scan test now fails the build if a `confirm()` or an
  `alert()` reappears anywhere in `src`, the same way one already guards the
  built-in-brand rule.
- **Cancel is what the dialog opens on.** Focus lands on the way out rather than on the
  deletion, so a reflexive Return closes the dialog instead of confirming it.
- **The destructive button cannot be pressed twice.** It latches on the first press
  rather than waiting for the request to report itself in flight — the gap between
  those two moments is at least one render, which is exactly long enough for a
  double-click to send the same delete twice. It names what it is doing while it
  works ("Removing…"), and a failed attempt unlocks so it can be tried again.
- **Removing a friend and deleting a journal entry now ask first.** Both fired straight
  off the button. Unfriending is silently mutual, and a journal note is the one thing
  in the app with no copy anywhere else.
- **Deleting somebody else's account asks for their username back.** An admin deleting
  a user destroys a person's whole library — years of someone else's records, by a hand
  that is not theirs and with nothing that can undo it. It is the only action in the app
  that asks for typing, deliberately: making a routine removal cost a typing exercise
  only teaches people to type without reading.
- The four hand-rolled confirmation dialogs and the settings-only `ConfirmDialog` were
  replaced by the shared one, so the wording, the focus behaviour and the pending state
  cannot drift apart again.

### Notes
- The consequence lists are claims about what the database actually cascades, and the
  two that matter are already pinned by `test_deleting_an_entry_takes_it_off_every_shelf`
  and `test_deleting_a_title_takes_its_journal_with_it`. If a migration ever changes what
  a delete reaches, those fail before the copy quietly becomes a lie.
- Withdrawing a friend request, declining one, and removing your own avatar still act
  immediately. Nothing is destroyed by any of them, and a modal there is friction
  without a purpose.

## [2.5.3] — 2026-08-26

### Added
- **A rendering error no longer takes the whole page with it.** React's answer to
  an exception thrown while drawing is to unmount the entire tree: not a broken
  panel on a working page, but an empty document with nothing in it and nothing
  saying why. On a self-hosted instance that is indistinguishable from a container
  that died, which sends someone to `docker logs` for a fault that only ever
  happened in the browser. The app is now wrapped in an error boundary above every
  provider, so a crash lands on a screen that explains itself and offers a way out.
- **Two ways back.** "Try again" rebuilds the interface from scratch and empties
  the query cache on the way — the likeliest cause of a render crash is a component
  meeting a payload it did not expect, and retrying against the same cached copy of
  it would only fail in the same place. "Return to dashboard" is a full load of the
  home route, which drops every piece of state the crash happened in.
- **A technical reference that is safe to send.** The screen carries a collapsed
  block with the version, the moment, the route, the browser, the stack and the
  React component stack — enough to act on a bug report from someone who cannot
  reproduce it on demand, without asking anyone to open the developer console.
  What is shown is exactly what the copy button copies; there is no fuller version
  travelling to the clipboard that nobody has read. The button is left out entirely
  where the Clipboard API does not exist, which is any instance reached over plain
  `http` — the trace is still there to select, and a button that silently does
  nothing is worse than no button.
- **Nothing private goes with it.** Query strings, session tokens, `Authorization`
  headers, anything naming itself a password or a key, email addresses and unnamed
  opaque blobs are stripped from the report before it is shown. The rules are
  deliberately narrow in the other direction too: file paths, frame positions and
  ordinary error messages survive intact, because a report whose stack is entirely
  `[redacted]` cannot be acted on. Seventeen tests pin both halves.

### Accessibility
- **The failure is announced.** The heading and the explanation sit in an alert
  region, so a screen reader says what happened when the screen replaces the app
  rather than leaving someone on a page that silently changed underneath them. The
  stack trace is deliberately outside that region — an alert is read out whole, and
  a recited stack trace is not an announcement.

### Known limits
- The boundary catches what React can catch: a throw during render, in a lifecycle,
  or in a constructor. An event handler that throws and a rejected promise never
  reach a boundary in any React version, and this one does not pretend otherwise.
- One broken component still replaces the whole screen. Per-route boundaries would
  buy that back and can be added without changing anything here.

## [2.5.2] — 2026-08-26

### Changed
- **The app says it is starting instead of showing nothing.** While the instance
  and the current user are being fetched — the two answers that decide which
  route can be drawn at all — the router used to return an empty full-height
  div. Against a local server that is a flicker; on a NAS, a Raspberry Pi, a
  database still waking up or a phone on bad signal it is several seconds of
  blank page, which is indistinguishable from a broken deployment and is exactly
  when someone starts restarting healthy containers. There is now a startup
  screen: the instance's mark, a thin indeterminate rule, and a line naming what
  is being loaded. Nothing about it blocks — the moment the answers land, the
  real route replaces it.
- **The startup screen knows which instance it belongs to.** It is drawn before
  `/instance` answers, so it has nothing to go on — it now reuses the name, logo
  and accent colour the last successful load saw, kept in `localStorage`. An
  instance called something other than AniTracker no longer spends its slowest
  seconds wearing the built-in brand, and one with its own accent never shows a
  frame of the default gold before switching: the colour is applied before the
  first paint, not after it. A browser that has never loaded the app, or one that
  refuses storage, falls back to the bundled artwork as before.
- **The served accent is the authority in both directions.** Applying it was a
  one-way `setProperty`, which was harmless while nothing set the colour before
  the response arrived. Now that the startup screen does, an instance whose
  accent resolves to empty — `ACCENT_COLOR=` with no value in `.env` — would
  have kept wearing the remembered colour for the rest of the session. An empty
  value now clears the override instead of being ignored.

### Accessibility
- **Loading is announced, once.** The startup screen carries a single polite
  live region holding one sentence at a time: `Loading <instance name>`, replaced
  after eight seconds by "This is taking longer than expected." — so a delayed
  request reads as a slow server rather than a crash. Both messages are visible
  text as well, and the indicator stops moving under `prefers-reduced-motion`
  while still reading as a bar.

## [2.5.1] — 2026-08-26

### Fixed
- **Release images build again.** The frontend stage was being run under QEMU for
  the arm64 half of the multi-arch build, emulating an `npm ci` that produces
  static JavaScript and CSS — output with no architecture at all. It turned the
  2.1.1 release build into a six-hour job that was cancelled without publishing
  anything. The stage is now pinned to `$BUILDPLATFORM`, so it runs natively once
  and its output is copied into both images.

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

[Unreleased]: https://github.com/RGBond007/anitracker/compare/v2.5.10...HEAD
[2.5.10]: https://github.com/RGBond007/anitracker/compare/v2.5.9...v2.5.10
[2.5.9]: https://github.com/RGBond007/anitracker/compare/v2.5.8...v2.5.9
[2.5.8]: https://github.com/RGBond007/anitracker/compare/v2.5.7...v2.5.8
[2.5.7]: https://github.com/RGBond007/anitracker/compare/v2.5.6...v2.5.7
[2.5.6]: https://github.com/RGBond007/anitracker/compare/v2.5.5...v2.5.6
[2.5.5]: https://github.com/RGBond007/anitracker/compare/v2.5.4...v2.5.5
[2.5.4]: https://github.com/RGBond007/anitracker/compare/v2.5.3...v2.5.4
[2.5.3]: https://github.com/RGBond007/anitracker/compare/v2.5.2...v2.5.3
[2.5.2]: https://github.com/RGBond007/anitracker/compare/v2.5.1...v2.5.2
[2.5.1]: https://github.com/RGBond007/anitracker/compare/v2.5.0...v2.5.1
[2.5.0]: https://github.com/RGBond007/anitracker/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/RGBond007/anitracker/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/RGBond007/anitracker/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/RGBond007/anitracker/compare/v2.1.1...v2.2.0
[2.1.1]: https://github.com/RGBond007/anitracker/compare/v2.0.1...v2.1.1
[2.0.1]: https://github.com/RGBond007/anitracker/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/RGBond007/anitracker/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/RGBond007/anitracker/releases/tag/v1.0.0
