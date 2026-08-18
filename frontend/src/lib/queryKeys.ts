import type { EntryStatus, MediaType } from "./api-client";

/** Every cache key in one place, so invalidation never guesses at a string. */
export const queryKeys = {
  instance: ["instance"] as const,
  me: ["me"] as const,
  users: ["users"] as const,
  dashboard: ["dashboard"] as const,
  /** Sorted, so picking the same genres in either order is one cache entry. */
  search: (q: string, type: MediaType, genres: string[] = []) =>
    ["search", type, q, [...genres].sort().join(",")] as const,
  trending: (type: MediaType) => ["trending", type] as const,
  media: (provider: string, id: string, type: MediaType) =>
    ["media", provider, id, type] as const,
  entries: (filters: { type?: MediaType; status?: EntryStatus | "all"; sort?: string } = {}) =>
    ["entries", filters] as const,
  entryForMedia: (provider: string, id: string) => ["entry-for-media", provider, id] as const,
  /** Keyed by the season asked about: any member of a chain answers for all of it. */
  series: (provider: string, id: string) => ["series", provider, id] as const,
  seasonSelections: ["season-selections"] as const,
  importJob: (id: number) => ["import-job", id] as const,

  friends: ["friends"] as const,
  friendsWatching: ["friends-watching"] as const,
  recommendations: ["recommendations"] as const,
  feed: ["feed"] as const,
  schedule: ["schedule"] as const,
  discover: ["discover"] as const,
  leaderboard: ["leaderboard"] as const,
  userSearch: (q: string) => ["user-search", q] as const,
  profile: (username: string) => ["profile", username] as const,
  compare: (username: string) => ["compare", username] as const,
};

/**
 * Anything that changes a list entry invalidates all of these. `series` is in the
 * list because it carries a copy of the entry for every season it lists — progress
 * shown in the season switcher would otherwise go stale the moment it is edited.
 */
export const listEntryScopes = [
  ["entries"],
  ["dashboard"],
  ["entry-for-media"],
  ["series"],
  // Deliberately not `recommendations`. Adding a title does remove it from the
  // server's answer, so invalidating here would make the card vanish from under
  // the pointer that just clicked it. The card reports its own state instead --
  // it asks whether the title is on the list -- and the list refreshes on the
  // next visit.
] as const;

/**
 * Accepting or removing a friend changes who you may see, so the profile and
 * compare caches are as stale as the friend list itself.
 */
export const friendScopes = [
  ["friends"],
  ["friends-watching"],
  ["recommendations"],
  ["feed"],
  ["profile"],
  ["compare"],
  ["discover"],
  ["leaderboard"],
] as const;
