import type { Media } from "../../lib/api-client";

export type SortOrder = "relevance" | "newest" | "score" | "title";

export interface SearchFilters {
  format: string | null;
  status: string | null;
  year: number | null;
  genres: string[];
  sort: SortOrder;
}

export const NO_FILTERS: SearchFilters = {
  format: null,
  status: null,
  year: null,
  genres: [],
  sort: "relevance",
};

/**
 * Filters live in the URL, like the query and the type before them, so a
 * filtered search survives a reload and can be sent to someone.
 */
export function readFilters(params: URLSearchParams): SearchFilters {
  const year = Number(params.get("year"));
  const sort = params.get("sort");
  return {
    format: params.get("format"),
    status: params.get("status"),
    year: Number.isFinite(year) && year > 0 ? year : null,
    genres: params.getAll("genre"),
    sort: sort === "newest" || sort === "score" || sort === "title" ? sort : "relevance",
  };
}

export function writeFilters(params: URLSearchParams, filters: SearchFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of ["format", "status", "year", "sort", "genre"]) next.delete(key);

  if (filters.format) next.set("format", filters.format);
  if (filters.status) next.set("status", filters.status);
  if (filters.year) next.set("year", String(filters.year));
  if (filters.sort !== "relevance") next.set("sort", filters.sort);
  for (const genre of filters.genres) next.append("genre", genre);
  return next;
}

/** How many facets are doing something — the number on the Filters button. */
export function activeCount(filters: SearchFilters): number {
  return (
    (filters.format ? 1 : 0) +
    (filters.status ? 1 : 0) +
    (filters.year ? 1 : 0) +
    filters.genres.length +
    (filters.sort === "relevance" ? 0 : 1)
  );
}

/**
 * The genres AniList actually uses. A fixed set, not one read off the results:
 * a search for "attack" surfaces Action and Drama, and a facet built from that
 * page could never offer Thriller -- so the one filter people reach for would
 * quietly be missing most of its options, and all of them before a first search.
 *
 * Adult titles are filtered out upstream, so its genre is not offered here.
 */
export const GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Ecchi",
  "Fantasy",
  "Horror",
  "Mahou Shoujo",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
];

/** What the current result set offers, so format, status and year are never dead ends. */
export interface FacetOptions {
  formats: string[];
  statuses: string[];
  years: number[];
  genres: string[];
}

export function facetsOf(results: Media[]): FacetOptions {
  const formats = new Set<string>();
  const statuses = new Set<string>();
  const years = new Set<number>();
  // Anything the provider returned that is not on the canonical list still gets
  // offered -- the list is the floor, not a whitelist.
  const genres = new Set<string>(GENRES);

  for (const media of results) {
    if (media.format) formats.add(media.format);
    if (media.status) statuses.add(media.status);
    if (media.season_year) years.add(media.season_year);
    for (const genre of media.genres) genres.add(genre);
  }

  return {
    formats: [...formats].sort(),
    statuses: [...statuses].sort(),
    years: [...years].sort((a, b) => b - a),
    genres: [...genres].sort(),
  };
}

const scoreOf = (media: Media) => media.average_score ?? -1;
const yearOf = (media: Media) => media.season_year ?? -1;

/**
 * Narrow and order a result set.
 *
 * Applied to the flat results before they are grouped, so a franchise is built
 * from the seasons that survived rather than being assembled and then gutted.
 */
export function applyFilters(results: Media[], filters: SearchFilters): Media[] {
  const kept = results.filter((media) => {
    if (filters.format && media.format !== filters.format) return false;
    if (filters.status && media.status !== filters.status) return false;
    if (filters.year && media.season_year !== filters.year) return false;
    return filters.genres.every((genre) => media.genres.includes(genre));
  });

  if (filters.sort === "relevance") return kept;

  const sorted = [...kept];
  if (filters.sort === "newest") sorted.sort((a, b) => yearOf(b) - yearOf(a));
  else if (filters.sort === "score") sorted.sort((a, b) => scoreOf(b) - scoreOf(a));
  else sorted.sort((a, b) => (a.title_romaji ?? "").localeCompare(b.title_romaji ?? ""));
  return sorted;
}

// --- recent searches ------------------------------------------------------

const RECENT_KEY = "anitrack-recent-searches";
const RECENT_MAX = 8;

export function readRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

/** Most recent first, no duplicates, capped. Returns the new list. */
export function rememberSearch(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return readRecent();
  const kept = [trimmed, ...readRecent().filter((q) => q.toLowerCase() !== trimmed.toLowerCase())];
  const capped = kept.slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(capped));
  } catch {
    /* private mode: the list simply does not persist */
  }
  return capped;
}

export function forgetSearches(): void {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    /* nothing to clean up */
  }
}
