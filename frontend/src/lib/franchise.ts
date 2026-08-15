import type { Entry } from "./api-client";

/**
 * A show, with every season of it the user owns.
 *
 * The library used to show one card per season — four for Tokyo Ghoul, five for
 * Re:ZERO — which buried the handful of things actually being watched. Grouping
 * folds them into one card that follows whichever season you are on.
 */
export interface Franchise {
  /** `root_provider_id`, or the entry's own id when the chain is unresolved. */
  key: string;
  /** Every owned season, ascending. A standalone title is a chain of one. */
  seasons: Entry[];
  /** The season the card represents: what you are watching, else the furthest. */
  active: Entry;
  /** True once there is more than one season to speak of. */
  isMultiSeason: boolean;
}

/** Strips "Season 3", "3rd Season", "Part 2" so the card can show the show's name. */
export function baseTitle(title: string): string {
  return (
    title
      .replace(/\s*(?::|-)?\s*(?:Season\s*\d+|\d+(?:st|nd|rd|th)\s*Season)\b/gi, "")
      .replace(/\s*Part\s*\d+\b/gi, "")
      .replace(/\s*[-:·]\s*$/, "")
      .trim() || title
  );
}

const seasonOf = (e: Entry) => e.media.season_number ?? 1;

export function groupByFranchise(entries: Entry[]): Franchise[] {
  const buckets = new Map<string, Entry[]>();
  for (const entry of entries) {
    // Unresolved chains fall back to their own id, so a title never disappears
    // just because the provider had no relation data for it.
    const key = entry.media.root_provider_id ?? `solo:${entry.media.provider_id}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(entry);
    else buckets.set(key, [entry]);
  }

  const out: Franchise[] = [];
  for (const [key, seasons] of buckets) {
    seasons.sort((a, b) => seasonOf(a) - seasonOf(b));
    // Watching wins over finished; among several, the furthest along.
    const watching = seasons.filter((e) => e.status === "current");
    const active =
      watching.length > 0 ? watching[watching.length - 1] : seasons[seasons.length - 1];
    out.push({ key, seasons, active, isMultiSeason: seasons.length > 1 });
  }

  // Keep the caller's ordering: franchises appear where their active season was.
  const rank = new Map(entries.map((e, i) => [e.id, i]));
  out.sort((a, b) => (rank.get(a.active.id) ?? 0) - (rank.get(b.active.id) ?? 0));
  return out;
}

/**
 * The next season that exists but is not on the list yet — the thing the card
 * offers once you finish the one you are on.
 */
export function nextSeasonId(franchise: Franchise): string | null {
  const { active, seasons } = franchise;
  if (active.status !== "completed") return null;
  const sequel = active.media.sequel_id;
  if (!sequel) return null;
  const owned = new Set(seasons.map((e) => e.media.provider_id));
  return owned.has(sequel) ? null : sequel;
}
