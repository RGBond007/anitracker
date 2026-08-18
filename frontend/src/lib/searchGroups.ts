import type { Media, TitleLanguage } from "./api-client";
import { baseTitle } from "./franchise";
import { displayTitle } from "./titles";

/**
 * What a title is within its franchise. Mirrors `season_chain.kind_for` on the
 * server, so a movie reads as a movie on the search page and on the title page.
 */
export type MemberKind = "season" | "movie" | "ova" | "special" | "other";

const KIND_BY_FORMAT: Record<string, MemberKind> = {
  TV: "season",
  ONA: "season",
  TV_SHORT: "special",
  MOVIE: "movie",
  OVA: "ova",
  SPECIAL: "special",
  MUSIC: "special",
  MANGA: "season",
  NOVEL: "season",
  ONE_SHOT: "special",
};

export function kindOf(media: Media): MemberKind {
  if (!media.format) return "season";
  return KIND_BY_FORMAT[media.format.toUpperCase()] ?? "other";
}

/** One show and everything of it the search turned up. */
export interface SearchFranchise {
  key: string;
  title: string;
  /** The show itself: the head of the chain, which is what the card is about. */
  main: Media;
  /** The numbered spine, in the order it aired. */
  seasons: Media[];
  /** Movies, OVAs, specials and anything else hanging off it. */
  extras: Media[];
  /** Everything, for the callers that just want a count. */
  members: Media[];
}

/** Sorts undated announcements last, where an unaired season belongs. */
function airedAt(media: Media): number {
  if (media.start_date) {
    const time = new Date(media.start_date).getTime();
    if (!Number.isNaN(time)) return time;
  }
  // A year alone is placed at the start of that year: enough to order it against
  // other years, and honest about not knowing the day.
  return media.season_year ? new Date(media.season_year, 0, 1).getTime() : Number.MAX_SAFE_INTEGER;
}

/**
 * Union-find over the result set. Two titles end up in one group only because
 * the provider said they are linked, never because their names look alike.
 */
class Groups {
  private parent = new Map<string, string>();

  find(id: string): string {
    const seen = this.parent.get(id);
    if (seen === undefined || seen === id) {
      if (seen === undefined) this.parent.set(id, id);
      return id;
    }
    const root = this.find(seen);
    this.parent.set(id, root);
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootB, rootA);
  }
}

/**
 * Collapse a flat result list into one entry per show.
 *
 * Searching "attack on titan" returns six rows of the same show, which buries
 * every other match. What joins them is AniList's own relation data: each result
 * names its prequel, its sequel and the series it is an extra of, and this walks
 * those edges within the result set. Titles are never compared, so "Fate/Zero"
 * and "Fate/stay night" stay apart and a season with an unrelated name still
 * joins its own show.
 *
 * Providers that report no relations at all -- Jikan and Kitsu -- would leave
 * every result standalone, so for *those* results only, the old name-based
 * grouping is used as a fallback. It is never applied to a result that came with
 * edges, which is what keeps a bad guess from overriding a known fact.
 */
export function groupSearchResults(results: Media[], lang: TitleLanguage): SearchFranchise[] {
  const byId = new Map(results.map((m) => [m.provider_id, m]));
  const groups = new Groups();

  const hasEdges = (media: Media) =>
    Boolean(media.prequel_id || media.sequel_id || media.parent_id || media.related_ids?.length);

  for (const media of results) {
    groups.find(media.provider_id);
    // Only ever joined to something that is *also* in these results: a sequel the
    // search did not return is not a member of anything shown here.
    for (const id of [media.prequel_id, media.sequel_id, media.parent_id]) {
      if (id && byId.has(id)) groups.union(media.provider_id, id);
    }
    for (const id of media.related_ids ?? []) {
      if (byId.has(id)) groups.union(media.provider_id, id);
    }
  }

  // Fallback for results the provider gave no edges for at all.
  const nameKeys = new Map<string, string>();
  for (const media of results) {
    if (hasEdges(media)) continue;
    const name = baseTitle(displayTitle(media, lang)).toLowerCase();
    const first = nameKeys.get(name);
    if (first) groups.union(first, media.provider_id);
    else nameKeys.set(name, media.provider_id);
  }

  const buckets = new Map<string, Media[]>();
  for (const media of results) {
    const key = groups.find(media.provider_id);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(media);
    else buckets.set(key, [media]);
  }

  const out: SearchFranchise[] = [];
  for (const [key, members] of buckets) {
    const ordered = [...members].sort((a, b) => airedAt(a) - airedAt(b));
    const seasons = ordered.filter((m) => kindOf(m) === "season");
    const extras = ordered.filter((m) => kindOf(m) !== "season");

    // The show is named after its first season, not after whichever member the
    // search matched best -- and never after a movie when there are seasons.
    const main = chainHead(seasons) ?? ordered[0];

    out.push({
      key,
      title: baseTitle(displayTitle(main, lang)),
      main,
      seasons,
      extras,
      members: ordered,
    });
  }

  // Groups keep the provider's own relevance order, taken from wherever the
  // group's best-matching member appeared.
  const rank = new Map(results.map((m, i) => [m.provider_id, i]));
  const best = (group: SearchFranchise) =>
    Math.min(...group.members.map((m) => rank.get(m.provider_id) ?? 0));
  out.sort((a, b) => best(a) - best(b));
  return out;
}

/**
 * The first season, found by walking prequel links rather than trusting dates.
 *
 * A split cour is often dated the same as the half before it, and a "Final
 * Season Part 2" can carry the date of its announcement. Following the chain
 * backwards is what gets those right; the date sort is only the tie-break for
 * members the chain does not reach.
 */
function chainHead(seasons: Media[]): Media | null {
  if (seasons.length === 0) return null;
  const within = new Set(seasons.map((m) => m.provider_id));
  const headed = seasons.filter((m) => !m.prequel_id || !within.has(m.prequel_id));
  // Exactly one member with no prequel inside the group is a clean chain. More
  // than one means the search returned two disjoint runs, and the earliest wins.
  return headed[0] ?? seasons[0];
}

/**
 * "Season 2", or a real subtitle where the provider gave one.
 *
 * Numbered by position in the aired order rather than by parsing the name: a
 * show whose second season is called "Final Season" has no 2 in it anywhere.
 */
export function seasonLabel(
  media: Media,
  index: number,
  seriesTitle: string,
  lang: TitleLanguage,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const full = displayTitle(media, lang);
  const rest = full.toLowerCase().startsWith(seriesTitle.toLowerCase())
    ? full.slice(seriesTitle.length).replace(/^[\s:·・-]+/, "")
    : "";
  // A subtitle that is itself just "Season 3" adds nothing over the number.
  if (rest && !/^(?:season\s*\d+|\d+(?:st|nd|rd|th)\s*season)$/i.test(rest)) return rest;
  return t("season.short", { n: index + 1 });
}
