import type { Entry } from "../../lib/api-client";
import { groupByFranchise } from "../../lib/franchise";

/**
 * What the library says about the last few weeks, and what it suggests doing next.
 *
 * Both are read off entries the dashboard has already fetched. Nothing here is
 * stored or counted server-side: there is no activity log, so a claim like "you
 * watched 40 episodes this month" cannot be made honestly — `progress` is a running
 * total with no history behind it. What *is* dated is `start_date` and
 * `finish_date`, so the recap only says things those two can prove.
 *
 * §6 rules gimmicks out, which here means no streaks and no encouragement. A recap
 * is a statement of fact, and a suggestion names one title and the reason it came up.
 */

/** A show untouched for this long has been left, not paused. */
const STALE_DAYS = 30;

/** Three fills the row without turning the dashboard into a to-do list. */
const MAX_SUGGESTIONS = 3;

/** One kind twice is a pattern worth showing; three times is a filter, not advice. */
const MAX_PER_KIND = 2;

export interface Recap {
  /** Local midnight on the first of the month being summarised. */
  month: Date;
  finished: number;
  started: number;
  ongoing: number;
}

export type SuggestionKind = "finish" | "nextSeason" | "stale" | "rate";

export interface Suggestion {
  kind: SuggestionKind;
  entry: Entry;
  /** The season that leads into `entry`, for `nextSeason`. */
  after?: Entry;
}

/**
 * `new Date("2026-08-17")` is UTC midnight, which renders as the day before in any
 * negative offset — the same trap `calendarDate` documents. Stored dates are plain
 * calendar days, so they are built as local ones.
 */
function localDate(iso: string | null): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

const sameMonth = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

/**
 * The current calendar month, or null when it holds nothing worth reporting.
 *
 * Null rather than a row of zeroes: a recap that says you finished nothing is an
 * apology, and §8 asks for the section to be absent instead.
 */
export function monthRecap(entries: Entry[], now: Date = new Date()): Recap | null {
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  let finished = 0;
  let started = 0;
  let ongoing = 0;

  for (const entry of entries) {
    const done = localDate(entry.finish_date);
    if (done && sameMonth(done, now)) finished += 1;

    const begun = localDate(entry.start_date);
    if (begun && sameMonth(begun, now)) started += 1;

    if (entry.status === "current") ongoing += 1;
  }

  if (finished === 0 && started === 0) return null;
  return { month, finished, started, ongoing };
}

/**
 * Up to three things worth doing, most concrete first.
 *
 * The order is the order of how little is left to decide: finishing a season that
 * has one episode left needs no thought, while rating something you finished weeks
 * ago is housekeeping. A title appears once however many rules it satisfies.
 */
export function suggestions(entries: Entry[], now: Date = new Date()): Suggestion[] {
  const found: Suggestion[] = [];

  // 1. One unit from the end.
  for (const entry of entries) {
    const total = entry.media.total_units;
    if (entry.status === "current" && total && total - entry.progress === 1) {
      found.push({ kind: "finish", entry });
    }
  }

  // 2. A season you own, sitting unstarted behind one you finished. Selections are
  //    not passed: which season a *card* shows has no bearing on which is next.
  for (const franchise of groupByFranchise(entries)) {
    if (!franchise.isMultiSeason) continue;
    for (let i = 1; i < franchise.seasons.length; i += 1) {
      const previous = franchise.seasons[i - 1];
      const next = franchise.seasons[i];
      if (previous.status === "completed" && next.status === "planned" && next.progress === 0) {
        found.push({ kind: "nextSeason", entry: next, after: previous });
      }
    }
  }

  // 3. Started, then left alone.
  const staleBefore = now.getTime() - STALE_DAYS * 86_400_000;
  for (const entry of entries) {
    if (entry.status !== "current" || entry.progress === 0) continue;
    const touched = new Date(entry.updated_at).getTime();
    if (!Number.isNaN(touched) && touched < staleBefore) {
      found.push({ kind: "stale", entry });
    }
  }

  // 4. Finished and never scored.
  for (const entry of entries) {
    if (entry.status === "completed" && entry.score == null) {
      found.push({ kind: "rate", entry });
    }
  }

  const picked: Suggestion[] = [];
  const seen = new Set<number>();
  const perKind = new Map<SuggestionKind, number>();

  for (const suggestion of found) {
    if (picked.length >= MAX_SUGGESTIONS) break;
    if (seen.has(suggestion.entry.id)) continue;
    const used = perKind.get(suggestion.kind) ?? 0;
    if (used >= MAX_PER_KIND) continue;
    picked.push(suggestion);
    seen.add(suggestion.entry.id);
    perKind.set(suggestion.kind, used + 1);
  }

  return picked;
}
