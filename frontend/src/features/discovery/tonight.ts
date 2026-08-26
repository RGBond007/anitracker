import type { Entry, MediaType } from "../../lib/api-client";

/**
 * "What should I watch tonight?" — a queue of three, argued from the library.
 *
 * The same contract as discovery: every rule is arithmetic over entries the app
 * already holds, and every pick carries the reason it surfaced, as structured
 * parts the component translates. Nothing is predicted and nothing is stored;
 * the queue is an answer to a question asked right now, not a feed.
 */

export interface TonightOptions {
  /** The evening being planned, not a preference: one sitting's worth. */
  minutes: 25 | 50 | 90;
  /** Start something new, or carry on with something begun. */
  fresh: boolean;
  type: MediaType;
  /** A single genre to hold the queue to, or null for anything. */
  genre: string | null;
  /** Prefer titles friends are involved with. A preference, never a hard filter. */
  withFriends: boolean;
}

/** How a friend relates to a candidate title, for the reason line. */
export interface FriendSignal {
  name: string;
  kind: "watching" | "sent" | "loved";
}

/** One translated-later reason fragment. */
export type Reason =
  | { kind: "fitEpisodes"; units: number; minutes: number }
  | { kind: "fitChapters"; units: number }
  | { kind: "fitMovie"; minutes: number }
  | { kind: "finishable"; left: number }
  | { kind: "progress"; progress: number; total: number | null }
  | { kind: "onHold"; days: number }
  | { kind: "untouched"; days: number }
  | { kind: "friendWatching"; name: string }
  | { kind: "friendSent"; name: string }
  | { kind: "friendLoved"; name: string };

export interface TonightPick {
  entry: Entry;
  reasons: Reason[];
}

/**
 * Chapters that fit a sitting. Manga carries no duration, so this is a stated
 * rough equivalence rather than arithmetic — the reason line says "about".
 */
const CHAPTERS_FOR: Record<TonightOptions["minutes"], number> = { 25: 3, 50: 6, 90: 10 };

const DEFAULT_EPISODE_MINUTES = 24;

const daysSince = (iso: string): number => {
  const then = new Date(iso).getTime();
  return Number.isNaN(then) ? 0 : Math.round((Date.now() - then) / 86_400_000);
};

/**
 * Every candidate the options allow, best first.
 *
 * Returned in full rather than cut to three: the queue shows the first three, and
 * "replace" walks further down this same ranking — so a replacement is always the
 * next-best argument, not a reshuffle.
 */
export function tonightQueue(
  entries: Entry[],
  options: TonightOptions,
  friends: Map<string, FriendSignal[]> = new Map(),
): TonightPick[] {
  const isManga = options.type === "manga";

  const pool = entries.filter((entry) => {
    if (entry.media.type !== options.type) return false;
    if (options.genre && !(entry.media.genres ?? []).includes(options.genre)) return false;
    if (options.fresh) return entry.status === "planned" && entry.progress === 0;
    return (
      (entry.status === "current" || entry.status === "on_hold") &&
      entry.progress > 0 &&
      (entry.media.total_units == null || entry.progress < entry.media.total_units)
    );
  });

  const picks: (TonightPick & { rank: number })[] = [];

  for (const entry of pool) {
    const media = entry.media;
    const signals = friends.get(`${media.provider}:${media.provider_id}`) ?? [];
    const reasons: Reason[] = [];
    let rank = 0;

    // --- does it fit the sitting? ---
    if (isManga) {
      const units = Math.min(
        CHAPTERS_FOR[options.minutes],
        remaining(entry) ?? CHAPTERS_FOR[options.minutes],
      );
      if (units < 1) continue;
      reasons.push({ kind: "fitChapters", units });
    } else {
      const perEpisode = media.duration || DEFAULT_EPISODE_MINUTES;
      if (perEpisode > options.minutes) continue; // an episode that cannot fit is out
      const isMovie = media.format === "MOVIE" || media.total_units === 1;
      if (isMovie) {
        reasons.push({ kind: "fitMovie", minutes: perEpisode });
        // A movie that ends with the evening is the best possible fit.
        rank += options.minutes - perEpisode < perEpisode ? 3 : 1;
      } else {
        const fit = Math.max(1, Math.floor(options.minutes / perEpisode));
        const left = remaining(entry);
        const units = left != null ? Math.min(fit, left) : fit;
        reasons.push({ kind: "fitEpisodes", units, minutes: units * perEpisode });
        // Little of the sitting wasted is a better answer to "I have 50 minutes".
        rank += 2 - Math.min(2, (options.minutes - units * perEpisode) / options.minutes);
        if (left != null && left <= fit) {
          reasons.push({ kind: "finishable", left });
          rank += 3; // finishing something tonight beats everything else
        }
      }
    }

    // --- why this one? ---
    if (!options.fresh) {
      reasons.push({ kind: "progress", progress: entry.progress, total: media.total_units ?? null });
      if (entry.status === "on_hold") {
        reasons.push({ kind: "onHold", days: daysSince(entry.updated_at) });
        rank += 1; // picking something back up is what "continue" is for
      } else {
        // Mid-story and warm: the more recently touched, the easier to resume.
        rank += Math.max(0, 1 - daysSince(entry.updated_at) / 30);
      }
    } else {
      const wait = daysSince(entry.updated_at);
      if (wait >= 60) reasons.push({ kind: "untouched", days: wait });
      rank += (media.average_score ?? 0) / 100; // gentle tiebreak, never the argument
    }

    for (const signal of signals.slice(0, 1)) {
      reasons.push(
        signal.kind === "watching"
          ? { kind: "friendWatching", name: signal.name }
          : signal.kind === "sent"
            ? { kind: "friendSent", name: signal.name }
            : { kind: "friendLoved", name: signal.name },
      );
      if (options.withFriends) rank += 2;
    }

    picks.push({ entry, reasons, rank });
  }

  picks.sort((a, b) => b.rank - a.rank);
  return picks.map(({ entry, reasons }) => ({ entry, reasons }));
}

function remaining(entry: Entry): number | null {
  const total = entry.media.total_units;
  return total == null ? null : Math.max(0, total - entry.progress);
}

/** The genres actually present in the pool the options would draw from — for the picker. */
export function genresAvailable(entries: Entry[], type: MediaType): string[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.media.type !== type || entry.status === "dropped") continue;
    for (const genre of entry.media.genres ?? []) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([genre]) => genre).slice(0, 8);
}
