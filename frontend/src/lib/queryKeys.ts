import type { EntryStatus, MediaType } from "./api-client";

/** Every cache key in one place, so invalidation never guesses at a string. */
export const queryKeys = {
  instance: ["instance"] as const,
  me: ["me"] as const,
  users: ["users"] as const,
  dashboard: ["dashboard"] as const,
  search: (q: string, type: MediaType) => ["search", type, q] as const,
  media: (provider: string, id: string, type: MediaType) =>
    ["media", provider, id, type] as const,
  entries: (filters: { type?: MediaType; status?: EntryStatus | "all"; sort?: string } = {}) =>
    ["entries", filters] as const,
  entryForMedia: (provider: string, id: string) => ["entry-for-media", provider, id] as const,
  importJob: (id: number) => ["import-job", id] as const,

  friends: ["friends"] as const,
  feed: ["feed"] as const,
  schedule: ["schedule"] as const,
  discover: ["discover"] as const,
  leaderboard: ["leaderboard"] as const,
  userSearch: (q: string) => ["user-search", q] as const,
  profile: (username: string) => ["profile", username] as const,
  compare: (username: string) => ["compare", username] as const,
};

/** Anything that changes a list entry invalidates all three of these. */
export const listEntryScopes = [["entries"], ["dashboard"], ["entry-for-media"]] as const;

/**
 * Accepting or removing a friend changes who you may see, so the profile and
 * compare caches are as stale as the friend list itself.
 */
export const friendScopes = [
  ["friends"],
  ["feed"],
  ["profile"],
  ["compare"],
  ["discover"],
  ["leaderboard"],
] as const;
