import type { Entry } from "../../lib/api-client";

/**
 * Something to watch, argued for from the library rather than predicted.
 *
 * Every rule here is one sentence of arithmetic over entries the app already has,
 * and every pick carries the reason it surfaced. That is the constraint the whole
 * file is built around: if a rule cannot say *why* in a line the reader would
 * accept, it does not belong here. Nothing is scored, weighted or blended --
 * a blended score is exactly the thing that cannot explain itself.
 *
 * All of it draws on titles the user already owns. "Discovery" here means finding
 * something in your own backlog, which is where the answer usually is: the reason
 * lines in the brief say so themselves ("already on your watchlist").
 */

/** A season and a bit: the length someone will start on a weeknight. */
const SHORT = 13;

/** What counts as "you liked this" when borrowing a title's genres. */
const LOVED = 9;

/** Untouched this long and it has slipped off the end of the list. */
const FORGOTTEN_DAYS = 120;

/** Below this many entries a genre is one you have barely tried. */
const RARE_GENRE_MAX = 3;

/** Per section. Enough to browse, few enough to read. */
const PER_SECTION = 6;

export type PickKind =
  | "onHold"
  | "shortPlanned"
  | "becauseYouLiked"
  | "finishedShort"
  | "rareGenre"
  | "forgotten";

export interface Pick {
  kind: PickKind;
  entry: Entry;
  /** Filled into the section's reason string. */
  /**
   * Values for the section's reason string. Deliberately named rather than reusing
   * `count`: i18next treats a `count` option as a pluralisation request and starts
   * looking for `_one`/`_other` keys, which is not what a line like "12 episodes"
   * wants. Only `dismissedCount` genuinely pluralises.
   */
  reason: {
    title?: string;
    score?: number;
    genre?: string;
    titles?: number;
    days?: number;
    episodes?: number;
    progress?: number;
    total?: number;
  };
}

export interface Section {
  kind: PickKind;
  picks: Pick[];
}

const daysSince = (iso: string): number => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return (Date.now() - then) / 86_400_000;
};

const isManga = (entry: Entry) => entry.media.type === "manga";

/**
 * Titles that are candidates to *start*: on the list, not begun, not finished.
 * Everything except the on-hold section draws from this pool, which is why a
 * completed title never turns up being recommended back to its owner.
 */
const unstarted = (entries: Entry[]) =>
  entries.filter((entry) => entry.status === "planned" && entry.progress === 0);

/** How many entries the user has in each genre, for "a genre you rarely watch". */
function genreCounts(entries: Entry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const genre of entry.media.genres ?? []) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * The sections, in the order they are offered.
 *
 * Ordered by how little the reader has to commit: picking up something already
 * begun costs nothing, a finished twelve-episode story costs an evening and cannot
 * leave them waiting on a broadcast, and trying an unfamiliar genre is the one that
 * asks them to take a chance. Empty sections are dropped rather than rendered
 * empty (§8).
 */
export function discoverySections(entries: Entry[], dismissed: Set<string>): Section[] {
  const key = (entry: Entry) => `${entry.media.provider}:${entry.media.provider_id}`;
  const live = entries.filter((entry) => !dismissed.has(key(entry)));
  const pool = unstarted(live);
  const used = new Set<number>();

  /** A title appears in one section only — the first that has a reason for it. */
  const take = (kind: PickKind, candidates: Pick[]): Section => {
    const picks: Pick[] = [];
    for (const pick of candidates) {
      if (used.has(pick.entry.id) || picks.length >= PER_SECTION) continue;
      used.add(pick.entry.id);
      picks.push(pick);
    }
    return { kind, picks };
  };

  // --- Continue something on hold ---
  const onHold = take(
    "onHold",
    live
      .filter((entry) => entry.status === "on_hold" && entry.progress > 0)
      .sort((a, b) => daysSince(b.updated_at) - daysSince(a.updated_at))
      .map((entry) => ({
        kind: "onHold" as const,
        entry,
        reason: {
          progress: entry.progress,
          total: entry.media.total_units ?? undefined,
        },
      })),
  );

  // --- Because you liked … ---
  // The reason names one title the reader scored 9+ and one genre they share, so
  // the line reads "Because you rated Frieren 9/10" and is literally true.
  // An anchor has to be something they actually watched, not merely something
  // carrying a score. Scores are independent of status here, so a title sitting
  // unstarted on the plan-to-watch list can hold a 9 from a previous life -- and
  // citing it would both claim they liked something they have not seen and let a
  // title appear as its own recommendation's reason.
  const loved = live
    .filter(
      (entry) =>
        (entry.score ?? 0) >= LOVED && (entry.status === "completed" || entry.progress > 0),
    )
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const becausePicks: Pick[] = [];
  for (const anchor of loved) {
    const anchorGenres = new Set(anchor.media.genres ?? []);
    if (anchorGenres.size === 0) continue;
    for (const candidate of pool) {
      if (candidate.id === anchor.id) continue;
      if (isManga(candidate) !== isManga(anchor)) continue;
      const shared = (candidate.media.genres ?? []).filter((g) => anchorGenres.has(g));
      if (shared.length < 2) continue;
      becausePicks.push({
        kind: "becauseYouLiked",
        entry: candidate,
        reason: { title: anchorTitle(anchor), score: anchor.score ?? undefined },
      });
    }
  }
  const because = take("becauseYouLiked", becausePicks);

  // --- Complete stories, under a cour ---
  // Computed *before* the looser "short" rule below, and that order is the whole
  // reason this section is ever non-empty: `take` gives a title to the first
  // section that asks for it, so the broader rule would otherwise swallow every
  // candidate this one wants and leave it permanently empty.
  //
  // "Complete" is the provider's own status, not a guess: a short run that is still
  // airing is not a story you can finish this week, which is the whole appeal.
  const finishedShort = take(
    "finishedShort",
    pool
      .filter((entry) => {
        const total = entry.media.total_units ?? 0;
        return entry.media.status === "FINISHED" && total > 0 && total <= SHORT;
      })
      .sort((a, b) => (b.media.average_score ?? 0) - (a.media.average_score ?? 0))
      .map((entry) => ({
        kind: "finishedShort" as const,
        entry,
        reason: { episodes: entry.media.total_units ?? undefined },
      })),
  );

  // --- Short shows already on the list ---
  const shortPlanned = take(
    "shortPlanned",
    pool
      .filter((entry) => {
        const total = entry.media.total_units ?? 0;
        return total > 0 && total <= SHORT;
      })
      .sort((a, b) => (a.media.total_units ?? 0) - (b.media.total_units ?? 0))
      .map((entry) => ({
        kind: "shortPlanned" as const,
        entry,
        reason: { episodes: entry.media.total_units ?? undefined },
      })),
  );

  // --- A genre you rarely watch ---
  const counts = genreCounts(live);
  const rarePicks: Pick[] = [];
  for (const entry of pool) {
    // The rarest genre this title carries, so the line names the one that makes it
    // unusual for this reader rather than whichever the provider listed first.
    let rarest: string | null = null;
    let rarestCount = Infinity;
    for (const genre of entry.media.genres ?? []) {
      const count = counts.get(genre) ?? 0;
      if (count > 0 && count <= RARE_GENRE_MAX && count < rarestCount) {
        rarest = genre;
        rarestCount = count;
      }
    }
    if (rarest) {
      rarePicks.push({ kind: "rareGenre", entry, reason: { genre: rarest, titles: rarestCount } });
    }
  }
  rarePicks.sort((a, b) => (a.reason.titles ?? 0) - (b.reason.titles ?? 0));
  const rareGenre = take("rareGenre", rarePicks);

  // --- Forgotten ---
  const forgotten = take(
    "forgotten",
    pool
      .filter((entry) => daysSince(entry.updated_at) >= FORGOTTEN_DAYS)
      .sort((a, b) => daysSince(b.updated_at) - daysSince(a.updated_at))
      .map((entry) => ({
        kind: "forgotten" as const,
        entry,
        reason: { days: Math.round(daysSince(entry.updated_at)) },
      })),
  );

  return [onHold, because, finishedShort, shortPlanned, rareGenre, forgotten].filter(
    (section) => section.picks.length > 0,
  );
}

/** The anchor's own name, for the "because you rated X" line. */
function anchorTitle(entry: Entry): string {
  const media = entry.media;
  return media.title_english || media.title_romaji || media.title_native || "";
}

export function pickKey(entry: Entry): string {
  return `${entry.media.provider}:${entry.media.provider_id}`;
}
